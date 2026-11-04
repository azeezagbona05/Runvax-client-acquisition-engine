import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rows } from '../helpers/fakePrisma';
import { fakeDeps, CRAWLER_ENV } from '../helpers/fakeWeb';
import { ACTIVATION } from '@/lib/acquisition/activation';
import { lagosDay, nextLagosMidnight } from '@/lib/acquisition/time';
import { reserve, recordFailure, recordSuccess, dailyCap, usageToday } from '@/lib/acquisition/budget';
import { isBlockedAddress, choosePublicAddress } from '@/lib/acquisition/web/ssrf';
import { normalizeSiteUrl, registrableDomain, sameSite } from '@/lib/acquisition/web/url';
import { parseRobots, isAllowed, robotsFromStatus } from '@/lib/acquisition/web/robots';
import { fetchSite, crawlerIdentity } from '@/lib/acquisition/web/fetcher';
import { purgeExpiredPageCache } from '@/lib/acquisition/web/pageCache';
import { addSuppression } from '@/lib/acquisition/suppression';

const ENV_KEYS = ['IA_CRAWLER_ENABLED', 'IA_CRAWLER_POLICY_URL', 'IA_PLACES_DAILY_CAP', 'IA_WEB_PAGES_DAILY_CAP', 'IA_DAILY_TASK_CAP'];
afterEach(() => { for (const k of ENV_KEYS) delete process.env[k]; vi.useRealTimers(); });

describe('activation switches (tripwire)', () => {
  it('everything that reaches the outside world is off in Phase 2', () => {
    expect(ACTIVATION).toEqual({ googlePlaces: false, liveWebFetch: false, pagespeedApi: false, liveDns: false });
  });
});

describe('Africa/Lagos day boundary', () => {
  it('buckets by Lagos calendar day (UTC+1), not UTC', () => {
    expect(lagosDay(new Date('2026-10-14T22:59:59Z'))).toBe('2026-10-14');
    expect(lagosDay(new Date('2026-10-14T23:00:00Z'))).toBe('2026-10-15');
  });
  it('next Lagos midnight is 23:00 UTC', () => {
    expect(nextLagosMidnight(new Date('2026-10-14T10:15:30.250Z')).toISOString()).toBe('2026-10-14T23:00:00.000Z');
    expect(nextLagosMidnight(new Date('2026-10-14T23:30:00Z')).toISOString()).toBe('2026-10-15T23:00:00.000Z');
  });
});

