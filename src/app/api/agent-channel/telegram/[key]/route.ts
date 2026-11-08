import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleChatMessage } from '@/lib/agents/chat';
import { sanitizeConfig, type AssistantConfig } from '@/lib/agents/kinds';
import { openSecrets, validKey } from '@/lib/agents/store';
import { sendMessage } from '@/lib/agents/telegram';
import { rateLimit } from '@/lib/rateLimiter';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const same = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Telegram calls this for every message to the bot. Only requests carrying the secret token set when the bot was connected are accepted. Always answers 200 so Telegram does not retry. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params; if (!validKey(key)) return NextResponse.json({ ok: false }, { status: 404 });
  const a = await prisma.customAgent.findUnique({ where: { publicKey: key } });
  if (!a || a.kind !== 'assistant' || a.status !== 'active') return NextResponse.json({ ok: true });
  const s = openSecrets(a.secret); const given = req.headers.get('x-telegram-bot-api-secret-token') ?? '';
  if (!s.telegramToken || !s.telegramSecret || !same(given, s.telegramSecret)) return NextResponse.json({ ok: false }, { status: 401 });
  const cfg = sanitizeConfig('assistant', a.config) as AssistantConfig; if (!cfg.channels.telegram) return NextResponse.json({ ok: true });
  const upd = await req.json().catch(() => null) as { message?: { chat?: { id?: number; type?: string }; text?: string } } | null;
  const chatId = upd?.message?.chat?.id; const text = upd?.message?.text;
  if (!chatId || typeof text !== 'string' || upd?.message?.chat?.type !== 'private') return NextResponse.json({ ok: true });
  if (!rateLimit(`tg:${a.id}:${chatId}`, { maxRequests: 20, windowMs: 60_000 }).ok) return NextResponse.json({ ok: true });
  const reply = /^\/start\b/i.test(text) ? cfg.greeting : (await handleChatMessage(a, 'telegram', String(chatId), text)).reply;
  await sendMessage(s.telegramToken, chatId, reply);
  return NextResponse.json({ ok: true });
}
