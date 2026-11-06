import { useUserKeys } from '@/lib/integrations/keys';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apolloEnabled, domainFromUrl, findDecisionMaker } from '@/lib/apollo';
import { remember } from '@/lib/prospectMemory';
import type { Business } from '@/types';

export const dynamic = 'force-dynamic';

// Reveals cost Apollo credits, so they are paid-plan only and capped per user per day.
const DAILY_CAP = 20;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  await useUserKeys(userId);

  if (!apolloEnabled()) return NextResponse.json({ error: 'Decision-maker lookup is not enabled' }, { status: 501 });

  const { prospectId } = await req.json() as { prospectId?: string };
  if (!prospectId) return NextResponse.json({ error: 'prospectId required' }, { status: 400 });

  const [prospect, user] = await Promise.all([
    prisma.prospect.findFirst({ where: { id: prospectId, userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { plan: true } }),
  ]);
  if (!prospect) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!user || user.plan === 'free') {
    return NextResponse.json({ error: 'Decision-maker lookup is available on paid plans' }, { status: 403 });
  }

  const business = prospect.businessData as unknown as Business;
  if (business.decisionMaker) return NextResponse.json({ decisionMaker: business.decisionMaker, cached: true });

  const domain = domainFromUrl(business.website);
  if (!domain) return NextResponse.json({ error: 'This business has no website domain to look up' }, { status: 422 });

  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const usedToday = await prisma.prospectMemory.count({
    where: { userId, source: 'apollo_lookup', createdAt: { gte: startOfDay } },
  });
  if (usedToday >= DAILY_CAP) {
    return NextResponse.json({ error: `Daily lookup limit of ${DAILY_CAP} reached` }, { status: 429 });
  }

  let dm;
  try {
    dm = await findDecisionMaker(domain);
  } catch (e) {
    console.error('[/api/apollo/decision-maker]', e);
    return NextResponse.json({ error: 'Lookup failed — try again later' }, { status: 502 });
  }

  // Counts toward the daily cap whether or not anyone was found: the credit is spent either way.
  await remember({
    userId, prospectId, kind: 'contact', source: 'apollo_lookup', confidence: dm ? 'medium' : 'low',
    content: dm ? `Decision-maker: ${dm.name}${dm.title ? ` — ${dm.title}` : ''} (Apollo)` : `No decision-maker found for ${domain} (Apollo)`,
  });

  if (!dm) return NextResponse.json({ decisionMaker: null });

  // Fill gaps only: an email already on file is never overwritten.
  const updated: Business = {
    ...business,
    decisionMaker: { name: dm.name, title: dm.title, linkedin: dm.linkedin, source: 'apollo' },
    ...(!business.email && dm.email
      ? { email: dm.email, emailVerified: dm.emailStatus === 'verified' ? ('valid' as const) : ('unknown' as const) }
      : {}),
  };
  await prisma.prospect.update({ where: { id: prospectId }, data: { businessData: updated as unknown as object } });

  return NextResponse.json({ decisionMaker: updated.decisionMaker, emailAdded: !business.email && !!dm.email });
}
