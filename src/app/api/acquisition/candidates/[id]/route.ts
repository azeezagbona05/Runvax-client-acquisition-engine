import { NextRequest, NextResponse } from 'next/server';
import { requireAcquisitionAccess } from '@/lib/acquisition/flag';
import { actOnCandidate } from '@/lib/acquisition/candidates';
import { readJson, errorResponse } from '@/lib/acquisition/http';

export const dynamic = 'force-dynamic';

// exclude, or promote with an independent source (website, source, two attestations).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAcquisitionAccess(req);
  if (!access.ok) return access.response;
  try {
    const r = await actOnCandidate(access.userId, access.email, params.id, await readJson(req));
    return NextResponse.json(r, { status: r.ok ? 200 : 422 });
  } catch (err) { return errorResponse(err); }
}
