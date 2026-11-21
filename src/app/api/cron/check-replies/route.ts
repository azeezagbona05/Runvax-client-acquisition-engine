import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardCron } from '@/lib/cron';
import { checkInbox } from '@/lib/acqInboxReader';
import { notifyOwnerOfReply } from '@/lib/acqNotify';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Daily tick: reads the mailbox of everyone who sent campaign emails recently, so replies are filed (and follow-ups stopped)
// even when nobody opens the Inbox. Already-seen messages are skipped by the reader, so running this twice is harmless.
const BUDGET_MS = 45_000;

export async function GET(req: NextRequest) {
  if (!guardCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const started = Date.now();
  const since = new Date(Date.now() - 30 * 86_400_000);
  const sent = await prisma.outreachLead.findMany({ where: { sentAt: { gte: since } }, distinct: ['userId'], select: { userId: true }, take: 500 });
  const rows = await prisma.user.findMany({ where: { id: { in: sent.map((l) => l.userId) }, isSuspended: false, emailVerified: { not: null } }, select: { id: true }, take: 200 })
    .then((u) => u.map((x) => ({ userId: x.id })));
  let users = 0, replies = 0, failed = 0;
  for (const r of rows) {
    if (Date.now() - started > BUDGET_MS) break;
    try {
      const out = await checkInbox(r.userId, { notifyOwner: notifyOwnerOfReply });
      users++;
      if (out.ok) replies += out.replies; else failed++;
    } catch (e) { failed++; console.error('[cron/check-replies]', r.userId, e); }
  }
  return NextResponse.json({ candidates: rows.length, users, replies, failed });
}
