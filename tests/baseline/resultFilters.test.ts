import { describe, it, expect } from 'vitest';
import type { Business } from '@/types';
import { DEFAULT_FILTERS, PRESETS, activeFilterCount, applyFilters, hasRealWebsite, matchingPreset, type AiFit } from '@/lib/resultFilters';

const biz = (o: Partial<Business> & { id: string }): Business => ({
  name: o.id, address: 'Lagos', hasWebsite: false, category: 'Dentist', ...o,
});

const list: Business[] = [
  biz({ id: 'site', hasWebsite: true, website: 'https://smile.ng', phone: '1', rating: 4.6, reviewCount: 120, status: 'OPERATIONAL' }),
  biz({ id: 'social', hasWebsite: true, website: 'https://instagram.com/x', phone: '2', rating: 4.0, reviewCount: 30 }),
  biz({ id: 'none', hasWebsite: false, phone: '3', rating: 4.8, reviewCount: 300 }),
  biz({ id: 'closed', hasWebsite: true, website: 'https://old.ng', phone: '4', status: 'CLOSED_PERMANENTLY', reviewCount: 50 }),
  biz({ id: 'slow', hasWebsite: true, website: 'https://slow.ng', psiScore: 32, reviewCount: 15 }),
];
const fits = new Map<string, AiFit>([
  ['site', { score: 80, band: 'strong' }], ['social', { score: 40, band: 'possible' }],
  ['none', { score: 20, band: 'low' }], ['closed', { score: 70, band: 'good' }], ['slow', { score: 60, band: 'good' }],
]);
const ids = (r: Business[]) => r.map((b) => b.id);
const f = (o: Partial<typeof DEFAULT_FILTERS>) => ({ ...DEFAULT_FILTERS, ...o });

describe('result filters', () => {
  it('treats a social page as not a real website', () => {
    expect(hasRealWebsite(list[0])).toBe(true);
    expect(hasRealWebsite(list[1])).toBe(false);
  });
  it('website filter: has / none / social', () => {
    expect(ids(applyFilters(list, f({ website: 'has' }), fits))).toEqual(['site', 'closed', 'slow']);
    expect(ids(applyFilters(list, f({ website: 'none' }), fits))).toEqual(['none']);
    expect(ids(applyFilters(list, f({ website: 'social' }), fits))).toEqual(['social']);
  });
  it('drops closed businesses and low-review ones', () => {
    expect(ids(applyFilters(list, f({ openOnly: true }), fits))).not.toContain('closed');
    expect(ids(applyFilters(list, f({ minReviews: 100 }), fits))).toEqual(['site', 'none']);
  });
  it('AI fit threshold and slow site', () => {
    expect(ids(applyFilters(list, f({ aiFit: 'good' }), fits))).toEqual(['site', 'closed', 'slow']);
    expect(ids(applyFilters(list, f({ slowSite: true }), fits))).toEqual(['slow']);
  });
  it('sorts by AI fit, stable on ties, without mutating input', () => {
    const before = ids(list);
    expect(ids(applyFilters(list, f({ sort: 'ai_fit' }), fits))).toEqual(['site', 'closed', 'slow', 'social', 'none']);
    expect(ids(list)).toEqual(before);
  });
  it('the AI receptionist preset keeps open, reachable sites with reviews, best fit first', () => {
    const p = PRESETS.find((x) => x.id === 'ai_receptionist')!;
    expect(ids(applyFilters(list, p.filters, fits))).toEqual(['site']);
    expect(matchingPreset(p.filters)).toBe('ai_receptionist');
  });
  it('counts active filters, ignoring sort', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeFilterCount(f({ website: 'has', phone: true, sort: 'rating' }))).toBe(2);
  });
});
