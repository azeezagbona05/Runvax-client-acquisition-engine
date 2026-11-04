import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { canTransition, transitionProspect, allowedTransitions, isState, TERMINAL, type AcqState } from './lifecycle';
import { addSuppression } from './suppression';
import { cancelAcqTasks } from './tasks/queue';
import { blockDrafts, draftValidity, DraftError, DELIVERY_TIME_CODES, type Reason } from './drafts';
import { checkDraftForDelivery } from './gate';

/**
 * Manually recorded sales outcomes. Nothing here sends, schedules or follows
 * up: an admin records what happened outside RUNVAX, and the prospect moves
 * along the existing acquisition lifecycle. Each outcome is one append-only
 * AcquisitionOutcome row; the lifecycle move is an AcquisitionPipelineEvent.
 *
 * The CRM Prospect row is deliberately NOT updated: its stage drives existing
 * RUNVAX automation (Rex auto-drafts for stage "found", Atlas follow-up
 * suggestions for "contacted" / "interested" / "proposal"), and the
 * acquisition engine must not feed prospects into those flows.
 *
 * Opt-outs and objections always take effect, whatever the prospect's state:
 * the recipient (and, for a clinic inbox, the domain) is suppressed, pending
 * tasks are cancelled, active drafts are blocked and the prospect is moved to
 * `suppressed`.
 */

const when = z.iso.datetime({ offset: true }).optional();
const note = z.string().trim().max(500).optional();
const reason = z.string().trim().min(3).max(500);
const money = { amount: z.number().int().positive().max(2_000_000_000), currency: z.string().trim().regex(/^[A-Z]{3}$/, 'ISO 4217 code, e.g. NGN') };

export const OutcomeSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('sent'), draftId: z.string().min(1), occurredAt: when, attest: z.literal(true) }),
  z.strictObject({ type: z.literal('reply'), sentiment: z.enum(['positive', 'neutral', 'negative']), occurredAt: when, note }),
  z.strictObject({ type: z.literal('opt_out'), occurredAt: when, note }),
  z.strictObject({ type: z.literal('objection'), occurredAt: when, reason }),
  z.strictObject({ type: z.literal('meeting_booked'), occurredAt: when, note }),
  z.strictObject({ type: z.literal('proposal_sent'), occurredAt: when, note, ...money }),
  z.strictObject({ type: z.literal('won'), occurredAt: when, reason, ...money }),
  z.strictObject({ type: z.literal('lost'), occurredAt: when, reason }),
]);
export type OutcomeInput = z.infer<typeof OutcomeSchema>;
export const OUTCOME_TYPES = ['sent', 'reply', 'opt_out', 'objection', 'meeting_booked', 'proposal_sent', 'won', 'lost'] as const;

// Where each outcome moves the prospect, and the states it may be recorded in
// without moving (e.g. a second reply).
const MOVES: Record<string, { to: AcqState | null; stayIn: AcqState[] }> = {
  sent: { to: 'sent', stayIn: [] },
  reply: { to: 'replied', stayIn: ['replied', 'qualified', 'proposal'] },
  meeting_booked: { to: 'qualified', stayIn: ['qualified', 'proposal'] },
  proposal_sent: { to: 'proposal', stayIn: ['proposal'] },
  won: { to: 'won', stayIn: [] },
  lost: { to: 'lost', stayIn: [] },
};

export type OutcomeResult = { ok: true; outcomeId: string; state: string; suppressed?: string[] } | { ok: false; blockers: Reason[] };

