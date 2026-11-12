import { describe, it, expect } from 'vitest';
import { analyseEmail, matchApplications, suggestDates } from '@/lib/career/manage/classify';

const NOW = new Date('2026-11-12T10:00:00Z');

describe('analyseEmail', () => {
  it('interview invitation, with a suggested date, time and video link', () => {
    const a = analyseEmail('Subject: Interview with Acme\n\nHi Ada, we would like to invite you to an interview for the Frontend Developer role. Are you free on 20 November 2026 at 2:30 PM? Join on Zoom: https://acme.zoom.us/j/12345 .', NOW);
    expect(a.kind).toBe('interview'); expect(a.subject).toBe('Interview with Acme');
    expect(a.interviewDates).toEqual(['2026-11-20T14:30']); expect(a.interviewKind).toBe('video'); expect(a.links[0]).toContain('zoom.us');
  });
  it('a rejection that mentions interviewing is still a rejection', () => {
    expect(analyseEmail('Thank you for interviewing with us. Unfortunately we will not be moving forward with your application.', NOW).kind).toBe('rejected');
  });
  it('an acknowledgement that only says "if shortlisted we will invite you to interview" is NOT an interview', () => {
    const a = analyseEmail('Thank you for applying to Acme. We have received your application. If your profile matches we will invite you to an interview.', NOW);
    expect(a.kind).toBe('acknowledged'); expect(a.interviewDates).toEqual([]);
  });
  it('offer beats everything', () => { expect(analyseEmail('We are pleased to offer you the position. Unfortunately other candidates were also strong.', NOW).kind).toBe('offer'); });
  it('requests for information', () => { expect(analyseEmail('Please complete the following assessment within 5 days.', NOW).kind).toBe('info_request'); });
  it('anything unclear is "other", never guessed', () => { expect(analyseEmail('Hello, just checking the weather today.', NOW).kind).toBe('other'); });
  it('summary quotes the email, and never stores more than a sentence', () => {
    const a = analyseEmail('Regret to inform you that the role is closed. ' + 'x'.repeat(5000), NOW); expect(a.summary.length).toBeLessThanOrEqual(600);
  });
});

describe('suggestDates', () => {
  it('handles ISO, day-month, month-day, and no-year dates (next occurrence)', () => {
    expect(suggestDates('on 2026-12-01 at 10:00', NOW)).toEqual(['2026-12-01T10:00']);
    expect(suggestDates('Thursday 3rd December at 14:00', NOW)).toEqual(['2026-12-03T14:00']);
    expect(suggestDates('December 3, 2026 at 9am', NOW)).toEqual(['2026-12-03T09:00']);
    expect(suggestDates('on 5 January', NOW)).toEqual(['2027-01-05T09:00']);
  });
  it('ignores impossible and past dates', () => { expect(suggestDates('31 February 2027', NOW)).toEqual([]); expect(suggestDates('1 March 2020', NOW)).toEqual([]); });
});

describe('matchApplications', () => {
  const apps = [{ id: 'a', company: 'Acme Ltd', title: 'Frontend Developer' }, { id: 'b', company: 'Initech', title: 'React Developer' }];
  it('finds the application by company name', () => { expect(matchApplications('Hello from Acme Ltd about your application', apps).map((a) => a.id)).toEqual(['a']); });
  it('returns nothing rather than guessing', () => { expect(matchApplications('Hello from someone', apps)).toEqual([]); });
});

import { followUpDraft } from '@/lib/career/manage/reminders';
import { prepByRules } from '@/lib/career/manage/coach';
import { digestHtml, worthEmailing } from '@/lib/career/manage/digest';
import { sanitizePermissions, sanitizeProfile } from '@/lib/career/types';
import { guard, profileText } from '@/lib/career/tailor';

describe('follow-up draft', () => {
  it('states only what the candidate did', () => {
    const d = followUpDraft({ name: 'Ada Obi' }, { title: 'Frontend Developer', company: 'Acme' }, new Date('2026-11-01T00:00:00Z'), 0);
    expect(d).toContain('Frontend Developer'); expect(d).toContain('1 November 2026'); expect(d).toContain('Ada Obi');
    expect(d).not.toMatch(/\d+ years|experience|skilled/i);
  });
  it('the second note reads as a second note', () => { expect(followUpDraft({ name: 'A' }, { title: 'T', company: 'C' }, new Date(), 1)).toMatch(/following up again/i); });
});

describe('interview coach (basic)', () => {
  const profile = sanitizeProfile({ name: 'Ada', headline: 'Frontend Developer', skills: ['React', 'TypeScript'], achievements: ['Cut page load time by 40%'], experience: [{ title: 'Frontend Developer', company: 'Bright Labs', bullets: ['Built a React dashboard used by 300 customers'] }] });
  const prep = prepByRules(profile, { title: 'Frontend Developer', company: 'Acme', description: 'We use React and TypeScript to build dashboards.' });
  it('builds questions with talking points from the profile only', () => {
    expect(prep.questions.length).toBeGreaterThanOrEqual(5); expect(prep.questions.map((q) => q.question).join()).toMatch(/How have you used React/);
    const all = prep.questions.map((q) => q.talkingPoint).join(' ');
    expect(all).toContain('Built a React dashboard used by 300 customers');
    expect(guard(prep.questions.find((q) => /React/.test(q.question))!.talkingPoint, profile, profileText(profile)).flags).toEqual([]);
  });
});

describe('reminder emails', () => {
  const now = new Date('2026-11-12T08:00:00Z'); const H = 3_600_000;
  const items = [
    { kind: 'interview' as const, id: 'i1', title: 'Interview: Dev at Acme', detail: 'video', due: new Date(now.getTime() + 20 * H) },
    { kind: 'interview' as const, id: 'i2', title: 'Interview: Dev at Beta', detail: 'video', due: new Date(now.getTime() + 60 * H) },
    { kind: 'follow_up' as const, id: 'f1', title: 'Follow up: X', detail: '', due: new Date(now.getTime() - 10 * H) },
    { kind: 'follow_up' as const, id: 'f2', title: 'Follow up: Y', detail: '', due: new Date(now.getTime() - 100 * H) },
    { kind: 'approval' as const, id: 'a1', title: 'Decide: Z', detail: '', due: new Date(now.getTime() - 100 * H) },
  ];
  it('emails only what is new: interviews within 48h not mentioned before, follow-ups that just became due', () => {
    expect(worthEmailing(items, new Set(), now).map((r) => r.id)).toEqual(['i1', 'f1']);
    expect(worthEmailing(items, new Set(['i1']), now).map((r) => r.id)).toEqual(['f1']);
  });
  it('escapes HTML in titles', () => { expect(digestHtml('Ada', [{ ...items[0], title: '<script>x</script>' }])).not.toContain('<script>'); });
  it('reminder emails default on and can be turned off', () => { expect(sanitizePermissions({}).remindByEmail).toBe(true); expect(sanitizePermissions({ remindByEmail: false }).remindByEmail).toBe(false); });
});
