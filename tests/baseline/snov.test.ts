import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findEmail, resetSnovToken, snovEnabled, splitName, verifyEmail } from '@/lib/snov';

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

beforeEach(() => { resetSnovToken(); process.env.SNOV_CLIENT_ID = 'id'; process.env.SNOV_CLIENT_SECRET = 'secret'; });
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
