import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { requireUser } from '@/lib/requireUser';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rateLimiter';
import { createTicket, listMine } from '@/lib/support';
import { validateNewTicket } from '@/lib/supportShared';

export const dynamic = 'force-dynamic';
const TABLE_HINT = 'Support tickets are not set up yet. Please email info@runvax.com for now.';

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  try { return NextResponse.json({ tickets: await listMine(auth.userId) }); }
  catch (e) { console.error('[support] list failed', e); return NextResponse.json({ error: TABLE_HINT }, { status: 503 }); }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;
  const rl = rateLimit(`support:new:${auth.userId}`, { maxRequests: 5, windowMs: 60 * 60 * 1000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many tickets in a short time. Please try again later.' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } });
  const parsed = validateNewTicket(await req.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const token = await getToken({ req });
  try {
    const u = await prisma.user.findUnique({ where: { id: auth.userId }, select: { email: true, name: true } });
    const email = u?.email ?? (token?.email as string | undefined);
    if (!email) return NextResponse.json({ error: 'Your account has no email address on file.' }, { status: 400 });
    const res = await createTicket({ id: auth.userId, email, name: u?.name }, parsed.value);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 429 });
    return NextResponse.json({ ticket: res.ticket }, { status: 201 });
  } catch (e) { console.error('[support] create failed', e); return NextResponse.json({ error: TABLE_HINT }, { status: 503 }); }
}
