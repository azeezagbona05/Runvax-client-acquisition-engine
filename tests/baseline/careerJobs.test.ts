import { describe, it, expect } from 'vitest';
import { dedupeKey, fromArbeitnow, fromGreenhouse, fromLever, fromRemotive, stripHtml, type Job } from '@/lib/career/jobs/sources';
import { levelOf, scoreJob } from '@/lib/career/jobs/match';
import { sanitizePreferences, sanitizeProfile } from '@/lib/career/types';

const job = (o: Partial<Job> = {}): Job => ({ source: 'remotive', externalId: '1', title: 'Frontend Developer', company: 'Acme', location: 'Worldwide', remote: true, url: 'https://x.test/1', description: 'Build UIs with React and TypeScript.', postedAt: null, ...o });
const profile = sanitizeProfile({ skills: ['React', 'TypeScript', 'CSS'], experience: [{ title: 'Frontend Developer', company: 'Bright Labs' }] });
const prefs = sanitizePreferences({ titles: ['Frontend Developer'], workModes: ['remote'], level: 'mid', country: 'Nigeria', industries: ['Fintech'] });

describe('normalisers', () => {
  it('Remotive', () => {
    const j = fromRemotive({ jobs: [{ id: 5, url: 'https://remotive.com/j/5', title: 'Dev', company_name: 'Co', candidate_required_location: 'Europe', publication_date: '2026-11-10T10:00:00', description: '<p>Hello&nbsp;<b>World</b></p>' }, { id: 6, url: 'javascript:alert(1)', title: 'Bad' }] });
    expect(j).toHaveLength(1); expect(j[0]).toMatchObject({ source: 'remotive', remote: true, location: 'Europe', description: 'Hello World' });
  });
  it('Arbeitnow, Greenhouse and Lever', () => {
    expect(fromArbeitnow({ data: [{ slug: 's', url: 'https://a.test/s', title: 'T', company_name: 'C', location: 'Berlin', remote: false, created_at: 1700000000 }] })[0]).toMatchObject({ source: 'arbeitnow', location: 'Berlin' });
    expect(fromGreenhouse({ jobs: [{ id: 1, absolute_url: 'https://g.test/1', title: 'T', location: { name: 'Remote - US' }, content: '&lt;p&gt;Hi&lt;/p&gt;' }] }, 'Stripe')[0]).toMatchObject({ company: 'Stripe', remote: true, description: 'Hi' });
    expect(fromLever([{ id: 'a', hostedUrl: 'https://l.test/a', text: 'T', categories: { location: 'Lagos' }, descriptionPlain: 'Plain' }], 'Co')[0]).toMatchObject({ company: 'Co', location: 'Lagos', description: 'Plain' });
  });
  it('garbage in gives nothing, not a crash', () => { expect(fromRemotive(null)).toEqual([]); expect(fromLever({} as never, 'x')).toEqual([]); expect(stripHtml('')).toBe(''); });
});

describe('dedupeKey', () => {
  it('same job on two boards collapses; different place or title does not', () => {
    const a = dedupeKey({ company: 'LGC Group', title: 'Manager*in GMP (m/w/d)', location: 'Berlin' });
    expect(dedupeKey({ company: 'lgc group', title: 'Manager in GMP', location: 'berlin' })).toBe(a);
    expect(dedupeKey({ company: 'LGC Group', title: 'Manager*in GMP (m/w/d)', location: 'Hamburg' })).not.toBe(a);
    expect(dedupeKey({ company: 'LGC Group', title: 'Senior Manager GMP', location: 'Berlin' })).not.toBe(a);
  });
});

