import { describe, it, expect } from 'vitest';
import { FINDER_INDUSTRIES, finderError, finderQuery } from '@/lib/acqFinder';

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
