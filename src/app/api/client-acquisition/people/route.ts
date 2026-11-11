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
import { webSearchConfigured } from '@/lib/webSearch';
import { emailStatusOf, runEngine } from '@/lib/emailEngineApp';
import type { PersonFound } from '@/lib/acqPeople';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function paid(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  return !!u && u.plan !== 'free';
}

/**
 * The people RUNVAX's email engine reads off the business's own site, decision makers first, each with an email and a status.
 * A published address is labelled published; anything built from a naming pattern is labelled inferred or a guess, never confirmed.
 */
async function enginePeople(website: string): Promise<PersonFound[]> {
  const r = await runEngine(website, { peopleGuesses: MAX_PEOPLE, ms: 30_000 });
  const list = [...(r?.peopleCandidates ?? [])].sort((a, b) => Number(!!b.decisionMaker) - Number(!!a.decisionMaker));
  const out: PersonFound[] = [];
  for (const p of list) {
    const c = p.candidates?.[0];
    const published = !!c && c.provenance !== 'INFERRED';
    const st = c ? (c.verification ? { status: c.verification.status, statusNote: c.verification.reasons[c.verification.reasons.length - 1] } : await emailStatusOf(c.email, published)) : null;
    out.push({
      name: p.name, title: p.title ?? '', ...(p.sourceUrl ? { sourcePage: p.sourceUrl } : {}),
      ...(c ? { email: c.email, emailBasis: published ? 'published' as const : c.basis === 'GENERIC_PRIOR' ? 'guess' as const : 'inferred' as const, emailState: 'unconfirmed' as const, ...(st ?? {}) } : {}),
    });
  }
  return out;
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
    { primary: creditsOk ? { enabled: () => true, contacts: (domain, n) => domainContacts(domain, { max: n }) } : null, fallback: (ctx) => findDecisionMakers(ctx, { deep: false }), engine: enginePeople },
  );
  // Charge only for emails the paid lookup actually found (never for the free search, a failed lookup, or an address revealed before).
  const charge = result.via === 'primary' ? await chargeReveals(user.userId, result.people.map((p) => p.email).filter((e): e is string => !!e)) : null;
  // Emails the account could not pay for are not shown.
  const hide = new Set((charge?.unaffordable ?? []).map((e) => e.toLowerCase()));
  const people = hide.size ? result.people.map((p) => (p.email && hide.has(p.email.toLowerCase()) ? { ...p, email: undefined, emailState: undefined } : p)) : result.people;
  await logAgent(user.userId, 'audience', `Looked up the people at ${name}`, people.length ? `${people.length} found.` : 'Nobody found.');
  // Be straight about why a search came back empty when the LinkedIn search is not switched on.
  const note = !people.length && !webSearchConfigured() ? `${result.note ?? 'No named people were found.'} Searching for LinkedIn profiles is not switched on yet.` : result.note;
  return NextResponse.json({ ...result, ...(note ? { note } : {}), people, searchOn: webSearchConfigured(), balance: creditsOk ? (charge?.summary.total ?? before.total) : null });
}
