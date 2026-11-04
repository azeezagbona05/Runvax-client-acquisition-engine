import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { requireAdmin } from '@/lib/adminAuth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assertSuppressionKey } from './suppression';
import { runMaintenance } from './maintenance';

/**
 * The Industry Acquisition Engine is off unless the server env says exactly
 * "true". Read on every call (never cached) so turning it off takes effect on
 * the next request after a redeploy.
 */
export function acquisitionEnabled(): boolean {
  return process.env.INDUSTRY_ACQUISITION_ENABLED === 'true';
}

type AccessCheck =
  | { ok: true; userId: string; email: string }
  | { ok: false; response: NextResponse };

const deny = (status: number, error: string): AccessCheck => ({ ok: false, response: NextResponse.json({ error }, { status }) });

/**
 * Mutation requests must come from this app's own pages: an Origin header
 * equal to the request's own origin (or NEXTAUTH_URL's), or — when a browser
 * omits Origin — Sec-Fetch-Site: same-origin. Anything else (another site, a
 * script with no browser headers) is refused. Defence in depth on top of
 * NextAuth's SameSite=Lax session cookie.
 */
export function sameOriginRequest(req: Request): boolean {
  const origin = req.headers.get('origin');
  const allowed = new Set<string>();
  try { allowed.add(new URL(req.url).origin); } catch { /* ignore */ }
  try { if (process.env.NEXTAUTH_URL) allowed.add(new URL(process.env.NEXTAUTH_URL).origin); } catch { /* ignore */ }
  if (origin) return allowed.has(origin);
  return req.headers.get('sec-fetch-site') === 'same-origin';
}

async function activeAccount(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { isSuspended: true } });
  return !!u && !u.isSuspended;
}

/**
 * The single gate every /api/acquisition route calls first:
 *   flag off → 404 (the module's existence isn't revealed)
 *   mutation from another origin → 403
 *   signed out → 401, not an admin → 403 (allowlist re-read per request)
 *   suspended account (even with a still-valid session) → 403
 *   suppression key missing / too weak → 503 (fail closed)
 * Passing requests also run the time-based cleanup (maintenance.ts).
 * Mutation routes MUST pass `req` so the origin check applies.
 */
export async function requireAcquisitionAccess(req?: Request): Promise<AccessCheck> {
  if (!acquisitionEnabled()) return deny(404, 'Not found');
  if (req && !['GET', 'HEAD'].includes(req.method) && !sameOriginRequest(req)) return deny(403, 'Cross-origin request refused');
  const admin = await requireAdmin();
  if (!admin.ok) return admin;
  if (!(await activeAccount(admin.userId))) return deny(403, 'Account suspended or not found');
  try { assertSuppressionKey(); } catch { return deny(503, 'Acquisition is unavailable: the suppression key (IA_SUPPRESSION_KEY) is not configured'); }
  await runMaintenance();
  return admin;
}

/** Server-side check for the /acquisition pages: flag on, admin email, account active. */
export async function acquisitionPageAllowed(): Promise<boolean> {
  if (!acquisitionEnabled()) return false;
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase() ?? '';
  const admins = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!email || !admins.includes(email) || !session?.user?.id) return false;
  return activeAccount(session.user.id);
}
