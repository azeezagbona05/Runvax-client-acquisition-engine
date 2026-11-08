import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { sanitizeConfig, type AssistantConfig } from '@/lib/agents/kinds';
import { newSecret, openSecrets, sealSecrets } from '@/lib/agents/store';
import { deleteWebhook, getMe, setWebhook, validToken } from '@/lib/agents/telegram';
import { getAppUrl } from '@/lib/url';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** POST { action: 'connect' | 'disconnect' }: points the saved bot token at this agent (or detaches it). Needs the app to be on a public https address. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  if (!rateLimit(`agent-tg:${u.userId}`, { maxRequests: 8, windowMs: 60_000 }).ok) return NextResponse.json({ error: 'Slow down: try again in a minute.' }, { status: 429 });
  const { id } = await ctx.params; const a = await prisma.customAgent.findFirst({ where: { id, userId: u.userId } });
  if (!a || a.kind !== 'assistant') return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });
  const s = openSecrets(a.secret); const cfg = sanitizeConfig('assistant', a.config) as AssistantConfig;
  const { action } = await req.json().catch(() => ({})) as { action?: unknown };
  if (!s.telegramToken || !validToken(s.telegramToken)) return NextResponse.json({ ok: false, detail: 'Paste the bot token from @BotFather first. It looks like 123456789:ABC...' }, { status: 400 });
  if (action === 'disconnect') {
    await deleteWebhook(s.telegramToken);
    await prisma.customAgent.update({ where: { id: a.id }, data: { config: { ...cfg, channels: { ...cfg.channels, telegram: false } } as unknown as object, secret: sealSecrets({ ...s, telegramSecret: undefined }) } });
    return NextResponse.json({ ok: true, detail: 'Telegram disconnected.' });
  }
  const app = getAppUrl().replace(/\/$/, '');
  if (!app.startsWith('https://')) return NextResponse.json({ ok: false, detail: 'Telegram only talks to public https addresses. Connect the bot from your live RUNVAX, not from a local copy.' }, { status: 400 });
  const me = await getMe(s.telegramToken); if (!me.ok || !me.result) return NextResponse.json({ ok: false, detail: 'Telegram did not accept that token. Check it with @BotFather.' }, { status: 400 });
  const secret = newSecret();
  const hook = await setWebhook(s.telegramToken, `${app}/api/agent-channel/telegram/${a.publicKey}`, secret);
  if (!hook.ok) return NextResponse.json({ ok: false, detail: hook.description || 'Telegram refused to set the webhook.' }, { status: 400 });
  await prisma.customAgent.update({ where: { id: a.id }, data: { config: { ...cfg, channels: { ...cfg.channels, telegram: true, telegramBot: me.result.username } } as unknown as object, secret: sealSecrets({ ...s, telegramSecret: secret }) } });
  return NextResponse.json({ ok: true, detail: `Connected. Message @${me.result.username} on Telegram to try it.`, bot: me.result.username });
}
