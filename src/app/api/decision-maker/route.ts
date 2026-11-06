import { useUserKeys } from '@/lib/integrations/keys';
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/requireUser';
import { rateLimit } from '@/lib/rateLimiter';
import { prisma } from '@/lib/prisma';
import { remember } from '@/lib/prospectMemory';
import { findDecisionMakers, paidProvidersConfigured } from '@/lib/dmFinder';
import { cleanPhone, sameName } from '@/lib/decisionMaker';
import type { Business } from '@/types';

export const dynamic = 'force-dynamic';

type DM = NonNullable<Business['decisionMaker']>;
type Cand = NonNullable<Business['dmCandidates']>[number];

// Paid sources (Hunter, Apollo, Apify) spend real credits: paid plans only, capped per user per day.
const PAID_DAILY_CAP = 20;
const PICKABLE: DM['source'][] = ['website', 'search', 'apollo', 'hunter', 'apify'];
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function cityOf(address?: string): string {
  const parts = (address ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  return parts[1] ?? parts[0] ?? '';
}

/** Finds the saved prospect row this request refers to, if the user has saved it. */
async function findProspect(userId: string, ref: { prospectId?: string; businessId?: string }) {
  if (ref.prospectId) return prisma.prospect.findFirst({ where: { id: ref.prospectId, userId } });
  if (ref.businessId) return prisma.prospect.findUnique({ where: { userId_businessId: { userId, businessId: ref.businessId } } });
  return null;
}

async function persist(
  userId: string, prospect: { id: string; businessData: unknown }, dm: DM, memo: string, source: string,
  extra: { candidates?: Cand[] } = {},
) {
  const business = prospect.businessData as unknown as Business;
  // The person's own email lives on decisionMaker, so the business's shared inbox is kept as-is.
  const updated: Business = {
    ...business,
    decisionMaker: dm,
    ...(extra.candidates ? { dmCandidates: extra.candidates.slice(0, 5) } : {}),
  };
  await prisma.prospect.update({ where: { id: prospect.id }, data: { businessData: updated as unknown as object } });
  await remember({ userId, prospectId: prospect.id, kind: 'contact', source, confidence: dm.source === 'manual' ? 'high' : 'medium', content: memo });
}

/**
 * POST — search for the decision-maker across every configured source.
 * Body: { prospectId? | businessId?, name?, address?, website?, category?, categoryTypes?, deep? }.
 * Free sources (website, public search) always run. `deep: true` adds the paid sources and
 * needs a saved prospect on a paid plan. Unsaved businesses get the result back unstored.
 */
export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user.ok) return user.response;
  await useUserKeys(user.userId);
  if (!rateLimit(`decision-maker:${user.userId}`, { maxRequests: 30, windowMs: 60_000 }).ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({})) as {
    prospectId?: string; businessId?: string; name?: string; address?: string; website?: string; deep?: boolean;
    category?: string; categoryTypes?: string[];
  };
  const prospect = await findProspect(user.userId, body);
  const saved = prospect ? (prospect.businessData as unknown as Business) : null;

  const businessName = saved?.name ?? body.name;
  if (!businessName) return NextResponse.json({ error: 'Business name required' }, { status: 400 });

  const deep = !!body.deep;
  const current = saved?.decisionMaker;

  // Something the sender typed always wins over anything we find; only a deeper search
  // (looking up that person's contact details) goes past it.
  if (current?.source === 'manual' && !deep) {
    return NextResponse.json({ decisionMaker: current, candidates: saved?.dmCandidates ?? [], cached: true });
  }

  if (deep) {
    if (!prospect) return NextResponse.json({ error: 'Save this prospect first — the deeper search stores what it finds' }, { status: 422 });
    if (!paidProvidersConfigured()) return NextResponse.json({ error: 'No paid lookup sources are configured' }, { status: 501 });
    const u = await prisma.user.findUnique({ where: { id: user.userId }, select: { plan: true } });
    if (!u || u.plan === 'free') return NextResponse.json({ error: 'The deeper search is available on paid plans' }, { status: 403 });
    const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
    const used = await prisma.prospectMemory.count({ where: { userId: user.userId, source: 'dm_paid_lookup', createdAt: { gte: startOfDay } } });
    if (used >= PAID_DAILY_CAP) return NextResponse.json({ error: `Daily deep-search limit of ${PAID_DAILY_CAP} reached` }, { status: 429 });
  }

  const result = await findDecisionMakers(
    {
      businessName, city: cityOf(saved?.address ?? body.address), website: saved?.website ?? body.website,
      category: (saved?.category ?? body.category)?.toString().slice(0, 80),
      categoryTypes: (saved?.categoryTypes ?? (Array.isArray(body.categoryTypes) ? body.categoryTypes : []))
        .filter((t): t is string => typeof t === 'string').slice(0, 10).map((t) => t.slice(0, 60)),
      ...(current?.name ? { knownPerson: { name: current.name, title: current.title } } : {}),
    },
    { deep },
  );

  const candidates: Cand[] = result.candidates.slice(0, 5).map((c) => ({
    name: c.name, title: c.title, linkedin: c.linkedin, source: c.source, confidence: c.confidence,
    ...(c.email ? { email: c.email } : {}), ...(c.phone ? { phone: c.phone } : {}),
  }));
  const contactOf = (c: typeof result.best | undefined) => (c ? {
    ...(c.email ? { email: c.email } : {}), ...(c.emailStatus ? { emailStatus: c.emailStatus } : {}), ...(c.phone ? { phone: c.phone } : {}),
  } : {});

  // The person already on file stays when the search found them again (now with contact
  // details) or when the sender named them; otherwise the best new result replaces them.
  const again = current ? result.candidates.find((c) => sameName(c.name, current.name)) : undefined;
  let best = result.best;
  let dm: DM | null;
  if (current && (again || current.source === 'manual')) {
    best = again ?? null;
    dm = { ...current, ...contactOf(again), ...(again?.linkedin && !current.linkedin ? { linkedin: again.linkedin } : {}) };
  } else {
    dm = best ? { name: best.name, title: best.title, linkedin: best.linkedin, source: best.source as DM['source'], ...contactOf(best) } : null;
  }

  if (prospect) {
    // A paid run counts against the cap whether or not anyone was found: the credit is spent either way.
    if (deep) {
      await remember({
        userId: user.userId, prospectId: prospect.id, kind: 'contact', source: 'dm_paid_lookup', confidence: 'low',
        content: `Deep decision-maker search ran (${result.ran.join(', ')}) — ${dm ? `found ${dm.name}` : 'nobody found'}`,
      });
    }
    // Skip the write when nothing changed (e.g. a deep search that found no contact for the named person).
    if (dm && JSON.stringify(dm) !== JSON.stringify(current)) {
      await persist(
        user.userId, prospect, dm,
        `Decision-maker: ${dm.name} — ${dm.title} (${best?.sources?.join(' + ') ?? dm.source}${best?.sources && best.sources.length > 1 ? ', sources agree' : ''})${dm.email ? ` · email ${dm.email}` : ''}${dm.phone ? ` · phone ${dm.phone}` : ''}`,
        'dm_lookup',
        { candidates },
      );
    }
  }

  return NextResponse.json({
    decisionMaker: dm, candidates, ran: result.ran, paidAvailable: result.paidAvailable && !!prospect, saved: !!prospect && !!dm,
  });
}

