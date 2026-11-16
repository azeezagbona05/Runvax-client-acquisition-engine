import { describe, it, expect, vi } from 'vitest';
import { isRetryable, tunedDatabaseUrl, withRetry } from '@/lib/prismaTuning';

const URL5 = 'mysql://user:p%40ss@mysql.example.com:3306/appdb?connection_limit=5';
describe('tunedDatabaseUrl', () => {
  it('on Vercel: a smaller pool and more patience, credentials untouched', () => {
    const u = tunedDatabaseUrl(URL5, { VERCEL: '1' })!;
    expect(u.startsWith('mysql://user:p%40ss@mysql.example.com:3306/appdb?')).toBe(true); expect(u).toContain('connection_limit=2'); expect(u).toContain('pool_timeout=20');
  });
  it('never raises a limit that was already lower, and honours the override', () => {
    expect(tunedDatabaseUrl('mysql://u:p@h/db?connection_limit=1', { VERCEL: '1' })).toContain('connection_limit=1');
    expect(tunedDatabaseUrl(URL5, { VERCEL: '1', PRISMA_CONNECTION_LIMIT: '3' })).toContain('connection_limit=3');
    expect(tunedDatabaseUrl('mysql://u:p@h/db', { VERCEL: '1' })).toBe('mysql://u:p@h/db?connection_limit=2&pool_timeout=20');         // no query string at all
  });
  it('off Vercel (local, tests): unchanged', () => { expect(tunedDatabaseUrl(URL5, {})).toBe(URL5); expect(tunedDatabaseUrl(undefined, { VERCEL: '1' })).toBeUndefined(); });
});

const err = (code?: string, name = 'PrismaClientKnownRequestError') => Object.assign(new Error('x'), { code, name });
describe('isRetryable', () => {
  it("'could not connect' and 'no free connection' are retried for every operation (the query never ran)", () => {
    for (const code of ['P1001', 'P1002', 'P2024']) for (const op of ['findMany', 'create', 'update', 'delete', 'createMany']) expect(isRetryable(err(code), op)).toBe(true);
    expect(isRetryable(err(undefined, 'PrismaClientInitializationError'), 'create')).toBe(true);
  });
  it('a dropped connection is retried for reads only (a write might already have happened)', () => {
    expect(isRetryable(err('P1017'), 'findFirst')).toBe(true); expect(isRetryable(err('P1017'), 'count')).toBe(true); expect(isRetryable(err('P1017'), 'update')).toBe(false); expect(isRetryable(err('P1008'), 'create')).toBe(false);
  });
  it('real errors are never retried: a duplicate, a missing row, bad input, anything unknown', () => {
    for (const code of ['P2002', 'P2025', 'P2003', 'P2000']) expect(isRetryable(err(code), 'findMany')).toBe(false); expect(isRetryable(new Error('boom'), 'findMany')).toBe(false); expect(isRetryable(null, 'x')).toBe(false);
  });
});

describe('withRetry', () => {
  const fast = { sleep: async () => undefined, random: () => 0 };
  it('succeeds on a later try after connection errors', async () => {
    const run = vi.fn().mockRejectedValueOnce(err('P1001')).mockRejectedValueOnce(err('P2024')).mockResolvedValue('ok');
    expect(await withRetry(run, 'findMany', fast)).toBe('ok'); expect(run).toHaveBeenCalledTimes(3);
  });
  it('gives up after two retries and throws the real error', async () => {
    const run = vi.fn().mockRejectedValue(err('P1001')); await expect(withRetry(run, 'findMany', fast)).rejects.toMatchObject({ code: 'P1001' }); expect(run).toHaveBeenCalledTimes(3);
  });
  it('does not retry a real error, and never repeats a write that may have happened', async () => {
    const dup = vi.fn().mockRejectedValue(err('P2002')); await expect(withRetry(dup, 'create', fast)).rejects.toMatchObject({ code: 'P2002' }); expect(dup).toHaveBeenCalledTimes(1);
    const dropped = vi.fn().mockRejectedValue(err('P1017')); await expect(withRetry(dropped, 'update', fast)).rejects.toBeTruthy(); expect(dropped).toHaveBeenCalledTimes(1);
  });
  it('waits a short, growing, jittered time between tries', async () => {
    const waits: number[] = []; const run = vi.fn().mockRejectedValueOnce(err('P1001')).mockRejectedValueOnce(err('P1001')).mockResolvedValue(1);
    await withRetry(run, 'findMany', { sleep: async (ms) => { waits.push(ms); }, random: () => 0.5 }); expect(waits).toEqual([375, 625]);
  });
});
