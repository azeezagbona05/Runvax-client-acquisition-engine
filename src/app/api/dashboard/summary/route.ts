import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDashboardSummary } from '@/lib/dashboardSummary';

export const dynamic = 'force-dynamic';

// Customer-facing outcomes for the signed-in user only — every query inside is
// scoped by session.user.id. No internal agent or platform data is exposed.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    return NextResponse.json(await getDashboardSummary(session.user.id));
  } catch (e) {
    console.error('[/api/dashboard/summary]', e);
    return NextResponse.json({ error: 'Could not load dashboard' }, { status: 500 });
  }
}
