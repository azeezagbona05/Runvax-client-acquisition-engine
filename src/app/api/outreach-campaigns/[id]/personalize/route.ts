import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { checkAndIncrementAIForUser } from '@/lib/usage';
// RUNVAX's existing per-business pitch engine, used exactly as it is. Without a userId it records
// nothing in the prospecting product (no activity feed rows, no saturation, no memory lookups).
import { composeOutreach } from '@/lib/outreach/compose';
import type { Business } from '@/types';
import type { OfferType } from '@/lib/opportunity/types';
import { guardInstalled } from '@/lib/v2Setup';
import { logAgent } from '@/lib/acqReplies';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PER_REQUEST = 8;

/** What the pitch engine needs to know about someone we only have contact details for. */
function businessFor(lead: { id: string; email: string; name: string | null; business: string | null; website: string | null }): Business {
  const domain = lead.email.split('@')[1] ?? '';
  const site = lead.website ? (/^https?:\/\//i.test(lead.website) ? lead.website : `https://${lead.website}`) : undefined;
  return {
    id: `acq-${lead.id}`, name: lead.business?.trim() || domain || lead.email, address: '', email: lead.email,
    website: site, hasWebsite: !!site, category: 'Business',
    ...(lead.name?.trim() ? { decisionMaker: { name: lead.name.trim(), title: '', source: 'manual' as const } } : {}),
  };
}

/**
 * POST { offer: 'website' | 'ai_system' } — writes each waiting lead's first email with the RUNVAX pitch engine
 * (a few per request; the page repeats until none are left). Each lead costs one AI call from the plan's daily allowance.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;
  if (!rateLimit(`acq-personalize:${user.userId}`, { maxRequests: 20, windowMs: 60_000 }).ok) {
    return NextResponse.json({ error: 'Slow down: try again in a minute.' }, { status: 429 });
  }
  return guardInstalled(async () => {
    const campaign = await prisma.outreachCampaign.findFirst({ where: { id: params.id, userId: user.userId }, select: { id: true } });
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const body = await req.json().catch(() => ({})) as { offer?: unknown };
    const offer: OfferType = body.offer === 'ai_system' ? 'ai_system' : 'website';

    const account = await prisma.user.findUnique({ where: { id: user.userId }, select: { plan: true } });
    const waiting = { campaignId: campaign.id, status: 'queued', customBody: null };
    const leads = await prisma.outreachLead.findMany({
      where: waiting, orderBy: { createdAt: 'asc' }, take: PER_REQUEST,
      select: { id: true, email: true, name: true, business: true, website: true },
    });

    let done = 0, failed = 0;
    let stopped: string | undefined;
    for (const lead of leads) {
      const gate = await checkAndIncrementAIForUser(user.userId, account?.plan ?? 'free');
      if (!gate.ok) { stopped = 'Your daily AI allowance is used up. Run this again tomorrow, or send the rest with the standard email.'; break; }
      try {
        const r = await composeOutreach({ business: businessFor(lead), offer });
        const subject = r.emailSubject?.trim().slice(0, 190);
        const text = r.emailBody?.trim().slice(0, 8000);
        if (!subject || !text) { failed++; continue; }
        await prisma.outreachLead.update({ where: { id: lead.id }, data: { customSubject: subject, customBody: text } });
        done++;
      } catch (e) {
        console.error('[personalize]', e instanceof Error ? e.message : e);
        failed++;
      }
    }
    const left = await prisma.outreachLead.count({ where: waiting });
    if (done > 0) await logAgent(user.userId, 'content', `Personalised ${done} first email${done === 1 ? '' : 's'}`, failed ? `${failed} could not be written.` : undefined, campaign.id);
    return NextResponse.json({ done, failed, left, ...(stopped ? { stopped } : {}) });
  });
}
