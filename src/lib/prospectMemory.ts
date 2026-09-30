import { prisma } from '@/lib/prisma';

export type MemoryKind = 'opportunity' | 'reply' | 'note';

/**
 * Stores one fact about a prospect. Never throws — memory is a side effect of
 * an agent's real work and must not fail it. Skips a fact already stored.
 */
export async function remember(params: {
  userId: string;
  prospectId: string;
  kind: MemoryKind;
  content: string;
  source: string;
  confidence?: 'low' | 'medium' | 'high';
}) {
  try {
    const content = params.content.slice(0, 1000);
    const existing = await prisma.prospectMemory.findFirst({
      where: { prospectId: params.prospectId, kind: params.kind, content },
      select: { id: true },
    });
    if (existing) return;
    await prisma.prospectMemory.create({
      data: {
        userId: params.userId,
        prospectId: params.prospectId,
        kind: params.kind,
        content,
        source: params.source,
        confidence: params.confidence ?? 'medium',
      },
    });
  } catch (e) {
    console.error('remember failed', e);
  }
}

export async function recall(userId: string, prospectId: string, limit = 20) {
  return prisma.prospectMemory.findMany({
    where: { userId, prospectId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, kind: true, content: true, source: true, confidence: true, createdAt: true },
  });
}
