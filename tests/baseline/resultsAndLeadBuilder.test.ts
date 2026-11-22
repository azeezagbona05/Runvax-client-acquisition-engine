import { describe, it, expect } from 'vitest';
import { computeResults, reached } from '@/lib/acqResults';
import { segmentProspects, DEFAULT_SEGMENT } from '@/lib/leadBuilder';
import type { Business } from '@/types';

const T = new Date('2026-11-23T10:00:00Z');
describe('results and revenue', () => {
  const leads = [
    { campaignId: 'a', status: 'sent', sentAt: T },
    { campaignId: 'a', status: 'sent', sentAt: T, openedAt: T },
    { campaignId: 'a', status: 'sent', sentAt: T, repliedAt: T, outcome: 'interested' },
    { campaignId: 'a', status: 'sent', sentAt: T, repliedAt: T, outcome: 'interested', stage: 'demo_booked', dealValue: 399000 },
    { campaignId: 'a', status: 'sent', sentAt: T, stage: 'customer', dealValue: 399000 },
    { campaignId: 'a', status: 'sent', sentAt: T, stage: 'customer' },
    { campaignId: 'b', status: 'sent', sentAt: T, stage: 'lost', repliedAt: T, outcome: 'not_interested' },
    { campaignId: 'b', status: 'queued' },
  ];
  const r = computeResults(leads, [{ id: 'a', name: 'Dental', status: 'running' }, { id: 'b', name: 'Salons', status: 'running' }]);
  it('sums revenue only from customers with a value, and says how many have none', () => {
    expect(r.totals.revenue).toBe(399000);
    expect(r.totals.customers).toBe(2);
    expect(r.totals.customersWithoutValue).toBe(1);
    expect(r.totals.avgDeal).toBe(399000);
  });
  it('counts open deals separately from revenue', () => expect(r.totals.openValue).toBe(399000));
  it('a later stage implies the earlier ones, so the funnel only shrinks', () => {
    const c = r.funnel.map((s) => s.count);
    for (let i = 1; i < c.length; i++) expect(c[i]).toBeLessThanOrEqual(c[i - 1]);
    expect(r.funnel.find((s) => s.id === 'customer')?.count).toBe(2);
    expect(r.totals.sent).toBe(7);
  });
  it('gives each campaign its own row, best revenue first, and hides empty ones', () => {
    expect(r.rows.map((x) => x.id)).toEqual(['a', 'b']);
    expect(r.rows[0]).toMatchObject({ leads: 6, customers: 2, revenue: 399000, lost: 0 });
    expect(r.rows[1]).toMatchObject({ lost: 1 });
  });
  it('a lost contact with a meeting date is not counted as a meeting', () => expect(reached({ campaignId: 'x', status: 'sent', stage: 'lost', demoAt: T }).meeting).toBe(false));
  it('handles an empty account', () => expect(computeResults([], []).totals.sent).toBe(0));
});

const biz = (o: Partial<Business>): Business => ({ id: o.name ?? 'x', name: 'B', address: 'Lekki, Lagos', hasWebsite: false, category: 'Dental clinic', ...o } as Business);
describe('lead builder', () => {
  const list = [
    biz({ name: 'A', email: 'a@a.ng', phone: '0803 111 2222' }),
    biz({ name: 'B', email: 'b@b.ng', hasWebsite: true, website: 'https://b.ng' }),
    biz({ name: 'C', hasWebsite: true, website: 'https://instagram.com/c', email: 'c@c.ng', category: 'Salon' }),
    biz({ name: 'D', category: 'Salon', address: 'Wuse, Abuja' }),
    biz({ name: 'E', email: 'A@a.ng' }),
  ];
  it('no website counts a social page as none, and carries the phone', () => {
    const s = segmentProspects(list, { ...DEFAULT_SEGMENT, website: 'none' });
    expect(s.leads.map((l) => l.business)).toEqual(['A', 'C']);
    expect(s.leads[0].phone).toMatch(/^234/);
    expect(s.withoutEmail).toBe(1); // D
  });
  it('de-duplicates the same address', () => expect(segmentProspects(list, DEFAULT_SEGMENT).leads.filter((l) => l.email === 'a@a.ng')).toHaveLength(1));
  it('filters by industry and area', () => {
    expect(segmentProspects(list, { ...DEFAULT_SEGMENT, category: 'salon' }).matching).toBe(2);
    expect(segmentProspects(list, { ...DEFAULT_SEGMENT, area: 'abuja' }).matching).toBe(1);
  });
  it('industry chips ignore the industry filter itself so you can switch segment', () => {
    const s = segmentProspects(list, { ...DEFAULT_SEGMENT, website: 'none', category: 'salon' });
    expect(s.categories.map((c) => c.category).sort()).toEqual(['dental clinic', 'salon']);
  });
  it('needPhone drops those without one', () => expect(segmentProspects(list, { ...DEFAULT_SEGMENT, needPhone: true }).matching).toBe(1));
});
