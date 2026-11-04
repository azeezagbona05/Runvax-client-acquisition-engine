import type { FetchDeps, TransportResponse } from '@/lib/acquisition/web/fetcher';

/**
 * Fixture "internet" for fetcher tests: URL → response, hostname → addresses.
 * Unknown URLs return 404; unknown hosts resolve to a public documentation-free
 * address. Records every request so tests can assert what was (not) fetched.
 */
export interface FakeSite {
  responses: Record<string, Partial<TransportResponse> & { throws?: string }>;
  addresses?: Record<string, string[]>;
  /** Simulated response time per request (advances the fake clock). */
  latencyMs?: number;
}

export function fakeDeps(site: FakeSite) {
  const requests: Array<{ url: string; address: string; userAgent: string }> = [];
  const sleeps: number[] = [];
  let clock = 1_000_000;
  const deps: FetchDeps = {
    resolve: async (host) => site.addresses?.[host] ?? ['93.184.216.34'],
    transport: async (req) => {
      requests.push({ url: req.url.href, address: req.address, userAgent: req.userAgent });
      clock += site.latencyMs ?? 0;
      const r = site.responses[req.url.href];
      if (!r) return { status: 404, headers: { 'content-type': 'text/html' }, body: 'not found', truncated: false };
      if (r.throws) throw new Error(r.throws);
      return { status: r.status ?? 200, headers: r.headers ?? { 'content-type': 'text/html; charset=utf-8' }, body: r.body ?? '', truncated: r.truncated ?? false };
    },
    sleep: async (ms) => { sleeps.push(ms); clock += ms; },
    now: () => clock,
  };
  return { deps, requests, sleeps };
}

// A deliberately fictional policy URL: it passes the identity rules (https,
// real public suffix) but no such page is assumed to exist. The real
// crawler-policy page has not been published (docs/crawler-security-review.md).
export const CRAWLER_ENV = { IA_CRAWLER_ENABLED: 'true', IA_CRAWLER_POLICY_URL: 'https://crawler-policy.fixture-only-not-real.com/policy' };
