import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAcquisitionAccess } from '@/lib/acquisition/flag';
import { commitImport } from '@/lib/acquisition/imports/service';
import { readJson, errorResponse } from '@/lib/acquisition/http';

export const dynamic = 'force-dynamic';

const CommitSchema = z.strictObject({ attest: z.literal(true) });

// Creates the previewed prospects. Requires the admin's attestation.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAcquisitionAccess(req);
  if (!access.ok) return access.response;
  try {
    const body = CommitSchema.parse(await readJson(req));
    return NextResponse.json(await commitImport({ userId: access.userId, batchId: params.id, attestedBy: access.email, attest: body.attest }));
  } catch (err) { return errorResponse(err); }
}
