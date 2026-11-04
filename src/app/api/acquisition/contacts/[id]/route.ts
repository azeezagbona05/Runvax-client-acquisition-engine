import { NextResponse } from 'next/server';
import { requireAcquisitionAccess } from '@/lib/acquisition/flag';
import { deleteContact } from '@/lib/acquisition/admin';
import { errorResponse } from '@/lib/acquisition/http';

export const dynamic = 'force-dynamic';

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const access = await requireAcquisitionAccess(req);
  if (!access.ok) return access.response;
  try {
    return NextResponse.json(await deleteContact(access.userId, access.email, params.id));
  } catch (err) { return errorResponse(err); }
}
