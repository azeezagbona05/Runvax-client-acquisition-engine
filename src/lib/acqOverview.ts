/**
 * Everything the Client Acquisition dashboard shows, computed from a user's leads and campaigns.
 * Pure (no database), so the numbers are testable and the page, the API and the lists all agree.
 */

export interface OvLead {
  id: string;
  campaignId: string;
  email: string;
  name?: string | null;
  business?: string | null;
  website?: string | null;
  status: string;
  stage?: string | null;
  pausedUntil?: Date | string | null;
  replyClass?: string | null;
  sentAt?: Date | string | null;
  lastSentAt?: Date | string | null;
  openedAt?: Date | string | null;
  openCount?: number;
  clickedAt?: Date | string | null;
  repliedAt?: Date | string | null;
  outcome?: string | null;
  unsubscribedAt?: Date | string | null;
  followUpsSent?: number;
  createdAt: Date | string;
}

export interface OvCampaign {
  id: string;
  name: string;
  status: string;
  dailyCap: number;
  startedAt?: Date | string | null;
  createdAt: Date | string;
}

const DAY = 86_400_000;
const ms = (d: Date | string | null | undefined): number => (d ? new Date(d).getTime() : NaN);
const has = (d: Date | string | null | undefined) => Number.isFinite(ms(d));

/** Percent change from `prev` to `cur`; null when there is nothing to compare against. */
export function pctChange(cur: number, prev: number): number | null {
  if (prev <= 0) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

/** Calendar day (YYYY-MM-DD) of a timestamp in the viewer's timezone. `tz` is Date#getTimezoneOffset (minutes, UTC minus local). */
export function dayKey(t: number, tz = 0): string {
  return new Date(t - tz * 60_000).toISOString().slice(0, 10);
}

// ── Engagement ───────────────────────────────────────────────────────────────

export type EngagementStatus = 'Interested' | 'Replied' | 'Clicked' | 'Opened' | 'Sent';

export function engagementOf(l: OvLead): { score: number; status: EngagementStatus } | null {
  if (has(l.repliedAt) && l.outcome === 'interested') return { score: 5, status: 'Interested' };
  if (has(l.repliedAt)) return { score: 4, status: 'Replied' };
  if (has(l.clickedAt)) return { score: 3, status: 'Clicked' };
  if (has(l.openedAt)) return { score: 2, status: 'Opened' };
  if (has(l.sentAt)) return { score: 1, status: 'Sent' };
  return null;
}

export type LeadListStage = 'all' | 'queued' | 'sent' | 'opened' | 'clicked' | 'replied' | 'interested' | 'failed' | 'unsubscribed';

/** The one label a lead shows in lists, most advanced state first. */
export function leadStage(l: OvLead): Exclude<LeadListStage, 'all'> {
  if (l.unsubscribedAt || l.status === 'unsubscribed') return 'unsubscribed';
  if (l.status === 'failed') return 'failed';
  const e = engagementOf(l);
  return e ? (e.status.toLowerCase() as Exclude<LeadListStage, 'all'>) : 'queued';
}

/** The latest thing that happened with this lead. */
export function lastActivityAt(l: OvLead): number {
  const times = [l.sentAt, l.lastSentAt, l.openedAt, l.clickedAt, l.repliedAt, l.createdAt].map(ms).filter(Number.isFinite);
  return times.length ? Math.max(...times) : 0;
}

export interface TopLead {
  id: string;
  campaignId: string;
  business: string;
  email: string;
  website: string | null;
  status: EngagementStatus;
  opens: number;
  lastActivityAt: string;
}

export function topLeads(leads: OvLead[], n = 5): TopLead[] {
  return leads
    .map((l) => ({ l, e: engagementOf(l) }))
    .filter((x): x is { l: OvLead; e: NonNullable<ReturnType<typeof engagementOf>> } => x.e !== null)
    .sort((a, b) => b.e.score - a.e.score || (b.l.openCount ?? 0) - (a.l.openCount ?? 0) || lastActivityAt(b.l) - lastActivityAt(a.l))
    .slice(0, n)
    .map(({ l, e }) => ({
      id: l.id, campaignId: l.campaignId, email: l.email,
      business: l.business?.trim() || l.name?.trim() || l.email.split('@')[1] || l.email,
      website: l.website ?? null, status: e.status, opens: l.openCount ?? 0,
      lastActivityAt: new Date(lastActivityAt(l)).toISOString(),
    }));
}

// ── Activity feed ────────────────────────────────────────────────────────────

export type ActivityType = 'sent' | 'followup' | 'opened' | 'clicked' | 'replied' | 'imported';
export type ActivityPill = 'Delivered' | 'Opened' | 'Clicked' | 'Interested' | 'Replied' | 'Imported';

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  at: string;
  text: string;
  email: string;
  campaignId: string;
  campaignName: string;
  pill: ActivityPill;
}

