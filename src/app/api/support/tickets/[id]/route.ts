import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/requireUser';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rateLimiter';
import { getMine, userReply, userSetStatus } from '@/lib/support';
import { validateReply } from '@/lib/supportShared';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const found = await getMine(auth.userId, id).catch(() => null);
  return found ? NextResponse.json(found) : NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
}

/** POST { body } adds a reply. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const rl = rateLimit(`support:reply:${auth.userId}`, { maxRequests: 20, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many messages. Please wait a little.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } });
  const parsed = validateReply(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { id } = await ctx.params;
  const u = await prisma.user.findUnique({ where: { id: auth.userId }, select: { email: true, name: true } });
  if (!u?.email) return NextResponse.json({ error: 'Your account has no email address on file.' }, { status: 400 });
  const res = await userReply({ id: auth.userId, email: u.email, name: u.name }, id, parsed.body).catch(() => null);
  if (!res) return NextResponse.json({ error: 'Could not send your reply.' }, { status: 500 });
  return res.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: res.error }, { status: res.status });
}

/** PATCH { status: 'closed' | 'open' }: close a ticket you no longer need, or reopen a resolved one. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => null) as { status?: string } | null;
  if (body?.status !== 'closed' && body?.status !== 'open') return NextResponse.json({ error: 'Status must be open or closed.' }, { status: 400 });
  const { id } = await ctx.params;
  const ok = await userSetStatus(auth.userId, id, body.status).catch(() => false);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Could not update this ticket.' }, { status: 409 });
}
