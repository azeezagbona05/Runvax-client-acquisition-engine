import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { runQualityGate } from '@/lib/outreach/quality-gate';
import type { ProspectContext } from '@/lib/outreach/types';
import type { IndustryConfig, Offer } from './config/schema';
import { getIndustry, getOffer } from './config/registry';
import { findSuppressionHits, isPersonalEmail } from './suppression';
import { currentEvidence, offerHashOf } from './draftEvidence';

// Approval-record actions that change what the latest decision on the text is.
export const TEXT_DECISIONS = ['approve', 'edit', 'reject', 'invalidate'];

/**
 * The blocking delivery gate. Unlike the existing advisory quality gate, any
 * block here means the draft cannot be sent — there is no override flag.
 * evaluateDraftGate() is pure (all facts passed in) so every rule is unit
 * tested; checkDraftForDelivery() loads those facts from the database.
 */

export type GateBlockCode =
  | 'not_approved'
  | 'approval_stale'
  | 'channel_not_allowed'
  | 'no_recipient'
  | 'recipient_invalid'
  | 'contact_suppressed'
  | 'prospect_inactive'
  | 'missing_evidence'
  | 'evidence_not_found'
  | 'offer_unknown'
  | 'offer_unconfigured'
  | 'unsupported_claim'
  | 'prohibited_phrase'
  | 'unfilled_placeholder'
  | 'too_long'
  | 'missing_unsubscribe'
  | 'sender_identity_missing'
  | 'live_sending_disabled'
  | 'daily_cap_reached'
  | 'quality_gate_failed';

export interface GateBlock { code: GateBlockCode; detail: string }
export interface GateResult { allowed: boolean; blocks: GateBlock[]; warnings: string[]; checkedAt: string }

export interface GateInput {
  industry: IndustryConfig;
  businessName: string;
  prospectState: string;
  draft: {
    status: string;
    channel: string;
    subject: string | null;
    body: string;
    offerId: string;
    evidenceFindingIds: unknown;
  };
  // The latest decision that affects the text (approve / edit / reject / invalidate).
  latestApproval: { action: string; bodyHashAfter: string | null; evidenceHash?: string | null; offerHash?: string | null } | null;
  // Current versions of the draft's evidence and offer. When given, an approval
  // recorded for different versions is stale.
  currentEvidenceHash?: string | null;
  currentOfferHash?: string | null;
  recipient: { email: string | null; verification: string } | null;
  prospectFindingIds: string[];
  suppressionHits: string[];
  senderIdentity: { name: string; postalAddress: string } | null;
  sentToday: number;
}

export function draftHash(subject: string | null, body: string): string {
  return crypto.createHash('sha256').update(`${subject ?? ''}\n${body}`).digest('hex');
}

// Claim-like language. Anything matching must be covered verbatim by one of
// the offer's approvedClaims, which are removed from the text before scanning.
const CLAIM_PATTERNS: Array<[RegExp, string]> = [
  [/[₦$£€]\s?\d|\b\d[\d,.]*\s?(?:k|naira|ngn|usd|gbp|dollars?)\b/i, 'price amount'],
  [/\b(?:price|pricing|costs?|fees?|per month|monthly fee|discount|quote|invoice)\b/i, 'pricing language'],
  [/\bguarantee[ds]?\b|\bpromise[ds]?\b|\brisk[- ]free\b|\bno[- ]risk\b/i, 'guarantee'],
  [/\b\d+(?:\.\d+)?\s?%|\b\d+x\b|\b(?:double|triple)\s+(?:your|the)\b/i, 'statistic'],
  [/\b(?:increase|boost|grow|get|win|more)\s+(?:your\s+)?(?:bookings|patients|revenue|appointments|sales|leads|enquiries)\b/i, 'outcome promise'],
  [/\b(?:clinics?|clients?|customers?|practices?)\s+(?:like yours\s+)?(?:have\s+)?(?:saw|seen|achieved|got|increased|doubled)\b|\bour clients\b|\bcase stud(?:y|ies)\b/i, 'third-party result'],
  [/\b(?:within|in)\s+\d+\s+(?:hours?|days?|weeks?)\b|\bgo(?:es)? live (?:in|by|within)\b/i, 'delivery timeline'],
];

