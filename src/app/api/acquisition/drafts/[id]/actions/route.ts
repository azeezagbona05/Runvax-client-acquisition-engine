import { NextRequest, NextResponse } from 'next/server';
import { requireAcquisitionAccess } from '@/lib/acquisition/flag';
import { actOnDraft } from '@/lib/acquisition/drafts';
import { readJson, errorResponse } from '@/lib/acquisition/http';

export const dynamic = 'force-dynamic';

// Review decisions: edit / approve / reject / mark_ready / regenerate.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAcquisitionAccess(req);
  if (!access.ok) return access.response;
  try {
    const result = await actOnDraft(access.userId, access.email, params.id, await readJson(req));
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (err) { return errorResponse(err); }
}
