import { prisma } from '@/lib/prisma';
import { getAppUrl } from '@/lib/url';
import { getSiteSettings } from '@/lib/siteSettings';
import { addLeads } from '@/lib/outreachLeads';
import { loadMailbox, sendBatch, type BatchResult } from '@/lib/outreachSender';
import { checkInbox } from '@/lib/acqInboxReader';
import { sanitizeAutomation, toCampaignFields, followRule, conditionMet, type Automation } from '@/lib/automation';
import { buildEmail, needsFollowUp, stageOf, statsOf, renderTemplate, type CampaignStats } from '@/lib/outreachCampaign';
import { planAutomation } from '@/lib/automationAi';
import { hasProvider, providerFor } from '@/lib/ai';
import { defaultPlaybook } from '@/lib/replyPlaybook';
import {
  cleanText, describeSegment, firstName, planCampaign, planProblems, sanitizePlan, sanitizeSegment, PURPOSES,
  type Goal, type PlanKind, type PlatformPlan, type Purpose, type Segment,
} from '@/lib/platformCampaignShared';

/**
 * Admin campaigns for RUNVAX users, run on the customer campaign engine.
 *
 * The campaign itself (the emails, follow-ups, leads, opens, clicks, replies, pipeline) is an ordinary OutreachCampaign owned by
 * the admin's own account, so it behaves exactly like a front-end campaign and shows up there too. The PlatformCampaign row only
 * remembers what the engine does not: the audience filters, the goal and which page the link opens.
 * People who unsubscribed from RUNVAX email ("optout"), suspended accounts, bad and duplicate addresses are never added.
 */

const DAY = 86_400_000;
export const MAX_PLATFORM_CAMPAIGNS = 50;

interface U { id: string; email: string; name: string | null; plan: string; planExpiresAt: Date | null; emailVerified: Date | null; createdAt: Date; lastActiveAt: Date | null }
type Ctx = { trial: Set<string>; paid: Set<string> };

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

export function matchesSegment(u: U, seg: Segment, ctx: Ctx, now = Date.now()): boolean {
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

/** Everyone the filters match who may be emailed. */
export async function eligiblePeople(seg: Segment, now = Date.now()): Promise<{ people: U[]; optedOut: number }> {
  const { users, trial, paid, out } = await loadPeople();
  const seen = new Set<string>(); const people: U[] = []; let optedOut = 0;
  for (const raw of users) {
    const email = raw.email!.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || seen.has(email)) continue;
    seen.add(email);
    const u: U = { ...raw, email };
    if (!matchesSegment(u, seg, { trial, paid }, now)) continue;
    if (out.has(u.id)) { optedOut++; continue; }
    people.push(u);
  }
  return { people, optedOut };
}

/** Just the size of the audience for some filters, for the live count while the admin is editing them. */
export async function previewAudience(seg: Segment): Promise<{ matching: number; verified: number; optedOut: number }> {
  const { people, optedOut } = await eligiblePeople(seg);
  return { matching: people.length, verified: people.filter((p) => p.emailVerified).length, optedOut };
}

// ───────────────────────── the registry ─────────────────────────

export interface Registry { outreachCampaignId: string; purpose: Purpose; goal: Goal; stopOnGoal: boolean; segment: Segment; linkPath: string }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** Null for a campaign made with the first, simpler version of this builder (no engine campaign behind it). */
export function parseRegistry(config: unknown): Registry | null {
  if (!isObj(config) || typeof config.outreachCampaignId !== 'string') return null;
  const goal = ['none', 'claim_trial', 'verify_email', 'come_back'].includes(String(config.goal)) ? (config.goal as Goal) : 'none';
  return {
    outreachCampaignId: config.outreachCampaignId, purpose: PURPOSES.some((p) => p.id === config.purpose) ? (config.purpose as Purpose) : 'custom', goal,
    stopOnGoal: config.stopOnGoal !== false, segment: sanitizeSegment(config.segment), linkPath: typeof config.linkPath === 'string' ? config.linkPath : '/client-acquisition',
  };
}

