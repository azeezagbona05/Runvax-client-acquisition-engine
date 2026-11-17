import { describe, it, expect } from 'vitest';
import { recommend } from '@/lib/career/manage/recommend';
import { emptyProfile } from '@/lib/career/types';

const profile = { ...emptyProfile(), skills: ['Excel'], summary: 'Accountant' };
const job = (title: string, text: string, score = 80, restricted = false) => ({ title, text: `${title}\n${text}`, score, restricted });
const base = { profile, titles: ['Accountant'], minScore: 60, applied: 0, replied: 0, waitingApprovals: 0, appliedLast7Days: 0 };

describe('weekly recommendations', () => {
  it('suggests skills asked for by several good matches but missing from the profile, never ones it already has', () => {
    const jobs = Array.from({ length: 6 }, (_, i) => job('Accountant ' + i, 'You will use SQL and Excel daily'));
    const r = recommend({ ...base, jobs }).find((x) => x.id === 'skills');
    expect(r?.detail).toMatch(/sql \(6 of 6\)/); expect(r?.detail).not.toMatch(/excel/i);
  });
  it('suggests a recurring title not in the preferences', () => {
    const jobs = Array.from({ length: 4 }, () => job('Financial Controller', 'x'));
    expect(recommend({ ...base, jobs }).some((x) => x.id === 'titles' && /financial controller/.test(x.detail))).toBe(true);
  });
  it('flags restricted share, silence and stalled approvals; says "nothing to change" otherwise', () => {
    const jobs = Array.from({ length: 10 }, () => job('Accountant', 'x', 80, true));
    const ids = recommend({ ...base, jobs, applied: 6, replied: 0, waitingApprovals: 3 }).map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining(['restricted', 'silence', 'stalled']));
    expect(recommend({ ...base, jobs: [] }).map((x) => x.id)).toEqual(['steady']);
  });
  it('suggests lowering the bar when almost nothing reaches it', () => {
    const jobs = Array.from({ length: 25 }, () => job('Accountant', 'x', 30));
    expect(recommend({ ...base, jobs }).find((x) => x.id === 'bar-low')?.detail).toMatch(/Try 50/);
  });
});
