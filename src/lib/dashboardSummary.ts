import { prisma } from '@/lib/prisma';
import { rankOpportunities } from '@/lib/opportunity/rank';
import { detectOpportunities } from '@/lib/opportunity/detect';
import type { Business } from '@/types';

const DAY = 24 * 60 * 60 * 1000;
const NEW_WINDOW_DAYS = 7;
const WON_WINDOW_DAYS = 30;
const NO_REPLY_AFTER_DAYS = 3;
const ACTIVITY_WINDOW_DAYS = 14;
const OPEN_STAGES_EXCLUDED = ['won', 'lost'];

export interface DashboardOpportunity {
  prospectId: string;
  name: string;
  category: string;
  location: string | null;
  websiteStatus: string;
  problem: string;
  offer: string;
  evidence: string[];
  confidence: 'low' | 'medium' | 'high';
  band: string;
  score: number;
  contact: string;
  stage: string;
  lastActivity: string;
  draftId: string | null;
  business: Business;
}

export interface FollowUpItem {
  prospectId: string;
  name: string;
  kind: 'reply' | 'overdue' | 'no_reply';
  label: string;
  detail: string | null;
  at: string;
}

export interface ActivityItem {
  id: string;
  kind: 'discovered' | 'pitch' | 'sent';
  title: string;
  count: number;
  at: string;
}

export interface DashboardSummary {
  metrics: {
    newOpportunities: number;
    pitchesReady: number;
    repliesToFollowUp: number;
    dealsInProgress: number;
    clientsWon: number;
  };
  opportunities: DashboardOpportunity[];
  followUps: FollowUpItem[];
  activity: ActivityItem[];
}

function contactLabel(b: Business): string {
  if (b.email && b.emailVerified === 'valid') return 'Verified email';
  if (b.email) return 'Email found (unverified)';
  if (b.phone) return 'Phone only';
  return 'No contact route yet';
}

function websiteStatus(b: Business): string {
  if (!b.hasWebsite) return 'No website listed on Google';
  if (typeof b.psiScore === 'number') return `Has a website · mobile speed ${b.psiScore}/100`;
  return 'Has a website';
}

function lastEntry(raw: { content: string; type: string; channel: string; replyType: string | null; createdAt: Date } | undefined) {
  if (!raw) return null;
  let text: string | null = null;
  try {
    const parsed = JSON.parse(raw.content) as { content?: string };
    text = parsed.content?.trim() || null;
  } catch { text = raw.content?.trim() || null; }
  return { ...raw, text };
}