describe('daily budgets', () => {
  it('Places cap defaults to 50, is configurable, and has a hard maximum of 200', () => {
    expect(dailyCap('google_places')).toBe(50);
    process.env.IA_PLACES_DAILY_CAP = '10';
    expect(dailyCap('google_places')).toBe(10);
    process.env.IA_PLACES_DAILY_CAP = '100000';
    expect(dailyCap('google_places')).toBe(200);
    process.env.IA_PLACES_DAILY_CAP = 'abc';
    expect(dailyCap('google_places')).toBe(50);
  });

  it('S14: 60 concurrent reservations against a cap of 50 → exactly 50 granted', async () => {
    const now = new Date('2026-10-14T12:00:00Z');
    const results = await Promise.all(Array.from({ length: 60 }, () => reserve('google_places', now)));
    expect(results.filter((r) => r.ok)).toHaveLength(50);
    const refused = results.filter((r) => !r.ok) as Array<{ reason: string; retryAt: Date }>;
    expect(refused).toHaveLength(10);
    expect(refused[0].reason).toBe('cap_reached');
    expect(refused[0].retryAt.toISOString()).toBe('2026-10-14T23:00:00.000Z');
    expect(rows('acquisitionProviderUsage')).toHaveLength(1);
    expect(rows('acquisitionProviderUsage')[0]).toMatchObject({ provider: 'google_places', day: '2026-10-14', calls: 50 });
  });

  it('a new Lagos day starts a new counter', async () => {
    process.env.IA_PLACES_DAILY_CAP = '1';
    expect((await reserve('google_places', new Date('2026-10-14T12:00:00Z'))).ok).toBe(true);
    expect((await reserve('google_places', new Date('2026-10-14T13:00:00Z'))).ok).toBe(false);
    expect((await reserve('google_places', new Date('2026-10-14T23:00:01Z'))).ok).toBe(true);
  });

  it('a quota error pauses the provider until the next Lagos day', async () => {
    const now = new Date('2026-10-14T12:00:00Z');
    await reserve('google_places', now);
    await recordFailure('google_places', 'quota', now);
    const r = await reserve('google_places', new Date('2026-10-14T13:00:00Z'));
    expect(r).toMatchObject({ ok: false, reason: 'provider_paused' });
    expect((r as { retryAt: Date }).retryAt.toISOString()).toBe('2026-10-14T23:00:00.000Z');
  });

  it('5 consecutive failures within 15 minutes trip the circuit breaker for 30 minutes', async () => {
    const t0 = new Date('2026-10-14T12:00:00Z');
    for (let i = 0; i < 4; i++) await recordFailure('web_page', 'transient', new Date(t0.getTime() + i * 60_000));
    expect((await reserve('web_page', new Date(t0.getTime() + 5 * 60_000))).ok).toBe(true);
    await recordFailure('web_page', 'transient', new Date(t0.getTime() + 5 * 60_000));
    expect(await reserve('web_page', new Date(t0.getTime() + 6 * 60_000))).toMatchObject({ ok: false, reason: 'provider_paused' });
    expect((await reserve('web_page', new Date(t0.getTime() + 36 * 60_000))).ok).toBe(true);
  });

  it('a success resets the failure streak; usage summary reports caps', async () => {
    const now = new Date();
    await recordFailure('web_page', 'transient', now);
    await recordSuccess('web_page', now);
    expect(rows('acquisitionProviderUsage')[0].consecutiveFailures).toBe(0);
    const summary = await usageToday(now);
    expect(summary.find((s) => s.provider === 'google_places')).toMatchObject({ used: 0, cap: 50 });
  });
});

describe('SSRF guard', () => {
  it.each([
    '10.0.0.5', '127.0.0.1', '169.254.169.254', '172.16.3.4', '192.168.1.1', '100.64.0.1', '0.0.0.0', '224.0.0.1',
    '::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', '::ffff:10.0.0.1', '::ffff:127.0.0.1', '64:ff9b::a00:1', '2001:db8::1', 'not-an-ip',
  ])('blocks %s', (ip) => expect(isBlockedAddress(ip)).toBe(true));

  it.each(['93.184.216.34', '102.89.1.1', '2a00:1450:4001:80b::200e', '::ffff:93.184.216.34'])('allows public %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(false);
  });

  it('refuses a host if ANY resolved address is private', () => {
    expect(() => choosePublicAddress(['93.184.216.34', '10.0.0.1'])).toThrow(/non-public/);
    expect(() => choosePublicAddress([])).toThrow(/did not resolve/);
  });
});

describe('site URLs', () => {
  it('normalises and restricts', () => {
    expect(normalizeSiteUrl('smiledental.ng').href).toBe('https://smiledental.ng/');
    expect(() => normalizeSiteUrl('ftp://x.ng')).toThrow();
    expect(() => normalizeSiteUrl('https://x.ng:8080')).toThrow(/Port/);
    expect(() => normalizeSiteUrl('https://user:pw@x.ng')).toThrow(/Credentials/);
    expect(() => normalizeSiteUrl('https://www.instagram.com/smiledental')).toThrow(/Social/);
    expect(() => normalizeSiteUrl('https://wa.me/2348031234567')).toThrow(/Social/);
  });
  it('registrable domains understand .com.ng', () => {
    expect(registrableDomain('www.smiledental.com.ng')).toBe('smiledental.com.ng');
    expect(registrableDomain('book.smiledental.ng')).toBe('smiledental.ng');
    expect(sameSite(new URL('https://a.smiledental.com.ng'), new URL('https://smiledental.com.ng'))).toBe(true);
    expect(sameSite(new URL('https://evil.com.ng'), new URL('https://smiledental.com.ng'))).toBe(false);
  });
});

