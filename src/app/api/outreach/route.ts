import { NextRequest, NextResponse } from 'next/server';
import { Business } from '@/types';
import { checkAndIncrementAI } from '@/lib/usage';
import { requireVerifiedUser } from '@/lib/requireUser';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { composeOutreach, type OutreachFramework } from '@/lib/outreach/compose';
import type { OfferType } from '@/lib/opportunity/types';

export const dynamic = 'force-dynamic';

export type { OutreachFramework };

export async function POST(req: NextRequest) {
  // Writing outreach for a prospect is part of opening it: verified accounts only. Signed-out
  // visitors still get the 401 that triggers the sign-up preview.
  const verified = await requireVerifiedUser(req);
  if (!verified.ok) return verified.response;

  const {
    business,
    framework,
    competitors,
    timeOfDay,
    offer,
    websiteOpener,
  }: {
    business: Business;
    framework?: OutreachFramework;
    competitors?: string[];
    timeOfDay?: 'morning' | 'afternoon' | 'evening';
    /** Omitted means "use whatever this business best qualifies for". */
    offer?: OfferType;
    /** Opt-in A/B variant of the website opener. Omitted keeps the original pitch. */
    websiteOpener?: 'reputation_first';
  } = await req.json();

  const usage = await checkAndIncrementAI(req);
  if (!usage.ok) return usage.error!;

  const session = await getServerSession(authOptions);

  try {
    const result = await composeOutreach({
      business, framework, competitors, timeOfDay, offer, websiteOpener,
      userId: session?.user?.id,
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
