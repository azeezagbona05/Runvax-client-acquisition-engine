import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase());

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email.toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Cost aggregation start date — defaults to today (YYYY-MM-DD)
  const url = new URL(req.url);
  const costSince = url.searchParams.get('costSince') ?? new Date().toISOString().split('T')[0];

  const [users, payments, usageRecords] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, email: true, plan: true, createdAt: true,
        emailVerified: true, planExpiresAt: true,
        searchLimitOverride: true,
        blockedLocations: true,
        blockedCountries: true,
        registrationIp: true,
        lastSeenIp: true,
        isSuspended: true,
        _count: { select: { prospects: true } },
        searchHistory: {
          orderBy: { searchedAt: 'desc' },
          take: 5,
          select: { industry: true, location: true, totalCount: true, noWebsiteCount: true, searchedAt: true },
        },
      },
    }),
    prisma.payment.findMany({
      orderBy: { paidAt: 'desc' },
      take: 50,
      include: { user: { select: { name: true, email: true } } },
    }),
    // Aggregate token + search usage per user from costSince date onwards
    prisma.usageRecord.groupBy({
      by: ['userId'],
      where: { date: { gte: costSince } },
      _sum: {
        aiCalls: true,
        searchCount: true,
        openaiInputTokens: true,
        openaiOutputTokens: true,
        geminiInputTokens: true,
        geminiOutputTokens: true,
        googlePlacesReqs: true,
      },
    }),
  ]);

  // Cost rates (USD)
  const OPENAI_INPUT_PER_TOKEN  = 2.50  / 1_000_000;  // GPT-4o
  const OPENAI_OUTPUT_PER_TOKEN = 10.00 / 1_000_000;
  const GEMINI_INPUT_PER_TOKEN  = 0.10  / 1_000_000;  // Gemini 2.0 Flash
  const GEMINI_OUTPUT_PER_TOKEN = 0.40  / 1_000_000;
  const GOOGLE_PLACES_PER_REQ   = 0.032;              // Places API (New) Text Search

  // Build a per-user cost map
  type UserCost = {
    aiCalls: number;
    searchCount: number;
    openaiInputTokens: number;
    openaiOutputTokens: number;
    geminiInputTokens: number;
    geminiOutputTokens: number;
    googlePlacesReqs: number;
    openaiCostUsd: number;
    geminiCostUsd: number;
    googleCostUsd: number;
    totalCostUsd: number;
  };

  const costByUser: Record<string, UserCost> = {};
  for (const rec of usageRecords) {
    const inp  = rec._sum.openaiInputTokens  ?? 0;
    const out  = rec._sum.openaiOutputTokens ?? 0;
    const ginp = rec._sum.geminiInputTokens  ?? 0;
    const gout = rec._sum.geminiOutputTokens ?? 0;
    const gpr  = rec._sum.googlePlacesReqs  ?? 0;
    const openaiCost  = inp  * OPENAI_INPUT_PER_TOKEN + out  * OPENAI_OUTPUT_PER_TOKEN;
    const geminiCost  = ginp * GEMINI_INPUT_PER_TOKEN + gout * GEMINI_OUTPUT_PER_TOKEN;
    const googleCost  = gpr  * GOOGLE_PLACES_PER_REQ;
    costByUser[rec.userId] = {
      aiCalls:            rec._sum.aiCalls       ?? 0,
      searchCount:        rec._sum.searchCount   ?? 0,
      openaiInputTokens:  inp,
      openaiOutputTokens: out,
      geminiInputTokens:  ginp,
      geminiOutputTokens: gout,
      googlePlacesReqs:   gpr,
      openaiCostUsd:  openaiCost,
      geminiCostUsd:  geminiCost,
      googleCostUsd:  googleCost,
      totalCostUsd:   openaiCost + geminiCost + googleCost,
    };
  }

  const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);
  const byPlan = users.reduce((acc, u) => {
    acc[u.plan] = (acc[u.plan] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return NextResponse.json({ users, payments, totalRevenue, byPlan, costByUser, costSince });
}
