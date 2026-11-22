/**
 * Results and revenue for Client Acquisition: how many people each campaign reached, how many answered, how many became
 * meetings, proposals and paying customers, and how much money that is. Pure (no database), built only from what is
 * recorded on each contact. Revenue is the deal value of contacts marked "customer": nothing is estimated or invented.
 */

export interface ResLead {
  campaignId: string;
  status: string;
  sentAt?: Date | string | null;
  openedAt?: Date | string | null;
  repliedAt?: Date | string | null;
  outcome?: string | null;
  stage?: string | null;
  demoAt?: Date | string | null;
  closedAt?: Date | string | null;
  dealValue?: number | null;
}
export interface ResCampaign { id: string; name: string; status: string }

export interface ResRow {
  id: string; name: string; status: string;
  leads: number; sent: number; opened: number; replied: number; interested: number;
  meetings: number; proposals: number; customers: number; lost: number;
  /** Money from contacts marked customer. */
  revenue: number;
  /** Value of deals still open (meeting booked or proposal sent) that have a value recorded. */
  openValue: number;
  /** Customers marked without a deal value, so the revenue above is a floor. */
  customersWithoutValue: number;
  avgDeal: number;
  /** Percentages of sent emails, one decimal. */
  replyRate: number; interestedRate: number; meetingRate: number; customerRate: number;
}

export interface FunnelStep { id: 'sent' | 'opened' | 'replied' | 'interested' | 'meeting' | 'proposal' | 'customer'; label: string; count: number; /** Share of the step before it, 0-100. */ ofPrevious: number }

const has = (d: Date | string | null | undefined) => !!d && Number.isFinite(new Date(d).getTime());
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
const MEETING = ['demo_booked', 'proposal_sent', 'customer'];

function blank(id: string, name: string, status: string): ResRow {
  return { id, name, status, leads: 0, sent: 0, opened: 0, replied: 0, interested: 0, meetings: 0, proposals: 0, customers: 0, lost: 0, revenue: 0, openValue: 0, customersWithoutValue: 0, avgDeal: 0, replyRate: 0, interestedRate: 0, meetingRate: 0, customerRate: 0 };
}

/** What one contact has reached. Later stages imply earlier ones, so the funnel never goes up as it goes down. */
export function reached(l: ResLead) {
  const customer = l.stage === 'customer';
  const proposal = customer || l.stage === 'proposal_sent';
  const meeting = proposal || l.stage === 'demo_booked' || (has(l.demoAt) && l.stage !== 'lost');
  const interested = meeting || (has(l.repliedAt) && l.outcome === 'interested');
  const replied = interested || has(l.repliedAt);
  const opened = replied || has(l.openedAt);
  const sent = opened || has(l.sentAt);
  return { sent, opened, replied, interested, meeting, proposal, customer };
}

function add(r: ResRow, l: ResLead) {
  const x = reached(l);
  r.leads++;
  if (x.sent) r.sent++;
  if (x.opened) r.opened++;
  if (x.replied) r.replied++;
  if (x.interested) r.interested++;
  if (x.meeting) r.meetings++;
  if (x.proposal) r.proposals++;
  if (x.customer) {
    r.customers++;
    if (typeof l.dealValue === 'number' && l.dealValue > 0) r.revenue += l.dealValue; else r.customersWithoutValue++;
  } else if (l.stage === 'lost') r.lost++;
  else if ((l.stage === 'demo_booked' || l.stage === 'proposal_sent') && typeof l.dealValue === 'number' && l.dealValue > 0) r.openValue += l.dealValue;
}

function finish(r: ResRow): ResRow {
  const paying = r.customers - r.customersWithoutValue;
  return { ...r, avgDeal: paying > 0 ? Math.round(r.revenue / paying) : 0, replyRate: pct(r.replied, r.sent), interestedRate: pct(r.interested, r.sent), meetingRate: pct(r.meetings, r.sent), customerRate: pct(r.customers, r.sent) };
}

export interface Results { totals: ResRow; rows: ResRow[]; funnel: FunnelStep[] }

export function computeResults(leads: ResLead[], campaigns: ResCampaign[]): Results {
  const byId = new Map<string, ResRow>(campaigns.map((c) => [c.id, blank(c.id, c.name, c.status)]));
  const totals = blank('all', 'All campaigns', '');
  for (const l of leads) {
    // A lead whose campaign is not in the list still counts in the totals.
    const row = byId.get(l.campaignId);
    if (row) add(row, l);
    add(totals, l);
  }
  const t = finish(totals);
  const steps: Array<[FunnelStep['id'], string, number]> = [
    ['sent', 'Emailed', t.sent], ['opened', 'Opened', t.opened], ['replied', 'Replied', t.replied], ['interested', 'Interested', t.interested],
    ['meeting', 'Meeting booked', t.meetings], ['proposal', 'Proposal sent', t.proposals], ['customer', 'Paying customer', t.customers],
  ];
  const funnel = steps.map(([id, label, count], i) => ({ id, label, count, ofPrevious: i === 0 ? 100 : pct(count, steps[i - 1][2]) }));
  const rows = Array.from(byId.values()).map(finish).filter((r) => r.leads > 0).sort((a, b) => b.revenue - a.revenue || b.customers - a.customers || b.replied - a.replied);
  return { totals: t, rows, funnel };
}

export const CURRENCIES = [{ code: 'NGN', symbol: '₦' }, { code: 'USD', symbol: '$' }, { code: 'GBP', symbol: '£' }, { code: 'GHS', symbol: 'GH₵' }, { code: 'KES', symbol: 'KSh ' }, { code: 'ZAR', symbol: 'R ' }];
export const money = (n: number, symbol: string) => `${symbol}${Math.round(n).toLocaleString('en-US')}`;
