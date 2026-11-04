import { NextRequest, NextResponse } from 'next/server';
import { requireAcquisitionAccess } from '@/lib/acquisition/flag';
import { discoveryOverview } from '@/lib/acquisition/candidates';
import { errorResponse } from '@/lib/acquisition/http';

export const dynamic = 'force-dynamic';

// Read-only: whether Places discovery is allowed (and why not), today's budget, candidate counts, and the planned searches.
export async function GET(req: NextRequest) {
  const access = await requireAcquisitionAccess();
  if (!access.ok) return access.response;
  try {
    return NextResponse.json(await discoveryOverview(access.userId, req.nextUrl.searchParams.get('industry')?.slice(0, 40) || 'dental'));
  } catch (err) { return errorResponse(err); }
}