export function activityFeed(leads: OvLead[], campaigns: Array<Pick<OvCampaign, 'id' | 'name'>>, limit = 5): ActivityEvent[] {
  const names = new Map(campaigns.map((c) => [c.id, c.name]));
  const events: ActivityEvent[] = [];
  const push = (l: OvLead, type: ActivityType, at: Date | string | null | undefined, text: string, pill: ActivityPill) => {
    if (!has(at)) return;
    events.push({ id: `${l.id}:${type}`, type, at: new Date(at as string).toISOString(), text, email: l.email, campaignId: l.campaignId, campaignName: names.get(l.campaignId) ?? 'Campaign', pill });
  };
  for (const l of leads) {
    push(l, 'imported', l.createdAt, `New lead imported: ${l.business?.trim() || l.email}`, 'Imported');
    push(l, 'sent', l.sentAt, `Email sent to ${l.email}`, 'Delivered');
    if ((l.followUpsSent ?? 0) > 0 && has(l.lastSentAt) && ms(l.lastSentAt) !== ms(l.sentAt)) {
      push(l, 'followup', l.lastSentAt, `Follow-up sent to ${l.email}`, 'Delivered');
    }
    push(l, 'opened', l.openedAt, `Email opened by ${l.email}`, 'Opened');
    push(l, 'clicked', l.clickedAt, `Link clicked by ${l.email}`, 'Clicked');
    push(l, 'replied', l.repliedAt, `Reply received from ${l.email}`, l.outcome === 'interested' ? 'Interested' : 'Replied');
  }
  return events.sort((a, b) => ms(b.at) - ms(a.at)).slice(0, limit);
}

// ── Campaign rows ────────────────────────────────────────────────────────────

export interface CampaignRow {
  id: string;
  name: string;
  status: string;
  dailyCap: number;
  leads: number;
  sent: number;
  openedPct: number;
  repliedPct: number;
  /** Share of the list already emailed, 0–100. */
  progressPct: number;
  startedAt: string | null;
  createdAt: string;
}

const STATUS_ORDER: Record<string, number> = { running: 0, paused: 1, draft: 2, completed: 3 };

export function campaignRows(leads: OvLead[], campaigns: OvCampaign[]): CampaignRow[] {
  const agg = new Map<string, { leads: number; sent: number; opened: number; replied: number }>();
  for (const l of leads) {
    const a = agg.get(l.campaignId) ?? { leads: 0, sent: 0, opened: 0, replied: 0 };
    a.leads++;
    if (has(l.sentAt)) { a.sent++; if (has(l.openedAt)) a.opened++; }
    if (has(l.repliedAt)) a.replied++;
    agg.set(l.campaignId, a);
  }
  return campaigns
    .map((c) => {
      const a = agg.get(c.id) ?? { leads: 0, sent: 0, opened: 0, replied: 0 };
      return {
        id: c.id, name: c.name, status: c.status, dailyCap: c.dailyCap, leads: a.leads, sent: a.sent,
        openedPct: Math.round(pct(a.opened, a.sent)), repliedPct: Math.round(pct(a.replied, a.sent)),
        progressPct: a.leads ? Math.round((a.sent / a.leads) * 100) : 0,
        startedAt: c.startedAt ? new Date(c.startedAt).toISOString() : null, createdAt: new Date(c.createdAt).toISOString(),
      };
    })
    .sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || ms(b.createdAt) - ms(a.createdAt));
}

// ── The dashboard ────────────────────────────────────────────────────────────

export interface SeriesPoint { date: string; sent: number; opened: number; replied: number }

export interface Overview {
  cards: {
    totalLeads: number; leadsThisWeek: number; leadsGrowthPct: number | null;
    emailsSent: number; sentGrowthPct: number | null; sentOfLeads: number;
    delivered: number; deliveredRate: number;
    opened: number; openRate: number;
    clicked: number; clickRate: number;
    replies: number; replyRate: number; interested: number;
  };
  series: SeriesPoint[];
  campaigns: CampaignRow[];
  topLeads: TopLead[];
  activity: ActivityEvent[];
  sending: { today: number; limit: number };
  /** Replies still waiting for a decision (interested or not): the Inbox badge. */
  inboxCount: number;
  runningCampaigns: number;
}

