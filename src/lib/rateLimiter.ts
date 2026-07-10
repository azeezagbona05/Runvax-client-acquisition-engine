/**
 * In-memory rate limiter for auth endpoints.
 * Uses a sliding window per IP address.
 * On Vercel, each serverless invocation gets a fresh process — this is best-effort,
 * not a hard guarantee. For hard rate limiting, upgrade to Redis (Upstash).
 */

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

// Cleanup old entries every 5 minutes to avoid unbounded memory growth
setInterval(() => {
  const now = Date.now();
  store.forEach((win, key) => {
    if (win.resetAt < now) store.delete(key);
  });
}, 5 * 60 * 1000);

/**
 * Check and increment the rate limit for a given key.
 * Returns { ok: true } if within limits, { ok: false, retryAfter: seconds } if exceeded.
 */
export function rateLimit(
  key: string,
  opts: { maxRequests: number; windowMs: number },
): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true };
  }

  existing.count += 1;

  if (existing.count > opts.maxRequests) {
    const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
    return { ok: false, retryAfter };
  }

  return { ok: true };
}

/** Extract best-effort client IP from a Request or NextRequest */
export function getIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}
