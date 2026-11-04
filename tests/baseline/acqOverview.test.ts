import { describe, it, expect } from 'vitest';
import { activityFeed, campaignRows, computeOverview, dayKey, engagementOf, pctChange, timeAgo, timeAgoShort, topLeads, type OvCampaign, type OvLead } from '@/lib/acqOverview';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 28, 12);
const ago = (d: number, h = 0) => new Date(NOW - d * DAY - h * 3_600_000);
let n = 0;
const lead = (over: Partial<OvLead> = {}): OvLead => ({ id: `l${++n}`, campaignId: 'c1', email: `p${n}@x.com`, status: 'queued', createdAt: ago(20), ...over });
const sent = (over: Partial<OvLead> = {}) => lead({ status: 'sent', sentAt: ago(2), lastSentAt: ago(2), ...over });
const campaigns: OvCampaign[] = [
  { id: 'c1', name: 'Dental', status: 'running', dailyCap: 30, createdAt: ago(10), startedAt: ago(9) },
  { id: 'c2', name: 'Law', status: 'completed', dailyCap: 20, createdAt: ago(30), startedAt: ago(29) },
  { id: 'c3', name: 'Hotels', status: 'draft', dailyCap: 50, createdAt: ago(1) },
  { id: 'c4', name: 'Salons', status: 'paused', dailyCap: 10, createdAt: ago(5), startedAt: ago(4) },
];

describe('pctChange', () => {
  it('compares to the previous period and refuses to divide by zero', () => {
    expect(pctChange(112, 100)).toBe(12);
    expect(pctChange(50, 100)).toBe(-50);
    expect(pctChange(5, 0)).toBeNull();
  });
});

describe('dayKey', () => {
  it('buckets by the viewer calendar day', () => {
    const t = Date.UTC(2026, 9, 28, 23, 30);
    expect(dayKey(t, 0)).toBe('2026-10-28');
    expect(dayKey(t, -60)).toBe('2026-10-29');   // UTC+1: already tomorrow
    expect(dayKey(t, 300)).toBe('2026-10-28');    // UTC-5
  });
});

describe('engagement', () => {
  it('ranks interested > replied > clicked > opened > sent, and ignores unsent', () => {
    const e = (o: Partial<OvLead>) => engagementOf(sent(o))?.status;
    expect(e({ repliedAt: ago(1), outcome: 'interested' })).toBe('Interested');
    expect(e({ repliedAt: ago(1) })).toBe('Replied');
    expect(e({ clickedAt: ago(1), openedAt: ago(1) })).toBe('Clicked');
    expect(e({ openedAt: ago(1) })).toBe('Opened');
    expect(e({})).toBe('Sent');
    expect(engagementOf(lead())).toBeNull();
  });
  it('topLeads orders by engagement, then opens, then recency, and skips unsent', () => {
    const a = sent({ business: 'A', openedAt: ago(1), openCount: 2 });
    const b = sent({ business: 'B', openedAt: ago(1), openCount: 5 });
    const c = sent({ business: 'C', repliedAt: ago(1), outcome: 'interested' });
    const d = lead({ business: 'D' });
    const top = topLeads([a, b, c, d], 5);
    expect(top.map((t) => t.business)).toEqual(['C', 'B', 'A']);
    expect(top[0]).toMatchObject({ status: 'Interested', email: c.email });
  });
  it('falls back to the person or domain when a lead has no business name', () => {
    expect(topLeads([sent({ name: 'Ada', business: null })])[0].business).toBe('Ada');
    expect(topLeads([sent({ email: 'x@clinic.ng' })])[0].business).toBe('clinic.ng');
  });
});

describe('activity feed', () => {
  it('lists real events newest first with the right labels', () => {
    const l = sent({ business: 'Bright Smile', createdAt: ago(5), sentAt: ago(4), lastSentAt: ago(4), openedAt: ago(3), clickedAt: ago(2), repliedAt: ago(1), outcome: 'interested' });
    const feed = activityFeed([l], campaigns, 10);
    expect(feed.map((e) => e.type)).toEqual(['replied', 'clicked', 'opened', 'sent', 'imported']);
    expect(feed[0]).toMatchObject({ pill: 'Interested', text: `Reply received from ${l.email}`, campaignName: 'Dental' });
    expect(feed[4].text).toBe('New lead imported: Bright Smile');
  });
  it('shows a follow-up as its own event, and respects the limit', () => {
    const l = sent({ sentAt: ago(6), lastSentAt: ago(1), followUpsSent: 1 });
    expect(activityFeed([l], campaigns, 10).some((e) => e.type === 'followup')).toBe(true);
    expect(activityFeed([l], campaigns, 2)).toHaveLength(2);
  });
});