describe('robots.txt', () => {
  it('uses our group over *, longest match wins, Allow wins ties, wildcards', () => {
    const r = parseRobots(`User-agent: *\nDisallow: /\n\nUser-agent: RunvaxResearchBot\nDisallow: /private\nAllow: /private/contact$\nDisallow: /*.pdf\nCrawl-delay: 5`);
    expect(isAllowed(r, '/')).toBe(true);
    expect(isAllowed(r, '/private/x')).toBe(false);
    expect(isAllowed(r, '/private/contact')).toBe(true);
    expect(isAllowed(r, '/files/a.pdf')).toBe(false);
    expect(r.crawlDelayMs).toBe(5000);
  });
  it('falls back to * and never goes below a 2s delay', () => {
    const r = parseRobots('User-agent: *\nDisallow: /admin\nCrawl-delay: 0.5');
    expect(isAllowed(r, '/admin/x')).toBe(false);
    expect(isAllowed(r, '/contact')).toBe(true);
    expect(r.crawlDelayMs).toBe(2000);
  });
  it('does not match other bots by substring', () => {
    const r = parseRobots('User-agent: r\nDisallow: /\n\nUser-agent: *\nAllow: /');
    expect(isAllowed(r, '/')).toBe(true);
  });
  it.each([
    [200, 'User-agent: *\nDisallow:', 'parsed', true],
    [404, null, 'none', true],
    [410, null, 'none', true],
    [401, null, 'disallow_all', false],
    [403, null, 'disallow_all', false],
    [429, null, 'disallow_all', false],
    [503, null, 'disallow_all', false],
    [null, null, 'disallow_all', false],
  ])('HTTP %s → %s', (status, body, expected, allowed) => {
    const r = robotsFromStatus(status as number | null, body as string | null);
    expect(r.status).toBe(expected);
    expect(isAllowed(r, '/')).toBe(allowed);
  });
});

describe('crawler identity (D1)', () => {
  it('is disabled unless explicitly enabled with a genuine https policy URL', () => {
    expect(crawlerIdentity()).toEqual({ ok: false, reason: 'crawler_disabled' });
    process.env.IA_CRAWLER_ENABLED = 'true';
    expect(crawlerIdentity()).toEqual({ ok: false, reason: 'crawler_identity_missing' });
    for (const bad of ['http://harzotech.com/bot', 'https://localhost/bot', 'https://127.0.0.1/bot', 'https://example.com/bot', 'nonsense']) {
      process.env.IA_CRAWLER_POLICY_URL = bad;
      expect(crawlerIdentity().ok).toBe(false);
    }
    process.env.IA_CRAWLER_POLICY_URL = CRAWLER_ENV.IA_CRAWLER_POLICY_URL;
    expect(crawlerIdentity()).toEqual({ ok: true, userAgent: `RunvaxResearchBot/1.0 (+${CRAWLER_ENV.IA_CRAWLER_POLICY_URL})` });
  });
});

const HOME = '<html><head><title>Smile</title></head><body><a href="/contact">Contact</a><a href="/about-us">About</a><a href="https://other.ng/x">x</a><a href="/blog?page=2">blog</a></body></html>';