export async function recordOutcome(userId: string, actor: string, acqProspectId: string, body: unknown): Promise<OutcomeResult> {
  const o = OutcomeSchema.parse(body);
  const acq = await prisma.acquisitionProspect.findFirst({ where: { id: acqProspectId, userId } });
  if (!acq) throw new DraftError('Prospect not found');
  const occurredAt = o.occurredAt ? new Date(o.occurredAt) : new Date();
  if (occurredAt.getTime() > Date.now() + 5 * 60_000) throw new DraftError('occurredAt cannot be in the future');

  if (o.type === 'opt_out' || o.type === 'objection') return stopContact(userId, actor, acq, o, occurredAt);

  const move = MOVES[o.type];
  const state = acq.state as AcqState;
  const moving = !move.stayIn.includes(state);
  if (moving && !(move.to && canTransition(state, move.to))) {
    const next = isState(state) ? allowedTransitions(state).join(', ') || 'none' : 'none';
    return { ok: false, blockers: [{ code: 'illegal_transition', detail: `Cannot record "${o.type}" while the prospect is ${state} (allowed next: ${next})` }] };
  }

  let draftId: string | null = null;
  if (o.type === 'sent') {
    const d = await prisma.acquisitionDraft.findFirst({ where: { id: o.draftId, userId, acqProspectId: acq.id } });
    if (!d) throw new DraftError('Draft not found on this prospect');
    if (d.status !== 'ready') return { ok: false, blockers: [{ code: 'draft_not_ready', detail: `Only a ready draft can be recorded as sent (this one is ${d.status})` }] };
    // Re-check at the moment of recording: the evidence, offer and suppression
    // list may have changed since the draft was marked ready.
    const v = await draftValidity(userId, d as never);
    if (!v.valid) return { ok: false, blockers: v.reasons };
    const gate = await checkDraftForDelivery(userId, d.id);
    const blockers = gate.blocks.filter((b) => !DELIVERY_TIME_CODES.includes(b.code));
    if (blockers.length) return { ok: false, blockers };
    const res = await prisma.acquisitionDraft.updateMany({ where: { id: d.id, userId, status: 'ready' }, data: { status: 'sent', statusReason: `Sent outside RUNVAX (recorded by ${actor})` } });
    if (res.count === 0) throw new DraftError('The draft changed while you were working on it; reload and try again');
    draftId = d.id;
  }

  const row = await prisma.acquisitionOutcome.create({
    data: {
      userId, acqProspectId: acq.id, draftId, type: o.type,
      sentiment: o.type === 'reply' ? o.sentiment : null,
      amount: 'amount' in o ? o.amount : null,
      currency: 'currency' in o ? o.currency : null,
      reason: 'reason' in o ? o.reason : 'note' in o ? o.note ?? null : null,
      actorEmail: actor, occurredAt,
    },
  });
  if (moving && move.to) {
    await transitionProspect({ userId, acqProspectId: acq.id, to: move.to, reason: `Outcome recorded: ${o.type}${o.type === 'reply' ? ` (${o.sentiment})` : ''}`, actor });
  } else {
    await prisma.acquisitionPipelineEvent.create({ data: { userId, acqProspectId: acq.id, fromState: state, toState: state, reason: `Outcome recorded: ${o.type}`, actor } });
  }
  return { ok: true, outcomeId: row.id, state: moving && move.to ? move.to : state };
}

async function stopContact(
  userId: string, actor: string,
  acq: { id: string; state: string; orgDomain: string | null },
  o: Extract<OutcomeInput, { type: 'opt_out' | 'objection' }>, occurredAt: Date,
): Promise<OutcomeResult> {
  // Who asked: the recipient of the most recent draft (sent or not).
  const lastDraft = await prisma.acquisitionDraft.findFirst({ where: { userId, acqProspectId: acq.id, recipientDmId: { not: null } }, orderBy: { createdAt: 'desc' } });
  const recipient = lastDraft?.recipientDmId
    ? await prisma.acquisitionDecisionMaker.findFirst({ where: { id: lastDraft.recipientDmId, userId } })
    : null;
  const reasonCode = o.type === 'opt_out' ? 'opt_out' : 'objection';
  const source = `outcome:${actor}`.slice(0, 190);
  const suppressed: string[] = [];
  if (recipient?.email) { await addSuppression({ userId, kind: 'email', value: recipient.email, reason: reasonCode, source }); suppressed.push('email'); }
  if (recipient?.phone) { await addSuppression({ userId, kind: 'phone', value: recipient.phone, reason: reasonCode, source }); suppressed.push('phone'); }
  // A clinic inbox speaks for the clinic; an objection always covers the clinic.
  const wholeClinic = o.type === 'objection' || !recipient || recipient.kind !== 'manual_named';
  if (wholeClinic && acq.orgDomain) { await addSuppression({ userId, kind: 'domain', value: acq.orgDomain, reason: reasonCode, source }); suppressed.push('domain'); }
  if (suppressed.length === 0) {
    // Nothing to key the suppression on: refuse rather than pretend it took effect.
    throw new DraftError('No email, phone or domain is recorded for this prospect, so the opt-out cannot be enforced; add the domain or contact first');
  }

  await cancelAcqTasks(userId, acq.id, reasonCode);
  await blockDrafts(userId, acq.id, `${reasonCode} recorded`, actor);
  const row = await prisma.acquisitionOutcome.create({
    data: { userId, acqProspectId: acq.id, draftId: lastDraft?.id ?? null, type: o.type, reason: o.type === 'objection' ? o.reason : o.note ?? null, actorEmail: actor, occurredAt },
  });
  let state = acq.state;
  if (canTransition(acq.state, 'suppressed')) {
    await transitionProspect({ userId, acqProspectId: acq.id, to: 'suppressed', reason: `Outcome recorded: ${o.type}`, actor });
    state = 'suppressed';
  } else {
    await prisma.acquisitionPipelineEvent.create({ data: { userId, acqProspectId: acq.id, fromState: acq.state, toState: acq.state, reason: `Outcome recorded: ${o.type} (suppressed; prospect already ${acq.state})`, actor } });
  }
  return { ok: true, outcomeId: row.id, state, suppressed };
}

