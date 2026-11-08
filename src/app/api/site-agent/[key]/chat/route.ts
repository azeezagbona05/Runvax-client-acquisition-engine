import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleChatMessage } from '@/lib/agents/chat';
import { disclosureText, sanitizeConfig, type AssistantConfig } from '@/lib/agents/kinds';
import { corsOrigin } from '@/lib/agents/publicFeed';
import { validKey } from '@/lib/agents/store';
import { rateLimit } from '@/lib/rateLimiter';
import { getAppUrl } from '@/lib/url';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;
type Ctx = { params: Promise<{ key: string }> };
const cors = (origin: string) => ({ 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type', Vary: 'Origin' });

async function liveAssistant(key: string) {
  if (!validKey(key)) return null;
  const a = await prisma.customAgent.findUnique({ where: { publicKey: key } });
  if (!a || a.kind !== 'assistant' || a.status !== 'active') return null;
  const cfg = sanitizeConfig('assistant', a.config) as AssistantConfig;
  return cfg.channels.web ? { a, cfg } : null;
}

export async function OPTIONS(req: NextRequest) { return new NextResponse(null, { status: 204, headers: { ...cors(req.headers.get('origin') ?? '*'), 'Access-Control-Max-Age': '86400' } }); }

/** Public: what the chat widget needs to open (name and greeting). */
export async function GET(req: NextRequest, ctx: Ctx) {
  const live = await liveAssistant((await ctx.params).key);
  if (!live) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: cors('*') });
  const origin = corsOrigin(live.cfg.allowedDomains, req.headers.get('origin'));
  if (!origin) return NextResponse.json({ error: 'This assistant is not enabled for this website.' }, { status: 403 });
  return NextResponse.json({ name: live.cfg.business.name || live.a.name, greeting: live.cfg.greeting, booking: !!live.cfg.calendarUrl, disclosure: disclosureText(live.cfg), privacyUrl: live.cfg.privacyUrl || `${getAppUrl().replace(/\/$/, '')}/privacy` }, { headers: { ...cors(origin), 'Cache-Control': 'public, s-maxage=60' } });
}

/** Public: one visitor message → one reply. Rate limited by address and by visitor session. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const live = await liveAssistant((await ctx.params).key);
  if (!live) return NextResponse.json({ error: 'Not found' }, { status: 404, headers: cors('*') });
  const origin = corsOrigin(live.cfg.allowedDomains, req.headers.get('origin'));
  if (!origin) return NextResponse.json({ error: 'This assistant is not enabled for this website.' }, { status: 403 });
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const b = await req.json().catch(() => ({})) as { sid?: unknown; message?: unknown };
  const sid = typeof b.sid === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(b.sid) ? b.sid : '';
  if (!sid || typeof b.message !== 'string') return NextResponse.json({ error: 'Bad request' }, { status: 400, headers: cors(origin) });
  if (!rateLimit(`chat-ip:${ip}`, { maxRequests: 25, windowMs: 60_000 }).ok || !rateLimit(`chat-sid:${sid}`, { maxRequests: 40, windowMs: 3_600_000 }).ok)
    return NextResponse.json({ reply: 'You are sending messages very quickly. Please wait a moment.', limited: true }, { status: 429, headers: cors(origin) });
  const out = await handleChatMessage(live.a, 'web', sid, b.message);
  return NextResponse.json({ reply: out.reply, lead: out.lead }, { headers: cors(origin) });
}
