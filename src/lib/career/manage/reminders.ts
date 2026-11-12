import { prisma } from '@/lib/prisma';
import { EMPLOYER_KINDS } from './classify';

const DAY = 86_400_000;
export const FOLLOW_UP_AFTER_DAYS = 7;
export const MAX_FOLLOW_UPS = 2;

export interface Reminder { kind: 'interview' | 'follow_up' | 'approval'; id: string; title: string; detail: string; due: Date }

/** What needs the candidate's attention now. Everything is derived from their own records, so there is nothing to keep in sync. */
export async function computeReminders(userId: string, now = new Date()): Promise<Reminder[]> {
  const out: Reminder[] = [];
  const interviews = await prisma.careerInterview.findMany({ where: { userId, status: 'scheduled', startsAt: { gte: now, lte: new Date(now.getTime() + 3 * DAY) } }, orderBy: { startsAt: 'asc' } });
  for (const i of interviews) out.push({ kind: 'interview', id: i.id, title: `Interview: ${i.title} at ${i.company}`, detail: [i.kind, i.location].filter(Boolean).join(' · '), due: i.startsAt });

  const applied = await prisma.jobApplication.findMany({ where: { userId, status: 'applied', appliedAt: { lte: new Date(now.getTime() - FOLLOW_UP_AFTER_DAYS * DAY) } }, include: { responses: { select: { kind: true, receivedAt: true } }, match: { include: { listing: { select: { title: true, company: true } } } } } });
  for (const a of applied) {
    if (a.responses.some((r) => EMPLOYER_KINDS.includes(r.kind as never))) continue;       // they replied: no chasing
    const ups = a.responses.filter((r) => r.kind === 'followed_up'); if (ups.length >= MAX_FOLLOW_UPS) continue;
    const last = ups.reduce((t, r) => Math.max(t, r.receivedAt.getTime()), a.appliedAt!.getTime());
    const due = new Date(last + FOLLOW_UP_AFTER_DAYS * DAY); if (due > now) continue;
    out.push({ kind: 'follow_up', id: a.id, title: `Follow up: ${a.match.listing.title} at ${a.match.listing.company}`, detail: `No reply ${ups.length ? 'to your follow-up' : `${FOLLOW_UP_AFTER_DAYS} days after you applied`}`, due });
  }

  const waiting = await prisma.jobApplication.findMany({ where: { userId, status: 'prepared', updatedAt: { lte: new Date(now.getTime() - 2 * DAY) } }, include: { match: { include: { listing: { select: { title: true, company: true } } } } }, take: 10 });
  for (const a of waiting) out.push({ kind: 'approval', id: a.id, title: `Decide: ${a.match.listing.title} at ${a.match.listing.company}`, detail: 'Prepared and waiting for your approval', due: a.updatedAt });
  return out.sort((x, y) => x.due.getTime() - y.due.getTime());
}

/** A short, polite, fact-free note. It states only what the candidate did (applied for a role, on a date), so there is nothing to invent. */
export function followUpDraft(p: { name: string }, job: { title: string; company: string }, appliedAt: Date, nth: number): string {
  const when = appliedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return [`Subject: Following up on my application for ${job.title}`, `Dear Hiring Team at ${job.company},`,
    nth === 0 ? `I applied for the ${job.title} position on ${when} and wanted to confirm that my application reached you. I remain very interested in the role and would be glad to provide anything else you need.`
      : `I am following up again on my application for the ${job.title} position, submitted on ${when}. I remain interested and would welcome an update on where the process stands.`,
    'Thank you for your time.', `Kind regards,\n${p.name || ''}`.trim()].join('\n\n');
}