export async function getDashboardSummary(userId: string): Promise<DashboardSummary> {
  const now = Date.now();
  const todayStr = new Date(now).toISOString().split('T')[0];

  const [prospects, pendingDrafts, activityRows] = await Promise.all([
    prisma.prospect.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 500,
      select: {
        id: true, businessId: true, businessName: true, businessData: true, stage: true,
        savedAt: true, updatedAt: true, outreachSentAt: true, reminderDate: true, reminderNote: true,
        conversations: {
          orderBy: { createdAt: 'desc' }, take: 1,
          select: { type: true, channel: true, replyType: true, content: true, createdAt: true },
        },
      },
    }),
    prisma.outreachDraft.findMany({
      where: { userId, status: 'pending' },
      select: { id: true, prospectId: true },
    }),
    prisma.agentActivity.findMany({
      where: {
        userId,
        createdAt: { gte: new Date(now - ACTIVITY_WINDOW_DAYS * DAY) },
        action: { in: ['opportunity_flagged', 'draft_prepared', 'message_sent', 'campaign_imported', 'auto_scan_completed'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 120,
      select: { id: true, action: true, title: true, createdAt: true },
    }),
  ]);

  const draftByProspect = new Map(pendingDrafts.map((d) => [d.prospectId, d.id]));

  // ── Metrics ────────────────────────────────────────────────────────────────
  const newSince = now - NEW_WINDOW_DAYS * DAY;
  const wonSince = now - WON_WINDOW_DAYS * DAY;
  let newOpportunities = 0;
  let repliesToFollowUp = 0;
  let dealsInProgress = 0;
  let clientsWon = 0;
  const followUps: Array<FollowUpItem & { priority: number }> = [];

  for (const p of prospects) {
    const business = p.businessData as unknown as Business;
    const last = lastEntry(p.conversations[0]);
    const open = !OPEN_STAGES_EXCLUDED.includes(p.stage);

    if (p.savedAt.getTime() >= newSince && detectOpportunities(business).primary) newOpportunities++;
    if (p.stage === 'interested' || p.stage === 'proposal') dealsInProgress++;
    if (p.stage === 'won' && p.updatedAt.getTime() >= wonSince) clientsWon++;
    if (!open) continue;

    if (last?.type === 'received') {
      repliesToFollowUp++;
      followUps.push({
        prospectId: p.id, name: p.businessName, kind: 'reply', priority: 0,
        label: last.replyType ? `Replied — ${last.replyType.replace(/_/g, ' ')}` : 'Replied',
        detail: last.text ? last.text.slice(0, 140) : null,
        at: last.createdAt.toISOString(),
      });
    } else if (p.reminderDate && p.reminderDate <= todayStr) {
      followUps.push({
        prospectId: p.id, name: p.businessName, kind: 'overdue', priority: 1,
        label: p.reminderDate < todayStr ? 'Follow-up overdue' : 'Follow-up due today',
        detail: p.reminderNote ?? null,
        at: p.reminderDate,
      });
    } else if (
      p.outreachSentAt && last?.type !== 'received' &&
      now - p.outreachSentAt.getTime() >= NO_REPLY_AFTER_DAYS * DAY
    ) {
      const days = Math.floor((now - p.outreachSentAt.getTime()) / DAY);
      followUps.push({
        prospectId: p.id, name: p.businessName, kind: 'no_reply', priority: 2,
        label: `No reply after ${days} days`, detail: null,
        at: p.outreachSentAt.toISOString(),
      });
    }
  }

  followUps.sort((a, b) => a.priority - b.priority || (a.at < b.at ? 1 : -1));

  // ── Ranked opportunities (unworked prospects only) ─────────────────────────
  const unworked = prospects.filter((p) => p.stage === 'found');
  const byBusinessId = new Map<string, (typeof prospects)[number]>();
  for (const p of unworked) {
    byBusinessId.set(p.businessId, p);
    const bd = p.businessData as unknown as Business;
    if (bd?.id) byBusinessId.set(bd.id, p);
  }
  const businesses = unworked.map((p) => p.businessData as unknown as Business);
  let ranked = rankOpportunities(businesses, { limit: 5 });
  // A strict credibility cut can return nothing for a young pipeline; relax it
  // rather than show an empty list next to prospects the user already saved.
  if (ranked.length === 0) ranked = rankOpportunities(businesses, { minStrength: 20, limit: 5 });

  const opportunities: DashboardOpportunity[] = [];
  for (const r of ranked) {
    const p = byBusinessId.get(r.business.id);
    if (!p) continue;
    const b = r.business;
    opportunities.push({
      prospectId: p.id,
      name: p.businessName,
      category: b.category,
      location: b.address || null,
      websiteStatus: websiteStatus(b),
      problem: r.opportunity.reason,
      offer: r.opportunity.title,
      evidence: r.opportunity.evidence.slice(0, 3),
      confidence: r.opportunity.confidence,
      band: r.opportunity.band,
      score: r.opportunity.score,
      contact: contactLabel(b),
      stage: p.stage,
      lastActivity: p.updatedAt.toISOString(),
      draftId: draftByProspect.get(p.id) ?? null,
      business: b,
    });
  }

  // ── Activity: customer-facing events only, repeats grouped per day ─────────
  const groups = new Map<string, ActivityItem>();
  const activity: ActivityItem[] = [];
  for (const row of activityRows) {
    const kind: ActivityItem['kind'] =
      row.action === 'message_sent' ? 'sent'
      : row.action === 'draft_prepared' ? 'pitch'
      : 'discovered';
    const day = row.createdAt.toISOString().split('T')[0];
    const key = `${kind}:${day}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
      existing.title = groupTitle(kind, existing.count);
      continue;
    }
    const item: ActivityItem = { id: row.id, kind, title: singleTitle(kind, row.title), count: 1, at: row.createdAt.toISOString() };
    groups.set(key, item);
    activity.push(item);
  }

  return {
    metrics: { newOpportunities, pitchesReady: pendingDrafts.length, repliesToFollowUp, dealsInProgress, clientsWon },
    opportunities,
    followUps: followUps.slice(0, 8).map(({ priority: _p, ...rest }) => rest),
    activity: activity.slice(0, 30),
  };
}

function groupTitle(kind: ActivityItem['kind'], n: number): string {
  if (kind === 'sent') return `${n} messages sent`;
  if (kind === 'pitch') return `${n} pitches prepared`;
  return `${n} new opportunities found`;
}

function singleTitle(kind: ActivityItem['kind'], raw: string): string {
  // Strip internal agent vocabulary from legacy titles.
  const cleaned = raw.replace(/\bto (Rex|Ava)\b/g, '').replace(/\b(Ava|Rex)\b/g, 'RUNVAX');
  if (kind === 'pitch') return cleaned.replace(/^Prepared a message for/, 'Pitch prepared for');
  if (kind === 'discovered') return cleaned.replace(/^Flagged /, 'Opportunity: ').replace(/^Found an opportunity at /, 'Opportunity: ');
  return cleaned;
}
