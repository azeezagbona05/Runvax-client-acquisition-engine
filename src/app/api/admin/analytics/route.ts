import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase());

type Range = 'week' | 'month' | 'year' | 'all';
const DAYS: Record<Exclude<Range, 'all'>, number> = { week: 7, month: 30, year: 365 };

function normalize(s: string | undefined | null): string {
  return (s ?? '').trim().replace(/\s+/g, ' ');
}

// Minimum events before a cell is shown (avoid exposing single-user activity)
const MIN_CELL = 2;

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email.toLowerCase())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const range = (url.searchParams.get('range') as Range) || 'month';
  const now = Date.now();
  const spanDays = range === 'all' ? 3650 : DAYS[range];
  const start = new Date(now - spanDays * 86400000);
  const prevStart = new Date(now - spanDays * 2 * 86400000);

  const [prospects, searchIndustries, searchAreas, searchTerms, searchers, searchRows] = await Promise.all([
    // Append-only via savedAt — pull current + previous window for growth math
    prisma.prospect.findMany({
      where: { savedAt: { gte: prevStart } },
      select: { savedAt: true, updatedAt: true, stage: true, outreachSentAt: true, estimatedPriceMin: true, businessData: true },
    }),
    // Search popularity (SearchHistory is latest-per-user; a rough demand signal)
    prisma.searchHistory.groupBy({
      by: ['industry'],
      where: { searchedAt: { gte: start } },
      _count: { _all: true },
      orderBy: { _count: { industry: 'desc' } },
      take: 12,
    }),
    prisma.searchHistory.groupBy({
      by: ['location'],
      where: { searchedAt: { gte: start } },
      _count: { _all: true },
      orderBy: { _count: { location: 'desc' } },
      take: 12,
    }),
    prisma.searchHistory.groupBy({
      by: ['industry', 'location'],
      where: { searchedAt: { gte: start } },
      _count: { _all: true },
      orderBy: { _count: { industry: 'desc' } },
      take: 15,
    }),
    prisma.searchHistory.findMany({ where: { searchedAt: { gte: start } }, distinct: ['userId'], select: { userId: true } }),
    prisma.searchHistory.count({ where: { searchedAt: { gte: start } } }),
  ]);

  // ── Aggregate prospects (conversion funnel by industry, with growth) ──
  type Agg = { saved: number; savedPrev: number; contacted: number; won: number };
  const byIndustry: Record<string, Agg> = {};
  let curSaved = 0, prevSaved = 0, contacted = 0, won = 0, wonValue = 0, pipelineValue = 0;

  for (const p of prospects) {
    const data = (p.businessData ?? {}) as { category?: string };
    const key = normalize(data.category) || 'Uncategorized';
    const inCurrent = p.savedAt >= start;
    const price = p.estimatedPriceMin ?? 0;
    const isContacted = p.stage !== 'found' || !!p.outreachSentAt;
    const isWon = p.stage === 'won';

    byIndustry[key] ??= { saved: 0, savedPrev: 0, contacted: 0, won: 0 };
    if (inCurrent) {
      byIndustry[key].saved++;
      curSaved++;
      if (isContacted) { byIndustry[key].contacted++; contacted++; }
      if (isWon) { byIndustry[key].won++; won++; wonValue += price; }
      if (['contacted', 'interested', 'proposal'].includes(p.stage)) pipelineValue += price;
    } else {
      byIndustry[key].savedPrev++;
      prevSaved++;
    }
  }

  const industries = Object.entries(byIndustry)
    .filter(([, a]) => a.saved + a.savedPrev >= MIN_CELL)
    .map(([key, a]) => {
      const growthPct = a.savedPrev > 0 ? Math.round(((a.saved - a.savedPrev) / a.savedPrev) * 100) : null;
      return {
        key,
        saved: a.saved,
        savedPrev: a.savedPrev,
        growthPct,                       // null = no prior baseline
        isNew: a.savedPrev === 0 && a.saved > 0,
        contacted: a.contacted,
        won: a.won,
        saveRatePct: a.saved > 0 ? Math.round((a.contacted / a.saved) * 100) : 0,
        winRatePct: a.contacted > 0 ? Math.round((a.won / a.contacted) * 100) : 0,
      };
    })
    .sort((x, y) => y.saved - x.saved)
    .slice(0, 15);

  const prospectsGrowthPct = prevSaved > 0 ? Math.round(((curSaved - prevSaved) / prevSaved) * 100) : null;

  return NextResponse.json({
    range,
    totals: {
      prospects: curSaved,
      prospectsPrev: prevSaved,
      prospectsGrowthPct,
      searchers: searchers.length,
      searchRows,
      contacted,
      won,
      winRatePct: contacted > 0 ? Math.round((won / contacted) * 100) : 0,
      saveToWonPct: curSaved > 0 ? Math.round((won / curSaved) * 100) : 0,
      wonValue,
      pipelineValue,
    },
    industries,
    searchedIndustries: searchIndustries
      .filter((r) => r._count._all >= MIN_CELL)
      .map((r) => ({ key: normalize(r.industry) || '—', count: r._count._all })),
    searchedAreas: searchAreas
      .filter((r) => r._count._all >= MIN_CELL)
      .map((r) => ({ key: normalize(r.location) || '—', count: r._count._all })),
    searchedTerms: searchTerms
      .filter((r) => r._count._all >= MIN_CELL)
      .map((r) => ({ industry: normalize(r.industry), location: normalize(r.location), count: r._count._all })),
  });
}