/** The sender name people see: filled in only where the admin's own settings are blank. */
async function ensureIdentity(userId: string) {
  const s = await prisma.userSettings.findUnique({ where: { userId }, select: { senderName: true, smtpFrom: true } });
  if (!s) { await prisma.userSettings.create({ data: { userId, senderName: 'The RUNVAX team', smtpFrom: 'RUNVAX' } }); return; }
  const patch: { senderName?: string; smtpFrom?: string } = {};
  if (!s.senderName) patch.senderName = 'The RUNVAX team';
  if (!s.smtpFrom) patch.smtpFrom = 'RUNVAX';
  if (Object.keys(patch).length) await prisma.userSettings.update({ where: { userId }, data: patch });
}

export const linkFor = (linkPath: string) => `${getAppUrl()}${linkPath}`;

/**
 * What to show. The engine marks a campaign "completed" as soon as every first email has gone out, but follow-ups carry on after that,
 * so "completed" is still a running campaign. Only the admin marking it finished (kept on our own row) ends it.
 */
export const displayStatus = (registryStatus: string, engineStatus: string): 'draft' | 'running' | 'paused' | 'finished' =>
  registryStatus === 'finished' ? 'finished' : engineStatus === 'paused' ? 'paused' : engineStatus === 'draft' ? 'draft' : 'running';

/** Saves the campaign on the engine, adds the matching users as its leads, and records the audience and goal. Sends nothing. */
export async function createPlatformCampaign(args: { adminUserId: string; adminEmail: string; plan: PlatformPlan }): Promise<{ id: string; campaignId: string; added: number; optedOut: number; duplicates: number } | { error: string }> {
  const plan = sanitizePlan(args.plan);
  if (!plan) return { error: 'Add at least one email with a subject and a message.' };
  const problems = planProblems(plan); if (problems.length) return { error: problems[0] };
  if (await prisma.platformCampaign.count() >= MAX_PLATFORM_CAMPAIGNS) return { error: `You have ${MAX_PLATFORM_CAMPAIGNS} campaigns already. Delete an old one first.` };
  const { people, optedOut } = await eligiblePeople(plan.segment);
  if (people.length === 0) return { error: 'Nobody matches those audience filters, so there is nobody to email. Widen the filters.' };

  await ensureIdentity(args.adminUserId);
  const f = toCampaignFields(plan.automation);
  const campaign = await prisma.outreachCampaign.create({
    data: {
      userId: args.adminUserId, name: plan.name, subject: f.subject, body: f.body, followUpSubject: f.followUpSubject, followUpBody: f.followUpBody,
      followUpAfterDays: f.followUpAfterDays, maxFollowUps: f.maxFollowUps, dailyCap: f.dailyCap, automation: plan.automation as unknown as object,
    },
  });
  const link = linkFor(plan.linkPath);
  const added = await addLeads(campaign.id, args.adminUserId, people.map((u) => ({ email: u.email, name: u.name ?? undefined, website: link })));
  const reg: Registry = { outreachCampaignId: campaign.id, purpose: plan.purpose, goal: plan.goal, stopOnGoal: plan.stopOnGoal, segment: plan.segment, linkPath: plan.linkPath };
  const row = await prisma.platformCampaign.create({ data: { name: plan.name, purpose: plan.purpose, status: 'draft', config: reg as unknown as object, createdBy: args.adminEmail } });
  await prisma.adminAuditLog.create({ data: { actorEmail: args.adminEmail, action: 'platform_campaign_created', title: `Created campaign "${plan.name}"`, detail: `${plan.automation.emails.length} emails to ${added.added} people. Audience: ${describeSegment(plan.segment)}` } }).catch(() => {});
  return { id: row.id, campaignId: campaign.id, added: added.added, optedOut: optedOut + added.optedOut, duplicates: added.duplicates };
}

// ───────────────────────── reading a campaign ─────────────────────────