/**
 * PUT — the sender names the decision-maker themselves (they spoke to someone, saw a sign).
 * Body: { prospectId? | businessId?, name, title?, email?, phone? }. Empty name clears it.
 */
export async function PUT(req: NextRequest) {
  const user = await requireUser(req);
  if (!user.ok) return user.response;

  const body = await req.json().catch(() => ({})) as { prospectId?: string; businessId?: string; name?: string; title?: string; source?: DM['source']; linkedin?: string; email?: string; phone?: string };
  const name = (body.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
  const title = (body.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);

  const prospect = await findProspect(user.userId, body);

  if (!name) {
    if (prospect) {
      const { decisionMaker: _removed, ...rest } = prospect.businessData as unknown as Business;
      void _removed;
      await prisma.prospect.update({ where: { id: prospect.id }, data: { businessData: rest as unknown as object } });
    }
    return NextResponse.json({ decisionMaker: null });
  }

  // Picking one of the found candidates keeps its source; typing a name is manual.
  const source: DM['source'] = body.source && PICKABLE.includes(body.source) ? body.source : 'manual';
  const linkedin = typeof body.linkedin === 'string' && /^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\//i.test(body.linkedin) ? body.linkedin : undefined;
  const email = typeof body.email === 'string' && EMAIL_OK.test(body.email.trim()) ? body.email.trim().toLowerCase().slice(0, 120) : undefined;
  const phone = typeof body.phone === 'string' ? cleanPhone(body.phone.slice(0, 30)) : undefined;
  const dm: DM = { name, title, source, ...(linkedin ? { linkedin } : {}), ...(email ? { email } : {}), ...(phone ? { phone } : {}) };
  if (prospect) await persist(user.userId, prospect, dm, `Decision-maker: ${name}${title ? ` — ${title}` : ''}${email ? ` · ${email}` : ''}${phone ? ` · ${phone}` : ''} (${source === 'manual' ? 'added by you' : `picked from ${source}`})`, 'manual_dm');
  return NextResponse.json({ decisionMaker: dm, saved: !!prospect });
}

/** GET — whether a deeper (paid) search is configured, so the UI can offer it before a free search runs. */
export async function GET(req: NextRequest) {
  const user = await requireUser(req);
  if (!user.ok) return user.response;
  return NextResponse.json({ paidConfigured: paidProvidersConfigured() });
}
