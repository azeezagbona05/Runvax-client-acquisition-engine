import { appointmentState } from '@/lib/appointments';

/**
 * "Who should I reach out to today": every open contact gets a score from what is actually happening with it, and the reasons are shown so
 * nobody has to trust a number. Rules only, no guesses: each reason is a fact in the data (a reply waiting, a task overdue, a passed meeting).
 */
export interface QueueContact {
  leadId: string; business: string | null; name: string | null; email: string;
  stage: string | null; replyClass: string | null; outcome: string | null;
  repliedAt: Date | null; unansweredReplyAt: Date | null; openCount: number; clickCount: number; lastTouchAt: Date | null; unsubscribed: boolean;
  demoAt: Date | null; appointmentOutcome: string | null;
  tasks: Array<{ title: string; dueAt: Date | null; doneAt: Date | null }>;
  assigneeId: string | null;
}
export interface QueueItem { leadId: string; score: number; reasons: string[]; action: string; assigneeId: string | null }

const DAY = 86_400_000;
const POSITIVE = ['interested', 'info_request', 'meeting_request'];
const days = (a: Date, now: number) => Math.max(0, Math.floor((now - a.getTime()) / DAY));

export function reachOut(c: QueueContact, now = Date.now()): QueueItem | null {
  if (c.unsubscribed || c.stage === 'customer' || c.stage === 'lost' || c.outcome === 'not_interested' || c.replyClass === 'not_interested' || c.replyClass === 'unsubscribe') return null;
  const hits: Array<{ score: number; reason: string; action: string }> = [];

  if (c.unansweredReplyAt && POSITIVE.includes(c.replyClass ?? '')) hits.push({ score: 100, reason: `Replied ${days(c.unansweredReplyAt, now) === 0 ? 'today' : `${days(c.unansweredReplyAt, now)} day(s) ago`} and is waiting for an answer`, action: 'Reply to them' });
  else if (c.unansweredReplyAt && c.replyClass !== 'out_of_office') hits.push({ score: 70, reason: 'Replied and has not had an answer yet', action: 'Read and answer their reply' });

  for (const t of c.tasks) {
    if (t.doneAt) continue;
    const due = t.dueAt?.getTime();
    if (due !== undefined && due < now - 0) hits.push({ score: 90, reason: `Task overdue: ${t.title}`, action: t.title });
    else if (due !== undefined && due < now + DAY) hits.push({ score: 60, reason: `Task due today: ${t.title}`, action: t.title });
  }

  const ap = appointmentState({ demoAt: c.demoAt, outcome: c.appointmentOutcome }, now);
  if (ap === 'needs_update') hits.push({ score: 85, reason: 'The meeting time has passed and nobody recorded what happened', action: 'Record the outcome and the next step' });
  if (ap === 'missed') hits.push({ score: 75, reason: 'Missed the meeting', action: 'Invite them to book again' });
  if (ap === 'upcoming' && c.demoAt && c.demoAt.getTime() - now < 2 * DAY) hits.push({ score: 65, reason: 'Meeting in the next 2 days', action: 'Prepare for the meeting' });

  if (!c.repliedAt && (c.clickCount > 0 || c.openCount >= 3)) hits.push({ score: 45, reason: c.clickCount > 0 ? 'Clicked a link in your email and has not replied' : `Opened your email ${c.openCount} times and has not replied`, action: 'Send a personal message' });

  if ((c.stage === 'proposal_sent' || c.stage === 'demo_booked') && c.lastTouchAt && now - c.lastTouchAt.getTime() > 7 * DAY && ap !== 'upcoming') hits.push({ score: 40, reason: `No activity for ${days(c.lastTouchAt, now)} days since the ${c.stage === 'proposal_sent' ? 'proposal' : 'meeting'}`, action: 'Follow up' });

  if (!hits.length) return null;
  hits.sort((a, b) => b.score - a.score);
  // The top reason sets the score; every other true reason adds a little, so a contact with several things going on rises.
  return { leadId: c.leadId, score: hits[0].score + Math.min(9, (hits.length - 1) * 3), reasons: hits.map((h) => h.reason), action: hits[0].action, assigneeId: c.assigneeId };
}

export function buildQueue(contacts: QueueContact[], opts: { userId?: string; scope: 'mine' | 'all'; now?: number }): QueueItem[] {
  const now = opts.now ?? Date.now();
  return contacts.map((c) => reachOut(c, now)).filter((x): x is QueueItem => !!x)
    // "Mine" = assigned to me, plus unassigned ones anyone may pick up.
    .filter((i) => opts.scope === 'all' || i.assigneeId === opts.userId || i.assigneeId === null)
    .sort((a, b) => b.score - a.score);
}
