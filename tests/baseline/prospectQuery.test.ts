import { describe, it, expect } from 'vitest';
import { applyGroup, evalRule, makeRecord, newRule, ruleActive, searchRecords, togglePreset, presetOn, EMPTY_GROUP, type ProspectRecord } from '@/lib/prospectQuery';
import type { FinderBusiness } from '@/lib/acqFinder';

const biz = (o: Partial<FinderBusiness> & { id: string; name: string }): FinderBusiness => ({ address: 'Victoria Island, Lagos', ...o });
const rec = (b: FinderBusiness, extra: Partial<Parameters<typeof makeRecord>[1]> = {}): ProspectRecord => makeRecord(b, { contact: 'untouched', ...extra });
const recs = [
  rec(biz({ id: '1', name: 'Sketch Restaurant', category: 'Restaurant', rating: 4.4, reviewCount: 442, website: 'sketch.com', phone: '0908 845 1909' })),
  rec(biz({ id: '2', name: 'Slice Lagos', category: 'Pizza', rating: 4.1, reviewCount: 447, phone: '0906 135 4009' })),
  rec(biz({ id: '3', name: 'Gras Lekki', category: 'Restaurant', address: 'Lekki Phase 1, Lagos', rating: 3.2, reviewCount: 12 })),
  rec(biz({ id: '4', name: 'New Place', category: 'Cafe' }), { contact: 'verified', emails: ['owner@newplace.ng'], people: [{ name: 'Ada Obi', title: 'Owner' }] }),
];
const ids = (r: ProspectRecord[]) => r.map((x) => x.b.id);

describe('free-text search', () => {
  it('matches every word in any order, across name, address, phone, emails and people', () => {
    expect(ids(searchRecords(recs, 'pizza lagos'))).toEqual(['2']);
    expect(ids(searchRecords(recs, 'lekki'))).toEqual(['3']);
    expect(ids(searchRecords(recs, '0908'))).toEqual(['1']);
    expect(ids(searchRecords(recs, 'ada obi'))).toEqual(['4']);
    expect(ids(searchRecords(recs, 'newplace.ng'))).toEqual(['4']);
  });
  it('is case-insensitive, ignores extra spaces and returns everything for an empty query', () => {
    expect(ids(searchRecords(recs, '  SKETCH   '))).toEqual(['1']);
    expect(searchRecords(recs, '   ')).toBe(recs);
    expect(searchRecords(recs, 'zzz')).toEqual([]);
  });
});

describe('advanced filter', () => {
  it('number rules: missing ratings never satisfy a comparison, but do satisfy "is empty"', () => {
    expect(ids(applyGroup(recs, { match: 'all', rules: [newRule({ field: 'rating', op: 'gte', value: '4' })] }))).toEqual(['1', '2']);
    expect(ids(applyGroup(recs, { match: 'all', rules: [newRule({ field: 'rating', op: 'lt', value: '4' })] }))).toEqual(['3']);
    expect(ids(applyGroup(recs, { match: 'all', rules: [newRule({ field: 'rating', op: 'empty' })] }))).toEqual(['4']);
    expect(ids(applyGroup(recs, { match: 'all', rules: [newRule({ field: 'reviews', op: 'between', value: '500', value2: '10' })] }))).toEqual(['1', '2', '3']);
  });
  it('text rules and contact status', () => {
    expect(ids(applyGroup(recs, { match: 'all', rules: [newRule({ field: 'website', op: 'empty' })] }))).toEqual(['2', '3', '4']);
    expect(ids(applyGroup(recs, { match: 'all', rules: [newRule({ field: 'category', op: 'is', value: 'restaurant' })] }))).toEqual(['1', '3']);
    expect(ids(applyGroup(recs, { match: 'all', rules: [newRule({ field: 'address', op: 'not_contains', value: 'lekki' })] }))).toEqual(['1', '2', '4']);
    expect(ids(applyGroup(recs, { match: 'all', rules: [newRule({ field: 'contact', op: 'is', value: 'verified' })] }))).toEqual(['4']);
    expect(ids(applyGroup(recs, { match: 'all', rules: [newRule({ field: 'email', op: 'not_empty' })] }))).toEqual(['4']);
  });
  it('joins rules with all (AND) or any (OR)', () => {
    const rules = [newRule({ field: 'website', op: 'empty' }), newRule({ field: 'rating', op: 'gte', value: '4' })];
    expect(ids(applyGroup(recs, { match: 'all', rules }))).toEqual(['2']);
    expect(ids(applyGroup(recs, { match: 'any', rules }))).toEqual(['1', '2', '3', '4']);
  });
  it('ignores a rule that is still being filled in instead of hiding everything', () => {
    const half = newRule({ field: 'name', op: 'contains', value: '' });
    expect(ruleActive(half)).toBe(false);
    expect(applyGroup(recs, { match: 'all', rules: [half] })).toBe(recs);
    expect(ruleActive(newRule({ field: 'rating', op: 'between', value: '3' }))).toBe(false);
    expect(ruleActive(newRule({ field: 'rating', op: 'gte', value: 'abc' }))).toBe(false);
    expect(ruleActive(newRule({ field: 'phone', op: 'not_empty' }))).toBe(true);
    expect(evalRule(recs[0], newRule({ field: 'name', op: 'starts', value: 'sketch' }))).toBe(true);
  });
  it('presets toggle on and off as ordinary rules', () => {
    const on = togglePreset(EMPTY_GROUP, 'no-site');
    expect(presetOn(on, 'no-site')).toBe(true);
    expect(ids(applyGroup(recs, on))).toEqual(['2', '3', '4']);
    expect(togglePreset(on, 'no-site').rules).toEqual([]);
    expect(togglePreset(on, 'rated-4').rules).toHaveLength(2);
  });
});

describe('verified and decision-maker filters', () => {
  const list = [
    rec(biz({ id: 'a', name: 'A' }), { emails: ['a@a.com'], verified: true, decisionMaker: true }),
    rec(biz({ id: 'b', name: 'B' }), { emails: ['b@b.com'], decisionMaker: true }),
    rec(biz({ id: 'c', name: 'C' }), { emails: ['c@c.com'] }),
  ];
  it('"Verified email" keeps only businesses with a checked address', () => {
    expect(ids(applyGroup(list, togglePreset(EMPTY_GROUP, 'verified')))).toEqual(['a']);
  });
  it('"Decision maker" keeps businesses where one was found, and the two combine', () => {
    expect(ids(applyGroup(list, togglePreset(EMPTY_GROUP, 'decision')))).toEqual(['a', 'b']);
    expect(ids(applyGroup(list, togglePreset(togglePreset(EMPTY_GROUP, 'decision'), 'verified')))).toEqual(['a']);
  });
  it('can be turned off again', () => {
    const on = togglePreset(EMPTY_GROUP, 'verified');
    expect(presetOn(on, 'verified')).toBe(true);
    expect(presetOn(togglePreset(on, 'verified'), 'verified')).toBe(false);
  });
});
