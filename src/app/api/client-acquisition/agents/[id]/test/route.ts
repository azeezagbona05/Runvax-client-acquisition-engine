import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { sanitizeConfig, type AssistantConfig, type VisibilityConfig } from '@/lib/agents/kinds';
import { postSigned, pushWebhook, testWordPress } from '@/lib/agents/publish';
import { openSecrets } from '@/lib/agents/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** POST { dest: 'webhook' | 'wordpress' | 'crm' }: checks a connection without publishing anything real. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  if (!rateLimit(`agent-test:${u.userId}`, { maxRequests: 10, windowMs: 60_000 }).ok) return NextResponse.json({ error: 'Slow down: try again in a minute.' }, { status: 429 });
  const { id } = await ctx.params; const a = await prisma.customAgent.findFirst({ where: { id, userId: u.userId } });
  if (!a) return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
  const s = openSecrets(a.secret);
  const { dest } = await req.json().catch(() => ({})) as { dest?: unknown };
  if (a.kind === 'assistant') {
    const c = sanitizeConfig('assistant', a.config) as AssistantConfig;
    if (dest !== 'crm') return NextResponse.json({ error: 'Unknown destination.' }, { status: 400 });
    if (!c.crmWebhookUrl) return NextResponse.json({ dest, ok: false, detail: 'Add the CRM webhook address first' });
    return NextResponse.json({ dest, ...(await postSigned(c.crmWebhookUrl, s.webhookSecret, { event: 'test', agent: { id: a.id, name: a.name }, lead: { name: 'Test Lead', email: 'test@example.com', channel: 'web', test: true } })) });
  }
  if (a.kind !== 'visibility') return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
  const cfg = sanitizeConfig('visibility', a.config) as VisibilityConfig;
  if (dest === 'wordpress') return NextResponse.json(cfg.destinations.wordpress ? await testWordPress(cfg.destinations.wordpress, s.wpPassword) : { dest, ok: false, detail: 'Add your WordPress address and username first' });
  if (dest === 'webhook') return NextResponse.json(cfg.destinations.webhookUrl ? await pushWebhook(cfg.destinations.webhookUrl, s.webhookSecret, 'test', { id: a.id, name: a.name }, null) : { dest, ok: false, detail: 'Add the webhook address first' });
  return NextResponse.json({ error: 'Unknown destination.' }, { status: 400 });
}
