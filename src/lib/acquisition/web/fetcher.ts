import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import dns from 'node:dns';
import { ACTIVATION, ActivationError } from '../activation';
import { reserve, recordFailure, recordSuccess } from '../budget';
import { isCrawlBlocked } from '../suppression';
import { BlockedAddressError, choosePublicAddress } from './ssrf';
import { normalizeSiteUrl, sameSite, hasQuery, registrableDomain, UnsupportedUrlError, assertFetchableUrl, isPublicHostname } from './url';
import { isAllowed, robotsFromStatus, type RobotsRules, MIN_DELAY_MS } from './robots';
import { getCachedPage, putCachedPage } from './pageCache';

/**
 * The acquisition engine's own website fetcher. It shares nothing with the
 * existing /api/emails crawler, which sends a spoofed browser identity and
 * ignores robots.txt.
 *
 * - Runs only when IA_CRAWLER_ENABLED=true AND IA_CRAWLER_POLICY_URL is a
 *   genuine https policy/contact URL; it identifies itself as
 *   "RunvaxResearchBot/1.0 (+<that URL>)". Never a browser identity.
 * - The live network transport and DNS resolver also require
 *   ACTIVATION.liveWebFetch (false in Phase 2). Tests inject fixtures.
 * - robots.txt: our group or "*"; 404 → allowed; 401/403/429/5xx/timeout →
 *   the whole site is disallowed.
 * - Only the clinic's own registrable domain, http/https on 80/443, no query
 *   strings, at most 3 redirects, each re-validated (domain, robots, address).
 * - Every resolved address must be public (ssrf.ts); the connection is
 *   pinned to the checked address, so a second DNS answer can't redirect it.
 * - Every request (robots.txt included) reserves a web_page budget unit first.
 * - 8s per request, 1.5 MB, text/html only, ≥2s (or Crawl-delay) between
 *   requests, at most `maxPages` pages.
 * - Hard 30s budget per site INCLUDING waits: a request (or wait) is only
 *   started if it can finish inside the budget. A Crawl-delay above 10s means
 *   the home page only; the rest is left for a later run.
 * - Every redirect hop must pass the same URL rules as the start URL
 *   (http/https, standard port, no credentials, public hostname, no IP
 *   literal) BEFORE any DNS resolution.
 */

export const REQUEST_TIMEOUT_MS = 8000;
export const MAX_BYTES = 1.5 * 1024 * 1024;
export const MAX_REDIRECTS = 3;
export const SITE_BUDGET_MS = 30_000;
export const MAX_CRAWL_DELAY_MS = 10_000;

export interface TransportRequest { url: URL; address: string; userAgent: string; timeoutMs: number; maxBytes: number }
export interface TransportResponse { status: number; headers: Record<string, string | undefined>; body: string; truncated: boolean }
export type Transport = (req: TransportRequest) => Promise<TransportResponse>;

export interface FetchDeps {
  transport: Transport;
  resolve: (hostname: string) => Promise<string[]>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

export type PageStatus =
  | 'ok' | 'robots_disallowed' | 'blocked' | 'http_error' | 'timeout' | 'too_large' | 'not_html'
  | 'offsite_redirect' | 'invalid_redirect' | 'too_many_redirects' | 'error' | 'budget_exhausted' | 'time_budget';

export interface FetchedPage {
  url: string;
  finalUrl: string | null;
  status: PageStatus;
  httpStatus: number | null;
  html: string | null;
  fromCache: boolean;
}

export type SiteStatus =
  | 'ok' | 'crawler_disabled' | 'crawler_identity_missing' | 'live_fetch_not_approved' | 'crawl_blocked'
  | 'invalid_url' | 'robots_disallowed' | 'unreachable' | 'budget_exhausted';

export interface SiteFetchResult {
  status: SiteStatus;
  detail?: string;
  siteUrl?: string;
  robots?: RobotsRules['status'];
  pages: FetchedPage[];
  retryAt?: Date;
  /** Set when fewer pages than allowed were fetched on purpose. */
  limited?: 'crawl_delay_exceeds_limit' | 'site_time_budget';
}

// ─── identity ───────────────────────────────────────────────────────────────

export function crawlerIdentity(): { ok: true; userAgent: string } | { ok: false; reason: 'crawler_disabled' | 'crawler_identity_missing' } {
  if (process.env.IA_CRAWLER_ENABLED !== 'true') return { ok: false, reason: 'crawler_disabled' };
  const raw = process.env.IA_CRAWLER_POLICY_URL ?? '';
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    const looksReal = u.protocol === 'https:' && !u.username && !u.password && isPublicHostname(host)
      && !/(^|\.)example\.(com|org|net)$/.test(host);
    if (!looksReal) return { ok: false, reason: 'crawler_identity_missing' };
    return { ok: true, userAgent: `RunvaxResearchBot/1.0 (+${u.href})` };
  } catch {
    return { ok: false, reason: 'crawler_identity_missing' };
  }
}

