import { NextRequest, NextResponse } from 'next/server';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { createMcpToken, mcpTokenStatus, revokeMcpToken } from '@/lib/mcp/token';
import { getAppUrl } from '@/lib/url';

export const dynamic = 'force-dynamic';
const endpoint = () => `${getAppUrl().replace(/\/$/, '')}/api/mcp`;

/** GET: is Claude connected. POST: make a new token (replaces any old one) and show it ONCE. DELETE: disconnect. */
export async function GET(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  return NextResponse.json({ ...(await mcpTokenStatus(u.userId)), endpoint: endpoint() });
}
export async function POST(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  if (!rateLimit(`mcp-token:${u.userId}`, { maxRequests: 5, windowMs: 60_000 }).ok) return NextResponse.json({ error: 'Slow down: try again in a minute.' }, { status: 429 });
  return NextResponse.json({ token: await createMcpToken(u.userId), endpoint: endpoint() });
}
export async function DELETE(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  await revokeMcpToken(u.userId);
  return NextResponse.json({ ok: true });
}
