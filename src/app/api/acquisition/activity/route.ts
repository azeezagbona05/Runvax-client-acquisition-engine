import { NextRequest, NextResponse } from 'next/server';
import { requireAcquisitionAccess } from '@/lib/acquisition/flag';
import { listActivity } from '@/lib/acquisition/agents';
import { errorResponse } from '@/lib/acquisition/http';

export const dynamic = 'force-dynamic';

const STATUSES = ['pending', 'running', 'completed', 'skipped', 'failed', 'dead', 'cancelled'];

// Read-only: persisted task activity, newest first (queued tasks included).
export async function GET(req: NextRequest) {
  const access = await requireAcquisitionAccess();
  if (!access.ok) return access.response;
  try {
    const status = req.nextUrl.searchParams.get('status') ?? undefined;
    return NextResponse.json(await listActivity(access.userId, { status: status && STATUSES.includes(status) ? status : undefined }));
  } catch (err) { return errorResponse(err); }
}
