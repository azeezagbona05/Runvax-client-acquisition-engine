import { NextRequest } from 'next/server';

/** True when the request carries the Vercel Cron bearer secret. */
export function guardCron(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}
