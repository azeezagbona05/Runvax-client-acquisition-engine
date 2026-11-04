import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { checkOutreachTarget } from '@/lib/acquisition/recipientGuard';

export const dynamic = 'force-dynamic';

const Body = z.strictObject({
  targets: z.array(z.strictObject({
    businessId: z.string().max(200).optional(),
    email: z.string().max(320).optional(),
    phone: z.string().max(40).optional(),
  })).min(1).max(100),
});

/**
 * Asked by the browser before it opens a wa.me or mailto: link. Open to every
 * signed-in user (not admin- or flag-gated): a clinic imported earlier must stay
 * protected whatever the flag says. Results are in request order and say only
 * "allowed" or why not, for the caller's own prospects and suppression list.
 */
export async function POST(req: NextRequest) {
  const token = await getToken({ req });
  const userId = (token?.id ?? token?.sub) as string | undefined;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const account = await prisma.user.findUnique({ where: { id: userId }, select: { isSuspended: true } });
  if (!account) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (account.isSuspended) return NextResponse.json({ error: 'Account suspended' }, { status: 403 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });

  const results = [];
  for (const t of parsed.data.targets) {
    const v = await checkOutreachTarget(userId, t);
    results.push(v.allowed ? { allowed: true as const } : { allowed: false as const, code: v.code, message: v.message });
  }
  return NextResponse.json({ results });
}
