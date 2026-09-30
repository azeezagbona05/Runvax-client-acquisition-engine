import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { runAdminOpsAction, type AdminOpsRecommendationType } from '@/lib/adminOps';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase());
const VALID_TYPES: AdminOpsRecommendationType[] = ['send_expiry_reminders'];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email.toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { type } = await req.json() as { type?: string };
  if (!type || !VALID_TYPES.includes(type as AdminOpsRecommendationType)) {
    return NextResponse.json({ error: 'Unknown recommendation type' }, { status: 400 });
  }

  const result = await runAdminOpsAction(type as AdminOpsRecommendationType, session.user.email);
  return NextResponse.json(result);
}
