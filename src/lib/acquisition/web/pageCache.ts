import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { registrableDomain } from './url';

// Short-lived store of fetched pages (HTML only, bounded) so contact research
// and the audit don't fetch the same page twice. Never a long-term archive.

export const urlHash = (url: string) => crypto.createHash('sha256').update(url).digest('hex');

export interface CachedPage {
  url: string;
  finalUrl: string | null;
  status: string;
  httpStatus: number | null;
  html: string | null;
  fetchedAt: Date;
}

export async function getCachedPage(userId: string, url: string, now = new Date()): Promise<CachedPage | null> {
  const row = await prisma.acquisitionPageCache.findFirst({ where: { userId, urlHash: urlHash(url) } });
  if (!row || row.expiresAt <= now) return null;
  return { url: row.url, finalUrl: row.finalUrl, status: row.status, httpStatus: row.httpStatus, html: row.html, fetchedAt: row.fetchedAt };
}

export async function putCachedPage(params: {
  userId: string; url: string; finalUrl: string | null; status: string; httpStatus: number | null;
  html: string | null; ttlHours: number; now?: Date;
}): Promise<void> {
  const now = params.now ?? new Date();
  const data = {
    userId: params.userId,
    domain: registrableDomain(new URL(params.url).hostname),
    url: params.url,
    urlHash: urlHash(params.url),
    finalUrl: params.finalUrl,
    status: params.status,
    httpStatus: params.httpStatus,
    html: params.html,
    fetchedAt: now,
    expiresAt: new Date(now.getTime() + params.ttlHours * 60 * 60 * 1000),
  };
  await prisma.acquisitionPageCache.upsert({
    where: { userId_urlHash: { userId: params.userId, urlHash: data.urlHash } },
    create: data,
    update: data,
  });
}

export async function purgeExpiredPageCache(now = new Date()): Promise<number> {
  const res = await prisma.acquisitionPageCache.deleteMany({ where: { expiresAt: { lte: now } } });
  return res.count;
}

export async function purgeDomainPageCache(userId: string, domain: string): Promise<number> {
  const res = await prisma.acquisitionPageCache.deleteMany({ where: { userId, domain: registrableDomain(domain) } });
  return res.count;
}
