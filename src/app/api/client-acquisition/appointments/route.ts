import { NextRequest, NextResponse } from 'next/server';
import { guardInstalled } from '@/lib/v2Setup';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { countAppointments, loadAppointments } from '@/lib/appointments';

export const dynamic = 'force-dynamic';

/** GET: every booked appointment with what happened and the next step, plus counts for the tabs. */
export const GET = (req: NextRequest) => guardInstalled(async () => {
  const user = await requireCampaignUser(req); if (!user.ok) return user.response;
  try {
    const rows = await loadAppointments(user.userId);
    return NextResponse.json({ rows, counts: countAppointments(rows) });
  } catch (e) {
    console.error('[appointments]', e);
    return NextResponse.json({ error: 'Appointments are not available yet. The database update for them has not been applied.' }, { status: 503 });
  }
});
