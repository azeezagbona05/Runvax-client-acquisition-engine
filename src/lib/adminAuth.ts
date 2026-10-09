import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

type AdminCheck =
  | { ok: true; userId: string; email: string }
  | { ok: false; response: NextResponse };

/**
 * Server-side gate for platform-operations routes (RUNVAX's own SEO/GEO engine,
 * agent orchestration). Signed-out → 401, signed-in non-admin → 403.
 * Never rely on the client hiding a link — call this in the route itself.
 */
export async function requireAdmin(): Promise<AdminCheck> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const email = session.user.email?.toLowerCase() ?? '';
  if (!email || !ADMIN_EMAILS.includes(email)) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true, userId: session.user.id, email };
}
