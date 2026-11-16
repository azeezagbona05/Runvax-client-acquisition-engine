import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

let uid = 'cj_userA';
vi.mock('@/lib/campaignAuth', () => ({ requireCampaignUser: async () => ({ ok: true, userId: uid }) }));

import { prisma } from '@/lib/prisma';
import { clearJobCache } from '@/lib/career/jobs/sources';
import { clearEmployerCache } from '@/lib/career/jobs/employers';
import * as discover from '@/app/api/career/discover/route';
import * as jobs from '@/app/api/career/jobs/route';
import * as jobOne from '@/app/api/career/jobs/[id]/route';
import * as cron from '@/app/api/cron/career-discover/route';
import * as appsRoute from '@/app/api/career/applications/route';

const IDS = ['cj_userA', 'cj_userB', 'cj_userC'];
const req = (url: string, init?: RequestInit) => new NextRequest('http://x' + url, init as never);
const post = (b: unknown = {}, m = 'POST') => ({ method: m, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

const HIMALAYAS = { jobs: [
  { guid: 'h1', applicationLink: 'https://himalayas.app/companies/acme/jobs/fe', title: 'Frontend Developer', companyName: 'Acme', locationRestrictions: [], description: '<p>Build UIs with React and TypeScript.</p>', pubDate: 1794556821 },
  { guid: 'h2', applicationLink: 'https://himalayas.app/companies/boxco/jobs/op', title: 'Warehouse Operative', companyName: 'BoxCo', locationRestrictions: [], description: 'Lift boxes.', pubDate: 1794556821 },
] };
// The same Acme job again on another board, plus an unrelated one.
const ARBEIT = { data: [
  { slug: 'acme-fe', url: 'https://arbeitnow.test/acme', title: 'Frontend Developer', company_name: 'Acme', location: 'Worldwide', remote: true, description: 'React and TypeScript.', created_at: 1762700000 },
  { slug: 'chef', url: 'https://arbeitnow.test/chef', title: 'Chef', company_name: 'Kitchen', location: 'Berlin', remote: false, description: 'Cook.', created_at: 1762700000 },
] };
const LEVER = [{ id: 'z', hostedUrl: 'https://jobs.lever.co/initech/z', text: 'React Developer', workplaceType: 'remote', categories: { location: 'Worldwide' }, descriptionPlain: 'React, TypeScript and CSS' }];

function stubNetwork(opts: { himalayasFails?: boolean; places?: unknown[] } = {}) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (u: string) => {
    calls.push(u); const ok = (b: unknown) => ({ ok: true, status: 200, json: async () => b });
    if (u.includes('himalayas.app')) return opts.himalayasFails ? { ok: false, status: 503, json: async () => ({}) } : ok(HIMALAYAS);
    if (u.includes('places.googleapis.com')) return ok({ places: opts.places ?? [] });
    if (u.includes('arbeitnow.com')) return ok(ARBEIT);
    if (u.includes('api.lever.co/v0/postings/initech')) return ok(LEVER);
    return { ok: false, status: 404, json: async () => ({}) };
  }));
  return calls;
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: IDS } } });
  for (const id of IDS) await prisma.user.create({ data: { id, email: `${id}@t.test` } });
  await prisma.careerProfile.create({ data: { userId: 'cj_userA', confirmedAt: new Date(), profile: { name: 'Ada', skills: ['React', 'TypeScript', 'CSS'], experience: [{ title: 'Frontend Developer', company: 'Bright Labs', start: '', end: '', location: '', bullets: [] }], education: [], certifications: [], achievements: [], email: '', phone: '', location: '', headline: '', summary: '' } } });
  await prisma.careerPreference.create({ data: { userId: 'cj_userA', status: 'active', deployedAt: new Date(), preferences: { titles: ['Frontend Developer'], workModes: ['remote'], level: 'mid', industries: [], locations: [], country: 'Nigeria', currency: 'USD', salaryMin: null, salaryMax: null }, discovery: { sources: ['job_feeds', 'company_careers'], frequency: 'daily', employers: ['Initech', 'Nonexistent Co'], minScore: 75 }, permissions: { mode: 'prepare', autoMinScore: 90, autoMaxPerDay: 5, autoBlockedEmployers: [] } } });
});
beforeAll(async () => {
  await prisma.careerProfile.create({ data: { userId: 'cj_userC', confirmedAt: new Date(), profile: { name: 'Kwame Mensah', email: '', phone: '', location: 'Accra, Ghana', headline: 'Registered Nurse', summary: '', skills: ['Critical care'], experience: [{ title: 'Staff Nurse', company: 'Korle Bu', start: '2021', end: 'Present', location: '', bullets: ['Cared for ventilated patients in a 12-bed ICU'] }], education: [], certifications: [], achievements: [] } } });
  await prisma.careerPreference.create({ data: { userId: 'cj_userC', status: 'active', deployedAt: new Date(), preferences: { titles: ['Staff Nurse'], workModes: ['onsite'], level: 'mid', industries: [], locations: ['Accra'], country: 'Ghana', currency: 'GHS', salaryMin: null, salaryMax: null }, discovery: { sources: ['employers'], frequency: 'daily', employers: [], minScore: 55 }, permissions: { mode: 'prepare', autoMinScore: 90, autoMaxPerDay: 5, autoBlockedEmployers: [], remindByEmail: true } } });
});
beforeEach(() => { clearJobCache(); clearEmployerCache(); vi.unstubAllGlobals(); });

