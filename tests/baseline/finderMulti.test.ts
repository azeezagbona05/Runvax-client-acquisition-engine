import { describe, expect, it } from 'vitest';
import { MAX_DRY_STREAK, MAX_PAIRS, advanceMulti, finderErrorMulti, finderPairs, multiStep, multiStepsLeft, multiStopReason, startFinder, startMulti } from '@/lib/acqFinder';

describe('several categories and locations', () => {
  it('pairs every category with every location, without repeats, capped', () => {
    expect(finderPairs(['Dental Clinics', 'Law Firms', 'dental clinics '], ['Lekki', 'Ikeja', ''])).toEqual([
      { industry: 'Dental Clinics', location: 'Lekki' }, { industry: 'Law Firms', location: 'Lekki' },
      { industry: 'Dental Clinics', location: 'Ikeja' }, { industry: 'Law Firms', location: 'Ikeja' },
    ]);
    const many = finderPairs(['Dental Clinics', 'Law Firms', 'Hotels & Guesthouses'], Array.from({ length: 10 }, (_, i) => `Place ${i}`));
    expect(many).toHaveLength(MAX_PAIRS);
  });

  it('validates categories from the list and needs a location', () => {
    expect(finderErrorMulti([], ['Lekki'])).toMatch(/at least one business category/);
    expect(finderErrorMulti(['Dental Clinics', 'Spaceships'], ['Lekki'])).toMatch(/"Spaceships" is not in the category list/);
    expect(finderErrorMulti(['Dental Clinics'], [' '])).toMatch(/at least one location/);
    expect(finderErrorMulti(['dental clinics'], ['Anywhere I typed'])).toBeNull();
  });

  it('takes turns between pairs and names the pair in the label', () => {
    let m = startMulti([startFinder('Dental Clinics', 'Lekki', 'NG', ''), startFinder('Law Firms', 'Ikeja', 'NG', '')]);
    const a = multiStep(m)!; expect(a.i).toBe(0); expect(a.step.label).toBe('Dental Clinics in Lekki: more');
    m = advanceMulti(m, a.i, 3);
    const b = multiStep(m)!; expect(b.i).toBe(1); expect(b.step.label).toMatch(/^Law Firms /);
    m = advanceMulti(m, b.i, 2);
    expect(multiStep(m)!.i).toBe(0);
    expect(multiStepsLeft(m)).toBeGreaterThan(0);
  });

  it('drops a pair after a dry streak and stops when every pair is done', () => {
    let m = startMulti([startFinder('Dental Clinics', 'Nowhere Town', 'OTHER', ''), startFinder('Law Firms', 'Nowhere City', 'OTHER', '')]);
    for (let k = 0; k < 40 && multiStep(m); k++) m = advanceMulti(m, multiStep(m)!.i, 0);
    expect(multiStep(m)).toBeNull();
    expect(multiStopReason(m)).toMatch(/Every category, location/);
    const one = startMulti([startFinder('Dental Clinics', 'Lekki', 'NG', '')]);
    expect(multiStopReason(one)).toBeNull();
    expect(multiStep(one)!.step.label).toBe('More from Lekki');
    expect(MAX_DRY_STREAK).toBeGreaterThan(0);
  });
});