type LeadSel = {
  id: string; email: string; name: string | null; status: string; sentAt: Date | null; lastSentAt: Date | null; followUpsSent: number; openedAt: Date | null; openCount: number;
  clickedAt: Date | null; clickCount: number; repliedAt: Date | null; outcome: string | null; replyClass: string | null; unsubscribedAt: Date | null; error: string | null;
  stage: string | null; pausedUntil: Date | null;
};
const LEAD_SELECT = {
  id: true, email: true, name: true, status: true, sentAt: true, lastSentAt: true, followUpsSent: true, openedAt: true, openCount: true, clickedAt: true, clickCount: true,
  repliedAt: true, outcome: true, replyClass: true, unsubscribedAt: true, error: true, stage: true, pausedUntil: true,
} as const;

export async function loadCampaign(adminUserId: string, id: string) {
  const row = await prisma.platformCampaign.findUnique({ where: { id } });
  if (!row) return null;
  const reg = parseRegistry(row.config);
  if (!reg) return { row, reg: null, campaign: null, automation: null as Automation | null };
  const campaign = await prisma.outreachCampaign.findFirst({ where: { id: reg.outreachCampaignId, userId: adminUserId } });
  if (!campaign) return { row, reg, campaign: null, automation: null as Automation | null };
  return { row, reg, campaign, automation: sanitizeAutomation(campaign.automation) };
}

export interface ListItem { id: string; name: string; purpose: string; status: string; audience: string; emails: number; stats: CampaignStats | null; legacy: boolean }

export async function listPlatformCampaigns(adminUserId: string): Promise<ListItem[]> {
  const rows = await prisma.platformCampaign.findMany({ orderBy: { updatedAt: 'desc' }, take: 100 });
  const regs = rows.map((r) => ({ r, reg: parseRegistry(r.config) }));
  const ids = regs.flatMap((x) => (x.reg ? [x.reg.outreachCampaignId] : []));
  const [campaigns, leads] = await Promise.all([
    ids.length ? prisma.outreachCampaign.findMany({ where: { id: { in: ids }, userId: adminUserId } }) : [],
    ids.length ? prisma.outreachLead.findMany({ where: { campaignId: { in: ids } }, select: { campaignId: true, status: true, sentAt: true, lastSentAt: true, openedAt: true, clickedAt: true, repliedAt: true, outcome: true, unsubscribedAt: true, followUpsSent: true, stage: true, pausedUntil: true } }) : [],
  ]);
  const byCamp = new Map<string, typeof leads>();
  for (const l of leads) byCamp.set(l.campaignId, [...(byCamp.get(l.campaignId) ?? []), l]);
  return regs.map(({ r, reg }) => {
    const c = reg ? campaigns.find((x) => x.id === reg.outreachCampaignId) : undefined;
    const auto = c ? sanitizeAutomation(c.automation) : null;
    return {
      id: r.id, name: r.name, purpose: r.purpose, status: c ? displayStatus(r.status, c.status) : r.status,
      audience: reg ? describeSegment(reg.segment) : 'Created with the first version of this builder',
      emails: auto?.emails.length ?? 0, stats: c ? statsOf(byCamp.get(c.id) ?? [], { ...c, ...followRule(c) }) : null, legacy: !reg,
    };
  });
}

export interface StepInfo { index: number; subject: string; waitDays: number; sendIf: string; hasOpenedVariant: boolean; sent: number; due: number }
export interface LeadView extends Omit<LeadSel, 'stage'> { pipelineStage: string | null; stage: string; followUpDue: boolean; goalReached: boolean }

