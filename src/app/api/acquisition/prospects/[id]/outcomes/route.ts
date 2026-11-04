import { NextRequest, NextResponse } from 'next/server';
import { requireAcquisitionAccess } from '@/lib/acquisition/flag';
import { recordOutcome } from '@/lib/acquisition/outcomes';
import { readJson, errorResponse } from '@/lib/acquisition/http';

export const dynamic = 'force-dynamic';

// Records a sales outcome that happened outside RUNVAX. Nothing is sent or scheduled.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAcquisitionAccess(req);
  if (!access.ok) return access.response;
  try {
    const result = await recordOutcome(access.userId, access.email, params.id, await readJson(req));
    return NextResponse.json(result, { status: result.ok ? 201 : 422 });
  } catch (err) { return errorResponse(err); }
}
