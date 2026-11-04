import { NextResponse } from 'next/server';
import { requireAcquisitionAccess } from '@/lib/acquisition/flag';
import { listIndustries } from '@/lib/acquisition/config/registry';
import { prisma } from '@/lib/prisma';
import { overview } from '@/lib/acquisition/admin';

export const dynamic = 'force-dynamic';

const TASK_STATUSES = ['pending', 'running', 'completed', 'skipped', 'failed', 'dead', 'cancelled'] as const;

// Read-only summary for the admin overview: which industry packs are loaded,
// the state of their offers, and the acquisition queue.
export async function GET() {
  const access = await requireAcquisitionAccess();
  if (!access.ok) return access.response;

  const counts = await Promise.all(
    TASK_STATUSES.map((status) => prisma.acquisitionTask.count({ where: { userId: access.userId, status } })),
  );

  return NextResponse.json({
    enabled: true,
    overview: await overview(access.userId),
    industries: listIndustries().map((i) => ({
      id: i.id,
      version: i.version,
      displayName: i.displayName,
      city: i.geography.city,
      liveSendingEnabled: i.compliance.liveSendingEnabled,
      offers: i.offers.map((o) => ({ id: o.id, name: o.name, status: o.status })),
      categories: i.opportunityCategories.map((c) => ({ id: c.id, label: c.label, weight: c.weight, provisional: c.weightIsProvisional })),
    })),
    tasks: Object.fromEntries(TASK_STATUSES.map((s, i) => [s, counts[i]])),
  });
}
