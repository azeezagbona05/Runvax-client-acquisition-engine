import { NextRequest, NextResponse } from 'next/server';
import { requireAcquisitionAccess } from '@/lib/acquisition/flag';
import { addManualContact } from '@/lib/acquisition/admin';
import { readJson, errorResponse } from '@/lib/acquisition/http';

export const dynamic = 'force-dynamic';

// The ONLY way a named contact enters the system: an admin, with a source and a lawful basis.
export async function POST(req: NextRequest) {
  const access = await requireAcquisitionAccess(req);
  if (!access.ok) return access.response;
  try {
    return NextResponse.json(await addManualContact(access.userId, access.email, await readJson(req)));
  } catch (err) { return errorResponse(err); }
}
