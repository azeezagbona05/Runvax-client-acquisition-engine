import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedUser } from '@/lib/requireUser';
import { requireFeature } from '@/lib/usage';
import { TRIAL_DAYS, trialOfferOpen } from '@/lib/promo';

/**
 * Who may use the Client Acquisition app (build campaigns, import leads, find prospects, read activity):
 * any verified account. Everyone gets the new experience; only SENDING is restricted, below.
 */
export async function requireCampaignUser(req: NextRequest): Promise<{ ok: true; userId: string } | { ok: false; response: NextResponse }> {
  return requireVerifiedUser(req);
}

/**
 * Who may actually send email (start a campaign, send, send a test, reply from the inbox): verified accounts on a plan
 * with Email Blast. Cold email from free accounts is the easiest way to abuse a sending tool, so this stays behind Pro.
 * The error is a plain sentence the page can show as it is; it uses 403 and its own code so the generic upgrade popup (which talks about daily limits) does not open.
 */
export async function requireCampaignSender(req: NextRequest): Promise<{ ok: true; userId: string } | { ok: false; response: NextResponse }> {
  const user = await requireVerifiedUser(req);
  if (!user.ok) return user;
  const gate = await requireFeature(req, 'emailBlast');
  if (gate.ok) return user;
  return {
    ok: false,
    response: NextResponse.json({
      error: `Sending campaigns is part of Pro. Your campaign and leads are saved and ready.${trialOfferOpen() ? ` Start your free ${TRIAL_DAYS}-day Pro trial to send.` : ' Contact info@runvax.com to unlock sending.'}`,
      code: 'SENDING_LOCKED',
    }, { status: 403 }),
  };
}
