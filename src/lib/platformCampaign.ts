import { prisma } from '@/lib/prisma';
import { createTransporter, emailShell, ctaButton } from '@/lib/email';
import { getAppUrl, getAppName } from '@/lib/url';
import { unsubscribeUrl } from '@/lib/unsubscribe';
import { MAX_BATCH } from '@/lib/launchCampaign';
import { getSiteSettings } from '@/lib/siteSettings';
import { generate, hasProvider, providerFor, extractJson } from '@/lib/ai';
import {
  aiSystemPrompt, bodyToHtml, cleanText, describeSegment, fillPlaceholders, firstName, planCampaign, sanitizeConfig,
  type CampaignConfig, type PlanKind, type Purpose, type RenderVars, type Segment, type Step,
} from '@/lib/platformCampaignShared';

/**
 * Server side of the admin's campaigns for RUNVAX users.
 *
 * Who got which email is one LifecycleEmail row per person per email, key "pc:<campaignId>:<n>". The unique (userId, key)
 * row is claimed BEFORE sending, so a double click or two admins can never email someone twice. People who unsubscribed
 * (key "optout") and suspended accounts are never emailed. Every email carries a one-click unsubscribe link.
 */

export const stepKey = (id: string, i: number) => `pc:${id}:${i}`;
const DAY = 24 * 60 * 60 * 1000;

interface U { id: string; email: string; name: string | null; plan: string; planExpiresAt: Date | null; emailVerified: Date | null; createdAt: Date; lastActiveAt: Date | null }

export interface StepAudience {
  /** Everyone matching the audience filters (before the sequence rules). */
  matching: number;
  eligible: U[];
  alreadySent: number;
  /** Got the previous email but it is not yet time for this one. */
  waiting: number;
  /** Has not received the previous email (so this one cannot go yet). */
  notReached: number;
  /** Already did what the campaign wants, so they are left alone. */
  goalReached: number;
  optedOut: number;
}

async function loadPeople() {
  const users = await prisma.user.findMany({
    where: { isSuspended: false, email: { not: null } },
    select: { id: true, email: true, name: true, plan: true, planExpiresAt: true, emailVerified: true, createdAt: true, lastActiveAt: true },
    orderBy: { createdAt: 'asc' },
  }) as Array<Omit<U, 'email'> & { email: string | null }>;
  const [pay, outRows] = await Promise.all([
    prisma.payment.findMany({ where: { OR: [{ reference: { startsWith: 'trial_' } }, { amount: { gt: 0 }, status: 'success' }] }, select: { userId: true, reference: true, amount: true } }),
    prisma.lifecycleEmail.findMany({ where: { key: 'optout' }, select: { userId: true } }),
  ]);
  const trial = new Set(pay.filter((p) => p.reference.startsWith('trial_')).map((p) => p.userId));
  const paid = new Set(pay.filter((p) => p.amount > 0).map((p) => p.userId));
  return { users, trial, paid, out: new Set(outRows.map((r) => r.userId)) };
}

export function kindOf(u: Pick<U, 'id' | 'plan'>, trial: Set<string>, paid: Set<string>): PlanKind {
  if (paid.has(u.id) && u.plan !== 'free') return 'paid';
  if (u.plan !== 'free' && trial.has(u.id)) return 'trial';
  if (u.plan !== 'free') return 'paid';
  return 'free';
}

export function matchesSegment(u: U, seg: Segment, ctx: { trial: Set<string>; paid: Set<string> }, now = Date.now()): boolean {
  if (seg.plans.length && !seg.plans.includes(kindOf(u, ctx.trial, ctx.paid))) return false;
  if (seg.verified === 'yes' && !u.emailVerified) return false;
  if (seg.verified === 'no' && u.emailVerified) return false;
  const claimed = ctx.trial.has(u.id) || ctx.paid.has(u.id) || u.plan !== 'free';
  if (seg.trial === 'claimed' && !claimed) return false;
  if (seg.trial === 'unclaimed' && claimed) return false;
  const age = (now - u.createdAt.getTime()) / DAY;
  if (seg.joinedWithinDays !== null && age > seg.joinedWithinDays) return false;
  if (seg.joinedOlderThanDays !== null && age < seg.joinedOlderThanDays) return false;
  const idle = u.lastActiveAt ? (now - u.lastActiveAt.getTime()) / DAY : Infinity;
  if (seg.activeWithinDays !== null && idle > seg.activeWithinDays) return false;
  if (seg.inactiveForDays !== null && idle < seg.inactiveForDays) return false;
  return true;
}

