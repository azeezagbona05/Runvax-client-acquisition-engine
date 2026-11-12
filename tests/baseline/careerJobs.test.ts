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
    expect(f.reasons.join(' ')).toMatch(/title matches/i); expect(f.reasons.join(' ')).toMatch(/3 of your skills/); expect(f.reasons.join(' ')).toMatch(/Remote/); expect(f.reasons.join(' ')).toMatch(/Fintech/);
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
