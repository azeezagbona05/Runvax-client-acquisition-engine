import { prisma } from '@/lib/prisma';
import { lagosDay, nextLagosMidnight } from './time';

/**
 * Platform-wide daily budgets for every external call, and for acquisition
 * task executions. A unit is reserved BEFORE the call, by one conditional
 * UPDATE (calls = calls + 1 WHERE calls < cap), so concurrent runs, retries
 * and overlapping drains can never exceed the cap. Failed calls keep their
 * unit: a cap counts attempts, not successes. The cap is a ceiling, not a
 * target.
 */

export type Provider = 'google_places' | 'web_page' | 'pagespeed' | 'dns' | 'acq_tasks';

// [env var, default, hard maximum in code]
const CAPS: Record<Provider, [string, number, number]> = {
  google_places: ['IA_PLACES_DAILY_CAP', 50, 200],
  web_page: ['IA_WEB_PAGES_DAILY_CAP', 500, 2000],
  pagespeed: ['IA_PSI_DAILY_CAP', 100, 500],
  dns: ['IA_DNS_DAILY_CAP', 500, 2000],
  acq_tasks: ['IA_DAILY_TASK_CAP', 200, 1000],
};

const BREAKER_FAILURES = 5;
const BREAKER_WINDOW_MS = 15 * 60 * 1000;
const BREAKER_PAUSE_MS = 30 * 60 * 1000;

export function dailyCap(provider: Provider): number {
  const [env, def, max] = CAPS[provider];
  const n = Number.parseInt(process.env[env] ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : def;
}

export type Reservation = { ok: true } | { ok: false; reason: 'cap_reached' | 'provider_paused'; retryAt: Date };

async function ensureRow(provider: Provider, day: string) {
  try {
    await prisma.acquisitionProviderUsage.create({ data: { provider, day } });
  } catch (err) {
    if ((err as { code?: string }).code !== 'P2002') throw err; // another run created it first
  }
}

export async function reserve(provider: Provider, now: Date = new Date()): Promise<Reservation> {
  const day = lagosDay(now);
  const cap = dailyCap(provider);
  await ensureRow(provider, day);
  const res = await prisma.acquisitionProviderUsage.updateMany({
    where: {
      provider, day,
      calls: { lt: cap },
      OR: [{ pausedUntil: null }, { pausedUntil: { lt: now } }],
    },
    data: { calls: { increment: 1 } },
  });
  if (res.count === 1) return { ok: true };

  const row = await prisma.acquisitionProviderUsage.findFirst({ where: { provider, day } });
  if (row?.pausedUntil && row.pausedUntil > now) return { ok: false, reason: 'provider_paused', retryAt: row.pausedUntil };
  return { ok: false, reason: 'cap_reached', retryAt: nextLagosMidnight(now) };
}

export async function recordSuccess(provider: Provider, now: Date = new Date()): Promise<void> {
  await prisma.acquisitionProviderUsage.updateMany({
    where: { provider, day: lagosDay(now), consecutiveFailures: { gt: 0 } },
    data: { consecutiveFailures: 0 },
  });
}

/**
 * Quota errors (e.g. HTTP 429 / quota exceeded) pause the provider until the
 * next Lagos day. Otherwise 5 consecutive failures within 15 minutes pause it
 * for 30 minutes.
 */
export async function recordFailure(provider: Provider, kind: 'transient' | 'quota', now: Date = new Date()): Promise<void> {
  const day = lagosDay(now);
  await ensureRow(provider, day);
  const row = await prisma.acquisitionProviderUsage.findFirst({ where: { provider, day } });
  if (!row) return;
  const recent = row.lastFailureAt && now.getTime() - row.lastFailureAt.getTime() <= BREAKER_WINDOW_MS;
  const failures = (recent ? row.consecutiveFailures : 0) + 1;
  const pausedUntil = kind === 'quota'
    ? nextLagosMidnight(now)
    : failures >= BREAKER_FAILURES ? new Date(now.getTime() + BREAKER_PAUSE_MS) : row.pausedUntil;
  await prisma.acquisitionProviderUsage.updateMany({
    where: { id: row.id },
    data: { consecutiveFailures: failures, lastFailureAt: now, pausedUntil },
  });
}

export async function usageToday(now: Date = new Date()) {
  const day = lagosDay(now);
  const rows = await prisma.acquisitionProviderUsage.findMany({ where: { day } });
  return (Object.keys(CAPS) as Provider[]).map((p) => {
    const r = rows.find((x: { provider: string }) => x.provider === p);
    return { provider: p, day, used: r?.calls ?? 0, cap: dailyCap(p), pausedUntil: r?.pausedUntil ?? null };
  });
}
