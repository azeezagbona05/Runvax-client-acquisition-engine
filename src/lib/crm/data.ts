import { prisma } from '@/lib/prisma';
import { acquisitionStage } from '@/lib/replyIntel';
import type { QueueContact } from './queue';

const MAX = 2000;

/** Every contact in the workspace with what the team needs to see. One query, reused by the queue and the contact list. */
export async function loadWorkspaceContacts(ownerId: string) {
  const leads = await prisma.outreachLead.findMany({
    where: { userId: ownerId },
    select: {
      id: true, email: true, name: true, business: true, website: true, status: true, stage: true, outcome: true, replyClass: true, sentAt: true, lastSentAt: true,
      openedAt: true, openCount: true, clickedAt: true, clickCount: true, repliedAt: true, unsubscribedAt: true, demoAt: true, dealValue: true,
      campaign: { select: { id: true, name: true } },
      appointment: { select: { outcome: true } },
      assignment: { select: { assigneeId: true } },
      crmTasks: { where: { doneAt: null }, select: { id: true, title: true, dueAt: true, doneAt: true, assigneeId: true }, orderBy: { dueAt: 'asc' } },
      crmNotes: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' }, take: MAX,
  });
  const replies = await prisma.campaignReply.findMany({ where: { userId: ownerId, respondedAt: null, leadId: { in: leads.map((l) => l.id) } }, select: { leadId: true, receivedAt: true }, orderBy: { receivedAt: 'desc' } });
  const waiting = new Map<string, Date>(); for (const r of replies) if (!waiting.has(r.leadId)) waiting.set(r.leadId, r.receivedAt);
  return leads.map((l) => {
    const touches = [l.lastSentAt, l.openedAt, l.clickedAt, l.repliedAt, l.crmNotes[0]?.createdAt].filter((x): x is Date => !!x);
    const lastTouchAt = touches.length ? new Date(Math.max(...touches.map((t) => t.getTime()))) : null;
    const { stage, lost } = acquisitionStage({ replyClass: l.replyClass, sentAt: l.sentAt, openedAt: l.openedAt, clickedAt: l.clickedAt, repliedAt: l.repliedAt, outcome: l.outcome, stage: l.stage });
    const q: QueueContact = {
      leadId: l.id, business: l.business, name: l.name, email: l.email, stage: l.stage, replyClass: l.replyClass, outcome: l.outcome, repliedAt: l.repliedAt,
      unansweredReplyAt: waiting.get(l.id) ?? null, openCount: l.openCount, clickCount: l.clickCount, lastTouchAt, unsubscribed: !!l.unsubscribedAt || l.status === 'unsubscribed',
      demoAt: l.demoAt, appointmentOutcome: l.appointment?.outcome ?? null, tasks: l.crmTasks.map((t) => ({ title: t.title, dueAt: t.dueAt, doneAt: t.doneAt })), assigneeId: l.assignment?.assigneeId ?? null,
    };
    return { lead: l, queue: q, stage: lost ? 'lost' : stage, lastTouchAt };
  });
}