describe('fetchSite', () => {
  beforeEach(() => Object.assign(process.env, CRAWLER_ENV));

  it('S19: without crawler configuration it does nothing at all', async () => {
    delete process.env.IA_CRAWLER_ENABLED;
    const { deps, requests } = fakeDeps({ responses: {} });
    expect((await fetchSite({ userId: 'u1', siteUrl: 'smile.ng', maxPages: 4, contactPathHints: [], ttlHours: 24, deps })).status).toBe('crawler_disabled');
    expect(requests).toHaveLength(0);
    expect(rows('acquisitionProviderUsage')).toHaveLength(0);
  });

  it('S19: the live transport refuses while ACTIVATION.liveWebFetch is false (even with crawler env set)', async () => {
    const r = await fetchSite({ userId: 'u1', siteUrl: 'smile.ng', maxPages: 4, contactPathHints: [], ttlHours: 24 });
    expect(r.status).toBe('live_fetch_not_approved');
    expect(rows('acquisitionProviderUsage')).toHaveLength(0);
  });

  it('fetches home + relevant same-site pages with an honest UA, delays, and caches them', async () => {
    const { deps, requests, sleeps } = fakeDeps({
      responses: {
        'https://smile.ng/robots.txt': { status: 200, headers: { 'content-type': 'text/plain' }, body: 'User-agent: *\nCrawl-delay: 3' },
        'https://smile.ng/': { body: HOME },
        'https://smile.ng/contact': { body: '<p>Call us</p>' },
        'https://smile.ng/about-us': { body: '<p>About</p>' },
      },
    });
    const r = await fetchSite({ userId: 'u1', siteUrl: 'https://smile.ng', maxPages: 4, contactPathHints: ['/book'], ttlHours: 24, deps });
    expect(r.status).toBe('ok');
    expect(requests.map((x) => x.url)).toEqual(['https://smile.ng/robots.txt', 'https://smile.ng/', 'https://smile.ng/contact', 'https://smile.ng/about-us', 'https://smile.ng/book']);
    expect(requests.every((x) => x.userAgent === `RunvaxResearchBot/1.0 (+${CRAWLER_ENV.IA_CRAWLER_POLICY_URL})`)).toBe(true);
    expect(requests.some((x) => x.url.includes('other.ng') || x.url.includes('?'))).toBe(false);
    expect(sleeps.every((s) => s >= 2000)).toBe(true);
    expect(sleeps.length).toBeGreaterThanOrEqual(3);
    expect(rows('acquisitionProviderUsage').find((u) => u.provider === 'web_page')?.calls).toBe(5);

    // Second run is served from the cache: no new requests, no budget spent.
    const again = await fetchSite({ userId: 'u1', siteUrl: 'https://smile.ng', maxPages: 4, contactPathHints: ['/book'], ttlHours: 24, deps });
    expect(again.pages.every((p) => p.fromCache)).toBe(true);
    expect(requests).toHaveLength(5);
  });

  it('S4: robots.txt Disallow: / → nothing but robots.txt is requested', async () => {
    const { deps, requests } = fakeDeps({ responses: { 'https://smile.ng/robots.txt': { status: 200, headers: { 'content-type': 'text/plain' }, body: 'User-agent: *\nDisallow: /' } } });
    const r = await fetchSite({ userId: 'u1', siteUrl: 'smile.ng', maxPages: 4, contactPathHints: [], ttlHours: 24, deps });
    expect(r.status).toBe('robots_disallowed');
    expect(requests.map((x) => x.url)).toEqual(['https://smile.ng/robots.txt']);
  });

  it.each([[503], [403], [429]])('S5: robots.txt HTTP %s → site disallowed', async (status) => {
    const { deps, requests } = fakeDeps({ responses: { 'https://smile.ng/robots.txt': { status } } });
    expect((await fetchSite({ userId: 'u1', siteUrl: 'smile.ng', maxPages: 4, contactPathHints: [], ttlHours: 24, deps })).status).toBe('robots_disallowed');
    expect(requests).toHaveLength(1);
  });

  it('S5: robots.txt timeout → site disallowed', async () => {
    const { deps } = fakeDeps({ responses: { 'https://smile.ng/robots.txt': { throws: 'timeout' } } });
    expect((await fetchSite({ userId: 'u1', siteUrl: 'smile.ng', maxPages: 4, contactPathHints: [], ttlHours: 24, deps })).status).toBe('robots_disallowed');
  });

  it('S13: a site resolving to a private address is never connected to', async () => {
    const { deps, requests } = fakeDeps({ responses: {}, addresses: { 'smile.ng': ['10.0.0.5'] } });
    const r = await fetchSite({ userId: 'u1', siteUrl: 'smile.ng', maxPages: 4, contactPathHints: [], ttlHours: 24, deps });
    expect(r.status).toBe('robots_disallowed'); // robots.txt itself was blocked → conservative
    expect(requests).toHaveLength(0);
  });

  it('S13: a redirect to the metadata address is refused before connecting', async () => {
    const { deps, requests } = fakeDeps({
      responses: {
        'https://smile.ng/robots.txt': { status: 404 },
        'https://smile.ng/': { status: 302, headers: { location: 'https://meta.smile.ng/latest' } },
      },
      addresses: { 'meta.smile.ng': ['169.254.169.254'] },
    });
    const r = await fetchSite({ userId: 'u1', siteUrl: 'smile.ng', maxPages: 4, contactPathHints: [], ttlHours: 24, deps });
    expect(r.pages[0].status).toBe('blocked');
    expect(requests.map((x) => x.url)).toEqual(['https://smile.ng/robots.txt', 'https://smile.ng/']);
  });

  it('S13: IPv6 loopback is refused', async () => {
    const { deps, requests } = fakeDeps({ responses: {}, addresses: { 'smile.ng': ['::1'] } });
    await fetchSite({ userId: 'u1', siteUrl: 'smile.ng', maxPages: 4, contactPathHints: [], ttlHours: 24, deps });
    expect(requests).toHaveLength(0);
  });

  it('refuses off-site redirects, oversize and non-HTML responses, and redirect loops', async () => {
    const loop: Record<string, { status: number; headers: Record<string, string> }> = {};
    for (let i = 0; i < 6; i++) loop[`https://loop.ng/${i === 0 ? '' : i}`] = { status: 301, headers: { location: `https://loop.ng/${i + 1}` } };
    const { deps } = fakeDeps({
      responses: {
        'https://a.ng/robots.txt': { status: 404 }, 'https://a.ng/': { status: 301, headers: { location: 'https://elsewhere.com/' } },
        'https://b.ng/robots.txt': { status: 404 }, 'https://b.ng/': { truncated: true, body: '' },
        'https://c.ng/robots.txt': { status: 404 }, 'https://c.ng/': { headers: { 'content-type': 'application/pdf' }, body: '%PDF' },
        'https://loop.ng/robots.txt': { status: 404 }, ...loop,
      },
    });
    const go = (s: string) => fetchSite({ userId: 'u1', siteUrl: s, maxPages: 4, contactPathHints: [], ttlHours: 24, deps });
    expect((await go('a.ng')).pages[0].status).toBe('offsite_redirect');
    expect((await go('b.ng')).pages[0].status).toBe('too_large');
    expect((await go('c.ng')).pages[0].status).toBe('not_html');
    expect((await go('loop.ng')).pages[0].status).toBe('too_many_redirects');
  });

  it('honours the crawl_domain blocklist (site owner asked us not to crawl)', async () => {
    await addSuppression({ userId: 'u1', kind: 'crawl_domain', value: 'smile.ng', reason: 'manual', source: 'owner request' });
    const { deps, requests } = fakeDeps({ responses: {} });
    expect((await fetchSite({ userId: 'u1', siteUrl: 'https://www.smile.ng', maxPages: 4, contactPathHints: [], ttlHours: 24, deps })).status).toBe('crawl_blocked');
    expect(requests).toHaveLength(0);
  });

  it('stops when the web_page budget is exhausted and reports when to retry', async () => {
    process.env.IA_WEB_PAGES_DAILY_CAP = '2';
    const { deps, requests } = fakeDeps({
      responses: { 'https://smile.ng/robots.txt': { status: 404 }, 'https://smile.ng/': { body: HOME }, 'https://smile.ng/contact': { body: 'x' } },
    });
    const r = await fetchSite({ userId: 'u1', siteUrl: 'smile.ng', maxPages: 4, contactPathHints: [], ttlHours: 24, deps });
    expect(r.status).toBe('budget_exhausted');
    expect(r.retryAt).toBeInstanceOf(Date);
    expect(requests).toHaveLength(2);
  });

  it('expired cached pages are purged', async () => {
    const { deps } = fakeDeps({ responses: { 'https://smile.ng/robots.txt': { status: 404 }, 'https://smile.ng/': { body: '<p>hi</p>' } } });
    await fetchSite({ userId: 'u1', siteUrl: 'smile.ng', maxPages: 1, contactPathHints: [], ttlHours: 1, deps });
    expect(rows('acquisitionPageCache').length).toBe(2);
    expect(await purgeExpiredPageCache(new Date(Date.now() + 2 * 60 * 60 * 1000))).toBe(2);
    expect(rows('acquisitionPageCache')).toHaveLength(0);
  });
});