describe('career job discovery', () => {
  it('searches, de-duplicates across sources, scores, and isolates users', async () => {
    stubNetwork(); uid = 'cj_userA';
    const r = await (await discover.POST(req('/api/career/discover', post()))).json();
    expect(r.result.fetched).toBe(3);                    // Himalayas 2 + Lever 1: Arbeitnow's German jobs are skipped for someone in Nigeria
    expect(r.result.noBoard).toEqual(['Nonexistent Co careers']);
    expect(r.result.added).toBe(3);                    // EVERYTHING found is saved: Acme, Warehouse, Initech
    expect(r.result.relevant).toBe(2); expect(r.result.matched).toBe(2);
    expect(await prisma.jobListing.count({ where: { userId: 'cj_userA' } })).toBe(3);

    const m = await (await jobs.GET(req('/api/career/jobs?view=matches'))).json();
    expect(m.discovered).toBe(3); expect(m.jobs.map((j: { company: string }) => j.company).sort()).toEqual(['Acme', 'Initech']);        // best matches only here...
    const everything = await (await jobs.GET(req('/api/career/jobs?view=all'))).json(); expect(everything.total).toBe(3); expect(everything.jobs.map((j: { company: string }) => j.company).sort()).toEqual(['Acme', 'BoxCo', 'Initech']);   // ...but all of it is browsable
    expect(m.jobs.every((j: { score: number }) => j.score >= 75)).toBe(true);
    expect(m.jobs[0].reasons.length).toBeGreaterThan(0); expect(m.jobs.find((j: { company: string }) => j.company === 'Acme').source).toMatch(/Himalayas|Arbeitnow/);

    // a second search finds nothing new
    clearJobCache(); stubNetwork();
    const again = await (await discover.POST(req('/api/career/discover', post()))).json();
    expect(again.result.added).toBe(0);
    expect(await prisma.jobListing.count({ where: { userId: 'cj_userA' } })).toBe(3);

    // triage: dismiss hides it from matches; saving shows it under Saved
    const [first, second] = m.jobs;
    expect((await jobOne.PATCH(req('/x', post({ status: 'dismissed' }, 'PATCH')), { params: Promise.resolve({ id: first.id }) })).status).toBe(200);
    expect((await jobOne.PATCH(req('/x', post({ status: 'saved' }, 'PATCH')), { params: Promise.resolve({ id: second.id }) })).status).toBe(200);
    expect((await (await jobs.GET(req('/api/career/jobs?view=matches'))).json()).jobs).toHaveLength(1);
    expect((await (await jobs.GET(req('/api/career/jobs?view=saved'))).json()).jobs[0].id).toBe(second.id);

    // user B cannot see or touch user A's jobs
    uid = 'cj_userB';
    expect((await (await jobs.GET(req('/api/career/jobs?view=all'))).json()).jobs).toEqual([]);
    expect((await jobOne.PATCH(req('/x', post({ status: 'saved' }, 'PATCH')), { params: Promise.resolve({ id: first.id }) })).status).toBe(404);
    expect((await discover.POST(req('/api/career/discover', post()))).status).toBe(400);   // B has not deployed
  });

  it('a failing source is reported and the others still work', async () => {
    await prisma.jobListing.deleteMany({ where: { userId: 'cj_userA' } });
    stubNetwork({ himalayasFails: true }); uid = 'cj_userA';
    const r = await (await discover.POST(req('/api/career/discover', post()))).json();
    expect(r.result.sources.some((s: { ok: boolean; name: string }) => !s.ok && /Himalayas/.test(s.name))).toBe(true);
    expect(r.result.added).toBeGreaterThan(0);
  });

  it('a paused agent does not search', async () => {
    await prisma.careerPreference.update({ where: { userId: 'cj_userA' }, data: { status: 'paused' } }); uid = 'cj_userA';
    const res = await discover.POST(req('/api/career/discover', post())); expect(res.status).toBe(400);
    await prisma.careerPreference.update({ where: { userId: 'cj_userA' }, data: { status: 'active' } });
  });

  it('the cron needs the secret, then only runs agents that are due', async () => {
    await prisma.careerPreference.update({ where: { userId: 'cj_userC' }, data: { status: 'paused' } });          // only user A is in play here
    process.env.CRON_SECRET = 's3cret';
    expect((await cron.GET(req('/api/cron/career-discover'))).status).toBe(401);
    stubNetwork();
    const ok = await (await cron.GET(req('/api/cron/career-discover', { headers: { authorization: 'Bearer s3cret' } }))).json();
    expect(ok.ran).toBe(0);   // user A searched moments ago, so nothing is due
    await prisma.careerAgentEvent.deleteMany({ where: { userId: 'cj_userA', action: 'discovery_run' } });
    clearJobCache();
    const due = await (await cron.GET(req('/api/cron/career-discover', { headers: { authorization: 'Bearer s3cret' } }))).json();
    expect(due.ran).toBeGreaterThanOrEqual(1);
  });
});


