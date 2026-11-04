import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/phone';
import { addSuppression, findSuppressionHits, normalizeEmail, emailDomain } from './suppression';
import { cancelAcqTasks } from './tasks/queue';
import { purgeDomainPageCache } from './web/pageCache';
import { blockDrafts } from './drafts';

/**
 * Contact points on an acquisition prospect.
 *
 *   role_inbox      a role address (info@, reception@…) published by the clinic
 *   business_phone  the clinic's published phone / WhatsApp number
 *   manual_named    a named person — ONLY ever entered by an admin (manual
 *                   entry or an import's contact_* columns) with a source and
 *                   a lawful basis. Never extracted or inferred automatically.
 *
 * Every write checks the suppression list / tombstones first: a suppressed or
 * erased value is dropped, never stored.
 */

export type ContactKind = 'role_inbox' | 'business_phone' | 'manual_named';

const EMAIL_RE = /^[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

export function isEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim());
}

/** "role" only when the local part is a configured role word (exact, or role+suffix like info.lekki). */
export function classifyEmail(email: string, roleLocalParts: string[]): 'role' | 'named' | 'invalid' {
  const e = normalizeEmail(email);
  if (!isEmail(e)) return 'invalid';
  const local = e.split('@')[0];
  const head = local.split(/[._+-]/)[0];
  return roleLocalParts.includes(local) || roleLocalParts.includes(head) ? 'role' : 'named';
}

export function contactKey(kind: ContactKind, value: string): string {
  return crypto.createHash('sha256').update(`${kind}:${value}`).digest('hex');
}

export type StoreResult = { stored: true; id: string; duplicateOf?: string } | { stored: false; reason: 'suppressed' | 'invalid' | 'exists' };

export async function storeContact(params: {
  userId: string;
  acqProspectId: string;
  kind: ContactKind;
  email?: string | null;
  phone?: string | null;
  name?: string | null;
  role?: string | null;
  sourceId?: string | null;
  sourceUrl?: string | null;
  sourceNote?: string | null;
  evidenceQuote?: string | null;
  confidence: 'low' | 'medium' | 'high';
  lawfulBasis?: string;
  retainDays?: number;
  now?: Date;
}): Promise<StoreResult> {
  const now = params.now ?? new Date();
  const email = params.email ? normalizeEmail(params.email) : null;
  const phone = params.phone ? normalizePhone(params.phone) : null;
  if (email && !isEmail(email)) return { stored: false, reason: 'invalid' };
  if (params.kind === 'business_phone' && (!phone || phone.length < 10)) return { stored: false, reason: 'invalid' };
  if (params.kind === 'manual_named' && !params.name?.trim()) return { stored: false, reason: 'invalid' };

  const hits = await findSuppressionHits(params.userId, { email, phone });
  if (hits.length > 0) return { stored: false, reason: 'suppressed' };

  const keyValue = params.kind === 'business_phone' ? phone! : params.kind === 'role_inbox' ? email! : `${(params.name ?? '').trim().toLowerCase()}|${email ?? ''}|${phone ?? ''}`;
  const key = contactKey(params.kind, keyValue);

  // Same address on another prospect (e.g. a group inbox): stored, but flagged,
  // and only the first holder counts for contactability.
  let duplicateOf: string | undefined;
  if (email) {
    const other = await prisma.acquisitionDecisionMaker.findFirst({
      where: { userId: params.userId, email, acqProspectId: { not: params.acqProspectId } },
      select: { acqProspectId: true },
    });
    duplicateOf = other?.acqProspectId;
  }

  try {
    const row = await prisma.acquisitionDecisionMaker.create({
      data: {
        userId: params.userId,
        acqProspectId: params.acqProspectId,
        kind: params.kind,
        contactKey: key,
        email,
        phone,
        name: params.kind === 'manual_named' ? params.name!.trim().slice(0, 190) : null,
        role: params.role?.trim().slice(0, 190) ?? null,
        channel: email ? 'email' : 'phone',
        verification: 'unverified',
        sourceId: params.sourceId ?? null,
        sourceUrl: params.sourceUrl ?? null,
        sourceNote: params.sourceNote?.slice(0, 1000) ?? null,
        evidenceQuote: params.evidenceQuote?.slice(0, 300) ?? null,
        confidence: params.confidence,
        lawfulBasis: params.lawfulBasis ?? 'legitimate_interest_b2b',
        observedAt: now,
        lastVerifiedAt: now,
        // Provisional (pending privacy review): only named contacts carry a retention date.
        retainUntil: params.kind === 'manual_named' && params.retainDays ? new Date(now.getTime() + params.retainDays * 86_400_000) : null,
        flags: duplicateOf ? ({ duplicateOf } as Prisma.InputJsonValue) : undefined,
      },
    });
    return { stored: true, id: row.id, duplicateOf };
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      // Same contact seen again: refresh verification time, nothing new stored.
      await prisma.acquisitionDecisionMaker.updateMany({
        where: { acqProspectId: params.acqProspectId, contactKey: key },
        data: { lastVerifiedAt: now },
      });
      return { stored: false, reason: 'exists' };
    }
    throw err;
  }
}

