import { NextResponse } from 'next/server';
import { requireAcquisitionAccess } from '@/lib/acquisition/flag';
import { listRuns } from '@/lib/acquisition/admin';
import { errorResponse } from '@/lib/acquisition/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  const access = await requireAcquisitionAccess();
  if (!access.ok) return access.response;
  try {
    return NextResponse.json({ runs: await listRuns(access.userId) });
  } catch (err) { return errorResponse(err); }
}
