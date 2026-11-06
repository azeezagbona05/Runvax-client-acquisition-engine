import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { useUserKeys } from '@/lib/integrations/keys';
import { domainContacts, snovEnabled } from '@/lib/snov';
import { chargeReveals, loadCredits } from '@/lib/emailCredits';
// RUNVAX's own contact intelligence (the decision-maker finder), used as it is. Its free sources only.
import { findDecisionMakers } from '@/lib/dmFinder';
import { findPeople, MAX_PEOPLE } from '@/lib/acqPeople';
import { logAgent } from '@/lib/acqReplies';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function paid(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  return !!u && u.plan !== 'free';
}

/** GET — whether the email lookup is on for this account, and the email reveals left, so the page can say what a lookup costs. */
export async function GET(req: NextRequest) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;
  await useUserKeys(user.userId);
  const on = snovEnabled() && (await paid(user.userId));
  return NextResponse.json({ credits: on, balance: on ? (await loadCredits(user.userId)).total : null });
}

/**
 * POST { name, address?, website?, category?, max? } — the people at one business. Credit-based lookup first (paid plans),
 * then RUNVAX's own contact intelligence. Answers { people, via, note?, balance }.
 */
export async function POST(req: NextRequest) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;
  await useUserKeys(user.userId);
  if (!rateLimit(`acq-people:${user.userId}`, { maxRequests: 40, windowMs: 60_000 }).ok) return NextResponse.json({ error: 'Slow down: try again in a minute.' }, { status: 429 });

  const b = await req.json().catch(() => null) as { name?: unknown; address?: unknown; website?: unknown; category?: unknown; max?: unknown } | null;
  const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
  const name = str(b?.name, 160);
  if (!name) return NextResponse.json({ error: 'Business name required.' }, { status: 400 });
  const max = Math.max(1, Math.min(MAX_PEOPLE, Math.floor(Number(b?.max)) || 5));

  // The email lookup needs a paid plan and at least one reveal in hand; with none, the free contact search still runs.
  const before = await loadCredits(user.userId);
  const creditsOk = snovEnabled() && (await paid(user.userId)) && before.total > 0 && rateLimit(`acq-people-credits:${user.userId}`, { maxRequests: 100, windowMs: 3_600_000 }).ok;
  const result = await findPeople(
    { name, address: str(b?.address, 300), website: str(b?.website, 300), category: str(b?.category, 80), max: creditsOk ? Math.min(max, before.total) : max },
    { primary: creditsOk ? { enabled: () => true, contacts: (domain, n) => domainContacts(domain, { max: n }) } : null, fallback: (ctx) => findDecisionMakers(ctx, { deep: false }) },
  );
  // Charge only for emails the paid lookup actually found (never for the free search, a failed lookup, or an address revealed before).
  const charge = result.via === 'primary' ? await chargeReveals(user.userId, result.people.map((p) => p.email).filter((e): e is string => !!e)) : null;
  // Emails the account could not pay for are not shown.
  const hide = new Set((charge?.unaffordable ?? []).map((e) => e.toLowerCase()));
  const people = hide.size ? result.people.map((p) => (p.email && hide.has(p.email.toLowerCase()) ? { ...p, email: undefined, emailState: undefined } : p)) : result.people;
  await logAgent(user.userId, 'audience', `Looked up the people at ${name}`, people.length ? `${people.length} found.` : 'Nobody found.');
  return NextResponse.json({ ...result, people, balance: creditsOk ? (charge?.summary.total ?? before.total) : null });
}
