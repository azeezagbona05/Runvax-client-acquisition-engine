import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { domainContacts, findEmail, findEmails, resetSnovToken, setSnovGap, snovEnabled, splitName, verifyEmail, verifyEmails } from '@/lib/snov';

type Reply = { ok?: boolean; status?: number; body: unknown };
const json = (r: Reply) => ({ ok: r.ok ?? true, status: r.status ?? 200, json: async () => r.body }) as unknown as Response;

/** Routes a fake Snov.io by URL; later replies for the same URL are used in order. */
function fakeSnov(routes: Record<string, Reply[]>) {
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body as string | undefined });
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) return json({ ok: false, status: 404, body: {} });
    const queue = routes[key];
    return json(queue.length > 1 ? queue.shift()! : queue[0]);
  });
  vi.stubGlobal('fetch', fn);
  return calls;
}

const TOKEN: Reply = { body: { access_token: 'tok', expires_in: 3600 } };
const FAST = { pollMs: 0 };

beforeEach(() => { setSnovGap(0); resetSnovToken(); process.env.SNOV_CLIENT_ID = 'id'; process.env.SNOV_CLIENT_SECRET = 'secret'; });
afterEach(() => { vi.unstubAllGlobals(); delete process.env.SNOV_CLIENT_ID; delete process.env.SNOV_CLIENT_SECRET; });

describe('snovEnabled', () => {
  it('needs both the id and the secret', () => {
    expect(snovEnabled()).toBe(true);
    delete process.env.SNOV_CLIENT_SECRET;
    expect(snovEnabled()).toBe(false);
    process.env.SNOV_CLIENT_SECRET = '   ';
    expect(snovEnabled()).toBe(false);
  });
});

describe('splitName', () => {
  it('drops honorifics and needs two names', () => {
    expect(splitName('Dr. Ada Okafor')).toEqual(['Ada', 'Okafor']);
    expect(splitName('Ada Bola Okafor')).toEqual(['Ada', 'Okafor']);
    expect(splitName('Madonna')).toBeNull();
  });
});