function goalDone(goal: CampaignConfig['goal'], u: U, ctx: { trial: Set<string>; paid: Set<string> }, firstSentAt: Date | null): boolean {
  if (goal === 'claim_trial') return ctx.trial.has(u.id) || ctx.paid.has(u.id) || u.plan !== 'free';
  if (goal === 'verify_email') return !!u.emailVerified;
  if (goal === 'come_back') return !!(firstSentAt && u.lastActiveAt && u.lastActiveAt > firstSentAt);
  return false;
}

/** Who can be sent email `step` right now, and why everyone else cannot. Read-only. */
export async function stepAudience(id: string, cfg: CampaignConfig, step: number, now = Date.now()): Promise<StepAudience> {
  const { users, trial, paid, out } = await loadPeople();
  const keys = cfg.steps.map((_, i) => stepKey(id, i));
  const rows = keys.length ? await prisma.lifecycleEmail.findMany({ where: { key: { in: keys } }, select: { userId: true, key: true, sentAt: true } }) : [];
  const byUser = new Map<string, Map<number, Date>>();
  for (const r of rows) {
    const idx = Number(r.key.split(':')[2]);
    if (!byUser.has(r.userId)) byUser.set(r.userId, new Map());
    byUser.get(r.userId)!.set(idx, r.sentAt);
  }
  const res: StepAudience = { matching: 0, eligible: [], alreadySent: 0, waiting: 0, notReached: 0, goalReached: 0, optedOut: 0 };
  const seen = new Set<string>();
  const wait = (cfg.steps[step]?.waitDays ?? 0) * DAY;
  for (const raw of users) {
    const email = raw.email!.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || seen.has(email)) continue;
    seen.add(email);
    const u: U = { ...raw, email };
    const mine = byUser.get(u.id);
    // Someone already in the sequence stays in it even if they no longer match the filters (e.g. they became active).
    const inSequence = !!mine && mine.size > 0;
    if (!inSequence && !matchesSegment(u, cfg.segment, { trial, paid }, now)) continue;
    res.matching++;
    if (out.has(u.id)) { res.optedOut++; continue; }
    if (mine?.has(step)) { res.alreadySent++; continue; }
    if (step > 0) {
      const prev = mine?.get(step - 1);
      if (!prev) { res.notReached++; continue; }
      if (now - prev.getTime() < wait) { res.waiting++; continue; }
    }
    if (cfg.stopOnGoal && goalDone(cfg.goal, u, { trial, paid }, mine?.get(0) ?? null)) { res.goalReached++; continue; }
    res.eligible.push(u);
  }
  return res;
}

/** Just the size of the audience for some filters, for the live count while the admin is editing them. */
export async function previewAudience(seg: Segment): Promise<{ matching: number; verified: number; optedOut: number }> {
  const { users, trial, paid, out } = await loadPeople();
  const seen = new Set<string>();
  let matching = 0, verified = 0, optedOut = 0;
  for (const raw of users) {
    const email = raw.email!.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || seen.has(email)) continue;
    seen.add(email);
    if (!matchesSegment({ ...raw, email }, seg, { trial, paid })) continue;
    if (out.has(raw.id)) { optedOut++; continue; }
    matching++;
    if (raw.emailVerified) verified++;
  }
  return { matching, verified, optedOut };
}

/** How many of each email have gone out, and how many in the last 24 hours (for the daily cap). */
export async function sendCounts(id: string, steps: number): Promise<{ perStep: number[]; last24h: number }> {
  const rows = await prisma.lifecycleEmail.groupBy({ by: ['key'], where: { key: { startsWith: `pc:${id}:` } }, _count: { _all: true } });
  const perStep = Array.from({ length: steps }, (_, i) => rows.find((r) => r.key === stepKey(id, i))?._count._all ?? 0);
  const last24h = await prisma.lifecycleEmail.count({ where: { key: { startsWith: `pc:${id}:` }, sentAt: { gt: new Date(Date.now() - DAY) } } });
  return { perStep, last24h };
}

// ───────────────────────── rendering and sending ─────────────────────────

const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderStep(step: Step, vars: RenderVars, opts: { unsub?: string } = {}): { subject: string; html: string } {
  const appUrl = getAppUrl();
  const subject = fillPlaceholders(step.subject, vars);
  const bodyHtml = bodyToHtml(fillPlaceholders(step.body, vars));
  const button = step.ctaPath && step.ctaLabel ? ctaButton(escAttr(fillPlaceholders(step.ctaLabel, vars)), `${appUrl}${step.ctaPath}`) : '';
  const footer = `You&rsquo;re receiving this because you have a ${escAttr(vars.appName)} account. ${opts.unsub
    ? `<a href="${opts.unsub}" style="color:#94a3b8;">Unsubscribe from tips and offers</a>.`
    : 'Reply &ldquo;unsubscribe&rdquo; to stop these emails.'}`;
  return { subject, html: emailShell(vars.appName, `${bodyHtml}${button}`, escAttr(subject), footer) };
}

