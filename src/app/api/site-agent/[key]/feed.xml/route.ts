import { NextRequest, NextResponse } from 'next/server';
import { livePublicAgent, publishedPosts, rssXml } from '@/lib/agents/publicFeed';
import { getAppUrl } from '@/lib/url';

export const dynamic = 'force-dynamic';

/** Public RSS 2.0 feed (full text) of one visibility agent: Webflow, Zapier, Make, newsletters and feed readers can all read it. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params; const live = await livePublicAgent(key);
  if (!live || !live.cfg.destinations.rss) return new NextResponse('Not found', { status: 404 });
  const app = getAppUrl().replace(/\/$/, ''); const rows = await publishedPosts(live.agent.id, 30);
  const xml = rssXml({ title: live.cfg.business.name || live.agent.name, link: live.cfg.business.url || `${app}/a/${key}`, description: live.cfg.business.about || live.agent.name, self: `${app}/api/site-agent/${key}/feed.xml`,
    items: rows.map((p) => ({ title: p.title, link: `${app}/a/${key}/${p.slug}`, guid: p.id, summary: p.summary, body: p.body, date: p.publishedAt ?? p.createdAt })) });
  return new NextResponse(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, s-maxage=600' } });
}