export async function campaignDetail(adminUserId: string, id: string) {
  const c = await loadCampaign(adminUserId, id);
  if (!c) return null;
  if (!c.reg || !c.campaign || !c.automation) return { legacy: true as const, id, name: c.row.name, status: c.row.status };
  const { campaign, automation, reg } = c;
  const now = Date.now(); const rule = { ...campaign, ...followRule(campaign) };
  const [leads, mailbox, replies, goalIds] = await Promise.all([
    prisma.outreachLead.findMany({ where: { campaignId: campaign.id }, orderBy: [{ createdAt: 'asc' }, { email: 'asc' }], select: LEAD_SELECT }) as Promise<LeadSel[]>,
    loadMailbox(adminUserId).catch(() => null),
    prisma.campaignReply.findMany({ where: { campaignId: campaign.id }, orderBy: { receivedAt: 'desc' }, take: 50, select: { id: true, fromEmail: true, subject: true, text: true, replyClass: true, receivedAt: true, suggestion: true, lead: { select: { name: true } } } }),
    reg.goal !== 'none' ? goalReachedIds(campaign.id, reg.goal) : Promise.resolve(new Set<string>()),
  ]);
  const steps: StepInfo[] = automation.emails.map((e, i) => ({
    index: i, subject: e.subject, waitDays: e.waitDays, sendIf: e.sendIf, hasOpenedVariant: !!e.openedVariant,
    sent: i === 0 ? leads.filter((l) => l.sentAt).length : leads.filter((l) => l.followUpsSent >= i).length,
    due: i === 0 ? leads.filter((l) => l.status === 'queued').length : leads.filter((l) => l.followUpsSent === i - 1 && needsFollowUp(l, rule, now) && conditionMet(e.sendIf, { repliedAt: l.repliedAt ? 1 : undefined, openedAt: l.openedAt ? 1 : undefined, clickedAt: l.clickedAt ? 1 : undefined })).length,
  }));
  const views: LeadView[] = leads.map(({ stage: pipelineStage, ...l }) => ({ ...l, pipelineStage, stage: stageOf({ ...l, stage: pipelineStage }, rule, now), followUpDue: needsFollowUp({ ...l, stage: pipelineStage }, rule, now), goalReached: goalIds.has(l.id) }));
  return {
    legacy: false as const, id, name: c.row.name, purpose: c.row.purpose, status: displayStatus(c.row.status, campaign.status), dailyCap: campaign.dailyCap, startedAt: campaign.startedAt,
    audience: describeSegment(reg.segment), goal: reg.goal, stopOnGoal: reg.stopOnGoal, linkPath: reg.linkPath, link: linkFor(reg.linkPath), outreachCampaignId: campaign.id,
    mailbox: mailbox ? { ready: true as const, from: mailbox.fromAddress } : { ready: false as const, from: '' },
    automation, steps, stats: statsOf(leads, rule, now), goalReached: goalIds.size,
    leads: views, replies: replies.map((r) => ({ id: r.id, from: r.lead?.name || r.fromEmail, email: r.fromEmail, subject: r.subject, text: r.text.slice(0, 500), replyClass: r.replyClass, receivedAt: r.receivedAt, suggestion: r.suggestion?.slice(0, 500) ?? null })),
  };
}

// ───────────────────────── the goal ─────────────────────────

/** The engine's lead ids whose user has already done what the campaign wanted (claimed the trial, verified, come back). */
async function goalReachedIds(campaignId: string, goal: Goal): Promise<Set<string>> {
  if (goal === 'none') return new Set();
  const leads = await prisma.outreachLead.findMany({ where: { campaignId, status: 'sent', repliedAt: null, unsubscribedAt: null }, select: { id: true, email: true, sentAt: true } });
  if (!leads.length) return new Set();
  const emails = leads.map((l) => l.email);
  const [users, pay] = await Promise.all([
    prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true, plan: true, emailVerified: true, lastActiveAt: true } }),
    prisma.payment.findMany({ where: { OR: [{ reference: { startsWith: 'trial_' } }, { amount: { gt: 0 }, status: 'success' }] }, select: { userId: true } }),
  ]);
  const claimed = new Set(pay.map((p) => p.userId));
  const byEmail = new Map(users.map((u) => [u.email!.toLowerCase(), u]));
  const done = new Set<string>();
  for (const l of leads) {
    const u = byEmail.get(l.email.toLowerCase()); if (!u) continue;
    const ok = goal === 'claim_trial' ? claimed.has(u.id) || u.plan !== 'free'
      : goal === 'verify_email' ? !!u.emailVerified
      : !!(l.sentAt && u.lastActiveAt && u.lastActiveAt > l.sentAt);
    if (ok) done.add(l.id);
  }
  return done;
}

