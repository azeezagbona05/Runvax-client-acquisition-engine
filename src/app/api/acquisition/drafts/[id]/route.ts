import { NextResponse } from 'next/server';
import { requireAcquisitionAccess } from '@/lib/acquisition/flag';
import { getDraftDetail } from '@/lib/acquisition/drafts';
import { errorResponse } from '@/lib/acquisition/http';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const access = await requireAcquisitionAccess();
  if (!access.ok) return access.response;
  try {
    const detail = await getDraftDetail(access.userId, params.id);
    if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(detail);
  } catch (err) { return errorResponse(err); }
}