const PLACEHOLDER_RE = /\[[A-Z][A-Z _]+\]|\{\{[^}]*\}\}|<[A-Z][A-Z_]+>/;
const UNSUBSCRIBE_RE = /\bunsubscribe\b|\bopt[- ]out\b|reply\s+["'“]?stop\b/i;
const INACTIVE_STATES = ['suppressed', 'cancelled', 'disqualified', 'won', 'lost'];

function stripApprovedClaims(text: string, offer: Offer | null): string {
  let out = text;
  if (offer?.status === 'approved') {
    for (const claim of offer.approvedClaims) {
      out = out.split(claim).join(' ');
    }
  }
  return out;
}

export function evaluateDraftGate(input: GateInput): GateResult {
  const blocks: GateBlock[] = [];
  const warnings: string[] = [];
  const block = (code: GateBlockCode, detail: string) => blocks.push({ code, detail });
  const { draft, industry } = input;
  const fullText = `${draft.subject ?? ''}\n${draft.body}`;

  // Approval — and the approval must be of exactly this text.
  if (draft.status !== 'approved' && draft.status !== 'ready') block('not_approved', `Draft status is "${draft.status}"`);
  else if (input.latestApproval?.action !== 'approve' || input.latestApproval.bodyHashAfter !== draftHash(draft.subject, draft.body)) {
    block('approval_stale', 'The approved text differs from the current draft');
  } else if (input.currentEvidenceHash !== undefined && input.latestApproval.evidenceHash !== input.currentEvidenceHash) {
    block('approval_stale', 'The evidence has changed since the draft was approved');
  } else if (input.currentOfferHash !== undefined && input.latestApproval.offerHash !== input.currentOfferHash) {
    block('approval_stale', 'The offer configuration has changed since the draft was approved');
  }

  if (!(industry.outreach.channels as string[]).includes(draft.channel)) {
    block('channel_not_allowed', `Channel "${draft.channel}" is not enabled for ${industry.id}`);
  }

  // Recipient and suppression.
  if (!input.recipient?.email) block('no_recipient', 'No recipient email');
  else {
    if (['bounced', 'conflicting'].includes(input.recipient.verification)) {
      block('recipient_invalid', `Recipient verification is "${input.recipient.verification}"`);
    } else if (input.recipient.verification !== 'verified') {
      warnings.push('Recipient email is not verified');
    }
    if (isPersonalEmail(input.recipient.email)) warnings.push('Recipient uses a personal email provider — review before approving');
  }
  if (input.suppressionHits.length > 0) block('contact_suppressed', `Suppressed: ${input.suppressionHits.join(', ')}`);
  if (INACTIVE_STATES.includes(input.prospectState)) block('prospect_inactive', `Prospect is ${input.prospectState}`);

  // Evidence: at least one finding, and every cited finding belongs to this prospect.
  const cited = Array.isArray(draft.evidenceFindingIds) ? draft.evidenceFindingIds.filter((x): x is string => typeof x === 'string') : [];
  if (cited.length === 0) block('missing_evidence', 'Draft cites no audit findings');
  const unknown = cited.filter((id) => !input.prospectFindingIds.includes(id));
  if (unknown.length > 0) block('evidence_not_found', `Cited findings not on this prospect: ${unknown.join(', ')}`);

  // Offer.
  const offer = getOffer(industry, draft.offerId);
  if (!offer) block('offer_unknown', `Offer "${draft.offerId}" is not in the ${industry.id} catalogue`);
  else if (offer.status !== 'approved') block('offer_unconfigured', `${offer.name} has no approved description, scope or pricing yet`);

  // Content.
  const scanText = stripApprovedClaims(fullText, offer);
  for (const [re, label] of CLAIM_PATTERNS) {
    const m = scanText.match(re);
    if (m) block('unsupported_claim', `Unapproved ${label}: "${m[0]}"`);
  }
  const lower = fullText.toLowerCase();
  for (const phrase of industry.outreach.prohibitedPhrases) {
    if (lower.includes(phrase.toLowerCase())) block('prohibited_phrase', `Prohibited in ${industry.id}: "${phrase}"`);
  }
  for (const phrase of offer?.prohibitedClaims ?? []) {
    if (lower.includes(phrase.toLowerCase())) block('prohibited_phrase', `Prohibited for ${offer!.name}: "${phrase}"`);
  }
  const placeholder = fullText.match(PLACEHOLDER_RE);
  if (placeholder) block('unfilled_placeholder', `Unfilled placeholder ${placeholder[0]}`);
  const words = draft.body.trim().split(/\s+/).filter(Boolean).length;
  if (words > industry.outreach.maxWords) block('too_long', `${words} words (max ${industry.outreach.maxWords})`);
  if (industry.compliance.unsubscribeRequired && !UNSUBSCRIBE_RE.test(draft.body)) {
    block('missing_unsubscribe', 'No unsubscribe / opt-out line');
  }

  // The existing RUNVAX quality gate, enforced here rather than advisory.
  const qg = runQualityGate(
    { emailBody: draft.body },
    { businessName: input.businessName, country: industry.geography.country, channel: 'email' } as ProspectContext,
  );
  // AI-tell notes are advisory in that gate too (they never flip `pass`).
  if (!qg.pass) block('quality_gate_failed', qg.notes.filter((n) => !n.includes('AI-tell')).join('; ') || 'Quality gate failed');

  // Sending policy.
  if (industry.compliance.senderAddressRequired && (!input.senderIdentity?.name || !input.senderIdentity.postalAddress)) {
    block('sender_identity_missing', 'No configured sender identity with a postal address');
  }
  if (!industry.compliance.liveSendingEnabled) block('live_sending_disabled', 'Live sending is disabled for this industry');
  else if (input.sentToday >= industry.compliance.dailySendCap) block('daily_cap_reached', `Daily cap of ${industry.compliance.dailySendCap} reached`);

  return { allowed: blocks.length === 0, blocks, warnings, checkedAt: new Date().toISOString() };
}

export class GateBlockedError extends Error {
  constructor(public result: GateResult) {
    super(`Draft blocked: ${result.blocks.map((b) => b.code).join(', ')}`);
  }
}

/** Loads every fact the gate needs, evaluates it, and stores the result on the draft. */
export async function checkDraftForDelivery(userId: string, draftId: string): Promise<GateResult> {
  const draft = await prisma.acquisitionDraft.findFirst({ where: { id: draftId, userId } });
  if (!draft) throw new Error('Draft not found');
  const acq = await prisma.acquisitionProspect.findFirst({ where: { id: draft.acqProspectId, userId } });
  if (!acq) throw new Error('Prospect not found');
  const crm = await prisma.prospect.findFirst({ where: { id: acq.prospectId, userId }, select: { businessName: true } });
  const industry = getIndustry(acq.industryKey);
  if (!industry) throw new Error(`Unknown industry "${acq.industryKey}"`);

  const [latestApproval, recipient, findings] = await Promise.all([
    prisma.acquisitionApproval.findFirst({ where: { draftId, userId, action: { in: TEXT_DECISIONS } }, orderBy: { createdAt: 'desc' } }),
    draft.recipientDmId
      ? prisma.acquisitionDecisionMaker.findFirst({ where: { id: draft.recipientDmId, userId, acqProspectId: acq.id } })
      : Promise.resolve(null),
    prisma.acquisitionFinding.findMany({ where: { acqProspectId: acq.id, userId }, select: { id: true } }),
  ]);
  const suppressionHits = recipient?.email || acq.orgDomain
    ? await findSuppressionHits(userId, { email: recipient?.email ?? undefined, domain: acq.orgDomain ?? undefined })
    : [];
  const citedSignals = Array.isArray(draft.evidenceSignalIds) ? (draft.evidenceSignalIds as unknown[]).filter((x): x is string => typeof x === 'string') : null;
  const offer = getOffer(industry, draft.offerId);

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const sentToday = await prisma.acquisitionDraft.count({ where: { userId, status: 'sent', updatedAt: { gte: startOfDay } } });

  const result = evaluateDraftGate({
    industry,
    businessName: crm?.businessName ?? '',
    prospectState: acq.state,
    draft,
    latestApproval,
    recipient: recipient ? { email: recipient.email, verification: recipient.verification } : null,
    prospectFindingIds: findings.map((f: { id: string }) => f.id),
    suppressionHits,
    senderIdentity: null, // sending identities arrive in Phase 5
    sentToday,
    currentEvidenceHash: citedSignals ? (await currentEvidence(userId, acq.id, citedSignals, industry)).hash : undefined,
    currentOfferHash: draft.offerHash ? (offer ? offerHashOf(offer) : null) : undefined,
  });

  await prisma.acquisitionDraft.update({
    where: { id: draft.id },
    data: { gateResult: result as unknown as Prisma.InputJsonValue },
  });
  return result;
}

/**
 * The one and only delivery entry point for acquisition drafts. Every send
 * goes through the gate first. No delivery adapter exists in Phase 1, so even
 * a draft that passed would stop here.
 */
export async function deliverDraft(userId: string, draftId: string): Promise<never> {
  const result = await checkDraftForDelivery(userId, draftId);
  if (!result.allowed) throw new GateBlockedError(result);
  throw new Error('No delivery adapter is configured (Phase 5)');
}
