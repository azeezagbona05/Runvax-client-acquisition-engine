import { describe, it, expect } from 'vitest';
import { parseCsv, toCsv, ACTION_LABEL, CONTACT_ACTION, contactState, isVerifiedStatus, DEFAULT_FILTERS, FINDER_INDUSTRIES, filterResults, filtersActive, finderError, finderQuery, type FinderBusiness } from '@/lib/acqFinder';

describe('prospect finder form', () => {
  it('builds the same query sentence V1 sends', () => {
    expect(finderQuery('Dental Clinics', ' Lekki, Lagos ')).toBe('Dental Clinics in Lekki, Lagos');
  });
  it('validates like the V1 form', () => {
    expect(finderError('', 'Lekki')).toMatch(/category/);
    expect(finderError('Spaceships', 'Lekki')).toMatch(/list/);
    expect(finderError('dental clinics', '')).toMatch(/location/i);
    expect(finderError('dental clinics', 'Lekki')).toBeNull();
  });
  it('offers the V1 categories', () => {
    expect(FINDER_INDUSTRIES).toContain('Dental Clinics');
    expect(FINDER_INDUSTRIES).toHaveLength(24);
  });
});

import { GRID_STEPS, MAX_DRY_STREAK, advanceFinder, gridPoint, landmarksFor, planStep, sameLocationQueries, startFinder, stepsLeft, stopReason } from '@/lib/acqFinder';

describe('load more: same location, then landmarks, then the wider grid', () => {
  const centre = { lat: 6.45, lng: 3.47 };
  const ctx0 = () => startFinder('Dental Clinics', 'Lekki Phase 1', 'NG', '', centre);

  it('starts with other wordings for the same location', () => {
    const s = planStep(ctx0())!;
    expect(s.kind).toBe('same');
    expect(s.query).toBe(sameLocationQueries('Dental Clinics', 'Lekki Phase 1')[0]);
    expect(s.label).toMatch(/More from Lekki Phase 1/);
  });
  it('moves to nearby landmarks once the same-location wordings are used up', () => {
    let c = ctx0();
    for (let i = 0; i < 3; i++) c = advanceFinder(c, 5);
    const s = planStep(c)!;
    expect(s.kind).toBe('landmark');
    expect(s.location).not.toBe('Lekki Phase 1');
    expect(s.query).toContain(s.location);
  });
  it('a same-location wording that finds nothing new ends that phase early', () => {
    const c = advanceFinder(ctx0(), 0);
    expect(planStep(c)!.kind).toBe('landmark');
  });
  it('then falls back to the V1 grid, and ends after 24 steps', () => {
    let c = { ...ctx0(), landmarks: [] as string[] };
    c = advanceFinder(c, 0);
    expect(planStep(c)!.kind).toBe('grid');
    for (let i = 0; i < GRID_STEPS; i++) c = advanceFinder(c, 3);
    expect(planStep(c)).toBeNull();
    expect(stepsLeft(c)).toBe(0);
  });
  it('without a centre there is no grid, so it simply ends', () => {
    const c = advanceFinder({ ...startFinder('Dental Clinics', 'Nowhere', 'NG', ''), landmarks: [] }, 0);
    expect(planStep(c)).toBeNull();
  });
  it('picks landmarks from the same area and city, never the location itself', () => {
    const l = landmarksFor('Lekki Phase 1', 'NG');
    expect(l.length).toBeGreaterThan(0);
    expect(l).not.toContain('Lekki Phase 1');
    expect(new Set(l).size).toBe(l.length);
  });
  it('grid points match V1: inner ring north is 0.5 radius north', () => {
    const p = gridPoint(centre, 5, 0);
    expect(p.ring).toBe(1);
    expect(p.dir).toBe('north');
    expect(p.lat).toBeCloseTo(centre.lat + 2.5 / 111, 6);
    expect(gridPoint(centre, 5, 17).ring).toBe(3);
    expect(gridPoint(centre, 5, 31).ring).toBe(4);
    expect(GRID_STEPS).toBe(32);
  });
  it('keep-finding stops when everything is tried or after a run of empty searches', () => {
    expect(stopReason(ctx0(), 0)).toBeNull();
    expect(stopReason(ctx0(), MAX_DRY_STREAK)).toMatch(/exhausted/);
    let c = { ...ctx0(), landmarks: [] as string[] };
    c = advanceFinder(c, 0);
    for (let i = 0; i < GRID_STEPS; i++) c = advanceFinder(c, 1);
    expect(stopReason(c, 0)).toMatch(/nothing more/);
  });
});


