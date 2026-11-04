import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAcquisitionAccess } from '@/lib/acquisition/flag';
import { previewImport } from '@/lib/acquisition/imports/service';
import { readJson, errorResponse } from '@/lib/acquisition/http';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const PreviewSchema = z.strictObject({
  industryKey: z.string().min(1).max(50),
  label: z.string().max(190).optional(),
  csvText: z.string().max(2 * 1024 * 1024),
});

export async function GET() {
  const access = await requireAcquisitionAccess();
  if (!access.ok) return access.response;
  try {
    const batches = await prisma.acquisitionImportBatch.findMany({
      where: { userId: access.userId }, orderBy: { createdAt: 'desc' }, take: 20,
      select: { id: true, kind: true, label: true, status: true, rowCount: true, acceptedCount: true, duplicateCount: true, rejectedCount: true, createdAt: true, attestedAt: true },
    });
    return NextResponse.json({ batches });
  } catch (err) { return errorResponse(err); }
}

// Preview only: validates and reports per-row outcomes; creates no prospects.
export async function POST(req: NextRequest) {
  const access = await requireAcquisitionAccess(req);
  if (!access.ok) return access.response;
  try {
    const body = PreviewSchema.parse(await readJson(req, 2 * 1024 * 1024 + 4096));
    return NextResponse.json(await previewImport({ userId: access.userId, industryKey: body.industryKey, kind: 'csv', csvText: body.csvText, label: body.label }));
  } catch (err) { return errorResponse(err); }
}
