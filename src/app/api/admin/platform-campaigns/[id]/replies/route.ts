import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { checkReplies } from '@/lib/platformCampaign';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** POST: read the sending mailbox for replies from this account's campaign contacts and file them (sorted: interested, question, no, out of office...). */
export async function POST() {
  const admin = await requireAdmin(); if (!admin.ok) return admin.response;
  if (!rateLimit(`pc-inbox:${admin.userId}`, { maxRequests: 10, windowMs: 60_000 }).ok) return NextResponse.json({ error: 'Slow down: try again in a minute.' }, { status: 429 });
  const r = await checkReplies(admin.userId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
  return NextResponse.json({ ok: true, scanned: r.scanned, replies: r.replies, duplicates: r.duplicates });
}
