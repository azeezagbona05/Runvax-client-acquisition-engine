import { NextRequest, NextResponse } from 'next/server';
import { requireAcquisitionAccess } from '@/lib/acquisition/flag';
import { addManualEvidence } from '@/lib/acquisition/evidence';
import { readJson, errorResponse } from '@/lib/acquisition/http';

export const dynamic = 'force-dynamic';

// Records evidence an admin observed on the clinic's own website.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAcquisitionAccess(req);
  if (!access.ok) return access.response;
  try {
    return NextResponse.json(await addManualEvidence(access.userId, access.email, params.id, await readJson(req)), { status: 201 });
  } catch (err) { return errorResponse(err); }
}
