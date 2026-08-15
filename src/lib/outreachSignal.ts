import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { emptySaturation, isTrackableBusinessId, type Saturation } from '@/lib/saturation';

// Server-side reads/writes for the cross-user outreach tracker.
// Reads are aggregates only — nothing here can return who is in a count.

/**
 * Record that `userId` has sent `businessId` a message.
 *
 * Idempotent per (business, user): repeat sends bump sendCount/lastSentAt but
 * never inflate the distinct-user count that the badge reports.
 */
export async function recordOutreachSignal(
  userId: string,
  businessId: string,
  channel: string,
): Promise<void> {
  if (!isTrackableBusinessId(businessId)) return;

  const now = new Date();
  const args = {
    where: { businessId_userId: { businessId, userId } },
    create: { businessId, userId, channel, firstSentAt: now, lastSentAt: now },
    update: { channel, lastSentAt: now, sendCount: { increment: 1 } },
  };

  try {
    await prisma.outreachSignal.upsert(args);
  } catch (err) {
    // Prisma's upsert isn't atomic on MySQL — a concurrent send for the same
    // (businessId, userId) can win the create race. Retry: the row now exists.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      await prisma.outreachSignal.upsert(args);
    } else {
      throw err;
    }
  }
}

/**
 * Aggregate saturation for a batch of businesses.
 *
 * Two indexed queries regardless of batch size: one GROUP BY for the public
 * aggregate, one narrow lookup for the viewer's own rows. Businesses with no
 * signal are returned as zeroed entries so callers never have to null-check.
 */
export async function getSaturation(
  businessIds: string[],
  userId: string,
): Promise<Record<string, Saturation>> {
  const ids = Array.from(new Set(businessIds.filter(isTrackableBusinessId)));
  const out: Record<string, Saturation> = {};
  if (ids.length === 0) return out;

  for (const id of ids) out[id] = emptySaturation(id);

  const [totals, mine] = await Promise.all([
    prisma.outreachSignal.groupBy({
      by: ['businessId'],
      where: { businessId: { in: ids } },
      _count: { _all: true },
      _max: { lastSentAt: true },
    }),
    prisma.outreachSignal.findMany({
      where: { businessId: { in: ids }, userId },
      select: { businessId: true, lastSentAt: true },
    }),
  ]);

  for (const t of totals) {
    const row = out[t.businessId];
    if (!row) continue;
    row.userCount = t._count._all;
    row.otherCount = t._count._all;
    row.lastSentAt = t._max.lastSentAt?.toISOString() ?? null;
  }

  // Subtract the viewer from otherCount — "You + 13 others" reads far better
  // than a 14 that silently includes yourself.
  for (const m of mine) {
    const row = out[m.businessId];
    if (!row) continue;
    row.youContacted = true;
    row.yourLastSentAt = m.lastSentAt.toISOString();
    row.otherCount = Math.max(0, row.userCount - 1);
  }

  return out;
}

/** Single-business convenience wrapper. */
export async function getSaturationFor(
  businessId: string,
  userId: string,
): Promise<Saturation> {
  const map = await getSaturation([businessId], userId);
  return map[businessId] ?? emptySaturation(businessId);
}