describe('browsing everything that was found', () => {
  it('search, source filter, sort, paging and the dismissed list all work, and only on your own jobs', async () => {
    await prisma.jobListing.deleteMany({ where: { userId: 'cj_userA' } }); stubNetwork(); uid = 'cj_userA';
    await discover.POST(req('/api/career/discover', post()));
    const get = async (qs: string) => (await jobs.GET(req(`/api/career/jobs?${qs}`))).json();
    expect((await get('view=all&q=acme')).jobs.map((j: { company: string }) => j.company)).toEqual(['Acme']);
    expect((await get('view=all&q=boxco')).total).toBe(1);
    expect((await get('view=all&source=lever')).jobs.every((j: { sourceId: string }) => j.sourceId === 'lever')).toBe(true);
    const all = await get('view=all'); expect(all.sources.map((s: { id: string }) => s.id).sort()).toEqual(['himalayas', 'lever']);
    const p1 = await get('view=all&limit=2&offset=0'), p2 = await get('view=all&limit=2&offset=2');
    expect([p1.jobs.length, p2.jobs.length, p1.total]).toEqual([2, 1, 3]); expect(new Set([...p1.jobs, ...p2.jobs].map((j: { id: string }) => j.id)).size).toBe(3);       // pages do not overlap
    expect((await get('view=all&limit=9999')).limit).toBe(60);                                                                                            // the page size is capped
    const scores = (await get('view=all&sort=score')).jobs.map((j: { score: number }) => j.score); expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    const first = all.jobs[0]; await jobOne.PATCH(req('/x', post({ status: 'dismissed' }, 'PATCH')), { params: Promise.resolve({ id: first.id }) });
    expect((await get('view=all')).total).toBe(2); expect((await get('view=dismissed')).jobs.map((j: { id: string }) => j.id)).toEqual([first.id]);
    uid = 'cj_userB'; expect((await get('view=all')).total).toBe(0); expect((await get('view=all&q=acme')).jobs).toEqual([]);
  });
});

