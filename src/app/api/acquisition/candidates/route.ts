import { NextRequest, NextResponse } from 'next/server';
import { requireAcquisitionAccess } from '@/lib/acquisition/flag';
import { listCandidates } from '@/lib/acquisition/candidates';
import { errorResponse } from '@/lib/acquisition/http';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const access = await requireAcquisitionAccess();
  if (!access.ok) return access.response;
  try {
    const sp = req.nextUrl.searchParams;
    return NextResponse.json({ items: await listCandidates(access.userId, { industryKey: sp.get('industry')?.slice(0, 40) || undefined, status: sp.get('status')?.slice(0, 30) || undefined }) });
  } catch (err) { return errorResponse(err); }
}
