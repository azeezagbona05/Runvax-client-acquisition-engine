import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { runDelegatedAction, type AtlasRecommendationType } from '@/lib/atlas';

export const dynamic = 'force-dynamic';

const VALID_TYPES: AtlasRecommendationType[] = ['reactivate_cold_leads', 'scan_more_prospects', 'follow_up_interested'];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { type } = await req.json() as { type?: string };
  if (!type || !VALID_TYPES.includes(type as AtlasRecommendationType)) {
    return NextResponse.json({ error: 'Unknown recommendation type' }, { status: 400 });
  }

  const result = await runDelegatedAction(session.user.id, type as AtlasRecommendationType);
  return NextResponse.json(result);
}