describe('filterResults', () => {
  const b = (id: string, over: Partial<FinderBusiness> = {}): FinderBusiness => ({ id, name: id, address: '', ...over });
  const all = [
    b('a', { website: 'a.com', rating: 4.8, reviewCount: 120, phone: '1' }),
    b('b', { rating: 3.2, reviewCount: 8 }),
    b('c', { website: 'c.com', rating: 4.1, reviewCount: 30 }),
    b('d', {}),
    b('e', { rating: 2.5, reviewCount: 60, phone: '2' }),
  ];
  const ids = (xs: FinderBusiness[]) => xs.map((x) => x.id).join('');
  const f = (over: Partial<typeof DEFAULT_FILTERS>) => ({ ...DEFAULT_FILTERS, ...over });

  it('keeps everything in the order found by default', () => {
    expect(ids(filterResults(all, DEFAULT_FILTERS))).toBe('abcde');
    expect(filtersActive(DEFAULT_FILTERS)).toBe(false);
  });
  it('filters by website', () => {
    expect(ids(filterResults(all, f({ website: 'with' })))).toBe('ac');
    expect(ids(filterResults(all, f({ website: 'without' })))).toBe('bde');
  });
  it('puts no-website businesses first without dropping the others, keeping the original order within each group', () => {
    expect(ids(filterResults(all, f({ sort: 'no-website-first' })))).toBe('bdeac');
    expect(ids(filterResults(all, f({ sort: 'website-first' })))).toBe('acbde');
  });
  it('filters by rating, with unrated ones only matching "No rating yet"', () => {
    expect(ids(filterResults(all, f({ rating: '4+' })))).toBe('ac');
    expect(ids(filterResults(all, f({ rating: 'under3.5' })))).toBe('be');
    expect(ids(filterResults(all, f({ rating: 'unrated' })))).toBe('d');
  });
  it('sorts by rating with unrated last either way, and by reviews', () => {
    expect(ids(filterResults(all, f({ sort: 'rating-high' })))).toBe('acbed');
    expect(ids(filterResults(all, f({ sort: 'rating-low' })))).toBe('ebcad');
    expect(ids(filterResults(all, f({ sort: 'reviews-high' })))).toBe('aecbd');
  });
  it('combines filters: no website, rated under 4, at least 20 reviews, with a phone', () => {
    expect(ids(filterResults(all, f({ website: 'without', rating: 'under4', minReviews: 20, phoneOnly: true })))).toBe('e');
  });
  it('can limit to businesses whose email was found', () => {
    expect(ids(filterResults(all, f({ emailOnly: true }), (x) => x.id === 'c' || x.id === 'd'))).toBe('cd');
  });
});


describe('contact discovery state', () => {
  const ada = { name: 'Ada Obi', title: 'Owner' };
  it('reads whether a finder note already confirms the address', () => {
    expect(isVerifiedStatus('Snov.io: valid')).toBe(true);
    expect(isVerifiedStatus('Checked with Snov.io: address exists (pattern guess)')).toBe(true);
    expect(isVerifiedStatus('verified')).toBe(true);
    for (const no of ['Snov.io: unknown (catchall)', 'not_valid', 'invalid', undefined, '']) expect(isVerifiedStatus(no)).toBe(false);
  });
  it('walks the five states', () => {
    expect(contactState({ people: null })).toBe('untouched');
    expect(contactState({ people: [] })).toBe('none');
    expect(contactState({ people: [], businessEmail: 'info@x.com' })).toBe('business_only');
    expect(contactState({ people: null, businessEmail: 'info@x.com' })).toBe('business_only');
    expect(contactState({ people: [ada] })).toBe('person_no_email');
    expect(contactState({ people: [{ ...ada, email: 'ada@x.com' }] })).toBe('unverified');
    expect(contactState({ people: [{ ...ada, email: 'ada@x.com', emailStatus: 'Snov.io: valid' }] })).toBe('verified');
  });
  it('lets a verify run overrule the finder note, and drops an invalid address back to "email missing"', () => {
    const p = [{ ...ada, email: 'ada@x.com', emailStatus: 'Snov.io: valid' }];
    expect(contactState({ people: p, verdicts: { 'ada@x.com': 'invalid' } })).toBe('person_no_email');
    expect(contactState({ people: [{ ...ada, email: 'Ada@x.com' }], verdicts: { 'ada@x.com': 'valid' } })).toBe('verified');
    expect(contactState({ people: [{ ...ada, email: 'ada@x.com' }], verdicts: { 'ada@x.com': 'unknown' } })).toBe('unverified');
  });
  it('offers the next step for each state', () => {
    expect(CONTACT_ACTION).toEqual({ untouched: 'find_dm', business_only: 'find_dm', person_no_email: 'find_email', unverified: 'verify', none: 'retry', verified: null });
    expect(ACTION_LABEL.retry).toBe('Retry discovery');
  });
});


describe('csv', () => {
  it('round-trips commas, quotes and line breaks', () => {
    const rows = [['name', 'note'], ['Smile, Inc', 'says "hi"'], ['A', 'two\nlines']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});
