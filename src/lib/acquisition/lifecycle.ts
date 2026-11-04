import { prisma } from '@/lib/prisma';

/**
 * Acquisition lifecycle for one prospect. State only moves along these edges,
 * and only through transitionProspect() — model output never decides the next
 * state directly. Terminal states have no outgoing edges.
 */
export const STATES = [
  'discovered',
  'contacts_researched',
  'audited',
  'strategized',
  'draft_pending_approval',
  'approved',
  'sent',
  'follow_up',
  'replied',
  'qualified',
  'proposal',
  'won',
  'lost',
  'disqualified',
  'needs_review',
  'suppressed',
  'cancelled',
] as const;

export type AcqState = (typeof STATES)[number];

// Exits available from every non-terminal state.
const ALWAYS: AcqState[] = ['suppressed', 'cancelled'];

const EDGES: Record<AcqState, AcqState[]> = {
  discovered: ['contacts_researched', 'needs_review', 'disqualified'],
  contacts_researched: ['audited', 'needs_review', 'disqualified'],
  audited: ['strategized', 'needs_review', 'disqualified'],
  strategized: ['draft_pending_approval', 'needs_review', 'disqualified'],
  // Rejecting or regenerating a draft goes back to strategized.
  draft_pending_approval: ['approved', 'strategized', 'needs_review'],
  // Editing an approved draft sends it back for approval.
  approved: ['sent', 'draft_pending_approval'],
  sent: ['replied', 'follow_up'],
  follow_up: ['sent', 'replied', 'lost'],
  replied: ['follow_up', 'qualified', 'lost', 'disqualified', 'needs_review'],
  qualified: ['proposal', 'lost', 'disqualified', 'needs_review'],
  proposal: ['won', 'lost', 'needs_review'],
  needs_review: ['discovered', 'contacts_researched', 'audited', 'strategized', 'replied', 'qualified', 'disqualified'],
  won: [],
  lost: [],
  disqualified: [],
  suppressed: [],
  cancelled: [],
};

export const TERMINAL: AcqState[] = ['won', 'lost', 'disqualified', 'suppressed', 'cancelled'];

export function isState(s: string): s is AcqState {
  return (STATES as readonly string[]).includes(s);
}

export function allowedTransitions(from: AcqState): AcqState[] {
  if (TERMINAL.includes(from)) return [];
  return [...EDGES[from], ...ALWAYS];
}

export function canTransition(from: string, to: string): boolean {
  return isState(from) && isState(to) && allowedTransitions(from).includes(to);
}

export class TransitionError extends Error {}

/**
 * Moves a prospect between states and records the event. The update is
 * conditional on the state still being `from`, so two concurrent agents can't
 * both advance the same prospect.
 */
export async function transitionProspect(params: {
  userId: string;
  acqProspectId: string;
  to: AcqState;
  reason: string;
  actor: string;
}): Promise<{ from: AcqState; to: AcqState }> {
  const current = await prisma.acquisitionProspect.findFirst({
    where: { id: params.acqProspectId, userId: params.userId },
    select: { state: true },
  });
  if (!current) throw new TransitionError('Prospect not found');
  const from = current.state;
  if (!canTransition(from, params.to)) {
    throw new TransitionError(`Illegal transition ${from} → ${params.to}`);
  }

  const res = await prisma.acquisitionProspect.updateMany({
    where: { id: params.acqProspectId, userId: params.userId, state: from },
    data: { state: params.to },
  });
  if (res.count === 0) throw new TransitionError(`State changed concurrently (expected ${from})`);

  await prisma.acquisitionPipelineEvent.create({
    data: {
      userId: params.userId,
      acqProspectId: params.acqProspectId,
      fromState: from,
      toState: params.to,
      reason: params.reason.slice(0, 1000),
      actor: params.actor,
    },
  });
  return { from: from as AcqState, to: params.to };
}