/** Replaces any occurrence of the given emails / phones in free text (linear, bounded patterns). */
export function redactValues(text: string, emails: Set<string>, phones: Set<string>): string {
  if (!text) return text;
  return text
    .replace(/[^\s@<>"'(),;:]{1,64}@[^\s@<>"'(),;:]{1,253}/g, (m) => (emails.has(m.toLowerCase().replace(/^mailto:/, '').replace(/[.]+$/, '')) ? '[erased]' : m))
    .replace(/\+?\d[\d\s().-]{5,24}\d/g, (m) => (phones.has(normalizePhone(m)) ? '[erased]' : m));
}

/**
 * Erasure (an admin action, e.g. on request). Removes the prospect's contact
 * values from EVERY place the engine wrote them, and tombstones them so no
 * import, extractor or provider can bring them back:
 *   - contact rows (deleted), and phone duplicate-detection keys equal to an
 *     erased number (deleted)
 *   - evidence quotes and string values of signals, finding text, source
 *     URLs and event reasons (redacted)
 *   - the engine-created CRM record's businessData phone/email (removed) —
 *     a pre-existing CRM record the engine merely linked to is NOT modified
 *     (crmRecordNotModified: true) and must be handled in the CRM
 *   - unexpired import previews holding the values (rows cleared)
 *   - cached pages for the domain or containing a value (deleted)
 * Then pending tasks are cancelled and a PII-free event is recorded.
 */
export async function eraseContacts(params: {
  userId: string; acqProspectId: string; reason: 'erasure' | 'objection' | 'opt_out'; actor: string; domain?: string | null;
}): Promise<{ erased: number; redacted: number; crmRecordNotModified: boolean }> {
  const { userId, acqProspectId } = params;
  const acq = await prisma.acquisitionProspect.findFirst({ where: { id: acqProspectId, userId } });
  const prospect = acq ? await prisma.prospect.findFirst({ where: { id: acq.prospectId, userId }, select: { id: true, source: true, businessData: true } }) : null;
  const engineOwned = prospect?.source === 'industry-acquisition';

  const contacts = await prisma.acquisitionDecisionMaker.findMany({ where: { userId, acqProspectId }, select: { id: true, email: true, phone: true } });
  const emails = new Set<string>();
  const phones = new Set<string>();
  for (const c of contacts as Array<{ email: string | null; phone: string | null }>) {
    if (c.email) emails.add(normalizeEmail(c.email));
    if (c.phone) { const p = normalizePhone(c.phone); if (p) phones.add(p); }
  }
  // Values that only exist in the engine-created CRM record (from the import).
  const data = (engineOwned ? (prospect?.businessData ?? {}) : {}) as Record<string, unknown>;
  if (typeof data.email === 'string' && isEmail(data.email)) emails.add(normalizeEmail(data.email));
  if (typeof data.phone === 'string') { const p = normalizePhone(data.phone); if (p.length >= 10) phones.add(p); }

  for (const e of Array.from(emails)) await addSuppression({ userId, kind: 'email', value: e, reason: params.reason, source: `erase:${params.actor}` });
  for (const ph of Array.from(phones)) await addSuppression({ userId, kind: 'phone', value: ph, reason: params.reason, source: `erase:${params.actor}` });

  const del = await prisma.acquisitionDecisionMaker.deleteMany({ where: { userId, acqProspectId } });
  let redacted = 0;
  // Duplicate-detection keys that are the erased phone numbers themselves.
  if (phones.size > 0) {
    const ids = await prisma.acquisitionIdentity.deleteMany({ where: { userId, acqProspectId, kind: 'phone', value: { in: Array.from(phones) } } });
    redacted += ids.count;
  }
  const red = (t: string | null | undefined) => (typeof t === 'string' ? redactValues(t, emails, phones) : t);

  for (const sgl of await prisma.acquisitionSignal.findMany({ where: { userId, acqProspectId }, select: { id: true, evidenceQuote: true, value: true } }) as Array<{ id: string; evidenceQuote: string | null; value: unknown }>) {
    const q = red(sgl.evidenceQuote);
    const v = typeof sgl.value === 'string' ? red(sgl.value) : sgl.value;
    if (q !== sgl.evidenceQuote || v !== sgl.value) {
      await prisma.acquisitionSignal.updateMany({ where: { id: sgl.id }, data: { evidenceQuote: q ?? null, ...(typeof v === 'string' ? { value: v } : {}) } });
      redacted++;
    }
  }
  for (const f of await prisma.acquisitionFinding.findMany({ where: { userId, acqProspectId }, select: { id: true, finding: true, evidence: true } }) as Array<{ id: string; finding: string; evidence: string }>) {
    const fe = red(f.evidence)!; const ff = red(f.finding)!;
    if (fe !== f.evidence || ff !== f.finding) { await prisma.acquisitionFinding.updateMany({ where: { id: f.id }, data: { evidence: fe, finding: ff } }); redacted++; }
  }
  for (const src of await prisma.acquisitionSource.findMany({ where: { userId, acqProspectId }, select: { id: true, url: true } }) as Array<{ id: string; url: string | null }>) {
    const u = red(src.url);
    if (u !== src.url) { await prisma.acquisitionSource.updateMany({ where: { id: src.id }, data: { url: u ?? null } }); redacted++; }
  }
  for (const ev of await prisma.acquisitionPipelineEvent.findMany({ where: { userId, acqProspectId }, select: { id: true, reason: true } }) as Array<{ id: string; reason: string }>) {
    const r = red(ev.reason)!;
    if (r !== ev.reason) { await prisma.acquisitionPipelineEvent.updateMany({ where: { id: ev.id }, data: { reason: r } }); redacted++; }
  }

  // Drafts may quote a named recipient; review notes and outcome notes are free text.
  const draftIds = (await prisma.acquisitionDraft.findMany({ where: { userId, acqProspectId }, select: { id: true } }) as Array<{ id: string }>).map((d) => d.id);
  for (const a of draftIds.length ? await prisma.acquisitionApproval.findMany({ where: { userId, draftId: { in: draftIds } }, select: { id: true, note: true } }) as Array<{ id: string; note: string | null }> : []) {
    const n = red(a.note);
    if (n !== a.note) { await prisma.acquisitionApproval.updateMany({ where: { id: a.id }, data: { note: n ?? null } }); redacted++; }
  }
  for (const o of await prisma.acquisitionOutcome.findMany({ where: { userId, acqProspectId }, select: { id: true, reason: true } }) as Array<{ id: string; reason: string | null }>) {
    const r = red(o.reason);
    if (r !== o.reason) { await prisma.acquisitionOutcome.updateMany({ where: { id: o.id }, data: { reason: r ?? null } }); redacted++; }
  }
  redacted += await blockDrafts(userId, acqProspectId, `erased with contacts (${params.reason})`, params.actor, { erase: true });

  if (engineOwned && prospect && (data.email !== undefined || data.phone !== undefined)) {
    const next: Record<string, unknown> = { ...data };
    if (typeof next.email === 'string' && emails.has(normalizeEmail(next.email))) delete next.email;
    if (typeof next.phone === 'string' && phones.has(normalizePhone(next.phone))) delete next.phone;
    await prisma.prospect.updateMany({ where: { id: prospect.id, userId }, data: { businessData: next as Prisma.InputJsonValue } });
    redacted++;
  }

  // Previews not yet committed or expired that still hold a value.
  const values = [...Array.from(emails), ...Array.from(phones)];
  for (const b of await prisma.acquisitionImportBatch.findMany({ where: { userId, status: 'previewed' }, select: { id: true, rows: true } }) as Array<{ id: string; rows: unknown }>) {
    const json = JSON.stringify(b.rows ?? '').toLowerCase();
    const digits = json.replace(/\D/g, '');
    if (values.some((v) => json.includes(v) || (/^\d+$/.test(v) && digits.includes(v.slice(-9))))) {
      await prisma.acquisitionImportBatch.updateMany({ where: { id: b.id }, data: { status: 'expired', rows: Prisma.DbNull } });
      redacted++;
    }
  }

  if (params.domain) await purgeDomainPageCache(userId, params.domain);
  for (const c of await prisma.acquisitionPageCache.findMany({ where: { userId }, select: { id: true, html: true } }) as Array<{ id: string; html: string | null }>) {
    if (c.html && redactValues(c.html, emails, phones) !== c.html) await prisma.acquisitionPageCache.deleteMany({ where: { id: c.id } });
  }

  await cancelAcqTasks(userId, acqProspectId, `contacts ${params.reason}`);
  await prisma.acquisitionPipelineEvent.create({
    data: {
      userId, acqProspectId,
      fromState: acq?.state ?? 'unknown', toState: acq?.state ?? 'unknown',
      reason: `${del.count} contact record(s) erased (${params.reason}); ${redacted} other record(s) redacted; values tombstoned${engineOwned ? '' : '; linked pre-existing CRM record NOT modified — handle in the CRM'}`,
      actor: params.actor,
    },
  });
  return { erased: del.count, redacted, crmRecordNotModified: !engineOwned };
}

export { emailDomain };