// ─── live transport + resolver (both refuse unless activated) ───────────────

const liveResolve = async (hostname: string): Promise<string[]> => {
  if (!ACTIVATION.liveWebFetch) throw new ActivationError('liveWebFetch', 'DNS resolution for website fetching');
  if (net.isIP(hostname)) return [hostname];
  const res = await dns.promises.lookup(hostname, { all: true, verbatim: true });
  return res.map((r) => r.address);
};

/** The only headers ever sent to a clinic site: no cookies, no authorisation, no forwarded credentials. */
export function requestHeaders(userAgent: string): Record<string, string> {
  return { 'User-Agent': userAgent, Accept: 'text/html,text/plain;q=0.9', 'Accept-Encoding': 'identity' };
}

/**
 * Socket lookup pinned to an address that already passed the public-address
 * check. Node calls this instead of DNS, so a second (rebinding) DNS answer
 * can never redirect the connection.
 */
export function pinnedLookup(address: string) {
  const family = net.isIP(address);
  return (_host: string, opts: { all?: boolean } | undefined, cb: (...a: unknown[]) => void) =>
    opts?.all ? cb(null, [{ address, family }]) : cb(null, address, family);
}

const liveTransport: Transport = (req) => {
  if (!ACTIVATION.liveWebFetch) return Promise.reject(new ActivationError('liveWebFetch', 'website fetching'));
  const mod = req.url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const r = mod.request({
      host: req.url.hostname,
      port: req.url.port || (req.url.protocol === 'https:' ? 443 : 80),
      path: `${req.url.pathname}${req.url.search}`,
      method: 'GET',
      servername: req.url.hostname,
      headers: requestHeaders(req.userAgent),
      // Pin the socket to the address that passed the public-address check.
      lookup: pinnedLookup(req.address),
    } as http.RequestOptions, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      let truncated = false;
      res.on('data', (c: Buffer) => {
        size += c.length;
        if (size > req.maxBytes) { truncated = true; res.destroy(); return; }
        chunks.push(c);
      });
      const done = () => resolve({
        status: res.statusCode ?? 0,
        headers: Object.fromEntries(Object.entries(res.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v])),
        body: Buffer.concat(chunks).toString('utf8'),
        truncated,
      });
      res.on('end', done);
      res.on('close', done);
    });
    const hard = setTimeout(() => r.destroy(new Error('timeout')), req.timeoutMs);
    r.on('error', (e) => { clearTimeout(hard); reject(e); });
    r.on('close', () => clearTimeout(hard));
    r.end();
  });
};

export const LIVE_DEPS: FetchDeps = {
  transport: liveTransport,
  resolve: liveResolve,
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  now: () => Date.now(),
};

// ─── fetching ───────────────────────────────────────────────────────────────