// ─── Funnel metrics ─────────────────────────────────────────────────────────

type OutcomeRow = { acqProspectId: string; type: string; sentiment: string | null; amount: number | null; currency: string | null; occurredAt: Date };

const rate = (n: number, d: number) => (d === 0 ? null : Math.round((n / d) * 1000) / 1000);

/**
 * Counts of distinct prospects at each step, from recorded outcomes only.
 * Values are summed per currency from each prospect's latest proposal / win.
 */
export async function funnelMetrics(userId: string) {
  const [outcomes, drafts, approvals, prospects] = await Promise.all([
    prisma.acquisitionOutcome.findMany({ where: { userId }, orderBy: { occurredAt: 'asc' } }) as Promise<OutcomeRow[]>,
    prisma.acquisitionDraft.findMany({ where: { userId }, select: { id: true, acqProspectId: true, status: true } }),
    prisma.acquisitionApproval.findMany({ where: { userId, action: { in: ['approve', 'mark_ready'] } }, select: { draftId: true, action: true } }),
    prisma.acquisitionProspect.findMany({ where: { userId }, select: { id: true, state: true } }),
  ]);
  const who = (type: string) => new Set(outcomes.filter((o) => o.type === type).map((o) => o.acqProspectId));
  const latest = (type: string) => {
    const m = new Map<string, OutcomeRow>();
    for (const o of outcomes) if (o.type === type) m.set(o.acqProspectId, o);
    return Array.from(m.values());
  };
  const sumBy = (rows: OutcomeRow[]) => {
    const out: Record<string, number> = {};
    for (const r of rows) if (r.amount != null && r.currency) out[r.currency] = (out[r.currency] ?? 0) + r.amount;
    return out;
  };

  const sent = who('sent');
  const replies = latest('reply');
  const replied = new Set(replies.map((r) => r.acqProspectId));
  const bySentiment = { positive: 0, neutral: 0, negative: 0 } as Record<string, number>;
  for (const r of replies) if (r.sentiment) bySentiment[r.sentiment] = (bySentiment[r.sentiment] ?? 0) + 1;
  const meetings = who('meeting_booked');
  const proposals = latest('proposal_sent');
  const won = latest('won');
  const lost = who('lost');
  const optOuts = who('opt_out');
  const objections = who('objection');

  const byState: Record<string, number> = {};
  for (const p of prospects as Array<{ state: string }>) byState[p.state] = (byState[p.state] ?? 0) + 1;
  const draftIdsWith = (action: string) => new Set((approvals as Array<{ draftId: string; action: string }>).filter((a) => a.action === action).map((a) => a.draftId));

  return {
    note: 'Recorded outcomes only (entered manually). Counts are distinct prospects unless stated.',
    prospectsByState: byState,
    drafts: {
      generated: drafts.length,
      approved: draftIdsWith('approve').size,
      markedReady: draftIdsWith('mark_ready').size,
      awaitingApproval: (drafts as Array<{ status: string }>).filter((d) => d.status === 'pending_approval').length,
      currentlyReady: (drafts as Array<{ status: string }>).filter((d) => d.status === 'ready').length,
    },
    sent: sent.size,
    replied: replied.size,
    repliesBySentiment: bySentiment,
    optOuts: optOuts.size,
    objections: objections.size,
    meetingsBooked: meetings.size,
    proposalsSent: proposals.length,
    proposalValue: sumBy(proposals),
    won: won.length,
    wonValue: sumBy(won),
    lost: lost.size,
    rates: {
      reply: rate(replied.size, sent.size),
      positiveReply: rate(bySentiment.positive, sent.size),
      optOut: rate(optOuts.size + objections.size, sent.size),
      meetingPerSent: rate(meetings.size, sent.size),
      proposalPerMeeting: rate(proposals.length, meetings.size),
      winPerProposal: rate(won.length, proposals.length),
    },
    terminalStates: TERMINAL,
  };
}
