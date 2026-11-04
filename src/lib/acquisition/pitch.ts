import type { IndustryConfig, Offer } from './config/schema';
import { freshnessFactor } from './scoring';

/**
 * Deterministic pitch drafts. No model is involved: the text is assembled
 * from fixed templates, and the only clinic-specific statements are built
 * from OBSERVED evidence signals, phrased as what we could or couldn't find
 * ("I couldn't find a way to book online") rather than as a claim about the
 * clinic ("you have no booking system"). Inferred and unknown signals are
 * never stated in the text; they are returned for the reviewer.
 *
 * buildPitch() is pure. It refuses — with reasons — instead of producing a
 * weak draft when the evidence doesn't support the offer.
 */

export interface PitchSignal {
  id: string;
  code: string;
  value: unknown;
  basis: string;
  confidence: string;
  sourceUrl: string | null;
  evidenceQuote: string | null;
  observedAt: Date;
  lastVerifiedAt: Date;
}

export interface PitchFinding { id: string; category: string; polarity: string; basis: string; signalIds: unknown }

export interface PitchRecipient { id: string; kind: string; name: string | null; email: string | null; flags: unknown }

export interface PitchInput {
  industry: IndustryConfig;
  offer: Offer | null;
  businessName: string;
  domain: string | null;
  prospectState: string;
  recommendedOfferId: string | null;
  signals: PitchSignal[]; // active (not superseded) signals
  findings: PitchFinding[];
  recipient: PitchRecipient | null;
  recipientSuppressed: boolean;
  now: Date;
}

export type PitchRefusalCode =
  | 'prospect_state'
  | 'no_recommendation'
  | 'offer_not_recommended'
  | 'offer_unknown'
  | 'no_pitch_template'
  | 'insufficient_evidence'
  | 'no_recipient'
  | 'recipient_suppressed'
  | 'too_long';

export interface PitchRefusal { code: PitchRefusalCode; detail: string }

export interface CitedEvidence {
  signalId: string;
  findingIds: string[];
  code: string;
  value: unknown;
  basis: 'observed';
  confidence: string;
  sourceUrl: string | null;
  quote: string | null;
  observedAt: string;
  sentence: string; // the words in the draft that rest on this signal
  needsReverify: boolean;
}

export interface ReviewerNote { signalId: string | null; code: string; value: unknown; basis: string; note: string }

export type PitchResult =
  | {
      ok: true;
      subject: string;
      body: string;
      recipientDmId: string;
      cited: CitedEvidence[];
      citedSignalIds: string[];
      citedFindingIds: string[];
      inferred: ReviewerNote[];
      unknown: ReviewerNote[];
      warnings: string[];
    }
  | { ok: false; reasons: PitchRefusal[] };

// Only these observations may be put into words. Each phrase states what we
// could not find (or did find), never what the clinic lacks or suffers from.
const PHRASES: Record<string, string> = {
  'online_booking_present:false': "I couldn't find a way to book an appointment online",
  'contact_form_present:false': "I couldn't find an enquiry form",
  'whatsapp_entry_point:false': "I couldn't find a WhatsApp link",
  'chat_widget_present:false': "I couldn't see a chat option",
  'opening_hours_published:false': "I couldn't find your opening hours",
  'click_to_call:false': "I couldn't find a tap-to-call phone link",
};
const MAX_OBSERVATIONS = 2;

export const DRAFT_STATES = ['strategized', 'draft_pending_approval', 'approved'];
export const SIGN_OFF = 'Kind regards,\nHarzotech';
export const OPT_OUT_LINE = "If you'd prefer not to hear from us, reply STOP and we won't contact you again.";

const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' });
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