/** Marks people who reached the goal as converted, so the engine stops following up with them. Returns how many. */
export async function applyGoal(campaignId: string, goal: Goal): Promise<number> {
  const ids = await goalReachedIds(campaignId, goal);
  if (!ids.size) return 0;
  const r = await prisma.outreachLead.updateMany({
    where: { id: { in: Array.from(ids) }, OR: [{ stage: null }, { stage: { notIn: ['customer', 'lost', 'demo_booked', 'proposal_sent'] } }] },
    data: { stage: 'customer', closedAt: new Date() },
  });
  return r.count;
}

// ───────────────────────── running it ─────────────────────────

/** A real send must never go out from a production server whose own address is local or not https (the link inside would be broken). */
export function sendSafetyProblem(): string | null {
  if (process.env.NODE_ENV !== 'production') return null;
  const url = getAppUrl();
  if (!/^https:\/\//.test(url) || /localhost|127\.0\.0\.1/.test(url)) return `Refusing to send to your users: the app address is "${url}", not a public https address.`;
  return null;
}

export async function startCampaign(adminUserId: string, id: string): Promise<{ ok: true } | { error: string; code?: string }> {
  const c = await loadCampaign(adminUserId, id);
  if (!c?.campaign) return { error: 'Campaign not found' };
  if (c.row.status === 'finished') return { error: 'This campaign is finished.' };
  if (!(await loadMailbox(adminUserId))) return { error: 'No mailbox is set up for sending. The server needs its SMTP settings (and your address must be on the admin list).', code: 'NO_MAILBOX' };
  const queued = await prisma.outreachLead.count({ where: { campaignId: c.campaign.id, status: 'queued' } });
  if (queued === 0 && !c.campaign.startedAt) return { error: 'There is nobody left to send to.' };
  await prisma.outreachCampaign.update({ where: { id: c.campaign.id }, data: { status: 'running', startedAt: c.campaign.startedAt ?? new Date() } });
  await prisma.platformCampaign.update({ where: { id }, data: { status: 'active' } });
  return { ok: true };
}

export async function setCampaignState(adminUserId: string, id: string, state: 'paused' | 'finished'): Promise<{ ok: true } | { error: string }> {
  const c = await loadCampaign(adminUserId, id);
  if (!c?.campaign) return { error: 'Campaign not found' };
  await prisma.outreachCampaign.update({ where: { id: c.campaign.id }, data: { status: state === 'paused' ? 'paused' : 'completed' } });
  await prisma.platformCampaign.update({ where: { id }, data: { status: state === 'paused' ? 'paused' : 'finished' } });
  return { ok: true };
}

/** One batch of introductions or of the follow-ups that are due. Call again while leftToSend > 0 and the cap is not reached. */
export async function sendNow(adminUserId: string, id: string, kind: 'initial' | 'followup'): Promise<(BatchResult & { stoppedByGoal: number }) | { error: string }> {
  const c = await loadCampaign(adminUserId, id);
  if (!c?.campaign || !c.reg) return { error: 'Campaign not found' };
  if (c.row.status === 'finished') return { error: 'This campaign is finished.' };
  if (c.campaign.status === 'paused') return { error: 'This campaign is paused. Resume it to send.' };
  const stoppedByGoal = c.reg.stopOnGoal && c.reg.goal !== 'none' ? await applyGoal(c.campaign.id, c.reg.goal) : 0;
  const r = await sendBatch({ campaignId: c.campaign.id, userId: adminUserId, kind });
  return { ...r, stoppedByGoal };
}

/** One copy of email `step` to the admin's own address, with a real link and marked [TEST]. Records nothing. */
export async function sendTest(adminUserId: string, adminEmail: string, adminName: string | null, id: string, step: number): Promise<{ ok: true } | { error: string }> {
  const c = await loadCampaign(adminUserId, id);
  if (!c?.campaign || !c.reg || !c.automation) return { error: 'Campaign not found' };
  const e = c.automation.emails[step]; if (!e) return { error: 'Choose which email.' };
  const mailbox = await loadMailbox(adminUserId);
  if (!mailbox) return { error: 'No mailbox is set up for sending. The server needs its SMTP settings (and your address must be on the admin list).' };
  const appUrl = getAppUrl();
  const lead = { email: adminEmail, name: adminName ?? undefined, website: linkFor(c.reg.linkPath) };
  const built = buildEmail({ subject: e.subject, body: e.body, lead, sender: mailbox.sender, unsubscribeUrl: `${appUrl}/api/oc/unsubscribe?t=preview`, originalSubject: renderTemplate(c.automation.emails[0].subject, lead) });
  try {
    const from = mailbox.fromName ? `"${mailbox.fromName}" <${mailbox.fromAddress}>` : mailbox.fromAddress;
    await mailbox.transport.sendMail({ from, to: adminEmail, replyTo: mailbox.replyTo, subject: `[TEST] ${built.subject}`, text: built.text, html: built.html });
    return { ok: true };
  } catch (err) { return { error: err instanceof Error ? err.message.slice(0, 300) : 'Could not send the test email.' }; }
}

/** The email exactly as people will get it, for the preview pane. */
export async function renderPreview(adminUserId: string, e: { subject: string; body: string }, linkPath: string, firstSubject: string) {
  const mailbox = await loadMailbox(adminUserId).catch(() => null);
  const appUrl = getAppUrl(); const lead = { email: 'ada@example.com', name: 'Ada Obi', website: linkFor(linkPath) };
  const sender = mailbox?.sender ?? { name: 'The RUNVAX team' };
  const built = buildEmail({ subject: e.subject, body: e.body, lead, sender, unsubscribeUrl: `${appUrl}/api/oc/unsubscribe?t=preview`, originalSubject: renderTemplate(firstSubject, lead) });
  return { subject: built.subject, html: built.html, text: built.text };
}

export async function checkReplies(adminUserId: string) { return checkInbox(adminUserId); }

/** Edit the wording, goal, link or name. Wording applies to emails not yet sent; emails already sent are history. */
export async function updateCampaign(adminUserId: string, adminEmail: string, id: string, patch: { name?: unknown; plan?: unknown }): Promise<{ ok: true } | { error: string }> {
  const c = await loadCampaign(adminUserId, id);
  if (!c?.campaign || !c.reg) return { error: 'Campaign not found' };
  const reg: Registry = { ...c.reg };
  let name = c.row.name; const notes: string[] = [];
  if (typeof patch.name === 'string' && cleanText(patch.name, 120) && cleanText(patch.name, 120) !== name) { name = cleanText(patch.name, 120); notes.push('renamed'); }
  if (patch.plan !== undefined) {
    const p = sanitizePlan({ ...(patch.plan as object), segment: c.reg.segment, purpose: c.reg.purpose });
    if (!p) return { error: 'Add at least one email with a subject and a message.' };
    const problems = planProblems(p); if (problems.length) return { error: problems[0] };
    const f = toCampaignFields(p.automation);
    await prisma.outreachCampaign.update({ where: { id: c.campaign.id }, data: { name, subject: f.subject, body: f.body, followUpSubject: f.followUpSubject, followUpBody: f.followUpBody, followUpAfterDays: f.followUpAfterDays, maxFollowUps: f.maxFollowUps, dailyCap: f.dailyCap, automation: { ...p.automation, name } as unknown as object } });
    if (p.linkPath !== reg.linkPath) await prisma.outreachLead.updateMany({ where: { campaignId: c.campaign.id }, data: { website: linkFor(p.linkPath) } });
    reg.goal = p.goal; reg.stopOnGoal = p.stopOnGoal; reg.linkPath = p.linkPath; notes.push('emails or settings edited');
  } else if (name !== c.row.name) {
    await prisma.outreachCampaign.update({ where: { id: c.campaign.id }, data: { name } });
  }
  if (!notes.length) return { error: 'Nothing to change.' };
  await prisma.platformCampaign.update({ where: { id }, data: { name, config: reg as unknown as object } });
  await prisma.adminAuditLog.create({ data: { actorEmail: adminEmail, action: 'platform_campaign_updated', title: `Updated campaign "${name}"`, detail: notes.join(', ') } }).catch(() => {});
  return { ok: true };
}

/** Only a campaign that has never sent can be deleted. */
export async function deleteCampaign(adminUserId: string, adminEmail: string, id: string): Promise<{ ok: true } | { error: string; status?: number }> {
  const row = await prisma.platformCampaign.findUnique({ where: { id } });
  if (!row) return { error: 'Campaign not found', status: 404 };
  const reg = parseRegistry(row.config);
  if (reg) {
    const sent = await prisma.outreachLead.count({ where: { campaignId: reg.outreachCampaignId, userId: adminUserId, sentAt: { not: null } } });
    if (sent > 0) return { error: 'This campaign has already sent email, so it is kept for the record. Mark it finished instead.', status: 409 };
    await prisma.outreachCampaign.deleteMany({ where: { id: reg.outreachCampaignId, userId: adminUserId } });
  } else {
    const legacySent = await prisma.lifecycleEmail.count({ where: { key: { startsWith: `pc:${id}:` } } });
    if (legacySent > 0) return { error: 'This campaign has already sent email, so it is kept for the record.', status: 409 };
  }
  await prisma.platformCampaign.delete({ where: { id } });
  await prisma.adminAuditLog.create({ data: { actorEmail: adminEmail, action: 'platform_campaign_deleted', title: `Deleted campaign "${row.name}"` } }).catch(() => {});
  return { ok: true };
}

// ───────────────────────── drafting with AI ─────────────────────────

export const aiAvailable = () => hasProvider(providerFor('automation')) || hasProvider('openai');

/** Drafts with the same AI planner the customer builder uses. Returns null (the caller falls back to the built-in writer) on any problem. */
export async function draftWithAi(purpose: Purpose, detail: string): Promise<PlatformPlan | null> {
  if (!aiAvailable()) return null;
  try {
    const base = planCampaign(purpose, detail, (await getSiteSettings()).trialDays);
    const meta = PURPOSES.find((p) => p.id === purpose)!;
    const brief = { ...base.automation.brief!, offer: 'RUNVAX', audience: 'people who already have a RUNVAX account', goal: meta.label, signOff: 'The RUNVAX team' };
    const prompt = [
      `Write a short email campaign from the RUNVAX team to existing RUNVAX account holders. Purpose: ${meta.label}.`,
      cleanText(detail, 400) ? `What to tell them: ${cleanText(detail, 400)}` : 'Keep it general and honest.',
      'These are existing users, not cold prospects: do not pitch RUNVAX as if they had never heard of it. Use {{name}} for their first name and {{website}} for the one link (the page the email wants them to open). Never invent numbers, discounts or features.',
    ].join('\n');
    const r = await planAutomation(prompt, null, { useAi: true, brief });
    if (r.source !== 'ai') return null;
    const plan = sanitizePlan({ ...base, name: r.automation.name || base.name, automation: { ...r.automation, brief, playbook: r.automation.playbook ?? defaultPlaybook(brief, 'Best regards,') } });
    return plan && planProblems(plan).length === 0 ? plan : null;
  } catch (e) {
    console.error('[platform-campaign] AI draft failed, using the built-in writer', e instanceof Error ? e.message : e);
    return null;
  }
}

export { firstName };