const LINK_RE = /<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)["']/gi;
const INTERESTING = /contact|about|book|appoint|service|treatment|team|reach|location|find-us/i;

function candidateLinks(html: string, base: URL, hints: string[], maxPages: number): URL[] {
  const out = new Map<string, URL>();
  const add = (u: URL) => {
    if (!sameSite(u, base) || hasQuery(u) || !/^https?:$/.test(u.protocol)) return;
    u.hash = '';
    const key = u.pathname.replace(/\/+$/, '') || '/';
    if (!out.has(key)) out.set(key, u);
  };
  add(new URL(base.href));
  for (const m of Array.from(html.matchAll(LINK_RE))) {
    try {
      const u = new URL(m[1], base);
      if (INTERESTING.test(u.pathname)) add(u);
    } catch { /* ignore bad hrefs */ }
  }
  for (const h of hints) add(new URL(h, base));
  return Array.from(out.values()).slice(0, maxPages);
}

interface Ctx {
  userId: string;
  base: URL;
  userAgent: string;
  deps: FetchDeps;
  ttlHours: number;
  robots: RobotsRules | null;
  lastRequestAt: number;
  delayMs: number;
  startedAt: number;
}

function fitsBudget(ctx: Ctx, waitMs: number): boolean {
  return ctx.deps.now() - ctx.startedAt + Math.max(0, waitMs) + REQUEST_TIMEOUT_MS <= SITE_BUDGET_MS;
}

async function fetchOne(ctx: Ctx, start: URL, kind: 'robots' | 'page'): Promise<FetchedPage & { retryAt?: Date }> {
  const cached = await getCachedPage(ctx.userId, start.href);
  if (cached) {
    return { url: start.href, finalUrl: cached.finalUrl, status: cached.status as PageStatus, httpStatus: cached.httpStatus, html: cached.html, fromCache: true };
  }

  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (hop > 0) {
      try { assertFetchableUrl(current); } catch { return finish(ctx, start, current, 'invalid_redirect', null, null); }
    }
    if (!sameSite(current, ctx.base)) return finish(ctx, start, current, 'offsite_redirect', null, null);
    if (kind === 'page' && ctx.robots && !isAllowed(ctx.robots, `${current.pathname}${current.search}`)) {
      return finish(ctx, start, current, 'robots_disallowed', null, null);
    }

    if (!fitsBudget(ctx, ctx.lastRequestAt + ctx.delayMs - ctx.deps.now())) {
      return { url: start.href, finalUrl: null, status: 'time_budget', httpStatus: null, html: null, fromCache: false };
    }
    const r = await reserve('web_page');
    if (!r.ok) return { url: start.href, finalUrl: null, status: 'budget_exhausted', httpStatus: null, html: null, fromCache: false, retryAt: r.retryAt };

    let address: string;
    try {
      address = choosePublicAddress(await ctx.deps.resolve(current.hostname));
    } catch (err) {
      if (err instanceof BlockedAddressError) return finish(ctx, start, current, 'blocked', null, null);
      if (err instanceof ActivationError) throw err;
      await recordFailure('web_page', 'transient');
      return finish(ctx, start, current, 'error', null, null);
    }

    const wait = ctx.lastRequestAt + ctx.delayMs - ctx.deps.now();
    // Not cached and not counted as a result: a later run can fetch it.
    if (!fitsBudget(ctx, wait)) return { url: start.href, finalUrl: null, status: 'time_budget', httpStatus: null, html: null, fromCache: false };
    if (wait > 0) await ctx.deps.sleep(wait);
    ctx.lastRequestAt = ctx.deps.now();

    let res: TransportResponse;
    try {
      res = await ctx.deps.transport({ url: current, address, userAgent: ctx.userAgent, timeoutMs: REQUEST_TIMEOUT_MS, maxBytes: MAX_BYTES });
    } catch (err) {
      if (err instanceof ActivationError) throw err;
      await recordFailure('web_page', 'transient');
      const timedOut = /timeout|timed out|ETIMEDOUT/i.test(String((err as Error)?.message ?? err));
      return finish(ctx, start, current, timedOut ? 'timeout' : 'error', null, null);
    }

    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      try { current = new URL(res.headers.location, current); } catch { return finish(ctx, start, current, 'invalid_redirect', res.status, null); }
      continue;
    }
    if (res.status >= 500) await recordFailure('web_page', 'transient');
    else await recordSuccess('web_page');

    if (kind === 'robots') return finish(ctx, start, current, res.status < 300 ? 'ok' : 'http_error', res.status, res.status < 300 ? res.body : null);
    if (res.truncated) return finish(ctx, start, current, 'too_large', res.status, null);
    if (res.status < 200 || res.status >= 300) return finish(ctx, start, current, 'http_error', res.status, null);
    const type = (res.headers['content-type'] ?? '').toLowerCase();
    if (!type.includes('text/html')) return finish(ctx, start, current, 'not_html', res.status, null);
    return finish(ctx, start, current, 'ok', res.status, res.body);
  }
  return finish(ctx, start, current, 'too_many_redirects', null, null);
}