describe('campaign rows', () => {
  it('computes progress and rates, and sorts running first', () => {
    const leads = [
      sent({ openedAt: ago(1) }), sent({ openedAt: ago(1), repliedAt: ago(1) }), sent(), lead(),
      sent({ campaignId: 'c2' }),
    ];
    const rows = campaignRows(leads, campaigns);
    expect(rows.map((r) => r.id)).toEqual(['c1', 'c4', 'c3', 'c2']);
    expect(rows[0]).toMatchObject({ leads: 4, sent: 3, progressPct: 75, openedPct: 67, repliedPct: 33 });
    expect(rows[1]).toMatchObject({ leads: 0, sent: 0, progressPct: 0 });
  });
});

describe('computeOverview', () => {
  const leads: OvLead[] = [
    sent({ createdAt: ago(1), sentAt: ago(0, 2), lastSentAt: ago(0, 2), openedAt: ago(0, 1), clickedAt: ago(0, 1) }),
    sent({ createdAt: ago(2), sentAt: ago(1), lastSentAt: ago(1), openedAt: ago(1), repliedAt: ago(0, 3), outcome: 'interested' }),
    sent({ createdAt: ago(3), sentAt: ago(9), lastSentAt: ago(9) }),
    sent({ createdAt: ago(10), sentAt: ago(9), lastSentAt: ago(9), repliedAt: ago(8) }),
    lead({ status: 'failed', createdAt: ago(1), error: 'x' } as Partial<OvLead>),
    lead({ createdAt: ago(1) }),
    lead({ createdAt: ago(40) }),
  ];
  const o = computeOverview(leads, campaigns, { now: NOW, days: 14 });

  it('counts the cards from real data', () => {
    expect(o.cards).toMatchObject({
      totalLeads: 7, leadsThisWeek: 5, emailsSent: 5, delivered: 4, opened: 2, clicked: 1, replies: 2, interested: 1,
    });
    expect(o.cards.deliveredRate).toBe(80);
    expect(o.cards.openRate).toBe(50);
    expect(o.cards.clickRate).toBe(25);
    expect(o.cards.replyRate).toBe(50);
    expect(o.cards.leadsGrowthPct).toBe(400);
    expect(o.cards.sentGrowthPct).toBe(0);
  });
  it('builds one point per day, oldest first, with the days summed correctly', () => {
    expect(o.series).toHaveLength(14);
    expect(o.series[13].date).toBe('2026-10-28');
    expect(o.series[0].date).toBe('2026-10-15');
    expect(o.series.reduce((s, p) => s + p.sent, 0)).toBe(4);
    expect(o.series.reduce((s, p) => s + p.replied, 0)).toBe(2);
    expect(o.series[13]).toMatchObject({ sent: 1, opened: 1, replied: 1 });
  });
  it('knows what is sent today, the limit, and how many replies await a decision', () => {
    expect(o.sending).toEqual({ today: 1, limit: 30 });
    expect(o.inboxCount).toBe(1);
    expect(o.runningCampaigns).toBe(1);
    expect(computeOverview([], [{ ...campaigns[0], status: 'paused' }], { now: NOW }).sending.limit).toBe(200);
  });
  it('is all zeros for a new account without dividing by zero', () => {
    const e = computeOverview([], [], { now: NOW });
    expect(e.cards).toMatchObject({ totalLeads: 0, emailsSent: 0, openRate: 0, replyRate: 0, leadsGrowthPct: null });
    expect(e.topLeads).toEqual([]);
    expect(e.activity).toEqual([]);
  });
});

describe('time labels', () => {
  it('reads naturally', () => {
    expect(timeAgo(new Date(NOW - 10_000), NOW)).toBe('just now');
    expect(timeAgo(new Date(NOW - 2 * 60_000), NOW)).toBe('2 minutes ago');
    expect(timeAgo(new Date(NOW - 3_600_000), NOW)).toBe('1 hour ago');
    expect(timeAgo(new Date(NOW - 5 * DAY), NOW)).toBe('5 days ago');
    expect(timeAgoShort(new Date(NOW - 2 * 3_600_000), NOW)).toBe('2h ago');
    expect(timeAgoShort(new Date(NOW - 26 * 3_600_000), NOW)).toBe('1d ago');
    expect(timeAgo(null, NOW)).toBe('—');
  });
});

import { leadStage } from '@/lib/acqOverview';
describe('leadStage', () => {
  it('labels leads for the lists, worst news first', () => {
    expect(leadStage(lead())).toBe('queued');
    expect(leadStage(sent())).toBe('sent');
    expect(leadStage(sent({ openedAt: ago(1) }))).toBe('opened');
    expect(leadStage(sent({ clickedAt: ago(1) }))).toBe('clicked');
    expect(leadStage(sent({ repliedAt: ago(1) }))).toBe('replied');
    expect(leadStage(sent({ repliedAt: ago(1), outcome: 'interested' }))).toBe('interested');
    expect(leadStage(lead({ status: 'failed' }))).toBe('failed');
    expect(leadStage(sent({ status: 'unsubscribed', repliedAt: ago(1) }))).toBe('unsubscribed');
  });
});