describe('scoreJob', () => {
  it('a strong fit scores high with readable reasons', () => {
    const f = scoreJob(job({ description: 'Fintech startup. Build UIs with React, TypeScript and CSS.' }), profile, prefs);
    expect(f.score).toBeGreaterThanOrEqual(90);
    expect(f.reasons.join(' ')).toMatch(/title matches/i); expect(f.reasons.join(' ')).toMatch(/3 of your skills/); expect(f.reasons.join(' ')).toMatch(/Open worldwide/); expect(f.reasons.join(' ')).toMatch(/Fintech/);
  });
  it('an unrelated job scores low', () => {
    expect(scoreJob(job({ title: 'Warehouse Operative', description: 'Lift boxes.', location: 'Berlin', remote: false }), profile, prefs).score).toBeLessThan(35);
  });
  it('a different level costs points; the right level earns them', () => {
    const base = scoreJob(job({ title: 'Frontend Developer' }), profile, prefs).score;
    expect(scoreJob(job({ title: 'Senior Frontend Developer' }), profile, prefs).score).toBeLessThan(scoreJob(job({ title: 'Senior Frontend Developer' }), profile, { ...prefs, level: 'senior' }).score);
    expect(base).toBeGreaterThan(0); expect(levelOf('Junior Dev')).toBe('junior'); expect(levelOf('Engineering Manager')).toBe('lead'); expect(levelOf('Dev')).toBeNull();
  });
  it('onsite-only candidates are not given remote credit; a local job earns place credit', () => {
    const onsite = sanitizePreferences({ ...prefs, workModes: ['onsite'], locations: ['Lagos'] });
    expect(scoreJob(job({ remote: true, location: 'Worldwide' }), profile, onsite).reasons.join()).not.toMatch(/Remote, as you prefer/);
    expect(scoreJob(job({ remote: false, location: 'Lagos, Nigeria' }), profile, onsite).reasons.join()).toMatch(/Located in/);
  });
  it('never exceeds 100', () => { expect(scoreJob(job(), profile, prefs).score).toBeLessThanOrEqual(100); });
});

describe('title understanding', () => {
  it('engineer = developer and front-end spellings are the same', () => {
    const fit = (title: string) => scoreJob(job({ title, description: '' }), profile, prefs).score;
    expect(fit('Frontend Engineer, Design Systems')).toBeGreaterThanOrEqual(fit('Frontend Developer') - 1);
    expect(fit('Front-End Software Engineer')).toBeGreaterThan(fit('Warehouse Operative'));
  });
  it('a contradicting specialty is a poor match, full-stack is acceptable', () => {
    const fit = (title: string) => scoreJob(job({ title, description: '' }), profile, prefs).score;
    expect(fit('Senior Back-end Developer')).toBeLessThan(fit('Frontend Developer') - 20);
    expect(fit('Full-Stack Developer')).toBeGreaterThan(fit('Back-end Developer'));
  });
});

