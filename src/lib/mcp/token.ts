import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getConnection, removeConnection, saveConnection } from '@/lib/integrations/store';

/** A personal access token for connecting an AI assistant (Claude) to one RUNVAX account. Shown once; only its SHA-256 is kept, sealed. */
const RE = /^rvx_([a-z0-9]{20,40})_([A-Za-z0-9_-]{40,})$/;
const sha = (t: string) => crypto.createHash('sha256').update(t).digest('hex');
const same = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function createMcpToken(userId: string): Promise<string> {
  const token = `rvx_${userId}_${crypto.randomBytes(32).toString('base64url')}`;
  await saveConnection(userId, 'mcp', { hash: sha(token) }, { createdAt: new Date().toISOString(), lastUsedAt: null });
  return token;
}
export const revokeMcpToken = (userId: string) => removeConnection(userId, 'mcp');

export async function mcpTokenStatus(userId: string): Promise<{ connected: boolean; createdAt: string | null; lastUsedAt: string | null }> {
  const c = await getConnection(userId, 'mcp');
  if (!c) return { connected: false, createdAt: null, lastUsedAt: null };
  return { connected: true, createdAt: (c.metaObj.createdAt as string) ?? null, lastUsedAt: (c.metaObj.lastUsedAt as string) ?? null };
}

/** The account a token belongs to, or null. Suspended accounts never authenticate. */
export async function verifyMcpToken(raw: string | null | undefined): Promise<string | null> {
  const token = (raw ?? '').replace(/^Bearer\s+/i, '').trim();
  const m = RE.exec(token); if (!m) return null;
  const userId = m[1];
  const c = await getConnection(userId, 'mcp');
  if (!c || !c.secrets.hash || !same(sha(token), c.secrets.hash)) return null;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { isSuspended: true } });
  if (!u || u.isSuspended) return null;
  const last = c.metaObj.lastUsedAt ? Date.parse(String(c.metaObj.lastUsedAt)) : 0;
  if (Date.now() - last > 60_000) await prisma.integrationConnection.updateMany({ where: { userId, provider: 'mcp' }, data: { meta: { ...c.metaObj, lastUsedAt: new Date().toISOString() } as object } }).catch(() => {});
  return userId;
}
