import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EMPLOYER_PREFIX, clearEmployerCache, employerQueries, findEmployers, fromPlaces, whereFor } from '@/lib/career/jobs/employers';
import { fromHimalayas, fromJobicy, fromRemoteOk } from '@/lib/career/jobs/sources';
import { isEuropeanCountry } from '@/lib/career/jobs/match';
import { tailorByRules } from '@/lib/career/tailor';
import { guard } from '@/lib/career/tailor';
import { sanitizePreferences, sanitizeProfile, defaultDiscovery, sanitizeDiscovery } from '@/lib/career/types';

describe('Himalayas reader', () => {
  const j = (o: object) => ({ title: 'Staff Nurse', companyName: 'CareCo', applicationLink: 'https://himalayas.app/companies/careco/jobs/staff-nurse', guid: 'g1', description: '<p>Care for <b>patients</b></p>', pubDate: 1794556821, ...o });
  it('turns a listing into a job that links back to Himalayas and says where it is open', () => {
    const [a, b] = fromHimalayas({ jobs: [j({ locationRestrictions: ['Ghana', 'Nigeria'] }), j({ guid: 'g2', locationRestrictions: [] })] });
    expect(a).toMatchObject({ source: 'himalayas', title: 'Staff Nurse', company: 'CareCo', location: 'Ghana, Nigeria', remote: true, description: 'Care for patients' }); expect(a.url).toMatch(/^https:\/\/himalayas\.app\//);
    expect(b.location).toBe('Worldwide');                                                      // no restriction listed = open worldwide
  });
  it('drops listings without a safe link or a title, and survives garbage', () => {
    expect(fromHimalayas({ jobs: [j({ applicationLink: 'javascript:alert(1)' }), j({ title: '' })] })).toEqual([]); expect(fromHimalayas(null)).toEqual([]); expect(fromHimalayas({ jobs: 5 })).toEqual([]);
  });
});

describe('employer queries: what kind of employer hires for this job', () => {
  it('maps roles to employer types, with a recruitment agency as the second stop', () => {
    expect(employerQueries(['Staff Nurse'])).toEqual(['hospital', 'recruitment agency']);
    expect(employerQueries(['Senior Accountant'])).toEqual(['accounting firm', 'recruitment agency']);
    expect(employerQueries(['Frontend Developer'])).toEqual(['software company', 'recruitment agency']);
    expect(employerQueries(['Primary School Teacher'])).toEqual(['school', 'recruitment agency']);
    expect(employerQueries(['Human Resources Manager'])).toEqual(['recruitment agency']);          // never twice
  });
  it('an unknown role still gets a sensible search, without the level word', () => { expect(employerQueries(['Senior Falconer'])).toEqual(['Falconer employer', 'recruitment agency']); expect(employerQueries([])).toEqual(['recruitment agency']); });
});

const prefs = (o: object = {}) => sanitizePreferences({ titles: ['Staff Nurse'], country: 'Ghana', locations: ['Accra'], ...o });
const nurse = sanitizeProfile({ name: 'Kwame Mensah', location: 'Accra, Ghana', skills: ['Critical care'], experience: [{ title: 'Staff Nurse', company: 'Korle Bu', start: '2021', end: 'Present', bullets: ['Cared for ventilated patients in a 12-bed ICU'] }] });
const PLACE = { id: 'ChIJabc', displayName: { text: 'Midway Hospital' }, formattedAddress: 'Tetteh Ashong Street, Accra, Ghana', websiteUri: 'https://midway.example', rating: 4.2, userRatingCount: 80, primaryTypeDisplayName: { text: 'Hospital' }, businessStatus: 'OPERATIONAL' };

describe('Google Maps employers', () => {
  beforeEach(() => clearEmployerCache());
  it('a place becomes an open-application listing that says plainly there is no vacancy', () => {
    const [x] = fromPlaces([PLACE], 'Staff Nurse', 'Accra');
    expect(x).toMatchObject({ source: 'places', externalId: 'ChIJabc', title: `${EMPLOYER_PREFIX}Staff Nurse`, company: 'Midway Hospital', remote: false, url: 'https://midway.example', location: 'Tetteh Ashong Street, Accra, Ghana' });
    expect(x.description).toMatch(/No vacancy is listed/); expect(x.description).toMatch(/rated 4.2/);
  });
  it('no website falls back to the Google Maps page; closed or nameless places are dropped', () => {
    expect(fromPlaces([{ ...PLACE, websiteUri: undefined }], 'Nurse', 'Accra')[0].url).toBe('https://www.google.com/maps/place/?q=place_id:ChIJabc');
    expect(fromPlaces([{ ...PLACE, businessStatus: 'CLOSED_PERMANENTLY' }, { id: 'x' }, { displayName: { text: 'No id' } }], 'Nurse', 'Accra')).toEqual([]);
  });
  it('searches by the person\'s own city and country, one request per kind, and caches', async () => {
    const search = vi.fn(async () => ({ places: [PLACE] }));
    const a = await findEmployers(prefs(), nurse, search as never); expect(search.mock.calls.map((c) => (c as unknown as [{ query: string }])[0].query)).toEqual(['hospital in Accra, Ghana', 'recruitment agency in Accra, Ghana']);
    expect(search.mock.calls.every((c) => (c as unknown as [{ maxPages: number }])[0].maxPages === 1)).toBe(true); expect(a!.length).toBe(2);
    await findEmployers(prefs(), nurse, search as never); expect(search).toHaveBeenCalledTimes(2);              // cached: no extra billed requests
  });
  it('takes the city from the CV when none was chosen, and does nothing without a city and country', async () => {
    expect(whereFor(prefs({ locations: [] }), nurse)).toEqual({ city: 'Accra', country: 'Ghana' });
    const search = vi.fn(); expect(await findEmployers(prefs({ country: '', locations: [] }), sanitizeProfile({}), search as never)).toBeNull(); expect(search).not.toHaveBeenCalled();
  });
});

describe('open-application letter', () => {
  it('asks whether there is an opening, never claims a posted job, and stays inside the profile', () => {
    const t = tailorByRules(nurse, 'Employer near you', 'Staff Nurse', { speculative: true, company: 'Midway Hospital' });
    expect(t.coverLetter).toMatch(/ask whether Midway Hospital has, or expects to have, an opening for a Staff Nurse/); expect(t.coverLetter).not.toMatch(/apply for the .* position/i); expect(t.coverLetter).toMatch(/If there is a suitable opening/);
    expect(guard(t.coverLetter, nurse, 'Staff Nurse at Midway Hospital, Accra').flags).toEqual([]);          // the job text names the employer, as it does in real use
  });
  it('a normal application is unchanged', () => { expect(tailorByRules(nurse, 'x', 'Staff Nurse').coverLetter).toMatch(/apply for the Staff Nurse position/); });
});

describe('where each source applies', () => {
  it('Arbeitnow (German jobs) is only for people in Europe', () => { expect(isEuropeanCountry('Germany')).toBe(true); expect(isEuropeanCountry('Nigeria')).toBe(false); });
  it('new setups look in all three kinds of place', () => { expect(defaultDiscovery().sources).toEqual(['company_careers', 'job_feeds', 'employers']); });
});

import { searchWords } from '@/lib/career/jobs/discover';
import { suggestByRules } from '@/lib/career/suggest';
describe('ordering and wording (found in the browser audit, round 2)', () => {
  it('the right kind of employer, better reviewed, ranks above a generic recruiter', () => {
    const hospital = fromPlaces([{ ...PLACE, rating: 4.5, userRatingCount: 200 }], 'Nurse', 'Accra', true)[0], agency = fromPlaces([{ ...PLACE, id: 'x2', rating: 3.2, userRatingCount: 3 }], 'Nurse', 'Accra', false)[0];
    expect(hospital.rank).toBe(10); expect(agency.rank).toBe(0); expect(fromPlaces([PLACE], 'Nurse', 'Accra', true)[0].rank).toBe(10 - 0);
  });
  it('the search words are the job title, not its department or brackets', () => {
    expect(searchWords('Staff Nurse - Intensive Care Unit')).toBe('Staff Nurse'); expect(searchWords('Registered Nurse (ICU)')).toBe('Registered Nurse'); expect(searchWords('Accountant | AR & AP')).toBe('Accountant'); expect(searchWords('  Frontend   Developer ')).toBe('Frontend Developer');
  });
  it('suggested titles drop the department and the duplicates it causes', () => {
    const p = sanitizeProfile({ headline: 'Registered Nurse (ICU)', experience: [{ title: 'Staff Nurse - Intensive Care Unit', company: 'A', start: '2021', end: 'Present', bullets: [] }, { title: 'Staff Nurse - Medical Ward', company: 'B', start: '2019', end: '2021', bullets: [] }] });
    expect(suggestByRules(p, '').preferences.titles).toEqual(['Registered Nurse (ICU)', 'Staff Nurse']);
  });
});

describe('defaults', () => {
  it('the match bar starts at 60%, where open applications and good jobs actually score', () => { expect(defaultDiscovery().minScore).toBe(60); expect(sanitizeDiscovery({}).minScore).toBe(60); expect(sanitizeDiscovery({ minScore: 75 }).minScore).toBe(75); });
});

describe('Jobicy and Remote OK readers', () => {
  it('reads a Jobicy job with its link back and where it is open', () => {
    const [a] = fromJobicy({ jobs: [{ id: 9, url: 'https://jobicy.com/jobs/9-nurse', jobTitle: 'Nurse &amp; Coach', companyName: 'CareCo', jobGeo: 'Anywhere', jobDescription: '<p>Care</p>', pubDate: '2026-11-19 10:00:00' }, { id: 10, jobTitle: 'No link' }] });
    expect(a).toMatchObject({ source: 'jobicy', title: 'Nurse & Coach', location: 'Anywhere', remote: true, description: 'Care' });
    expect(fromJobicy({ jobs: [{ id: 10, jobTitle: 'No link' }] })).toEqual([]);
    expect(fromJobicy(null)).toEqual([]);
  });
  it('skips the Remote OK legal notice and keeps real jobs', () => {
    const out = fromRemoteOk([{ legal: 'terms' }, { id: '5', url: 'https://remoteok.com/remote-jobs/5', position: 'Designer', company: 'Acme', location: '', description: '<p>Draw</p>', date: '2026-11-19T14:30:02+00:00' }]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ source: 'remoteok', title: 'Designer', location: 'Worldwide', remote: true });
  });
});
