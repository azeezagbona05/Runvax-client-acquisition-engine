import { NextResponse } from 'next/server';
import { isAdminSession } from '@/lib/adminSessionShared';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOrCreateTodaysAdminBrief } from '@/lib/adminOps';

export const dynamic = 'force-dynamic';


export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isAdminSession(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const brief = await getOrCreateTodaysAdminBrief();
  return NextResponse.json({ summary: brief.summary, recommendations: brief.recommendations });
}
