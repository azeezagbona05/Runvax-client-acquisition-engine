import { prisma } from '@/lib/prisma';
import { hostOf, escapeXml } from './html';
import { sanitizeConfig, type VisibilityConfig } from './kinds';
import { validKey } from './store';

/** A live visibility agent by its public key, or null (unknown key, paused, or not a visibility agent). */
export async function livePublicAgent(key: string) {
  if (!validKey(key)) return null;
  const a = await prisma.customAgent.findUnique({ where: { publicKey: key } });
  if (!a || a.kind !== 'visibility' || a.status !== 'active') return null;
  return { agent: a, cfg: sanitizeConfig('visibility', a.config) as VisibilityConfig };
}
export const publishedPosts = (agentId: string, limit = 20) => prisma.customAgentPost.findMany({ where: { agentId, status: 'published' }, orderBy: { publishedAt: 'desc' }, take: Math.min(50, Math.max(1, limit)) });

/** The CORS answer for a browser request: the site's own address when it is on the allow-list, anyone when no list is set. Null = refuse. */
export function corsOrigin(allowed: string[], origin: string | null): string | null {
  if (!origin) return '*';
  if (allowed.length === 0) return '*';
  const h = hostOf(origin);
  return h && allowed.some((d) => h === d || h.endsWith('.' + d)) ? origin : null;
}

export function rssXml(o: { title: string; link: string; description: string; self: string; items: Array<{ title: string; link: string; guid: string; summary: string; body: string; date: Date }> }): string {
  const items = o.items.map((i) => `<item><title>${escapeXml(i.title)}</title><link>${escapeXml(i.link)}</link><guid isPermaLink="false">${escapeXml(i.guid)}</guid><pubDate>${i.date.toUTCString()}</pubDate><description>${escapeXml(i.summary)}</description><content:encoded><![CDATA[${i.body.replace(/]]>/g, ']]&gt;')}]]></content:encoded></item>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escapeXml(o.title)}</title><link>${escapeXml(o.link)}</link><description>${escapeXml(o.description)}</description><atom:link href="${escapeXml(o.self)}" rel="self" type="application/rss+xml"/>${items}</channel></rss>`;
}
