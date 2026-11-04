import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { sendTestEmail } from '@/lib/outreachSender';

export const dynamic = 'force-dynamic';

/** POST — sends the campaign's email, filled in with sample details, to the account's own address. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;
  if (!rateLimit(`oc-test:${user.userId}`, { maxRequests: 5, windowMs: 60_000 }).ok) {
    return NextResponse.json({ error: 'Too many test emails. Try again in a minute.' }, { status: 429 });
  }
  const [campaign, account] = await Promise.all([
    prisma.outreachCampaign.findFirst({ where: { id: params.id, userId: user.userId }, select: { subject: true, body: true } }),
    prisma.user.findUnique({ where: { id: user.userId }, select: { email: true } }),
  ]);
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!account?.email) return NextResponse.json({ error: 'Your account has no email address to send the test to.' }, { status: 400 });

  const res = await sendTestEmail(user.userId, { campaign, to: account.email });
  return res.ok ? NextResponse.json({ ok: true, to: account.email }) : NextResponse.json({ error: res.message }, { status: 502 });
}
