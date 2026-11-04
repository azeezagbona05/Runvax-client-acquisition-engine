import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { RULE_SIGNALS } from './config/schema';
import { recordSignal } from './signals';
import { enqueueAcqTask } from './tasks/queue';
import { TERMINAL } from './lifecycle';
import { maskContactValues } from './web/extract';
import { registrableDomain } from './web/url';
import { invalidateStaleDrafts, DraftError } from './drafts';

/**
 * Manually entered evidence: an admin records something they observed on the
 * clinic's own website. It is stored like an extracted signal (basis
 * "observed", method "manual") with the page it was seen on, so a pitch can
 * cite it, and it re-runs the audit and scoring so findings and drafts stay in
 * step with it. No fetch happens: the admin looked at the page themselves.
 */

// Signals that can be seen on a website. appointment_driven comes from the
// industry config and pagespeed_mobile_poor from PageSpeed, so neither can be
// entered by hand.
const MANUAL_SIGNALS = RULE_SIGNALS.filter((s) => s !== 'appointment_driven' && s !== 'pagespeed_mobile_poor') as [string, ...string[]];

const common = {
  sourceUrl: z.string().trim().min(8).max(500),
  note: z.string().trim().min(3).max(300),
  confidence: z.enum(['low', 'medium', 'high']),
  attest: z.literal(true),
};

// One observation (original form), or several seen on the same page in one go.
export const ManualEvidenceSchema = z.strictObject({ code: z.enum(MANUAL_SIGNALS), value: z.boolean(), ...common });
export const ManualEvidenceBatchSchema = z.strictObject({
  items: z.array(z.strictObject({ code: z.enum(MANUAL_SIGNALS), value: z.boolean() })).min(1).max(MANUAL_SIGNALS.length)
    .refine((xs) => new Set(xs.map((x) => x.code)).size === xs.length, 'each signal may appear once'),
  ...common,
});
export async function addManualEvidence(userId: string, actor: string, acqProspectId: string, body: unknown) {
  const isBatch = typeof body === 'object' && body !== null && 'items' in body;
  const d = isBatch ? ManualEvidenceBatchSchema.parse(body) : (() => { const one = ManualEvidenceSchema.parse(body); return { ...one, items: [{ code: one.code, value: one.value }] }; })();
  const acq = await prisma.acquisitionProspect.findFirst({ where: { id: acqProspectId, userId } });
  if (!acq) throw new DraftError('Prospect not found');
  if ((TERMINAL as string[]).includes(acq.state)) throw new DraftError(`Prospect is ${acq.state}`);
  if (!acq.orgDomain) throw new DraftError('This prospect has no website domain to attribute evidence to');

  let url: URL;
  try { url = new URL(d.sourceUrl); } catch { throw new DraftError('sourceUrl must be a full http(s) URL'); }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new DraftError('sourceUrl must be http(s)');
  if (url.username || url.password) throw new DraftError('sourceUrl must not contain credentials');
  let domain: string;
  try { domain = registrableDomain(url.hostname); } catch { throw new DraftError('sourceUrl host is not a public website'); }
  if (domain !== acq.orgDomain) throw new DraftError(`Evidence must come from the clinic's own website (${acq.orgDomain})`);

  const masked = maskContactValues(d.note);
  const recorded: Array<{ code: string; value: boolean; id: string; created: boolean }> = [];
  for (const item of d.items) {
    const sig = await recordSignal({
      userId, acqProspectId: acq.id, code: item.code, value: item.value, basis: 'observed', method: 'manual',
      confidence: d.confidence, sourceUrl: url.toString(), quote: `Manually observed: ${masked}`,
    });
    recorded.push({ code: item.code, value: item.value, id: sig.id, created: sig.created });
  }
  // One event and ONE audit for the whole submission (the audit re-reads all signals), however many were entered.
  const summary = recorded.map((r) => `${r.code} = ${r.value}${r.created ? '' : ' (re-confirmed)'}`).join('; ');
  await prisma.acquisitionPipelineEvent.create({
    data: { userId, acqProspectId: acq.id, fromState: acq.state, toState: acq.state, reason: `Manual evidence: ${summary}`.slice(0, 900), actor },
  });
  const runKey = `manual-evidence-${recorded[0].id}-${Date.now()}`.slice(0, 64);
  await enqueueAcqTask({ userId, type: 'acq.audit', acqProspectId: acq.id, input: { industryKey: acq.industryKey, runKey } });
  const invalidated = await invalidateStaleDrafts(userId, acq.id, 'evidence changed');
  return {
    ok: true,
    // Single-signal callers keep the original response shape.
    signalId: recorded[0].id, created: recorded.some((r) => r.created),
    signals: recorded.map((r) => ({ code: r.code, value: r.value, signalId: r.id, created: r.created })),
    queued: 'acq.audit', invalidatedDrafts: invalidated,
  };
}
