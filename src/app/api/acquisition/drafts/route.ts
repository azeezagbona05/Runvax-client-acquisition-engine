import { NextRequest, NextResponse } from 'next/server';
import { requireAcquisitionAccess } from '@/lib/acquisition/flag';
import { listDrafts } from '@/lib/acquisition/drafts';
import { errorResponse } from '@/lib/acquisition/http';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const access = await requireAcquisitionAccess();
  if (!access.ok) return access.response;
  try {
    const status = req.nextUrl.searchParams.get('status')?.slice(0, 30) || undefined;
    return NextResponse.json(await listDrafts(access.userId, { status }));
  } catch (err) { return errorResponse(err); }
}
