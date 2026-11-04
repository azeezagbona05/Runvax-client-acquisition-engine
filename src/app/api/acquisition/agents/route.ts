import { NextResponse } from 'next/server';
import { requireAcquisitionAccess } from '@/lib/acquisition/flag';
import { agentOverview } from '@/lib/acquisition/agents';
import { errorResponse } from '@/lib/acquisition/http';

export const dynamic = 'force-dynamic';

// Read-only: each agent's real capability, state and recorded activity.
export async function GET() {
  const access = await requireAcquisitionAccess();
  if (!access.ok) return access.response;
  try {
    return NextResponse.json(await agentOverview(access.userId));
  } catch (err) { return errorResponse(err); }
}
