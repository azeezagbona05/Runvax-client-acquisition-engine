import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedUser } from '@/lib/requireUser';
import { requireFeature } from '@/lib/usage';

/**
 * Who may use email campaigns: verified accounts on a plan with Email Blast. Cold email from
 * unverified or free accounts is the easiest way to abuse a sending tool, so both are required.
 */
export async function requireCampaignUser(req: NextRequest): Promise<{ ok: true; userId: string } | { ok: false; response: NextResponse }> {
  const user = await requireVerifiedUser(req);
  if (!user.ok) return user;
  const gate = await requireFeature(req, 'emailBlast');
  if (!gate.ok) return { ok: false, response: gate.error! };
  return user;
}
