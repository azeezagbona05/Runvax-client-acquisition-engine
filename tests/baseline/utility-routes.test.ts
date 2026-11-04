/**
 * Utility routes that cost money or contact third parties: signed-in only, SSRF-safe, injection-safe.
 * Nothing real is contacted: fetch, DNS, TCP and the AI provider are all stubbed and asserted untouched.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import dns from 'node:dns';
import net from 'node:net';
import { NextRequest } from 'next/server';

const auth = vi.hoisted(() => ({ getToken: vi.fn(), getServerSession: vi.fn() }));
vi.mock('next-auth/jwt', () => ({ getToken: auth.getToken }));
vi.mock('next-auth', () => ({ getServerSession: auth.getServerSession }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
const ai = vi.hoisted(() => ({ generate: vi.fn(async () => ({ text: 'x' })) }));
vi.mock('@/lib/ai', () => ({ generate: ai.generate }));

import { POST as scrapeMeta } from '@/app/api/scrape-meta/route';
import { POST as verifyEmail } from '@/app/api/verify-email/route';
import { POST as enrichEmail } from '@/app/api/enrich-email/route';
import { GET as details } from '@/app/api/details/route';
import { GET as testCse } from '@/app/api/test-cse/route';
import { GET as probe } from '@/app/api/humanize-probe/route';
import { safeFetch, assertPublicHttpUrl } from '@/lib/safeFetch';
import { rateLimit } from '@/lib/rateLimiter';

const fetchMock = vi.fn();
const lookup = vi.fn();
let n = 0;
beforeEach(() => {
  n++;
  auth.getToken.mockReset().mockResolvedValue({ id: `u${n}`, sub: `u${n}`, emailVerified: new Date() }); // a fresh user each test: rate limits are per user
  auth.getServerSession.mockReset().mockResolvedValue({ user: { id: 'u1', email: 'admin@example.test' } });
  fetchMock.mockReset().mockResolvedValue(new Response('<title>Ok Clinic</title>', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  lookup.mockReset().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  vi.spyOn(dns.promises, 'lookup').mockImplementation(lookup as never);
  ai.generate.mockClear();
});

const post = (url: string, body: unknown) => new NextRequest(`http://localhost${url}`, { method: 'POST', body: JSON.stringify(body) });
const get = (url: string) => new NextRequest(`http://localhost${url}`);

describe('signed-out callers are refused before anything is spent or contacted', () => {
  beforeEach(() => { auth.getToken.mockResolvedValue(null); auth.getServerSession.mockResolvedValue(null); });
  it.each([
    ['scrape-meta', () => scrapeMeta(post('/api/scrape-meta', { url: 'https://clinic.example' }))],
    ['verify-email', () => verifyEmail(post('/api/verify-email', { email: 'a@clinic.example' }))],
    ['enrich-email', () => enrichEmail(post('/api/enrich-email', { website: 'https://clinic.example', name: 'X' }))],
    ['details', () => details(get('/api/details?id=ChIJabc'))],
    ['test-cse', () => testCse(get('/api/test-cse?key=k&cx=c'))],
    ['humanize-probe', () => probe(get('/api/humanize-probe'))],
  ])('%s → 401', async (_n, call) => {
    expect((await call()).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(lookup).not.toHaveBeenCalled();
    expect(ai.generate).not.toHaveBeenCalled();
  });

  it('the two operator diagnostics are admin-only: a signed-in non-admin gets 403', async () => {
    auth.getServerSession.mockResolvedValue({ user: { id: 'u9', email: 'someone@example.test' } });
    expect((await testCse(get('/api/test-cse'))).status).toBe(403);
    expect((await probe(get('/api/humanize-probe'))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled(); expect(ai.generate).not.toHaveBeenCalled();
  });
});

describe('SSRF: a request cannot make the server read internal addresses', () => {
  it.each(['http://127.0.0.1/', 'http://localhost/', 'http://169.254.169.254/latest/meta-data/', 'http://10.0.0.5/', 'http://[::1]/', 'http://[::ffff:127.0.0.1]/', 'file:///etc/passwd', 'ftp://clinic.example/', 'http://u:p@clinic.example/', 'https://clinic.example:8443/'])('scrape-meta refuses %s', async (url) => {
    lookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]); // names like "localhost" resolve to loopback
    const res = await scrapeMeta(post('/api/scrape-meta', { url }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a public-looking name that resolves to a private address is refused (DNS check)', async () => {
    lookup.mockResolvedValue([{ address: '192.168.1.10', family: 4 }]);
    expect((await scrapeMeta(post('/api/scrape-meta', { url: 'https://innocent.example' }))).status).toBe(400);
    lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }, { address: '10.1.1.1', family: 4 }]); // one bad answer is enough
    expect((await scrapeMeta(post('/api/scrape-meta', { url: 'https://mixed.example' }))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a redirect to an internal address is refused at the hop, not followed', async () => {
    lookup.mockImplementation(async (h: string) => (h === 'evil.example' ? [{ address: '127.0.0.1', family: 4 }] : [{ address: '93.184.216.34', family: 4 }]));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'http://evil.example/admin' } }));
    const res = await scrapeMeta(post('/api/scrape-meta', { url: 'https://clinic.example' }));
    expect(res.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1); // only the first, public hop
  });

  it('redirect loops are bounded', async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 302, headers: { location: 'https://clinic.example/again' } }));
    await expect(safeFetch('https://clinic.example/')).rejects.toThrow(/redirects/);
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it('ordinary public sites still work (title is returned) and https redirects are followed', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: 'https://www.clinic.example/' } }))
      .mockResolvedValueOnce(new Response('<title>Smile Dental</title><meta name="description" content="Dentist in Lagos">', { status: 200 }));
    const res = await scrapeMeta(post('/api/scrape-meta', { url: 'clinic.example' }));
    expect(res.status).toBe(200);
    expect((await res.json()).title).toBe('Smile Dental');
  });

  it('assertPublicHttpUrl accepts a normal public URL and rejects an unresolvable host', async () => {
    await expect(assertPublicHttpUrl('https://clinic.example/x')).resolves.toBeInstanceOf(URL);
    lookup.mockResolvedValue([]);
    await expect(assertPublicHttpUrl('https://nowhere.example')).rejects.toThrow();
    lookup.mockRejectedValue(Object.assign(new Error('getaddrinfo ENOTFOUND nowhere.example'), { code: 'ENOTFOUND' }));
    expect((await scrapeMeta(post('/api/scrape-meta', { url: 'https://nowhere.example' }))).status).toBe(400); // no resolver detail leaks
  });

  it('enrich-email never fetches an internal website the caller names', async () => {
    lookup.mockResolvedValue([{ address: '169.254.169.254', family: 4 }]);
    const res = await enrichEmail(post('/api/enrich-email', { website: 'http://metadata.internal/', name: '' }));
    expect(res.status).toBe(200); // unchanged contract: no email found
    expect((await res.json()).email).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('verify-email: no SMTP command injection, no internal mail hosts', () => {
  const tcp = () => vi.spyOn(net, 'createConnection').mockImplementation((() => { throw new Error('TCP must not be opened'); }) as never);

  it.each(['a@clinic.example\r\nRCPT TO:<victim@elsewhere.example>', 'a@clinic.example>\r\nQUIT', 'a b@clinic.example', 'a@@clinic.example', '<a@clinic.example>', 'x'.repeat(300) + '@clinic.example'])('rejects %j without any DNS or TCP', async (email) => {
    const spy = tcp(); const mx = vi.spyOn(dns.promises, 'resolveMx');
    const res = await verifyEmail(post('/api/verify-email', { email }));
    expect((await res.json()).result).toBe('invalid');
    expect(spy).not.toHaveBeenCalled(); expect(mx).not.toHaveBeenCalled();
  });

  it('an MX host that resolves to a private address is never connected to', async () => {
    const spy = tcp();
    vi.spyOn(dns.promises, 'resolveMx').mockResolvedValue([{ exchange: 'mail.evil.example', priority: 1 }]);
    lookup.mockResolvedValue([{ address: '10.0.0.7', family: 4 }]);
    const res = await verifyEmail(post('/api/verify-email', { email: 'a@evil.example' }));
    expect((await res.json()).result).toBe('unknown');
    expect(spy).not.toHaveBeenCalled();
  });

  it('a normal address on a public MX still reaches the handshake', async () => {
    const spy = vi.spyOn(net, 'createConnection').mockImplementation((() => { const e = new (require('node:events').EventEmitter)(); (e as { destroy?: () => void }).destroy = () => {}; setTimeout(() => e.emit('error', new Error('refused')), 0); return e; }) as never);
    vi.spyOn(dns.promises, 'resolveMx').mockResolvedValue([{ exchange: 'mx.clinic.example', priority: 1 }]);
    const res = await verifyEmail(post('/api/verify-email', { email: 'reception@clinic.example' }));
    expect((await res.json()).result).toBe('unknown');
    expect(spy).toHaveBeenCalledWith(25, 'mx.clinic.example');
  });
});

describe('details and rate limits', () => {
  it('rejects ids that could alter the upstream path, before any DB or network use', async () => {
    for (const id of ['../../x', 'a/b', 'a b', 'x?y=1', 'a'.repeat(400)]) expect((await details(get(`/api/details?id=${encodeURIComponent(id)}`))).status, id).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('per-user limits answer 429 instead of fanning out', async () => {
    auth.getToken.mockResolvedValue({ id: 'limited', sub: 'limited', emailVerified: new Date() });
    let last = 0;
    for (let i = 0; i < 35; i++) last = (await scrapeMeta(post('/api/scrape-meta', { url: 'https://clinic.example' }))).status;
    expect(last).toBe(429);
    expect(rateLimit('unrelated', { maxRequests: 1, windowMs: 1000 }).ok).toBe(true);
  });
});
