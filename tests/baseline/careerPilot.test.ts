import { describe, it, expect } from 'vitest';
import { cvAccuracy, pilotIndicators, pooled } from '@/lib/career/manage/pilot';
import { emptyProfile } from '@/lib/career/types';

const base = { ...emptyProfile(), name: 'Ada Obi', email: 'ada@x.com', skills: ['Triage', 'Wound care'], experience: [{ title: 'Staff Nurse', company: 'Lagoon Hospital', start: '', end: '', location: '', bullets: [] }] };

describe('pilot indicators', () => {
  it('CV accuracy is the share of facts kept; none when there is no baseline', () => {
    expect(cvAccuracy(base, base).value).toBe(100);
    expect(cvAccuracy(base, { ...base, skills: ['Triage'] }).value).toBe(80);
    expect(cvAccuracy(null, base).value).toBeNull();
  });
  it('relevance counts only jobs the candidate acted on', () => {
    const r = pilotIndicators({ baseline: null, profile: null, appliedReplies: [], interviews: 0, matches: [
      { source: 'himalayas', status: 'new', applicationStatus: null },
      { source: 'himalayas', status: 'saved', applicationStatus: null },
      { source: 'himalayas', status: 'dismissed', applicationStatus: null },
      { source: 'himalayas', status: 'new', applicationStatus: 'prepared' },
      { source: 'himalayas', status: 'new', applicationStatus: 'rejected' },
    ] });
    expect(r.relevance).toMatchObject({ value: 50, of: 4 });
  });
  it('useful employers, sent and response rate', () => {
    const r = pilotIndicators({ baseline: null, profile: null, interviews: 2,
      matches: [{ source: 'places', status: 'saved', applicationStatus: null }, { source: 'places', status: 'new', applicationStatus: null }, { source: 'places', status: 'new', applicationStatus: 'applied' }],
      appliedReplies: [['interview'], [], ['followed_up']] });
    expect(r.usefulEmployers).toMatchObject({ useful: 2, found: 3 });
    expect(r.applicationsSent).toBe(3);
    expect(r.responseRate.value).toBe(33);          // a follow-up the candidate sent is not an employer reply
    expect(r.interviews).toBe(2);
  });
  it('pools by denominator, and empty input gives no ratios', () => {
    const a = pilotIndicators({ baseline: null, profile: null, interviews: 0, matches: [{ source: 'x', status: 'saved', applicationStatus: null }], appliedReplies: [] });
    const b = pilotIndicators({ baseline: null, profile: null, interviews: 0, matches: [{ source: 'x', status: 'dismissed', applicationStatus: null }, { source: 'x', status: 'dismissed', applicationStatus: null }, { source: 'x', status: 'dismissed', applicationStatus: null }], appliedReplies: [] });
    expect(pooled([a, b]).relevance).toMatchObject({ value: 25, of: 4 });
    expect(pooled([]).relevance.value).toBeNull();
  });
});
