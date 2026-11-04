import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAcquisitionAccess } from '@/lib/acquisition/flag';
import { generateDraft } from '@/lib/acquisition/drafts';
import { readJson, errorResponse } from '@/lib/acquisition/http';

export const dynamic = 'force-dynamic';

const GenerateSchema = z.strictObject({ recipientDmId: z.string().min(1).max(64).optional() });

// Generates a deterministic pitch draft for human review. Nothing is sent.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireAcquisitionAccess(req);
  if (!access.ok) return access.response;
  try {
    const body = GenerateSchema.parse(await readJson(req));
    const result = await generateDraft(access.userId, access.email, params.id, body);
    return NextResponse.json(result, { status: result.ok ? 201 : 422 });
  } catch (err) { return errorResponse(err); }
}