function joinClauses(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

function idsOf(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export function buildPitch(input: PitchInput): PitchResult {
  const reasons: PitchRefusal[] = [];
  const refuse = (code: PitchRefusalCode, detail: string) => reasons.push({ code, detail });
  const { offer, industry } = input;

  if (!DRAFT_STATES.includes(input.prospectState)) refuse('prospect_state', `Prospect is "${input.prospectState}"; drafts need a strategized prospect`);
  if (!input.recommendedOfferId || input.recommendedOfferId === 'none') refuse('no_recommendation', 'No offer has been recommended for this prospect');
  if (!offer) refuse('offer_unknown', 'Offer is not in the catalogue');
  else {
    if (input.recommendedOfferId && input.recommendedOfferId !== 'none' && input.recommendedOfferId !== offer.id) {
      refuse('offer_not_recommended', `The current recommendation is ${input.recommendedOfferId}, not ${offer.id}`);
    }
    if (!offer.pitch || !offer.evidenceRequirement) refuse('no_pitch_template', `${offer.name} has no pitch template or evidence requirement`);
  }

  // Evidence: observed weaknesses in the offer's categories, with a phrase.
  const signalById = new Map(input.signals.map((s) => [s.id, s]));
  const byCode = new Map<string, { signal: PitchSignal; findingIds: string[] }>();
  const categories = offer?.evidenceRequirement?.categories ?? [];
  for (const f of input.findings) {
    if (f.polarity !== 'weakness' || f.basis !== 'observed' || !categories.includes(f.category)) continue;
    for (const sid of idsOf(f.signalIds)) {
      const s = signalById.get(sid);
      if (!s || s.basis !== 'observed') continue;
      if (freshnessFactor(s.lastVerifiedAt, input.now, industry.retention) === 0) continue;
      if (!PHRASES[`${s.code}:${String(s.value)}`]) continue;
      const cur = byCode.get(s.code);
      if (cur) { if (!cur.findingIds.includes(f.id)) cur.findingIds.push(f.id); }
      else byCode.set(s.code, { signal: s, findingIds: [f.id] });
    }
  }
  // Stable order: the configured category order, then phrase order.
  const phraseOrder = Object.keys(PHRASES);
  const usable = Array.from(byCode.values()).sort((a, b) =>
    phraseOrder.indexOf(`${a.signal.code}:${String(a.signal.value)}`) - phraseOrder.indexOf(`${b.signal.code}:${String(b.signal.value)}`));
  const min = offer?.evidenceRequirement?.minObservedWeaknesses ?? 1;
  if (usable.length < min) {
    refuse('insufficient_evidence', `Needs at least ${min} fresh, observed weakness in ${categories.join(' / ') || 'the offer categories'}; found ${usable.length}`);
  }
  if (!input.domain) refuse('insufficient_evidence', 'No website domain to attribute the observations to');

  // Recipient: an email contact point that isn't shared with another prospect.
  const r = input.recipient;
  if (!r || !r.email) refuse('no_recipient', 'No email contact point for this clinic');
  else if ((r.flags as { duplicateOf?: string } | null)?.duplicateOf) refuse('no_recipient', 'The contact point is shared with another prospect; choose another');
  if (input.recipientSuppressed) refuse('recipient_suppressed', 'The recipient or domain is suppressed');

  if (reasons.length > 0 || !offer?.pitch || !r) return { ok: false, reasons };

  const chosen = usable.slice(0, MAX_OBSERVATIONS);
  const latest = chosen.reduce((d, c) => (c.signal.lastVerifiedAt > d ? c.signal.lastVerifiedAt : d), chosen[0].signal.lastVerifiedAt);
  const clauses = chosen.map((c) => PHRASES[`${c.signal.code}:${String(c.signal.value)}`]);
  const observation = `When I looked at ${input.domain} on ${fmtDate(latest)}, ${joinClauses(clauses)}.`;

  const greeting = r.kind === 'manual_named' && r.name ? `Dear ${r.name.trim()},` : `Hello ${input.businessName} team,`;
  const body = [greeting, observation, offer.pitch.relevance, offer.pitch.cta, SIGN_OFF, OPT_OUT_LINE].join('\n\n');
  const subject = `${input.businessName}: a question about ${offer.pitch.topic}`;

  if (words(body) > industry.outreach.maxWords) {
    return { ok: false, reasons: [{ code: 'too_long', detail: `Template produces ${words(body)} words (max ${industry.outreach.maxWords})` }] };
  }

  const citedIds = new Set(chosen.map((c) => c.signal.id));
  const notes = (basis: string) => input.signals
    .filter((s) => s.basis === basis && !citedIds.has(s.id))
    .map((s) => ({ signalId: s.id, code: s.code, value: s.value, basis: s.basis, note: basis === 'inferred' ? 'Inferred, not observed — not stated in the draft' : 'Not checked — not stated in the draft' }));
  const unknown: ReviewerNote[] = notes('unknown');
  const observedCodes = new Set(input.signals.filter((s) => s.basis === 'observed').map((s) => s.code));
  for (const c of categories) {
    const cat = industry.opportunityCategories.find((x) => x.id === c);
    for (const rule of cat?.signalRules ?? []) {
      if (!observedCodes.has(rule.signal) && !input.signals.some((s) => s.code === rule.signal) && !unknown.some((u) => u.code === rule.signal)) {
        unknown.push({ signalId: null, code: rule.signal, value: null, basis: 'unknown', note: 'No evidence recorded' });
      }
    }
  }

  const warnings: string[] = [];
  if (offer.status !== 'approved') warnings.push(`${offer.name} is not approved for sale: this draft can be reviewed for wording but cannot be marked ready`);
  for (const c of chosen) if (freshnessFactor(c.signal.lastVerifiedAt, input.now, industry.retention) < 1) warnings.push(`${c.signal.code} is due for re-verification`);
  if (usable.length > chosen.length) warnings.push(`${usable.length - chosen.length} further observation(s) not used (max ${MAX_OBSERVATIONS})`);

  return {
    ok: true,
    subject,
    body,
    recipientDmId: r.id,
    cited: chosen.map((c, i) => ({
      signalId: c.signal.id,
      findingIds: c.findingIds,
      code: c.signal.code,
      value: c.signal.value,
      basis: 'observed',
      confidence: c.signal.confidence,
      sourceUrl: c.signal.sourceUrl,
      quote: c.signal.evidenceQuote,
      observedAt: c.signal.observedAt.toISOString(),
      sentence: clauses[i],
      needsReverify: freshnessFactor(c.signal.lastVerifiedAt, input.now, industry.retention) < 1,
    })),
    citedSignalIds: chosen.map((c) => c.signal.id),
    citedFindingIds: Array.from(new Set(chosen.flatMap((c) => c.findingIds))),
    inferred: notes('inferred'),
    unknown,
    warnings,
  };
}