describe('findEmail', () => {
  it('signs in once, starts the task, polls until completed, and returns a valid address', async () => {
    const calls = fakeSnov({
      '/v1/oauth/access_token': [TOKEN],
      '/emails-by-domain-by-name/start': [{ body: { data: { task_hash: 'h1' } } }],
      '/emails-by-domain-by-name/result': [
        { body: { status: 'in_progress' } },
        { body: { status: 'completed', data: [{ people: 'Ada Okafor', result: [{ email: 'Ada@Clinic.com', smtp_status: 'valid' }] }] } },
      ],
    });
    const out = await findEmail('clinic.com', 'Dr. Ada Okafor', FAST);
    expect(out).toMatchObject({ email: 'ada@clinic.com', smtpStatus: 'valid' });
    expect(calls.filter((c) => c.url.includes('access_token'))).toHaveLength(1);
    const start = calls.find((c) => c.url.includes('/start'))!;
    expect(JSON.parse(start.body!)).toEqual({ rows: [{ first_name: 'Ada', last_name: 'Okafor', domain: 'clinic.com' }] });
    expect(calls.filter((c) => c.url.includes('/result'))).toHaveLength(2);
  });

  it('treats a not_valid address as not found, but keeps an unknown one', async () => {
    fakeSnov({
      '/v1/oauth/access_token': [TOKEN],
      '/emails-by-domain-by-name/start': [{ body: { data: { task_hash: 'h' } } }],
      '/emails-by-domain-by-name/result': [{ body: { status: 'completed', data: [{ result: [{ email: 'a@x.com', smtp_status: 'not_valid' }, { email: 'b@x.com', smtp_status: 'unknown', unknown_status_reason: 'catchall' }] }] } }],
    });
    expect(await findEmail('x.com', 'Ada Okafor', FAST)).toMatchObject({ email: 'b@x.com', smtpStatus: 'unknown', reason: 'catchall' });
  });

  it('returns null for a single name without calling Snov at all', async () => {
    const calls = fakeSnov({});
    expect(await findEmail('x.com', 'Madonna', FAST)).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('gives up after the allowed polls', async () => {
    fakeSnov({
      '/v1/oauth/access_token': [TOKEN],
      '/emails-by-domain-by-name/start': [{ body: { data: { task_hash: 'h' } } }],
      '/emails-by-domain-by-name/result': [{ body: { status: 'in_progress' } }],
    });
    expect(await findEmail('x.com', 'Ada Okafor', { pollMs: 0, tries: 3 })).toBeNull();
  });

  it('says so when the account is out of credits', async () => {
    fakeSnov({
      '/v1/oauth/access_token': [TOKEN],
      '/emails-by-domain-by-name/start': [{ body: { data: { task_hash: 'h' } } }],
      '/emails-by-domain-by-name/result': [{ body: { status: 'not_enough_credits' } }],
    });
    await expect(findEmail('x.com', 'Ada Okafor', FAST)).rejects.toThrow(/credits/i);
  });

  it('refreshes the token once on a 401, then succeeds', async () => {
    const calls = fakeSnov({
      '/v1/oauth/access_token': [TOKEN],
      '/emails-by-domain-by-name/start': [{ ok: false, status: 401, body: {} }, { body: { data: { task_hash: 'h' } } }],
      '/emails-by-domain-by-name/result': [{ body: { status: 'completed', data: [{ result: [{ email: 'a@x.com', smtp_status: 'valid' }] }] } }],
    });
    expect((await findEmail('x.com', 'Ada Okafor', FAST))?.email).toBe('a@x.com');
    expect(calls.filter((c) => c.url.includes('access_token'))).toHaveLength(2);
  });

  it('explains bad credentials instead of a bare status code', async () => {
    fakeSnov({ '/v1/oauth/access_token': [{ ok: false, status: 400, body: {} }] });
    await expect(findEmail('x.com', 'Ada Okafor', FAST)).rejects.toThrow(/SNOV_CLIENT_ID/);
  });
});

describe('verifyEmail', () => {
  it('returns the verdict for one address', async () => {
    fakeSnov({
      '/v1/oauth/access_token': [TOKEN],
      '/email-verification/start': [{ body: { data: { task_hash: 'v1' } } }],
      '/email-verification/result': [{ body: { status: 'completed', data: [{ email: 'a@x.com', result: { smtp_status: 'not_valid', is_disposable: true } }] } }],
    });
    expect(await verifyEmail('a@x.com', FAST)).toMatchObject({ email: 'a@x.com', smtpStatus: 'not_valid', disposable: true });
  });
});

describe('verifyEmails (bulk)', () => {
  it('sends 10 per request, de-duplicates, and maps every answer', async () => {
    const emails = Array.from({ length: 12 }, (_, i) => `p${i}@clinic.com`);
    const calls = fakeSnov({
      '/v1/oauth/access_token': [TOKEN],
      '/email-verification/start': [{ body: { data: { task_hash: 'a' } } }, { body: { data: { task_hash: 'b' } } }],
      '/email-verification/result?task_hash=a': [{ body: { status: 'completed', data: emails.slice(0, 10).map((email) => ({ email, result: { smtp_status: email === 'p3@clinic.com' ? 'not_valid' : 'valid' } })) } }],
      '/email-verification/result?task_hash=b': [{ body: { status: 'completed', data: emails.slice(10).map((email) => ({ email, result: { smtp_status: 'unknown', unknown_status_reason: 'catchall' } })) } }],
    });
    const seen: number[] = [];
    const out = await verifyEmails([...emails, 'P0@clinic.com'], { ...FAST, onProgress: (d) => seen.push(d) });
    const starts = calls.filter((c) => c.url.endsWith('/email-verification/start'));
    expect(starts).toHaveLength(2);
    expect(JSON.parse(starts[0].body!).emails).toHaveLength(10);
    expect(JSON.parse(starts[1].body!).emails).toHaveLength(2);
    expect(out.size).toBe(12);
    expect(out.get('p3@clinic.com')?.smtpStatus).toBe('not_valid');
    expect(out.get('p11@clinic.com')).toMatchObject({ smtpStatus: 'unknown', reason: 'catchall' });
    expect(seen).toEqual([10, 12]);
  });

  it('keeps what it has and stops when credits run out', async () => {
    fakeSnov({
      '/v1/oauth/access_token': [TOKEN],
      '/email-verification/start': [{ body: { data: { task_hash: 'a' } } }, { body: { data: { task_hash: 'b' } } }],
      '/email-verification/result?task_hash=a': [{ body: { status: 'completed', data: [{ email: 'a@x.com', result: { smtp_status: 'valid' } }] } }],
      '/email-verification/result?task_hash=b': [{ body: { status: 'not_enough_credits' } }],
    });
    const emails = Array.from({ length: 11 }, (_, i) => `u${i}@x.com`);
    emails[0] = 'a@x.com';
    const out = await verifyEmails(emails, FAST);
    expect(out.get('a@x.com')?.smtpStatus).toBe('valid');
    expect(out.size).toBe(1);
  });
});

describe('findEmails (bulk)', () => {
  it('looks up several people in one request and keys results by domain and name', async () => {
    const calls = fakeSnov({
      '/v1/oauth/access_token': [TOKEN],
      '/emails-by-domain-by-name/start': [{ body: { data: { task_hash: 'h' } } }],
      '/emails-by-domain-by-name/result': [{ body: { status: 'completed', data: [
        { result: [{ email: 'ada@a.com', smtp_status: 'valid' }] }, { result: [] }, { result: [{ email: 'bo@c.com', smtp_status: 'unknown' }] },
      ] } }],
    });
    const out = await findEmails([
      { domain: 'a.com', fullName: 'Ada Okafor' }, { domain: 'b.com', fullName: 'Bo Lee' }, { domain: 'c.com', fullName: 'Bo Chen' }, { domain: 'd.com', fullName: 'Madonna' },
    ], FAST);
    expect(JSON.parse(calls.find((c) => c.url.endsWith('/start'))!.body!).rows).toHaveLength(3);
    expect(out.get('a.com|ada okafor')?.email).toBe('ada@a.com');
    expect(out.has('b.com|bo lee')).toBe(false);
    expect(out.get('c.com|bo chen')?.smtpStatus).toBe('unknown');
  });
});

describe('domainContacts (website only)', () => {
  it('lists people at the domain, then looks up each one email, up to the cap', async () => {
    const calls = fakeSnov({
      '/v1/oauth/access_token': [TOKEN],
      '/domain-search/prospects/start': [{ body: { meta: { task_hash: 'p1' } } }],
      '/domain-search/prospects/result/p1': [{ body: { status: 'completed', data: [
        { first_name: 'Ada', last_name: 'Okafor', position: 'Owner', source_page: 'https://x.com/team', search_emails_start: 'https://api.snov.io/v2/domain-search/prospects/search-emails/start/H1' },
        { first_name: 'Bo', last_name: 'Lee', position: 'Practice Manager', search_emails_start: 'https://api.snov.io/v2/domain-search/prospects/search-emails/start/H2' },
        { first_name: 'Cy', last_name: 'Ng', position: 'Dentist', search_emails_start: 'https://api.snov.io/v2/domain-search/prospects/search-emails/start/H3' },
      ] } }],
      '/search-emails/start/H1': [{ body: { meta: { task_hash: 'e1' } } }],
      '/search-emails/start/H2': [{ body: { meta: { task_hash: 'e2' } } }],
      '/search-emails/result/e1': [{ body: { status: 'completed', data: { emails: [{ email: 'ada@x.com', smtp_status: 'valid' }] } } }],
      '/search-emails/result/e2': [{ body: { status: 'completed', data: { emails: [] } } }],
    });
    const out = await domainContacts('x.com', { ...FAST, positions: ['Owner', 'Manager'], max: 2 });
    expect(out).toEqual([
      { name: 'Ada Okafor', position: 'Owner', sourcePage: 'https://x.com/team', email: 'ada@x.com', smtpStatus: 'valid' },
      { name: 'Bo Lee', position: 'Practice Manager', sourcePage: undefined },
    ]);
    expect(calls.some((c) => c.url.includes('/H3'))).toBe(false);
    expect(JSON.parse(calls.find((c) => c.url.endsWith('/prospects/start'))!.body!)).toMatchObject({ domain: 'x.com', positions: ['Owner', 'Manager'] });
  });

  it('never follows a lookup link that points off Snov', async () => {
    const calls = fakeSnov({
      '/v1/oauth/access_token': [TOKEN],
      '/domain-search/prospects/start': [{ body: { meta: { task_hash: 'p1' } } }],
      '/domain-search/prospects/result/p1': [{ body: { status: 'completed', data: [{ first_name: 'Ada', last_name: 'Okafor', position: 'Owner', search_emails_start: 'https://evil.test/steal' }] } }],
    });
    const out = await domainContacts('x.com', FAST);
    expect(out).toHaveLength(1);
    expect(out[0].email).toBeUndefined();
    expect(calls.some((c) => c.url.includes('evil.test'))).toBe(false);
  });
});
