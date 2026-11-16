/**
 * Database connection tuning. Kept free of any Prisma import so it can be tested exactly.
 *
 * Why: the production database is a shared host with a small connection limit. Each server instance used to hold up to 5 connections, and
 * a deploy starts fresh instances while the old ones still hold theirs, so for a few minutes the host refused connections
 * ("Can't reach database server") on unrelated routes. A smaller pool per instance, and a retry for errors that mean the query never ran,
 * make that survivable.
 */

/** Only on Vercel: a smaller pool, and more patience for a free connection. Local dev and tests keep whatever their URL says. */
export function tunedDatabaseUrl(url: string | undefined, env: Record<string, string | undefined> = process.env): string | undefined {
  if (!url || !env.VERCEL) return url;
  const want = Math.max(1, Number(env.PRISMA_CONNECTION_LIMIT ?? 2) || 2);
  const [base, query = ''] = url.split('?');                      // only the query string is touched, never the credentials
  const p = new URLSearchParams(query);
  const current = Number(p.get('connection_limit'));
  p.set('connection_limit', String(Number.isFinite(current) && current > 0 ? Math.min(current, want) : want));
  if (!p.has('pool_timeout')) p.set('pool_timeout', '20');
  return `${base}?${p.toString()}`;
}

const NEVER_RAN = new Set(['P1001', 'P1002', 'P2024']);          // can't reach the server, timed out reaching it, timed out waiting for a free connection
const READ_ONLY_RETRY = new Set(['P1008', 'P1017']);             // connection dropped: safe to repeat only for reads
const READS = new Set(['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy', 'queryRaw']);

/** Is this error one where the statement certainly did not run (or is a read, so running it twice is harmless)? */
export function isRetryable(e: unknown, operation: string): boolean {
  const code = (e as { code?: string } | null)?.code;
  const name = (e as { name?: string } | null)?.name;
  if (code && NEVER_RAN.has(code)) return true;
  if (name === 'PrismaClientInitializationError' && !code) return true;   // "Can't reach database server" before any query was sent
  if (code && READ_ONLY_RETRY.has(code)) return READS.has(operation);
  return false;
}

/** Runs `run`, retrying (at most twice, with a short random pause) when the error is one that is safe to repeat. */
export async function withRetry<T>(run: () => Promise<T>, operation: string, opts: { retries?: number; sleep?: (ms: number) => Promise<void>; random?: () => number } = {}): Promise<T> {
  const retries = opts.retries ?? 2; const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))); const random = opts.random ?? Math.random;
  for (let attempt = 0; ; attempt++) {
    try { return await run(); }
    catch (e) {
      if (attempt >= retries || !isRetryable(e, operation)) throw e;
      await sleep(250 * (attempt + 1) + Math.floor(random() * 250));
    }
  }
}