const from = () => `"${getAppName()}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`;
const varsFor = async (u: { name: string | null; plan: string }): Promise<RenderVars> => ({
  name: firstName(u.name), plan: u.plan === 'free' ? 'Free' : u.plan.charAt(0).toUpperCase() + u.plan.slice(1), appName: getAppName(), trialDays: (await getSiteSettings()).trialDays,
});

/** One copy to the admin's own address, marked [TEST]. Records nothing. */
export async function sendTest(cfg: CampaignConfig, step: number, to: string): Promise<void> {
  const s = cfg.steps[step];
  if (!s) throw new Error('No such email');
  const mail = renderStep(s, await varsFor({ name: 'Test', plan: 'free' }));
  await createTransporter().sendMail({ from: from(), to, subject: `[TEST] ${mail.subject}`, html: mail.html });
}

export interface BatchResult { sent: number; failed: number; remaining: number; capped: boolean }

/** Sends the next batch of one email. Call again until remaining is 0 (or the daily cap stops it). */
export async function sendBatch(id: string, cfg: CampaignConfig, step: number, limit = MAX_BATCH): Promise<BatchResult> {
  const s = cfg.steps[step];
  if (!s) throw new Error('No such email');
  const aud = await stepAudience(id, cfg, step);
  const { last24h } = await sendCounts(id, cfg.steps.length);
  const room = Math.max(0, cfg.dailyCap - last24h);
  const batch = aud.eligible.slice(0, Math.min(limit, MAX_BATCH, room));
  if (batch.length === 0) return { sent: 0, failed: 0, remaining: aud.eligible.length, capped: aud.eligible.length > 0 && room === 0 };

  const transporter = createTransporter();
  const appUrl = getAppUrl();
  const key = stepKey(id, step);
  let sent = 0, failed = 0;
  for (const u of batch) {
    try { await prisma.lifecycleEmail.create({ data: { userId: u.id, key } }); } catch { continue; } // someone else already claimed it
    try {
      const unsub = unsubscribeUrl(appUrl, u.id);
      const mail = renderStep(s, await varsFor(u), { unsub });
      await transporter.sendMail({
        from: from(), to: u.email, subject: mail.subject, html: mail.html,
        headers: { 'List-Unsubscribe': `<${unsub}>, <mailto:info@runvax.com?subject=Unsubscribe>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      });
      sent++;
    } catch (e) {
      failed++;
      console.error('[platform-campaign] send failed', id, step, e);
      await prisma.lifecycleEmail.deleteMany({ where: { userId: u.id, key } }).catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 500)); // stay under SMTP provider rate limits
  }
  return { sent, failed, remaining: Math.max(0, aud.eligible.length - batch.length) + failed, capped: room - batch.length <= 0 && aud.eligible.length > batch.length };
}

// ───────────────────────── drafting ─────────────────────────

export function aiAvailable(): boolean { return hasProvider(providerFor('campaign')); }

/** Drafts with the AI model when a key is set. Returns null (the caller falls back to the built-in writer) on any problem. */
export async function draftWithAi(purpose: Purpose, detail: string): Promise<{ name: string; config: CampaignConfig } | null> {
  if (!aiAvailable()) return null;
  try {
    const base = planCampaign(purpose, detail);
    const res = await generate({
      feature: 'campaign', json: true, temperature: 0.6, maxTokens: 1800, system: aiSystemPrompt(),
      prompt: `Purpose: ${purpose}\nWhat to tell people: ${cleanText(detail, 400) || '(nothing specific given: keep it general and honest)'}\nTrial length in days: ${(await getSiteSettings()).trialDays}`,
    });
    const j = extractJson<{ name?: unknown; steps?: unknown }>(res.text);
    const cfg = sanitizeConfig({ ...base.config, steps: j.steps });
    if (cfg.steps.length === 0) return null;
    return { name: cleanText(j.name, 120) || base.name, config: cfg };
  } catch (e) {
    console.error('[platform-campaign] AI draft failed, using the built-in writer', e);
    return null;
  }
}

export const summarise = (cfg: CampaignConfig) => ({ audience: describeSegment(cfg.segment), emails: cfg.steps.length, goal: cfg.goal });

export async function loadCampaign(id: string) {
  const row = await prisma.platformCampaign.findUnique({ where: { id } });
  if (!row) return null;
  return { row, cfg: sanitizeConfig(row.config) };
}
