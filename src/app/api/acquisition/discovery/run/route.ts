import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAcquisitionAccess } from '@/lib/acquisition/flag';
import { getIndustry } from '@/lib/acquisition/config/registry';
import { placesActivation } from '@/lib/acquisition/places/adapter';
import { enqueueAcqTask } from '@/lib/acquisition/tasks/queue';
import { readJson, errorResponse } from '@/lib/acquisition/http';
import { AdminActionError } from '@/lib/acquisition/admin';

export const dynamic = 'force-dynamic';

const Body = z.strictObject({ industryKey: z.string().min(1).max(40), area: z.string().min(2).max(60), queryIndex: z.number().int().min(0).max(20) });

// Queues ONE Places search task for an area. Refused while discovery is switched off, so nothing is queued
// that could never run; the task itself re-checks the gates before any request or budget use.
export async function POST(req: NextRequest) {
  const access = await requireAcquisitionAccess(req);
  if (!access.ok) return access.response;
  try {
    const b = Body.parse(await readJson(req));
    const gate = placesActivation();
    if (!gate.allowed) return NextResponse.json({ error: 'Places discovery is switched off', reasons: gate.reasons }, { status: 409 });
    const industry = getIndustry(b.industryKey);
    if (!industry) throw new AdminActionError(`Unknown industry "${b.industryKey}"`);
    if (!industry.geography.priorityAreas.includes(b.area)) throw new AdminActionError('Area is not one of this industry\'s configured areas');
    if (b.queryIndex >= industry.discovery.placesQueries.length) throw new AdminActionError('No such search query');
    const t = await enqueueAcqTask({ userId: access.userId, type: 'acq.discover', input: { industryKey: b.industryKey, area: b.area, queryIndex: b.queryIndex } });
    return NextResponse.json({ ok: true, taskId: t.id, created: t.created }, { status: 202 });
  } catch (err) { return errorResponse(err); }
}
