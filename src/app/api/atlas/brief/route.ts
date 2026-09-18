import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOrCreateTodaysBrief } from '@/lib/atlas';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const brief = await getOrCreateTodaysBrief(session.user.id);
  return NextResponse.json({ summary: brief.summary, recommendations: brief.recommendations });
}
