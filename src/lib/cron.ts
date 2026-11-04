import { NextRequest } from 'next/server';

/**
 * True when the request carries the Vercel Cron bearer secret. If CRON_SECRET is not configured
 * nothing is authorised (comparing against "Bearer undefined" would let anyone in).
 */
export function guardCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const authHeader = req.headers.get('authorization');
  return authHeader === `Bearer ${secret}`;
}
