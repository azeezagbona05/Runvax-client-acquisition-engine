import { NextRequest, NextResponse } from 'next/server';
import { corsOrigin, livePublicAgent, publishedPosts } from '@/lib/agents/publicFeed';
import { rateLimit } from '@/lib/rateLimiter';
import { getAppUrl } from '@/lib/url';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ key: string }> };
const headers = (origin: string) => ({ 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, OPTIONS', Vary: 'Origin' });

export async function OPTIONS(req: NextRequest) { return new NextResponse(null, { status: 204, headers: { ...headers(req.headers.get('origin') ?? '*'), 'Access-Control-Max-Age': '86400' } }); }

/** Public: the published articles of one visibility agent, for the embed script and any other platform. Published articles only. */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { key } = await ctx.params;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  if (!rateLimit(`agent-feed:${ip}`, { maxRequests: 120, windowMs: 60_000 }).ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const live = await livePublicAgent(key);
  if (!live) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: headers('*') });
  const origin = corsOrigin(live.cfg.allowedDomains, req.headers.get('origin'));
  if (!origin) return NextResponse.json({ error: 'This agent is not enabled for this website.' }, { status: 403 });
  if (!live.cfg.destinations.embed) return NextResponse.json({ error: 'Website embed is switched off for this agent.' }, { status: 403, headers: headers(origin) });
  const limit = Math.floor(Number(new URL(req.url).searchParams.get('limit'))) || 10;
  const rows = await publishedPosts(live.agent.id, limit); const app = getAppUrl().replace(/\/$/, '');
  return NextResponse.json({
    agent: { name: live.agent.name, business: live.cfg.business.name, url: live.cfg.destinations.hosted ? `${app}/a/${key}` : null },
    posts: rows.map((p) => ({ id: p.id, slug: p.slug, title: p.title, summary: p.summary, body: p.body, keywords: p.keywords ?? [], publishedAt: p.publishedAt?.toISOString() ?? p.createdAt.toISOString(), url: live.cfg.destinations.hosted ? `${app}/a/${key}/${p.slug}` : null })),
  }, { headers: { ...headers(origin), 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } });
}
