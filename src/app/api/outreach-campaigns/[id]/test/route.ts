import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignSender } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { sendTestEmail } from '@/lib/outreachSender';
import { sanitizeAutomation, stepCopy } from '@/lib/automation';

export const dynamic = 'force-dynamic';

/**
 * POST { step?, opened? } — sends one of the campaign's emails, filled in with sample details, to the account's own
 * address. Without a step it is the first email; `opened` picks a follow-up's version for people who opened.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireCampaignSender(req);
  if (!user.ok) return user.response;
  if (!rateLimit(`oc-test:${user.userId}`, { maxRequests: 5, windowMs: 60_000 }).ok) {
    return NextResponse.json({ error: 'Too many test emails. Try again in a minute.' }, { status: 429 });
  }
  const [campaign, account] = await Promise.all([
    prisma.outreachCampaign.findFirst({ where: { id: params.id, userId: user.userId }, select: { subject: true, body: true, automation: true } }),
    prisma.user.findUnique({ where: { id: user.userId }, select: { email: true } }),
  ]);
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!account?.email) return NextResponse.json({ error: 'Your account has no email address to send the test to.' }, { status: 400 });

  const body = await req.json().catch(() => ({})) as { step?: unknown; opened?: unknown };
  const seq = campaign.automation ? sanitizeAutomation(campaign.automation) : null;
  const index = typeof body.step === 'number' && Number.isInteger(body.step) ? body.step : 0;
  const step = seq && index > 0 ? seq.emails[index] : undefined;
  if (index > 0 && !step) return NextResponse.json({ error: 'That email is not in this campaign.' }, { status: 400 });
  const copy = step ? stepCopy(step, body.opened === true) : { subject: campaign.subject, body: campaign.body };
  const res = await sendTestEmail(user.userId, { campaign: { subject: copy.subject, body: copy.body }, to: account.email, ...(step ? { originalSubject: campaign.subject } : {}) });
  return res.ok ? NextResponse.json({ ok: true, to: account.email }) : NextResponse.json({ error: res.message }, { status: 502 });
}