async function finish(ctx: Ctx, start: URL, final: URL, status: PageStatus, httpStatus: number | null, html: string | null): Promise<FetchedPage> {
  await putCachedPage({ userId: ctx.userId, url: start.href, finalUrl: final.href, status, httpStatus, html, ttlHours: ctx.ttlHours });
  return { url: start.href, finalUrl: final.href, status, httpStatus, html, fromCache: false };
}

/**
 * Fetches a clinic's site (home + up to maxPages-1 relevant pages). Pass
 * `deps` only in tests; without it the live transport is used, which refuses
 * to run while ACTIVATION.liveWebFetch is false.
 */
export async function fetchSite(params: {
  userId: string;
  siteUrl: string;
  maxPages: number;
  contactPathHints: string[];
  ttlHours: number;
  deps?: FetchDeps;
}): Promise<SiteFetchResult> {
  const identity = crawlerIdentity();
  if (!identity.ok) return { status: identity.reason, pages: [] };
  if (!params.deps && !ACTIVATION.liveWebFetch) {
    return { status: 'live_fetch_not_approved', detail: 'ACTIVATION.liveWebFetch is false', pages: [] };
  }
  const deps = params.deps ?? LIVE_DEPS;

  let base: URL;
  try { base = normalizeSiteUrl(params.siteUrl); } catch (err) {
    return { status: 'invalid_url', detail: err instanceof UnsupportedUrlError ? err.message : 'invalid', pages: [] };
  }
  if (await isCrawlBlocked(params.userId, registrableDomain(base.hostname))) return { status: 'crawl_blocked', siteUrl: base.href, pages: [] };

  const startedAt = deps.now();
  const ctx: Ctx = { userId: params.userId, base, userAgent: identity.userAgent, deps, ttlHours: params.ttlHours, robots: null, lastRequestAt: 0, delayMs: MIN_DELAY_MS, startedAt };

  const robotsPage = await fetchOne(ctx, new URL('/robots.txt', base), 'robots');
  if (robotsPage.status === 'budget_exhausted') return { status: 'budget_exhausted', siteUrl: base.href, pages: [], retryAt: robotsPage.retryAt };
  ctx.robots = robotsFromStatus(robotsPage.status === 'ok' || robotsPage.status === 'http_error' ? robotsPage.httpStatus : null, robotsPage.html);
  ctx.delayMs = ctx.robots.crawlDelayMs;
  const delayTooLong = ctx.delayMs > MAX_CRAWL_DELAY_MS;
  // Over the limit: this run makes exactly one more request (the home page),
  // at the minimum spacing, and nothing after it.
  if (delayTooLong) ctx.delayMs = MIN_DELAY_MS;
  if (ctx.robots.status === 'disallow_all' || !isAllowed(ctx.robots, base.pathname || '/')) {
    return { status: 'robots_disallowed', siteUrl: base.href, robots: ctx.robots.status, pages: [] };
  }

  const home = await fetchOne(ctx, base, 'page');
  if (home.status === 'budget_exhausted') return { status: 'budget_exhausted', siteUrl: base.href, robots: ctx.robots.status, pages: [], retryAt: home.retryAt };
  const pages: FetchedPage[] = [home];
  if (home.status !== 'ok' || !home.html) {
    return { status: home.status === 'robots_disallowed' ? 'robots_disallowed' : 'unreachable', siteUrl: base.href, robots: ctx.robots.status, pages };
  }
  // A long Crawl-delay is respected by not making further requests in this run.
  if (delayTooLong) return { status: 'ok', siteUrl: base.href, robots: ctx.robots.status, pages, limited: 'crawl_delay_exceeds_limit' };

  let limited: SiteFetchResult['limited'];
  for (const link of candidateLinks(home.html, new URL(home.finalUrl ?? base.href), params.contactPathHints, params.maxPages).slice(1)) {
    const p = await fetchOne(ctx, link, 'page');
    if (p.status === 'budget_exhausted') return { status: 'budget_exhausted', siteUrl: base.href, robots: ctx.robots.status, pages, retryAt: p.retryAt };
    if (p.status === 'time_budget') { limited = 'site_time_budget'; break; }
    pages.push(p);
  }
  return { status: 'ok', siteUrl: base.href, robots: ctx.robots.status, pages, limited };
}