describe('Google Maps employers (open applications)', () => {
  beforeAll(async () => { await prisma.careerPreference.update({ where: { userId: 'cj_userC' }, data: { status: 'active' } }); });          // an earlier test paused this user
  const PLACE = { id: 'ChIJmidway', displayName: { text: 'Midway Hospital' }, formattedAddress: 'Tetteh Ashong Street, Accra, Ghana', websiteUri: 'https://midway.example', rating: 4.2, userRatingCount: 80, primaryTypeDisplayName: { text: 'Hospital' }, businessStatus: 'OPERATIONAL' };
  it('finds employers in the person\'s city, saves them as open applications, and does not search again within a week', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-key'; uid = 'cj_userC'; const calls = stubNetwork({ places: [PLACE] });
    const r = await (await discover.POST(req('/api/career/discover', post()))).json();
    expect(calls.filter((u) => u.includes('places.googleapis.com')).length).toBe(2);                       // hospital + recruitment agency: two billed requests, no more
    expect(r.result.added).toBe(1);
    const l = await prisma.jobListing.findFirstOrThrow({ where: { userId: 'cj_userC' }, include: { match: true } });
    expect(l).toMatchObject({ source: 'places', externalId: 'ChIJmidway', title: 'Open application: Staff Nurse', company: 'Midway Hospital', remote: false });
    expect(l.match!.score).toBeGreaterThanOrEqual(55); expect((l.match!.reasons as string[])[0]).toMatch(/No vacancy is listed/);
    const again = await (await discover.POST(req('/api/career/discover', post()))).json(); stubNetwork({ places: [PLACE] });
    expect(again.result.notes.join(' ')).toMatch(/refreshed in the last week/); expect(again.result.added).toBe(0);
  });
  it('never suggests an open application to the organisation the person already works for', async () => {
    const own = { ...PLACE, id: 'ChIJkorle', displayName: { text: 'Korle Bu Teaching Hospital' } };           // userC's current employer is "Korle Bu"
    await prisma.jobListing.deleteMany({ where: { userId: 'cj_userC' } }); clearEmployerCache(); stubNetwork({ places: [PLACE, own] }); uid = 'cj_userC';
    await discover.POST(req('/api/career/discover', post()));
    expect((await prisma.jobListing.findMany({ where: { userId: 'cj_userC' } })).map((l) => l.company)).toEqual(['Midway Hospital']);
    await prisma.jobListing.deleteMany({ where: { userId: 'cj_userC' } });
  });
  it('the prepared application is an enquiry, not an application for a job that does not exist', async () => {
    clearEmployerCache(); stubNetwork({ places: [PLACE] }); await discover.POST(req('/api/career/discover', post()));
    const m = await prisma.jobMatch.findFirstOrThrow({ where: { userId: 'cj_userC' } });
    const res = await appsRoute.POST(req('/api/career/applications', post({ matchIds: [m.id] }))); expect(res.status).toBe(200);
    const a = (await (await appsRoute.GET(req('/api/career/applications'))).json()).applications[0];
    expect(a.coverLetter).toMatch(/ask whether Midway Hospital has, or expects to have, an opening for a Staff Nurse/); expect(a.coverLetter).not.toMatch(/apply for the .* position/);
    expect(a.job.source).toBe('Google Maps');
  });
  it('Google Maps data is removed after 30 days, but never a saved one or one with an application', async () => {
    const old = new Date(Date.now() - 31 * 86_400_000); const mk = (id: string, name: string) => prisma.jobListing.create({ data: { userId: 'cj_userC', source: 'places', externalId: id, dedupeKey: id.padEnd(40, '0'), title: 'Open application: Staff Nurse', company: name, location: 'Accra', url: 'https://x.test', description: 'd', createdAt: old, match: { create: { userId: 'cj_userC', score: 60, reasons: [] } } }, include: { match: true } });
    const stale = await mk('stale', 'Stale Clinic'), kept = await mk('kept', 'Saved Clinic'); await prisma.jobMatch.update({ where: { id: kept.match!.id }, data: { status: 'saved' } });
    await prisma.jobListing.updateMany({ where: { userId: 'cj_userC', externalId: 'ChIJmidway' }, data: { createdAt: old } });         // has an application
    stubNetwork({ places: [] }); await discover.POST(req('/api/career/discover', post()));
    const left = (await prisma.jobListing.findMany({ where: { userId: 'cj_userC' } })).map((x) => x.externalId).sort();
    expect(left).toEqual(['ChIJmidway', 'kept']); expect(left).not.toContain(stale.externalId);
  });
  it('without a city and country there is nothing to search, and it says so', async () => {
    await prisma.careerPreference.update({ where: { userId: 'cj_userC' }, data: { preferences: { titles: ['Staff Nurse'], workModes: ['onsite'], level: 'mid', industries: [], locations: [], country: '', currency: 'GHS', salaryMin: null, salaryMax: null } } });
    await prisma.careerProfile.update({ where: { userId: 'cj_userC' }, data: { profile: { name: 'K', email: '', phone: '', location: '', headline: '', summary: '', skills: [], experience: [], education: [], certifications: [], achievements: [] } } });
    await prisma.jobListing.deleteMany({ where: { userId: 'cj_userC' } }); const calls = stubNetwork({ places: [PLACE] });
    const r = await (await discover.POST(req('/api/career/discover', post()))).json();
    expect(r.result.notes.join(' ')).toMatch(/needs your city and country/); expect(calls.filter((u) => u.includes('places.googleapis.com'))).toHaveLength(0);
  });
});
