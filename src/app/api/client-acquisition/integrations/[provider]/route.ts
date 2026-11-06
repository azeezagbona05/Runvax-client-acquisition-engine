import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/requireUser';
import { rateLimit } from '@/lib/rateLimiter';
import { gcalStartUrl, gmailStartUrl, runAction, type IntegrationId } from '@/lib/integrations/providers';

export const dynamic = 'force-dynamic';
const IDS: IntegrationId[] = ['wa', 'gmail', 'smtp', 'apollo', 'snov', 'gcal', 'airtable', 'webhooks'];

/** POST { action: connect | test | disconnect | sync | slots | book, ...fields } for one integration. */
export async function POST(req: NextRequest, { params }: { params: { provider: string } }) {
  const user = await requireUser(req);
  if (!user.ok) return user.response;
  const id = params.provider as IntegrationId;
  if (!IDS.includes(id)) return NextResponse.json({ error: 'Unknown integration' }, { status: 404 });
  if (!rateLimit(`integrations:${user.userId}`, { maxRequests: 40, windowMs: 60_000 }).ok) return NextResponse.json({ error: 'Too many requests. Wait a minute.' }, { status: 429 });
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = typeof body.action === 'string' ? body.action : '';

  if (id === 'gcal' && action === 'connect') {
    const url = gcalStartUrl(user.userId, typeof body.tz === 'string' ? body.tz.slice(0, 60) : 'UTC');
    return url ? NextResponse.json({ ok: true, redirect: url }) : NextResponse.json({ ok: false, message: 'Google sign-in is not configured on this server (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / NEXTAUTH_URL).' });
  }
  if (id === 'gmail' && action === 'connect' && !body.email) {
    const url = gmailStartUrl(user.userId);
    return url ? NextResponse.json({ ok: true, redirect: url }) : NextResponse.json({ ok: false, message: 'Google sign-in is not configured on this server (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / NEXTAUTH_URL). You can still connect with an app password.' });
  }
  try {
    return NextResponse.json(await runAction(user.userId, id, action, body));
  } catch (e) {
    return NextResponse.json({ ok: false, message: e instanceof Error ? e.message.slice(0, 200) : 'Something went wrong.' });
  }
}
