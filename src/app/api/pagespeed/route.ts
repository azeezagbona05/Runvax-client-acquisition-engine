import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { PsiDetails } from '@/types';

export const dynamic = 'force-dynamic';

const SOCIAL_HOSTS = ['instagram.com', 'facebook.com', 'twitter.com', 'tiktok.com', 'linkedin.com', 'youtube.com'];
function isSocialUrl(url: string): boolean {
  try { return SOCIAL_HOSTS.some((h) => new URL(url).hostname.includes(h)); }
  catch { return false; }
}

// Audits that are purely informational — skip from "failed" list
const SKIP_AUDIT_IDS = new Set([
  'screenshot-thumbnails', 'final-screenshot', 'full-page-screenshot',
  'network-requests', 'network-rtt', 'network-server-latency',
  'main-thread-tasks', 'metrics', 'resource-summary', 'third-party-summary',
  'third-party-facades', 'lcp-lazy-loaded', 'layout-shift-elements',
  'long-tasks', 'no-unload-listeners', 'uses-passive-event-listeners',
  'bf-cache', 'pwa-cross-browser', 'pwa-page-transitions', 'pwa-each-page-has-url',
  'installable-manifest', 'service-worker', 'apple-touch-icon',
  'performance-budget', 'timing-budget', 'total-byte-weight',
  'bootup-time', 'mainthread-work-breakdown', 'duplicated-javascript',
  'legacy-javascript', 'charset', 'doctype',
]);

type PsiApiResponse = {
  lighthouseResult?: {
    categories?: {
      performance?:      { score?: number };
      accessibility?:    { score?: number };
      'best-practices'?: { score?: number };
      seo?:              { score?: number };
    };
    audits?: Record<string, {
      title: string;
      score: number | null;
      displayValue?: string;
      details?: { type?: string; overallSavingsMs?: number; data?: string };
    }>;
  };
  error?: { code?: number; message?: string; status?: string };
};

function processAudits(audits: Record<string, {
  title: string;
  score: number | null;
  displayValue?: string;
  details?: { type?: string; overallSavingsMs?: number };
}>): Pick<PsiDetails, 'opportunities' | 'failedAudits' | 'passedCount'> {
  const opportunities = Object.entries(audits)
    .filter(([, a]) =>
      a.details?.type === 'opportunity' &&
      a.score !== null && a.score < 0.9 &&
      (a.details?.overallSavingsMs ?? 0) > 200
    )
    .map(([id, a]) => ({ id, title: a.title, savings: a.displayValue, savingsMs: a.details?.overallSavingsMs ?? 0 }))
    .sort((a, b) => b.savingsMs - a.savingsMs)
    .slice(0, 8)
    .map(({ id, title, savings }) => ({ id, title, savings }));

  const failedAudits = Object.entries(audits)
    .filter(([id, a]) =>
      !SKIP_AUDIT_IDS.has(id) &&
      a.score !== null && a.score < 0.5 &&
      a.details?.type !== 'opportunity'
    )
    .map(([id, a]) => ({ id, title: a.title }))
    .slice(0, 12);

  const passedCount = Object.values(audits).filter((a) => a.score !== null && a.score >= 0.9).length;

  return { opportunities, failedAudits, passedCount };
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const placeId = searchParams.get('placeId');
    const url     = searchParams.get('url');

    if (!placeId || !url) return NextResponse.json({ error: 'Missing placeId or url' }, { status: 400 });
    if (isSocialUrl(url)) return NextResponse.json({ error: 'Social profile — not a real website' }, { status: 422 });

    // Always fetch fresh — PSI is free and prospects update their sites
    const apiKey   = process.env.PAGESPEED_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
    const keyParam = apiKey ? `&key=${apiKey}` : '';
    // Request all 4 categories so we get accessibility, seo, best-practices scores too
    const cats   = 'category=performance&category=accessibility&category=best-practices&category=seo';
    const base   = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&${cats}${keyParam}`;

    const [mobileRes, desktopRes] = await Promise.all([
      fetch(`${base}&strategy=mobile`,  { cache: 'no-store' }),
      fetch(`${base}&strategy=desktop`, { cache: 'no-store' }),
    ]);

    const [mobileBody, desktopBody] = await Promise.all([
      mobileRes.json()  as Promise<PsiApiResponse>,
      desktopRes.json() as Promise<PsiApiResponse>,
    ]);

    if (!mobileRes.ok || mobileBody.error) {
      const reason = mobileBody.error?.status ?? '';
      const code   = mobileBody.error?.code ?? mobileRes.status;
      const msg =
        reason === 'PERMISSION_DENIED'
          ? 'API key blocked — add PageSpeed Insights API in Google Cloud Console, or set PAGESPEED_API_KEY in .env.local'
          : code === 429
          ? 'PSI rate limit hit — try again in a minute'
          : mobileBody.error?.message ?? `PSI returned ${mobileRes.status}`;
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const mCats = mobileBody.lighthouseResult?.categories ?? {};
    const dCats = desktopBody.lighthouseResult?.categories ?? {};
    const sc    = (c?: { score?: number }) => Math.round((c?.score ?? 0) * 100);

    const score        = sc(mCats.performance);
    const desktopScore = dCats.performance ? sc(dCats.performance) : null;

    const mAudits = mobileBody.lighthouseResult?.audits ?? {};
    const { opportunities, failedAudits, passedCount } = processAudits(mAudits);

    // Extract mobile screenshot from PSI (data URL, typically ~50-100KB)
    const screenshotData = (mAudits['final-screenshot']?.details?.data) ?? null;

    const details: PsiDetails = {
      categories: {
        performance:   score,
        accessibility: sc(mCats.accessibility),
        bestPractices: sc(mCats['best-practices']),
        seo:           sc(mCats.seo),
      },
      opportunities,
      failedAudits,
      passedCount,
    };

    // Also capture core web vitals metrics for display
    const metrics = {
      fcp: mAudits['first-contentful-paint']?.displayValue,
      lcp: mAudits['largest-contentful-paint']?.displayValue,
      tbt: mAudits['total-blocking-time']?.displayValue,
      cls: mAudits['cumulative-layout-shift']?.displayValue,
      si:  mAudits['speed-index']?.displayValue,
    };

    const checkedAt = new Date();

    await prisma.cachedBusiness.updateMany({
      where: { placeId },
      data: {
        psiScore: score,
        psiDesktopScore: desktopScore,
        psiDetails: details as object,
        psiCheckedAt: checkedAt,
        ...(screenshotData ? { psiScreenshot: screenshotData } : {}),
      },
    });

    return NextResponse.json({
      score, desktopScore, details, metrics, screenshotData,
      checkedAt: checkedAt.toISOString(),
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/pagespeed]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
