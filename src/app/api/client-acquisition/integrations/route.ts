import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/requireUser';
import { allStatuses } from '@/lib/integrations/providers';

export const dynamic = 'force-dynamic';

/** Live connection state of every integration for the signed-in user. */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user.ok) return user.response;
  try {
    return NextResponse.json({ integrations: await allStatuses(user.userId) });
  } catch {
    return NextResponse.json({ error: 'Could not load integrations. If this persists, the latest database update has not been applied yet.' }, { status: 500 });
  }
}