export function computeOverview(
  leads: OvLead[], campaigns: OvCampaign[],
  opts: { now?: number; days?: number; tz?: number; hardDailyMax?: number } = {},
): Overview {
  const now = opts.now ?? Date.now();
  const days = Math.min(90, Math.max(1, opts.days ?? 14));
  const tz = opts.tz ?? 0;
  const hardMax = opts.hardDailyMax ?? 200;

  const inWindow = (t: number, from: number, to: number) => Number.isFinite(t) && t >= from && t < to;
  const wk = now - 7 * DAY;
  const wk2 = now - 14 * DAY;

  const failed = leads.filter((l) => l.status === 'failed' && !has(l.sentAt)).length;
  const sentLeads = leads.filter((l) => has(l.sentAt));
  const delivered = sentLeads.length;
  const attempted = delivered + failed;
  const opened = sentLeads.filter((l) => has(l.openedAt)).length;
  const clicked = sentLeads.filter((l) => has(l.clickedAt)).length;
  const replied = leads.filter((l) => has(l.repliedAt));
  const interested = replied.filter((l) => l.outcome === 'interested').length;

  const leadsThisWeek = leads.filter((l) => inWindow(ms(l.createdAt), wk, now + 1)).length;
  const leadsPrevWeek = leads.filter((l) => inWindow(ms(l.createdAt), wk2, wk)).length;
  const sentThisWeek = sentLeads.filter((l) => inWindow(ms(l.sentAt), wk, now + 1)).length;
  const sentPrevWeek = sentLeads.filter((l) => inWindow(ms(l.sentAt), wk2, wk)).length;

  // Daily series, oldest first, with a point for every day even when nothing happened.
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) keys.push(dayKey(now - i * DAY, tz));
  const idx = new Map(keys.map((k, i) => [k, i]));
  const series: SeriesPoint[] = keys.map((date) => ({ date, sent: 0, opened: 0, replied: 0 }));
  const bump = (t: Date | string | null | undefined, field: 'sent' | 'opened' | 'replied') => {
    if (!has(t)) return;
    const i = idx.get(dayKey(ms(t), tz));
    if (i !== undefined) series[i][field]++;
  };
  for (const l of leads) { bump(l.sentAt, 'sent'); bump(l.openedAt, 'opened'); bump(l.repliedAt, 'replied'); }

  const todayKey = dayKey(now, tz);
  const today = leads.filter((l) => has(l.lastSentAt) && dayKey(ms(l.lastSentAt), tz) === todayKey).length;
  const running = campaigns.filter((c) => c.status === 'running');
  const limit = running.length ? Math.min(hardMax, running.reduce((s, c) => s + c.dailyCap, 0)) : hardMax;

  return {
    cards: {
      totalLeads: leads.length, leadsThisWeek, leadsGrowthPct: pctChange(leadsThisWeek, leadsPrevWeek),
      emailsSent: attempted, sentGrowthPct: pctChange(sentThisWeek, sentPrevWeek), sentOfLeads: leads.length,
      delivered, deliveredRate: pct(delivered, attempted),
      opened, openRate: pct(opened, delivered),
      clicked, clickRate: pct(clicked, delivered),
      replies: replied.length, replyRate: pct(replied.length, delivered), interested,
    },
    series,
    campaigns: campaignRows(leads, campaigns),
    topLeads: topLeads(leads, 5),
    activity: activityFeed(leads, campaigns, 5),
    sending: { today, limit },
    inboxCount: replied.filter((l) => !l.outcome).length,
    runningCampaigns: running.length,
  };
}

/** "2 minutes ago", "1 hour ago", "3d ago"-style label for the lists. */
export function timeAgo(iso: string | Date | null | undefined, now = Date.now()): string {
  const t = ms(iso);
  if (!Number.isFinite(t)) return '—';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return m === 1 ? '1 minute ago' : `${m} minutes ago`;
  const h = Math.round(m / 60);
  if (h < 24) return h === 1 ? '1 hour ago' : `${h} hours ago`;
  const d = Math.round(h / 24);
  if (d < 14) return d === 1 ? '1 day ago' : `${d} days ago`;
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Compact version for table cells: "2h ago", "1d ago". */
export function timeAgoShort(iso: string | Date | null | undefined, now = Date.now()): string {
  const t = ms(iso);
  if (!Number.isFinite(t)) return '—';
  const m = Math.round(Math.max(0, now - t) / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 14 ? `${d}d ago` : new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
