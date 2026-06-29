import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getPlanConfig } from '@/lib/plans';
import type { Business, ConversationEntry, ProspectStage, SavedProspect } from '@/types';

export const dynamic = 'force-dynamic';

type ProspectWithConversations = {
  id: string;
  businessData: unknown;
  stage: string;
  savedAt: Date;
  notes: string | null;
  reminderDate: string | null;
  reminderNote: string | null;
  estimatedPriceMin: number | null;
  estimatedPriceMax: number | null;
  score: number | null;
  outreachSentAt: Date | null;
  conversations: { content: string }[];
};

// Returns SavedProspect with _dbId injected so the client can call PATCH/DELETE
function toSavedProspect(p: ProspectWithConversations): SavedProspect & { _dbId: string } {
  return {
    _dbId: p.id,
    business: p.businessData as Business,
    stage: p.stage as ProspectStage,
    savedAt: p.savedAt.toISOString(),
    notes: p.notes ?? '',
    reminderDate: p.reminderDate ?? undefined,
    reminderNote: p.reminderNote ?? undefined,
    estimatedPrice: p.estimatedPriceMin != null && p.estimatedPriceMax != null
      ? { min: p.estimatedPriceMin, max: p.estimatedPriceMax }
      : undefined,
    score: p.score ?? 0,
    outreachSentAt: p.outreachSentAt?.toISOString(),
    conversations: p.conversations.map((c) => {
      try { return JSON.parse(c.content) as ConversationEntry; } catch { return null; }
    }).filter(Boolean) as ConversationEntry[],
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const prospects = await prisma.prospect.findMany({
    where: { userId: session.user.id },
    include: { conversations: { orderBy: { createdAt: 'asc' } } },
    orderBy: { savedAt: 'desc' },
  });

  return NextResponse.json(prospects.map(toSavedProspect));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { business } = await req.json() as { business: Business };
  if (!business?.id) return NextResponse.json({ error: 'Missing business' }, { status: 400 });

  const userPlan = (session.user as { plan?: string }).plan ?? 'free';
  const planConfig = await getPlanConfig(userPlan);

  // Enforce prospect save limit for free plan
  if (planConfig.maxProspects !== Infinity) {
    const count = await prisma.prospect.count({ where: { userId: session.user.id } });
    if (count >= planConfig.maxProspects) {
      return NextResponse.json({
        error: `Free plan limit: max ${planConfig.maxProspects} saved prospects`,
        code: 'PROSPECT_LIMIT',
        plan: userPlan,
        limit: planConfig.maxProspects,
      }, { status: 402 });
    }
  }

  // Import scoring dynamically to avoid server/client mismatch
  const { scoreProspect, estimatePrice } = await import('@/lib/scoring');
  const score = scoreProspect(business);
  const price = estimatePrice(business.category, business.categoryTypes);

  const prospect = await prisma.prospect.upsert({
    where: { userId_businessId: { userId: session.user.id, businessId: business.id } },
    create: {
      userId: session.user.id,
      businessId: business.id,
      businessName: business.name,
      businessData: business as object,
      score,
      estimatedPriceMin: price.min,
      estimatedPriceMax: price.max,
    },
    update: {
      businessData: business as object,
      businessName: business.name,
    },
    include: { conversations: { orderBy: { createdAt: 'asc' } } },
  });

  return NextResponse.json(toSavedProspect(prospect), { status: 201 });
}
