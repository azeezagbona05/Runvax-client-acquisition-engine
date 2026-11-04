/**
 * Phase 2B P0 hardening — regression tests. Written BEFORE the fixes; each
 * describe block failed against the Phase 2 implementation (see
 * docs/phase-2b-p0-report.md for the recorded pre-fix run). Fixtures and
 * mocked transports only — no network.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { rows, seed } from '../helpers/fakePrisma';
import { fakeDeps, CRAWLER_ENV } from '../helpers/fakeWeb';
import { S2, allResponses } from '../fixtures/sites';
import * as url from '@/lib/acquisition/web/url';
import * as fetcher from '@/lib/acquisition/web/fetcher';
import * as extract from '@/lib/acquisition/web/extract';
import * as suppression from '@/lib/acquisition/suppression';
import * as contacts from '@/lib/acquisition/contacts';
import * as maintenance from '@/lib/acquisition/maintenance';
import { identityKeys } from '@/lib/acquisition/identity';
import { previewImport, commitImport } from '@/lib/acquisition/imports/service';
import { __setResearchDeps } from '@/lib/acquisition/research/handlers';
import { drainAcqTasks } from '@/lib/acquisition/tasks/queue';
import { dental } from '@/lib/acquisition/config/industries/dental';

const auth = vi.hoisted(() => ({ getServerSession: vi.fn() }));
vi.mock('next-auth', () => ({ getServerSession: auth.getServerSession }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.hoisted(() => { process.env.ADMIN_EMAILS = 'admin@harzotech.test'; });

const ADMIN = { user: { id: 'u1', email: 'admin@harzotech.test' } };
const TEST_KEY = ['p0', 'test', 'fixture', '0123456789abcdef0123456789abcdef'].join('_');
const ORIGIN = 'http://localhost';
const post = (u: string, body: unknown, headers: Record<string, string> = { origin: ORIGIN }) =>
  new NextRequest(`${ORIGIN}${u}`, { method: 'POST', body: JSON.stringify(body), headers });

beforeEach(() => {
  process.env.INDUSTRY_ACQUISITION_ENABLED = 'true';
  process.env.IA_SUPPRESSION_KEY = TEST_KEY;
  process.env.IA_SUPPRESSION_KEY_ID = 'k1';
  Object.assign(process.env, CRAWLER_ENV);
  auth.getServerSession.mockReset();
});
afterEach(() => {
  __setResearchDeps(null);
  for (const k of ['INDUSTRY_ACQUISITION_ENABLED', 'IA_SUPPRESSION_KEY', 'IA_SUPPRESSION_KEY_ID', 'IA_SUPPRESSION_KEYS_PREVIOUS', 'IA_SUPPRESSION_LEGACY_MATCH', 'IA_CRAWLER_ENABLED', 'IA_CRAWLER_POLICY_URL']) delete process.env[k];
});

async function drainAll() { for (let i = 0; i < 8; i++) { const r = await drainAcqTasks({ budget: 50 }); if (r.claimed === 0) break; } }

// ─── P0-1 erasure completeness ──────────────────────────────────────────────
describe('P0-1 erasure completeness', () => {
  it('extracted evidence quotes never contain a phone number or email address', () => {
    const ex = extract.extractSite([{ url: `https://${S2.domain}/`, html: S2.responses['https://coralteeth-s2.ng/'].body }], dental, `https://${S2.domain}/`);
    const quotes = ex.signals.map((s) => s.quote).join(' ');
    expect(quotes).not.toMatch(/0800\s?000\s?0202|08000000202|2348000000202/);
    expect(quotes).not.toMatch(/reception@/);
    // The contact itself is still extracted (stored separately, deleted on erasure).
    expect(ex.phones.map((p) => p.phone)).toContain('2348000000202');
  });

  it('after erase_contacts, no erased value remains anywhere the engine wrote it', async () => {
    const { deps } = fakeDeps({ responses: allResponses() });
    __setResearchDeps({ fetchDeps: deps });
    const p = await previewImport({ userId: 'u1', industryKey: 'dental', kind: 'csv', csvText: `business_name,source,website,phone,email\nCoral Teeth Clinic,fixture,https://${S2.domain},0800 000 0202,reception@${S2.domain}` });
    await commitImport({ userId: 'u1', batchId: p.batchId, attestedBy: 'a', attest: true });
    await drainAll();
    const acq = rows('acquisitionProspect')[0];
    const res = await contacts.eraseContacts({ userId: 'u1', acqProspectId: acq.id as string, reason: 'erasure', actor: 'admin', domain: S2.domain });
    expect(res.erased).toBeGreaterThan(0);
    const everything = JSON.stringify(['acquisitionIdentity', 'acquisitionScore', 'acquisitionRecommendation', 'acquisitionSignal', 'acquisitionFinding', 'acquisitionDecisionMaker', 'acquisitionSource', 'acquisitionPipelineEvent', 'acquisitionImportBatch', 'acquisitionPageCache', 'acquisitionTask', 'acquisitionAgentRun', 'acquisitionSuppression', 'prospect'].map((t) => rows(t)));
    for (const v of ['0800 000 0202', '08000000202', '2348000000202', `reception@${S2.domain}`]) expect(everything).not.toContain(v);
  });

  it('a reused existing CRM prospect is never modified by erasure; the result says so', async () => {
    seed('prospect', { id: 'crm1', userId: 'u1', businessId: 'ChIJcrmcrmcrmcrmcrm12', businessName: 'CRM Clinic', businessData: { phone: '0801 111 1111' }, source: 'manual' });
    seed('acquisitionProspect', { id: 'ap1', userId: 'u1', prospectId: 'crm1', industryKey: 'dental', state: 'strategized' });
    seed('acquisitionDecisionMaker', { id: 'dm1', userId: 'u1', acqProspectId: 'ap1', kind: 'business_phone', phone: '2348011111111' });
    const res = await contacts.eraseContacts({ userId: 'u1', acqProspectId: 'ap1', reason: 'erasure', actor: 'admin' });
    expect(res).toMatchObject({ erased: 1, crmRecordNotModified: true });
    expect(rows('prospect')[0].businessData).toEqual({ phone: '0801 111 1111' });
  });
});

// ─── P0-2 cleanup wiring ────────────────────────────────────────────────────
describe('P0-2 expired-preview cleanup', () => {
  const expire = (id: string) => { rows('acquisitionImportBatch').find((b) => b.id === id)!.expiresAt = new Date(Date.now() - 1000); };
  const CSV = 'business_name,source,contact_name,contact_email,lawful_basis\nA Clinic,fixture,Dr Ada,ada@a-clinic.ng,legitimate_interest_b2b';

  it('runMaintenance() clears expired previews and expired cached pages', async () => {
    const p = await previewImport({ userId: 'u1', industryKey: 'dental', kind: 'csv', csvText: CSV });
    expire(p.batchId);
    seed('acquisitionPageCache', { userId: 'u1', domain: 'x.ng', url: 'https://x.ng/', urlHash: 'h', status: 'ok', html: '<p>x</p>', expiresAt: new Date(Date.now() - 1) });
    const r = await maintenance.runMaintenance({ force: true });
    expect(r).toMatchObject({ importsExpired: 1, pagesPurged: 1 });
    expect(JSON.stringify(rows('acquisitionImportBatch'))).not.toContain('ada@a-clinic.ng');
    expect(rows('acquisitionPageCache')).toHaveLength(0);
  });

  it('a queue run performs the cleanup', async () => {
    const p = await previewImport({ userId: 'u1', industryKey: 'dental', kind: 'csv', csvText: CSV });
    expire(p.batchId);
    await drainAcqTasks({ budget: 1 });
    expect(JSON.stringify(rows('acquisitionImportBatch'))).not.toContain('ada@a-clinic.ng');
  });

  it('any authorised acquisition API request performs the cleanup', async () => {
    const p = await previewImport({ userId: 'u1', industryKey: 'dental', kind: 'csv', csvText: CSV });
    expire(p.batchId);
    auth.getServerSession.mockResolvedValue(ADMIN);
    seed('user', { id: 'u1', isSuspended: false });
    const { GET } = await import('@/app/api/acquisition/runs/route');
    expect((await GET()).status).toBe(200);
    expect(JSON.stringify(rows('acquisitionImportBatch'))).not.toContain('ada@a-clinic.ng');
  });
});

// ─── P0-3 keyed suppression hashes ──────────────────────────────────────────
describe('P0-3 keyed suppression hashes', () => {
  const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

  it('stores a keyed HMAC, not a plain SHA-256 that could be reversed by enumeration', async () => {
    await suppression.addSuppression({ userId: 'u1', kind: 'phone', value: '0803 123 4567', reason: 'opt_out', source: 't' });
    const h = rows('acquisitionSuppression')[0].valueHash as string;
    expect(h.startsWith('hmac:k1:')).toBe(true);
    expect(h).not.toContain(sha('phone:2348031234567'));
    expect(await suppression.findSuppressionHits('u1', { phone: '08031234567' })).toHaveLength(1);
  });

  it('fails closed without a key: no write, and the acquisition API refuses to run', async () => {
    seed('user', { id: 'u1', isSuspended: false });
    delete process.env.IA_SUPPRESSION_KEY;
    await expect(suppression.addSuppression({ userId: 'u1', kind: 'email', value: 'a@b.ng', reason: 'opt_out', source: 't' })).rejects.toThrow(/IA_SUPPRESSION_KEY/);
    auth.getServerSession.mockResolvedValue(ADMIN);
    const { GET } = await import('@/app/api/acquisition/status/route');
    expect((await GET()).status).toBe(503);
  });

  it('rejects a weak key', async () => {
    process.env.IA_SUPPRESSION_KEY = 'short';
    await expect(suppression.addSuppression({ userId: 'u1', kind: 'email', value: 'a@b.ng', reason: 'opt_out', source: 't' })).rejects.toThrow(/at least 32/);
  });

  it('rotation: entries under a previous key still match; new writes use the current key', async () => {
    await suppression.addSuppression({ userId: 'u1', kind: 'email', value: 'old@clinic.ng', reason: 'opt_out', source: 't' });
    process.env.IA_SUPPRESSION_KEYS_PREVIOUS = `k1:${TEST_KEY}`;
    process.env.IA_SUPPRESSION_KEY = ['p0', 'rotated', 'fixture', 'fedcba9876543210fedcba9876543210'].join('_');
    process.env.IA_SUPPRESSION_KEY_ID = 'k2';
    expect(await suppression.findSuppressionHits('u1', { email: 'old@clinic.ng' })).toHaveLength(1);
    await suppression.addSuppression({ userId: 'u1', kind: 'email', value: 'new@clinic.ng', reason: 'opt_out', source: 't' });
    expect((rows('acquisitionSuppression').at(-1)!.valueHash as string).startsWith('hmac:k2:')).toBe(true);
    // Re-adding a value already suppressed under the old key creates no duplicate.
    await suppression.addSuppression({ userId: 'u1', kind: 'email', value: 'old@clinic.ng', reason: 'erasure', source: 't' });
    expect(rows('acquisitionSuppression')).toHaveLength(2);
  });

  it('legacy unsalted rows match only when explicitly enabled, and are upgraded on match', async () => {
    seed('acquisitionSuppression', { userId: 'u1', kind: 'email', value: null, valueHash: sha('email:legacy@clinic.ng'), reason: 'erasure', source: 'legacy' });
    expect(await suppression.findSuppressionHits('u1', { email: 'legacy@clinic.ng' })).toHaveLength(0);
    process.env.IA_SUPPRESSION_LEGACY_MATCH = 'true';
    expect(await suppression.findSuppressionHits('u1', { email: 'legacy@clinic.ng' })).toHaveLength(1);
    expect((rows('acquisitionSuppression')[0].valueHash as string).startsWith('hmac:k1:')).toBe(true);
  });
});

// ─── P0-4 URL, redirect and credential hardening ────────────────────────────
describe('P0-4 URL / redirect / credential hardening', () => {
  it.each([
    'http://93.184.216.34', 'http://2130706433/', 'http://0x7f.1/', 'http://[::1]/', 'http://[2001:4860::8888]/',
    'http://localhost/', 'http://intranet/', 'https://clinic.local/', 'https://clinic.internal/', 'https://clinic.test/',
  ])('rejects %s as a clinic site', (u) => expect(() => url.normalizeSiteUrl(u)).toThrow());

  it('accepts ordinary clinic hosts, including platform subdomains', () => {
    for (const u of ['smile.ng', 'https://www.smile.com.ng/x', 'https://smile.netlify.app', 'https://xn--smil-fpa.ng']) expect(() => url.normalizeSiteUrl(u)).not.toThrow();
  });

  async function redirectTo(location: string, addresses?: Record<string, string[]>) {
    const { deps, requests } = fakeDeps({ responses: {
      'https://smile.ng/robots.txt': { status: 404 },
      'https://smile.ng/': { status: 302, headers: { location } },
    }, addresses });
    const r = await fetcher.fetchSite({ userId: 'u1', siteUrl: 'smile.ng', maxPages: 1, contactPathHints: [], ttlHours: 24, deps });
    return { status: r.pages[0]?.status, requests };
  }
  it('refuses a redirect carrying credentials', async () => expect((await redirectTo('https://user:pw@smile.ng/x')).status).toBe('invalid_redirect'));
  it('refuses a redirect to a non-standard port', async () => expect((await redirectTo('https://smile.ng:8443/x')).status).toBe('invalid_redirect'));
  it('refuses a redirect to an IP literal without resolving it', async () => {
    const r = await redirectTo('http://93.184.216.34/');
    expect(r.status).toBe('invalid_redirect');
    expect(r.requests.map((x) => x.url)).toEqual(['https://smile.ng/robots.txt', 'https://smile.ng/']);
  });
  it('refuses a redirect to a non-http scheme', async () => expect((await redirectTo('file:///etc/passwd')).status).toBe('invalid_redirect'));

  it('DNS rebinding: one resolution per hop, and the transport gets exactly the checked address', async () => {
    let calls = 0;
    const { deps, requests } = fakeDeps({ responses: { 'https://smile.ng/robots.txt': { status: 404 }, 'https://smile.ng/': { body: '<p>hi</p>' } } });
    const answers = [['93.184.216.34'], ['10.0.0.1'], ['10.0.0.1']];
    deps.resolve = async () => answers[Math.min(calls++, answers.length - 1)];
    await fetcher.fetchSite({ userId: 'u1', siteUrl: 'smile.ng', maxPages: 1, contactPathHints: [], ttlHours: 24, deps });
    expect(requests[0].address).toBe('93.184.216.34');
    expect(requests).toHaveLength(1); // the second hostname resolution (private) was refused before connecting
  });

  it('the live socket lookup is pinned and never consults DNS', async () => {
    const dns = (await import('node:dns')).default;
    const spy = vi.spyOn(dns, 'lookup');
    const lookup = fetcher.pinnedLookup('93.184.216.34');
    const single = await new Promise<unknown[]>((res) => lookup('evil.example', {}, (...a: unknown[]) => res(a)));
    const all = await new Promise<unknown[]>((res) => lookup('evil.example', { all: true }, (...a: unknown[]) => res(a)));
    expect(single).toEqual([null, '93.184.216.34', 4]);
    expect(all).toEqual([null, [{ address: '93.184.216.34', family: 4 }]]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('only identity headers are ever sent — no cookies, authorisation or forwarded credentials', () => {
    expect(Object.keys(fetcher.requestHeaders('RunvaxResearchBot/1.0 (+https://x)')).sort()).toEqual(['Accept', 'Accept-Encoding', 'User-Agent']);
  });
});

// ─── P0-5 Public Suffix List ───────────────────────────────────────────────
describe('P0-5 Public Suffix List (incl. private section)', () => {
  it.each([
    ['www.smile.com.ng', 'smile.com.ng'],
    ['book.smile.ng', 'smile.ng'],
    ['smile.netlify.app', 'smile.netlify.app'],
    ['smile.github.io', 'smile.github.io'],
    ['smile.wordpress.com', 'smile.wordpress.com'],
    ['a.smile.blogspot.com', 'smile.blogspot.com'],
    ['smile.vercel.app', 'smile.vercel.app'],
    ['smile.myshopify.com', 'smile.myshopify.com'],
    ['x.smile.co.uk', 'smile.co.uk'],
    ['smile.ng.', 'smile.ng'],
  ])('%s → %s', (host, expected) => expect(url.registrableDomain(host)).toBe(expected));

  it('two clinics on the same hosting platform are different sites and different organisations', () => {
    expect(url.sameSite(new URL('https://smile.netlify.app'), new URL('https://evil.netlify.app'))).toBe(false);
    const d = (w: string) => identityKeys({ website: w }).find((k) => k.kind === 'domain')?.value;
    expect(d('https://smile.github.io')).not.toBe(d('https://other.github.io'));
  });
});

// ─── P0-6 linear-time scanning ─────────────────────────────────────────────
const FULL = process.env.RUN_FULL_HOSTILE !== '0';
const hostile: Array<[string, (n: number) => string]> = [
  ['unclosed forms', (n) => '<form><input type="text">'.repeat(Math.ceil(n / 26))],
  ['tags without >', (n) => '<a href="x" '.repeat(Math.ceil(n / 12))],
  ['unclosed scripts', (n) => '<script>x'.repeat(Math.ceil(n / 9))],
  ['unclosed comments', (n) => '<!--x'.repeat(Math.ceil(n / 5))],
  ['letter run', (n) => 'a'.repeat(n)],
  ['lt run', (n) => '<'.repeat(n)],
  ['divs without >', (n) => '<div id="r'.repeat(Math.ceil(n / 10))],
  ['email-ish run', (n) => 'a@'.repeat(Math.ceil(n / 2))],
  ['digit run', (n) => '0'.repeat(n)],
];
// These limits use the process's own CPU time, not wall-clock. On a busy machine (parallel test workers, builds,
// sync daemons) wall-clock stretched the heaviest case ("lt run", ~0.3 s normally) past 1 s with no code change,
// which made this test flaky. CPU time does not grow with contention, and the thresholds are unchanged: a
// quadratic scanner used ~10 s of CPU on these inputs (docs/crawler-security-review.md F6), so 250 ms / 1000 ms
// still catch it. Measured linear: doubling the input doubles the time (ratio 1.8 to 2.1 on Node 20, 22 and 24).
function cpuMs(fn: () => void): number {
  const start = process.cpuUsage();
  fn();
  const d = process.cpuUsage(start);
  return (d.user + d.system) / 1000;
}

describe('P0-6 linear-time page scanning', () => {
  it('a page cut short by the tag limit never yields "absent" claims (they become unknown)', () => {
    const html = '<html><body>' + '<span>x</span>'.repeat(12_000) + '<a href="https://calendly.com/x">Book</a></body></html>';
    const ex = extract.extractSite([{ url: 'https://x.ng/', html }], dental);
    const booking = ex.signals.find((x) => x.code === 'online_booking_present')!;
    expect(booking).toMatchObject({ basis: 'unknown', value: null });
  });
  it.each(hostile)('%s (200 KB) under 250 ms', (_n, gen) => {
    const html = `<html><body>${gen(200_000)}</body></html>`;
    expect(cpuMs(() => extract.extractSite([{ url: 'https://x.ng/', html }], dental))).toBeLessThan(250);
  });
  it.runIf(FULL).each(hostile)('%s (1.5 MB) under 1000 ms', (_n, gen) => {
    const html = `<html><body>${gen(1_500_000)}</body></html>`;
    expect(cpuMs(() => extract.extractSite([{ url: 'https://x.ng/', html }], dental))).toBeLessThan(1000);
  });
});

// ─── P0-7 crawl-delay and total time ────────────────────────────────────────
describe('P0-7 crawl-delay and total-time limits', () => {
  it('a Crawl-delay over 10 s means home page only — never a long sleep', async () => {
    const { deps, sleeps, requests } = fakeDeps({ responses: {
      'https://slow.ng/robots.txt': { status: 200, headers: { 'content-type': 'text/plain' }, body: 'User-agent: *\nCrawl-delay: 60' },
      'https://slow.ng/': { body: '<a href="/contact">c</a><a href="/about">a</a>' },
    } });
    const r = await fetcher.fetchSite({ userId: 'u1', siteUrl: 'slow.ng', maxPages: 3, contactPathHints: [], ttlHours: 24, deps });
    expect(Math.max(0, ...sleeps)).toBeLessThanOrEqual(10_000);
    expect(requests.map((x) => x.url)).toEqual(['https://slow.ng/robots.txt', 'https://slow.ng/']);
    expect(r.limited).toBe('crawl_delay_exceeds_limit');
  });

  it('total site time, including waits and slow responses, never exceeds 30 s', async () => {
    const { deps } = fakeDeps({ responses: allResponses(), latencyMs: 8_000 });
    const start = deps.now();
    const r = await fetcher.fetchSite({ userId: 'u1', siteUrl: `https://${S2.domain}`, maxPages: 4, contactPathHints: ['/contact', '/book'], ttlHours: 24, deps });
    expect(deps.now() - start).toBeLessThanOrEqual(30_000);
    expect(r.limited).toBe('site_time_budget');
  });
});

// ─── P0-8 suspended admins and request origin ───────────────────────────────
describe('P0-8 suspended admin and request-origin protection', () => {
  it('a suspended admin with a still-valid session is refused (API and pages)', async () => {
    auth.getServerSession.mockResolvedValue(ADMIN);
    seed('user', { id: 'u1', isSuspended: true });
    const { GET } = await import('@/app/api/acquisition/status/route');
    expect((await GET()).status).toBe(403);
    const { acquisitionPageAllowed } = await import('@/lib/acquisition/flag');
    expect(await acquisitionPageAllowed()).toBe(false);
  });

  it('mutations from a foreign or missing origin are refused; same-origin passes', async () => {
    auth.getServerSession.mockResolvedValue(ADMIN);
    seed('user', { id: 'u1', isSuspended: false });
    const { POST } = await import('@/app/api/acquisition/tasks/route');
    expect((await POST(post('/api/acquisition/tasks', {}, { origin: 'https://evil.example' }))).status).toBe(403);
    expect((await POST(post('/api/acquisition/tasks', {}, {}))).status).toBe(403);
    expect((await POST(post('/api/acquisition/tasks', {}, { 'sec-fetch-site': 'cross-site' }))).status).toBe(403);
    expect((await POST(post('/api/acquisition/tasks', {}))).status).toBe(200);
    expect((await POST(post('/api/acquisition/tasks', {}, { 'sec-fetch-site': 'same-origin' }))).status).toBe(200);
  });
});

// ─── P0-9 no assumed crawler-policy URL ─────────────────────────────────────
describe('P0-9 no nonexistent crawler-policy URL in test assumptions', () => {
  it('no test or fixture assumes harzotech.com/crawler-policy exists', () => {
    const root = path.resolve(__dirname, '..');
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
    const self = path.resolve(__filename);
    for (const f of walk(root).filter((f) => f !== self && /\.(ts|tsx)$/.test(f))) {
      expect(fs.readFileSync(f, 'utf8'), f).not.toMatch(/harzotech\.com\/crawler-policy/);
    }
  });

  it('the crawler identity requires a host under a real public suffix (no special-use names)', () => {
    process.env.IA_CRAWLER_ENABLED = 'true';
    for (const bad of ['https://policy.test/x', 'https://intranet/x', 'https://policy.local/x', 'https://policy.internal/x', 'https://policy.example/x']) {
      process.env.IA_CRAWLER_POLICY_URL = bad;
      expect(fetcher.crawlerIdentity().ok, bad).toBe(false);
    }
  });
});

// ─── Invariants preserved through P0 ────────────────────────────────────────
describe('P0 invariants: evidence model and scoring unchanged', () => {
  it('synthetic clinics score exactly as in the Phase 2 synthetic run (docs/phase-2-synthetic-run.md)', async () => {
    const { S1, S3, S15 } = await import('../fixtures/sites');
    const { deps } = fakeDeps({ responses: allResponses() });
    __setResearchDeps({ fetchDeps: deps });
    const list = [['Pearl Smile Dental', `https://${S1.domain}`, 'Lekki'], ['Coral Teeth Clinic', `https://${S2.domain}`, 'Ikeja GRA'], ['Glow Dental', `https://${S3.domain}`, 'Lekki'], ['Bluecrest Dental', `https://${S15.domain}`, 'Victoria Island'], ['Ivory Dental (no website)', '', 'Surulere']];
    const csv = ['business_name,source,website,area,city', ...list.map(([n, w, a]) => `"${n}",Synthetic fixture list,${w},${a},Lagos`)].join('\n');
    const p = await previewImport({ userId: 'u1', industryKey: 'dental', kind: 'csv', csvText: csv });
    await commitImport({ userId: 'u1', batchId: p.batchId, attestedBy: 'a', attest: true });
    await drainAll();
    const totals = Object.fromEntries(rows('acquisitionProspect').map((a) => [
      rows('prospect').find((x) => x.id === a.prospectId)!.businessName,
      `${rows('acquisitionScore').find((s) => s.acqProspectId === a.id)!.total}/${rows('acquisitionScore').find((s) => s.acqProspectId === a.id)!.band}`,
    ]));
    expect(totals).toEqual({
      'Pearl Smile Dental': '12/low', 'Coral Teeth Clinic': '44/medium', 'Glow Dental': '1/insufficient_evidence',
      'Bluecrest Dental': '41/medium', 'Ivory Dental (no website)': '4/insufficient_evidence',
    });
    expect(new Set(rows('acquisitionSignal').map((s) => s.basis))).toEqual(new Set(['observed', 'inferred', 'unknown']));
  });

  it('cross-origin DELETE is refused', async () => {
    auth.getServerSession.mockResolvedValue(ADMIN);
    seed('user', { id: 'u1', isSuspended: false });
    const { DELETE } = await import('@/app/api/acquisition/contacts/[id]/route');
    const r = await DELETE(new NextRequest(`${ORIGIN}/api/acquisition/contacts/x`, { method: 'DELETE', headers: { origin: 'https://evil.example' } }), { params: { id: 'x' } });
    expect(r.status).toBe(403);
  });

  it('key material never appears in errors or stored rows', async () => {
    process.env.IA_SUPPRESSION_KEYS_PREVIOUS = 'k0:short';
    let msg = '';
    try { suppression.assertSuppressionKey(); } catch (e) { msg = String((e as Error).message); }
    expect(msg).toMatch(/at least 32/);
    expect(msg).not.toContain('short');
    delete process.env.IA_SUPPRESSION_KEYS_PREVIOUS;
    await suppression.addSuppression({ userId: 'u1', kind: 'email', value: 'x@clinic.ng', reason: 'opt_out', source: 't' });
    expect(JSON.stringify(rows('acquisitionSuppression'))).not.toContain(TEST_KEY);
  });

  it('legacy upgrade does not create a duplicate when the current-key row already exists', async () => {
    const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
    await suppression.addSuppression({ userId: 'u1', kind: 'email', value: 'dup@clinic.ng', reason: 'opt_out', source: 't' });
    seed('acquisitionSuppression', { userId: 'u1', kind: 'email', value: null, valueHash: sha('email:dup@clinic.ng'), reason: 'erasure', source: 'legacy' });
    process.env.IA_SUPPRESSION_LEGACY_MATCH = 'true';
    expect((await suppression.findSuppressionHits('u1', { email: 'dup@clinic.ng' })).length).toBeGreaterThan(0);
    expect(rows('acquisitionSuppression').filter((r) => r.valueHash === sha('email:dup@clinic.ng'))).toHaveLength(0);
    expect(rows('acquisitionSuppression').filter((r) => r.kind === 'email')).toHaveLength(1);
  });
});
