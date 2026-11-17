import { prisma } from '@/lib/prisma';

/**
 * Appointments are the meetings booked with prospects (the lead's stage "demo booked" and its `demoAt` time). The team records what happened
 * and the next step, so nothing is forgotten after the meeting. Nothing here contacts anyone.
 */
export const OUTCOMES = ['held', 'missed', 'rescheduled'] as const;
export type Outcome = typeof OUTCOMES[number];

export type AppointmentState = 'upcoming' | 'needs_update' | 'missed' | 'held' | 'rescheduled' | 'unscheduled';
export type FollowUp = 'none' | 'open' | 'overdue' | 'done';

/** A meeting whose time has passed with no outcome recorded needs updating: we do not guess whether it was held or missed. */
export function appointmentState(a: { demoAt: Date | string | null; outcome: string | null }, now = Date.now()): AppointmentState {
  if (a.outcome === 'held' || a.outcome === 'missed' || a.outcome === 'rescheduled') return a.outcome;
  const t = a.demoAt ? new Date(a.demoAt).getTime() : NaN;
  if (!Number.isFinite(t)) return 'unscheduled';
  return t > now ? 'upcoming' : 'needs_update';
}

export function followUpState(a: { nextAction: string | null; nextActionDue: Date | string | null; nextActionDoneAt: Date | string | null }, now = Date.now()): FollowUp {
  if (!a.nextAction?.trim()) return 'none';
  if (a.nextActionDoneAt) return 'done';
  const due = a.nextActionDue ? new Date(a.nextActionDue).getTime() : NaN;
  return Number.isFinite(due) && due < now ? 'overdue' : 'open';
}

export interface AppointmentRow {
  leadId: string; campaignId: string; campaignName: string; email: string; name: string | null; business: string | null;
  demoAt: string | null; outcome: Outcome | null; state: AppointmentState;
  nextAction: string | null; nextActionDue: string | null; nextActionDoneAt: string | null; followUp: FollowUp;
  unsubscribed: boolean; stage: string | null;
}

export async function loadAppointments(userId: string, now = Date.now()): Promise<AppointmentRow[]> {
  const leads = await prisma.outreachLead.findMany({
    where: { userId, OR: [{ stage: 'demo_booked' }, { demoAt: { not: null } }, { appointment: { isNot: null } }] },
    select: { id: true, campaignId: true, email: true, name: true, business: true, demoAt: true, stage: true, status: true, unsubscribedAt: true, campaign: { select: { name: true } }, appointment: true },
    orderBy: { demoAt: 'desc' }, take: 500,
  });
  return leads.map((l) => {
    const ap = l.appointment;
    const outcome = (ap?.outcome && (OUTCOMES as readonly string[]).includes(ap.outcome) ? ap.outcome : null) as Outcome | null;
    return {
      leadId: l.id, campaignId: l.campaignId, campaignName: l.campaign.name, email: l.email, name: l.name, business: l.business,
      demoAt: l.demoAt?.toISOString() ?? null, outcome, state: appointmentState({ demoAt: l.demoAt, outcome }, now),
      nextAction: ap?.nextAction ?? null, nextActionDue: ap?.nextActionDue?.toISOString() ?? null, nextActionDoneAt: ap?.nextActionDoneAt?.toISOString() ?? null,
      followUp: followUpState(ap ?? { nextAction: null, nextActionDue: null, nextActionDoneAt: null }, now),
      unsubscribed: !!l.unsubscribedAt || l.status === 'unsubscribed', stage: l.stage,
    };
  });
}

export function countAppointments(rows: AppointmentRow[]) {
  return {
    needsUpdate: rows.filter((r) => r.state === 'needs_update').length,
    missed: rows.filter((r) => r.state === 'missed').length,
    upcoming: rows.filter((r) => r.state === 'upcoming').length,
    followUps: rows.filter((r) => r.followUp === 'open' || r.followUp === 'overdue').length,
    overdue: rows.filter((r) => r.followUp === 'overdue').length,
  };
}
