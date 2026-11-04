import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAcquisitionAccess } from '@/lib/acquisition/flag';
import { listProspects } from '@/lib/acquisition/admin';
import { addManualProspect } from '@/lib/acquisition/imports/service';
import { readJson, errorResponse } from '@/lib/acquisition/http';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const access = await requireAcquisitionAccess();
  if (!access.ok) return access.response;
  try {
    const u = req.nextUrl.searchParams;
    return NextResponse.json(await listProspects(access.userId, {
      state: u.get('state') ?? undefined, band: u.get('band') ?? undefined,
      search: u.get('q')?.slice(0, 100) ?? undefined, page: Number(u.get('page') ?? '1') || 1,
    }));
  } catch (err) { return errorResponse(err); }
}

const ManualSchema = z.strictObject({
  industryKey: z.string().min(1).max(50),
  row: z.record(z.string(), z.string().max(500)),
  attest: z.literal(true),
});

// Manual add of one clinic — same validation, suppression and dedupe as a CSV row.
export async function POST(req: NextRequest) {
  const access = await requireAcquisitionAccess(req);
  if (!access.ok) return access.response;
  try {
    const body = ManualSchema.parse(await readJson(req));
    return NextResponse.json(await addManualProspect({ userId: access.userId, industryKey: body.industryKey, row: body.row, attestedBy: access.email, attest: body.attest }));
  } catch (err) { return errorResponse(err); }
}
