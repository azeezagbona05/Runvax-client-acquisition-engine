import { describe, it, expect } from 'vitest';
import { levelFromYears, linksFromText, locationFromText, placeFromLocation, suggestByRules, suggestSetup, yearsOfExperience } from '@/lib/career/suggest';
import { sanitizeProfile } from '@/lib/career/types';

const NOW = new Date('2026-11-12T00:00:00Z');
const p = sanitizeProfile({
  name: 'Ada Obi', headline: 'Frontend Developer', location: 'Lagos, Nigeria',
  experience: [{ title: 'Senior Frontend Developer', company: 'Bright Labs', start: 'Jan 2021', end: 'Present', bullets: [] }, { title: 'Junior Developer', company: 'Pixel House', start: '2019', end: '2020', bullets: [] }],
});
const CV = 'Ada Obi\nada@gmail.com | Lagos, Nigeria\nlinkedin.com/in/ada-obi | github.com/adaobi | https://ada.dev/portfolio\nSkills: React';

describe('years and level', () => {
  it('counts from the earliest start to now when a role is current', () => { expect(yearsOfExperience(p, NOW)).toBe(7); });
  it('stops at the last end year when nothing is current', () => {
    expect(yearsOfExperience(sanitizeProfile({ experience: [{ title: 'A', company: 'B', start: '2015', end: '2019', bullets: [] }] }), NOW)).toBe(4);
  });
  it('no dates means unknown, and the level stays mid', () => { expect(yearsOfExperience(sanitizeProfile({}), NOW)).toBeNull(); expect(levelFromYears(null)).toBe('mid'); });
  it('maps years to a level', () => { expect([0, 2, 4, 7, 12].map((y) => levelFromYears(y))).toEqual(['entry', 'junior', 'mid', 'senior', 'lead']); });
});

describe('places and links come only from the CV text', () => {
  it('splits city and country, and does not invent a country', () => {
    expect(placeFromLocation('Lagos, Nigeria')).toEqual({ country: 'Nigeria', city: 'Lagos' });
    expect(placeFromLocation('Lagos')).toEqual({ country: '', city: 'Lagos' }); expect(placeFromLocation('')).toEqual({ country: '', city: '' });
  });
  it('finds LinkedIn, GitHub and a personal site; ignores email domains', () => {
    expect(linksFromText(CV)).toEqual({ linkedin: 'https://linkedin.com/in/ada-obi', github: 'https://github.com/adaobi', website: 'https://ada.dev/portfolio' });
    expect(linksFromText('ada@gmail.com only')).toEqual({ linkedin: '', github: '', website: '' });
  });
});

describe('location from the CV header', () => {
  it('finds City, Country, and nothing else', () => {
    expect(locationFromText('Ada Obi\nada@x.com | Lagos, Nigeria | +234 801')).toBe('Lagos, Nigeria');
    expect(locationFromText('Ada Obi\nSkills: React, Node')).toBe('');            // "React, Node" is not a place
    expect(locationFromText('Ada\nBright Labs, Acme Inc')).toBe('');
  });
  it('the suggestion uses it when the profile has no location', () => {
    const s = suggestByRules(sanitizeProfile({ headline: 'Dev' }), 'Ada\nLagos, Nigeria', NOW); expect(s.preferences.country).toBe('Nigeria'); expect(s.preferences.locations).toEqual(['Lagos']);
  });
});

describe('suggestByRules', () => {
  const s = suggestByRules(p, CV, NOW);
  it('proposes titles from the CV, a level from the years, the place, and the links', () => {
    expect(s.preferences.titles).toEqual(['Frontend Developer', 'Senior Frontend Developer', 'Junior Developer']);
    expect(s.preferences).toMatchObject({ level: 'senior', country: 'Nigeria', locations: ['Lagos'], workModes: ['remote', 'hybrid'] });
    expect(s.standing).toMatchObject({ linkedin: 'https://linkedin.com/in/ada-obi', residenceCountry: 'Nigeria' });
  });
  it('NEVER proposes what only the candidate can state', () => {
    expect(Object.keys(s.standing).sort()).toEqual(['github', 'linkedin', 'residenceCountry', 'website']);   // no work authorization, no sponsorship
    expect(JSON.stringify(s.preferences)).not.toMatch(/salary/i); expect(s.notes.join(' ')).toMatch(/only you can state/);
  });
  it('an empty CV gives an empty, harmless suggestion', () => {
    const e = suggestByRules(sanitizeProfile({}), '', NOW); expect(e.preferences.titles).toEqual([]); expect(e.standing.linkedin).toBe('');
  });
  it('without an AI provider the rules suggestion is returned', async () => { expect((await suggestSetup(p, CV)).source).toBe('rules'); });
});
