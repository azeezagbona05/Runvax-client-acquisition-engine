import { prisma } from '@/lib/prisma';
import { open, seal } from './crypto';

export type Provider = 'apollo' | 'snov' | 'gcal' | 'airtable' | 'webhooks' | 'gmail' | 'wa';

export async function getConnection(userId: string, provider: Provider) {
  const row = await prisma.integrationConnection.findUnique({ where: { userId_provider: { userId, provider } } });
  if (!row) return null;
  return { ...row, secrets: open<Record<string, string>>(row.secret) ?? {}, metaObj: (row.meta ?? {}) as Record<string, unknown> };
}

export async function saveConnection(userId: string, provider: Provider, secrets: Record<string, string>, meta: Record<string, unknown> = {}, status: 'connected' | 'error' = 'connected', detail: string | null = null) {
  const data = { secret: seal(secrets), meta: meta as object, status, statusDetail: detail, lastCheckedAt: new Date() };
  await prisma.integrationConnection.upsert({ where: { userId_provider: { userId, provider } }, create: { userId, provider, ...data }, update: data });
}

export async function markStatus(userId: string, provider: Provider, status: 'connected' | 'error', detail: string | null, extra: { synced?: boolean } = {}) {
  await prisma.integrationConnection.updateMany({ where: { userId, provider }, data: { status, statusDetail: detail ? detail.slice(0, 480) : null, lastCheckedAt: new Date(), ...(extra.synced ? { lastSyncAt: new Date() } : {}) } });
}

export async function removeConnection(userId: string, provider: Provider) {
  await prisma.integrationConnection.deleteMany({ where: { userId, provider } });
}
