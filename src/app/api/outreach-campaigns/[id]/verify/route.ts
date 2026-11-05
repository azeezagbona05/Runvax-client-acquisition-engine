import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { guardInstalled } from '@/lib/v2Setup';
import { logAgent } from '@/lib/acqReplies';
import { snovEnabled, verifyEmails } from '@/lib/snov';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Leads checked per request: 5 Snov batches of 10. The page repeats with the returned cursor until `next` is null. */
const PER_REQUEST = 50;

/** GET: is the Snov.io address check switched on, so the page knows whether to offer it. */
export async function GET(req: NextRequest) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;
  return NextResponse.json({ available: snovEnabled() });
}

/**
 * POST { after?: string } — checks the next batch of waiting leads' addresses with Snov.io in bulk.
 * Addresses that do not exist, and disposable ones, are marked "skipped" so they are never emailed.
 * Addresses Snov cannot decide on stay queued and are counted as "unsure". Each check costs a Snov credit.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;
  if (!rateLimit(`acq-verify:${user.userId}`, { maxRequests: 12, windowMs: 60_000 }).ok) {
    return NextResponse.json({ error: 'Slow down: try again in a minute.' }, { status: 429 });
  }
  if (!snovEnabled()) return NextResponse.json({ error: 'Email checking is not switched on yet.' }, { status: 501 });

  return guardInstalled(async () => {
    const campaign = await prisma.outreachCampaign.findFirst({ where: { id: params.id, userId: user.userId }, select: { id: true } });
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const account = await prisma.user.findUnique({ where: { id: user.userId }, select: { plan: true } });
    if (!account || account.plan === 'free') return NextResponse.json({ error: 'Checking emails in bulk is available on paid plans.' }, { status: 403 });

    const body = await req.json().catch(() => ({})) as { after?: unknown };
    const after = typeof body.after === 'string' && body.after ? body.after : undefined;

    const leads = await prisma.outreachLead.findMany({
      where: { campaignId: campaign.id, status: 'queued', ...(after ? { id: { gt: after } } : {}) },
      orderBy: { id: 'asc' }, take: PER_REQUEST, select: { id: true, email: true },
    });
    if (leads.length === 0) return NextResponse.json({ checked: 0, invalid: 0, disposable: 0, unsure: 0, next: null });

    let results;
    try {
      results = await verifyEmails(leads.map((l) => l.email));
    } catch (e) {
      console.error('[verify]', e instanceof Error ? e.message : e);
      return NextResponse.json({ error: 'The email checker did not answer. Nothing was changed; try again in a moment.' }, { status: 502 });
    }

    let checked = 0, invalid = 0, disposable = 0, unsure = 0;
    for (const lead of leads) {
      const r = results.get(lead.email.trim().toLowerCase());
      if (!r) continue;               // not answered (for example out of credits): left as it was
      checked++;
      if (r.smtpStatus === 'not_valid' || r.disposable) {
        const why = r.smtpStatus === 'not_valid' ? 'Snov.io: this address does not exist, so it was not emailed.' : 'Snov.io: this is a disposable address, so it was not emailed.';
        // Only a lead that is still waiting: never touch one that was sent or claimed in the meantime.
        const hit = await prisma.outreachLead.updateMany({ where: { id: lead.id, status: 'queued' }, data: { status: 'skipped', error: why } });
        if (hit.count) { if (r.smtpStatus === 'not_valid') invalid++; else disposable++; }
      } else if (r.smtpStatus === 'unknown') unsure++;
    }

    const next = leads.length === PER_REQUEST ? leads[leads.length - 1].id : null;
    if (invalid || disposable) {
      await logAgent(user.userId, 'outreach', `Removed ${invalid + disposable} bad address${invalid + disposable === 1 ? '' : 'es'} before sending`, `${invalid} do not exist, ${disposable} disposable.`, campaign.id);
    }
    return NextResponse.json({ checked, invalid, disposable, unsure, unanswered: leads.length - checked, next });
  });
}
