import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getOrCreateTodaysAdminBrief } from '@/lib/adminOps';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase());

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email.toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const brief = await getOrCreateTodaysAdminBrief();
  return NextResponse.json({ summary: brief.summary, recommendations: brief.recommendations });
}
