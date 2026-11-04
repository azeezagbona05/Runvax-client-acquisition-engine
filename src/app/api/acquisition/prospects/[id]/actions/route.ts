import { NextRequest, NextResponse } from 'next/server';
import { requireAcquisitionAccess } from '@/lib/acquisition/flag';
import { runAction } from '@/lib/acquisition/admin';
import { readJson, errorResponse } from '@/lib/acquisition/http';

export const dynamic = 'force-dynamic';

// Admin actions on one prospect. A reason is required and recorded.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAcquisitionAccess(req);
  if (!access.ok) return access.response;
  try {
    return NextResponse.json(await runAction(access.userId, access.email, params.id, await readJson(req)));
  } catch (err) { return errorResponse(err); }
}
