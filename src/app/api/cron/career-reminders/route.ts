import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardCron } from '@/lib/cron';
import { sendDigestFor } from '@/lib/career/manage/digest';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Daily tick: one reminder email per deployed Career Agent user who has something due (interviews soon, follow-ups newly due). Emails only the user themself.
export async function GET(req: NextRequest) {
  if (!guardCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const users = await prisma.careerPreference.findMany({ where: { status: 'active', user: { isSuspended: false } }, select: { userId: true }, take: 500 });
  let emailed = 0, items = 0;
  for (const u of users) { const n = await sendDigestFor(u.userId); if (n) { emailed++; items += n; } }
  return NextResponse.json({ checked: users.length, emailed, items });
}
