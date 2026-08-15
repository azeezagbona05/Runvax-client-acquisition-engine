import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSaturation, recordOutreachSignal } from '@/lib/outreachSignal';

export const dynamic = 'force-dynamic';

// Guards a single oversized request from turning into an unbounded IN (...) query.
const MAX_IDS = 120;

/**
 * GET /api/outreach-signal?ids=placeId1,placeId2
 *
 * Aggregate saturation for a batch of businesses. Returns counts and recency
 * only — there is deliberately no way to ask this endpoint *which* users are
 * behind a count.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const raw = req.nextUrl.searchParams.get('ids') ?? '';
  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, MAX_IDS);
  if (ids.length === 0) return NextResponse.json({});

  try {
    return NextResponse.json(await getSaturation(ids, session.user.id));
  } catch (err) {
    console.error('[/api/outreach-signal GET]', err);
    // The badge is additive — never fail a search because the tracker is down.
    return NextResponse.json({});
  }
}

/** POST /api/outreach-signal — record that this user messaged a business. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { businessId, channel } = await req.json() as {
    businessId?: string;
    channel?: string;
  };

  if (!businessId?.trim()) {
    return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
  }

  try {
    await recordOutreachSignal(session.user.id, businessId.trim(), channel ?? 'whatsapp');
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/outreach-signal POST]', err);
    // Recording is fire-and-forget from the client — a failure must never block
    // or roll back a send the user has already made.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
