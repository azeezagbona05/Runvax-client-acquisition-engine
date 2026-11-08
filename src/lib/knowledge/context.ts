import { prisma } from '@/lib/prisma';
import { rankChunks } from './retrieve';

/** The few excerpts from the assistant's knowledge base that bear on what the visitor just said. Only the owner's own ready sources are searched. */
export async function knowledgeExcerpts(userId: string, sourceIds: string[], query: string, k = 5): Promise<string[]> {
  if (!sourceIds.length || !query.trim()) return [];
  const rows = await prisma.knowledgeChunk.findMany({ where: { userId, sourceId: { in: sourceIds.slice(0, 20) }, source: { status: 'ready' } }, take: 3000, select: { text: true, label: true } });
  let total = 0;
  return rankChunks(query, rows, k).map((r) => `${r.item.label ? `[${r.item.label}] ` : ''}${r.item.text.slice(0, 900)}`).filter((t) => { total += t.length; return total <= 3500; });
}