import { accessFor, ownPlaces } from '@/lib/career/jobs/match';
describe('can the person actually take the job? (found in the browser audit)', () => {
  const ng = sanitizePreferences({ titles: ['Frontend Developer'], workModes: ['remote'], level: 'mid', country: 'Nigeria', locations: ['Lagos'] });
  it('remote but restricted to other places: no points for place, never above 40', () => {
    const f = scoreJob(job({ location: 'LATAM, Europe, USA, Canada, APAC', description: 'React and TypeScript, CSS, Fintech' }), profile, { ...ng, industries: ['Fintech'] });
    expect(f.access).toBe('restricted'); expect(f.score).toBeLessThanOrEqual(40); expect(f.reasons.join(' ')).toMatch(/Only open to: LATAM, Europe/);
  });
  it('open to the person: worldwide, Africa, EMEA, their country or their city', () => {
    for (const where of ['Worldwide', 'Anywhere in the world', 'Africa', 'EMEA', 'Nigeria', 'Lagos, Nigeria', 'West Africa']) expect(accessFor({ location: where, remote: true }, 'Nigeria', ['Lagos']).access).toBe('open');
  });
  it('a job that does not say where it is open stays "unknown", not rejected', () => { for (const where of ['', 'Remote', 'Homeoffice']) expect(accessFor({ location: where, remote: true }, 'Nigeria', []).access).toBe('unknown'); });
  it('Europe means open to a person in Germany and closed to a person in Ghana', () => {
    expect(accessFor({ location: 'Europe', remote: true }, 'Germany', []).access).toBe('open'); expect(accessFor({ location: 'Europe', remote: true }, 'Ghana', []).access).toBe('restricted');
  });
  it('onsite abroad needs relocation: restricted; onsite near the person: open', () => {
    expect(accessFor({ location: 'Lucerne', remote: false }, 'Nigeria', ['Lagos']).access).toBe('restricted'); expect(accessFor({ location: 'Victoria Island, Lagos', remote: false }, 'Nigeria', ['Lagos']).access).toBe('open');
    const f = scoreJob(job({ remote: false, location: 'Lucerne', description: 'React TypeScript CSS' }), profile, ng); expect(f.score).toBeLessThanOrEqual(40); expect(f.reasons.join(' ')).toMatch(/Based in Lucerne/);
  });
  it('without knowing where the person is, nothing is rejected', () => { expect(accessFor({ location: 'USA only', remote: true }, '', []).access).toBe('unknown'); expect(ownPlaces('', [])).toEqual([]); });
  it('"Senior" is not a match: a Senior Back-end Developer is not close to a Senior Accountant', () => {
    const acct = sanitizePreferences({ titles: ['Senior Accountant'], workModes: ['remote'], level: 'senior', country: 'Kenya' }); const accountant = sanitizeProfile({ skills: ['IFRS', 'Audit'], experience: [{ title: 'Senior Accountant', company: 'X' }] });
    const dev = scoreJob(job({ title: 'Senior Back-end Developer', description: 'Node and SQL', location: 'Worldwide' }), accountant, acct);
    const right = scoreJob(job({ title: 'Senior Accountant', description: 'IFRS reporting and audit', location: 'Worldwide' }), accountant, acct);
    expect(dev.score).toBeLessThan(35); expect(right.score).toBeGreaterThanOrEqual(85);
  });
  it('"Staff Nurse" is not read as a lead-level job', () => { expect(levelOf('Staff Nurse - ICU')).toBeNull(); expect(levelOf('Staff Software Engineer')).toBe('lead'); });
});

describe('a place that is named and is not yours rules a job out (found in the browser audit, round 2)', () => {
  const open = (where: string, country: string, cities: string[] = []) => accessFor({ location: where, remote: true }, country, cities).access;
  it('"South Africa" is not "Africa": a South Africa-only job is closed to Kenya, open to South Africa', () => {
    expect(open('South Africa', 'Kenya')).toBe('restricted'); expect(open('South Africa', 'South Africa')).toBe('open'); expect(open('Africa', 'Kenya')).toBe('open'); expect(open('East Africa', 'Kenya')).toBe('open');
  });
  it('any named country that is not yours is closed, even one on no list (Indonesia, Serbia, Egypt for a Nigerian)', () => {
    for (const where of ['Indonesia', 'Serbia', 'Cyprus', 'Malaysia', 'Egypt', 'Ukraine', 'Remote - US', 'Ghana']) expect(open(where, 'Nigeria')).toBe('restricted');
  });
  it('a list that includes yours is open; nothing named is unknown, not closed', () => {
    expect(open('Ghana, Nigeria', 'Nigeria')).toBe('open'); expect(open('Worldwide', 'Nigeria')).toBe('open'); expect(open('EMEA', 'Nigeria')).toBe('open'); expect(open('Remote', 'Nigeria')).toBe('unknown'); expect(open('', 'Nigeria')).toBe('unknown');
  });
  it('and the score follows: a job for Indonesia is not a 75% match for someone in Lagos', () => {
    const ng = sanitizePreferences({ titles: ['Frontend Developer'], workModes: ['remote'], level: 'mid', country: 'Nigeria' });
    const f = scoreJob(job({ title: 'Frontend Developer', location: 'Indonesia', description: 'React TypeScript CSS' }), profile, ng); expect(f.access).toBe('restricted'); expect(f.score).toBeLessThanOrEqual(40);
  });
});
