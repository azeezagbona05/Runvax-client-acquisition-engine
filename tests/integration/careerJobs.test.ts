import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

let uid = 'cj_userA';
vi.mock('@/lib/campaignAuth', () => ({ requireCampaignUser: async () => ({ ok: true, userId: uid }) }));

import { prisma } from '@/lib/prisma';
import { clearJobCache } from '@/lib/career/jobs/sources';
import * as discover from '@/app/api/career/discover/route';
import * as jobs from '@/app/api/career/jobs/route';
import * as jobOne from '@/app/api/career/jobs/[id]/route';
import * as cron from '@/app/api/cron/career-discover/route';

const IDS = ['cj_userA', 'cj_userB'];
const req = (url: string, init?: RequestInit) => new NextRequest('http://x' + url, init as never);
const post = (b: unknown = {}, m = 'POST') => ({ method: m, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

const REMOTIVE = { jobs: [
  { id: 1, url: 'https://remotive.com/j/1', title: 'Frontend Developer', company_name: 'Acme', candidate_required_location: 'Worldwide', publication_date: '2026-11-10T10:00:00', description: '<p>Build UIs with React and TypeScript.</p>' },
  { id: 2, url: 'https://remotive.com/j/2', title: 'Warehouse Operative', company_name: 'BoxCo', candidate_required_location: 'Worldwide', description: 'Lift boxes.' },
] };
// The same Acme job again on another board, plus an unrelated one.
const ARBEIT = { data: [
  { slug: 'acme-fe', url: 'https://arbeitnow.test/acme', title: 'Frontend Developer', company_name: 'Acme', location: 'Worldwide', remote: true, description: 'React and TypeScript.', created_at: 1762700000 },
  { slug: 'chef', url: 'https://arbeitnow.test/chef', title: 'Chef', company_name: 'Kitchen', location: 'Berlin', remote: false, description: 'Cook.', created_at: 1762700000 },
] };
const LEVER = [{ id: 'z', hostedUrl: 'https://jobs.lever.co/initech/z', text: 'React Developer', categories: { location: 'Remote' }, descriptionPlain: 'React, TypeScript and CSS' }];

function stubNetwork(opts: { remotiveFails?: boolean } = {}) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (u: string) => {
    calls.push(u); const ok = (b: unknown) => ({ ok: true, status: 200, json: async () => b });
    if (u.includes('remotive.com')) return opts.remotiveFails ? { ok: false, status: 503, json: async () => ({}) } : ok(REMOTIVE);
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
  await prisma.careerPreference.create({ data: { userId: 'cj_userA', status: 'active', deployedAt: new Date(), preferences: { titles: ['Frontend Developer'], workModes: ['remote'], level: 'mid', industries: [], locations: [], country: '', currency: 'USD', salaryMin: null, salaryMax: null }, discovery: { sources: ['job_feeds', 'company_careers'], frequency: 'daily', employers: ['Initech', 'Nonexistent Co'], minScore: 75 }, permissions: { mode: 'prepare', autoMinScore: 90, autoMaxPerDay: 5, autoBlockedEmployers: [] } } });
});
beforeEach(() => { clearJobCache(); vi.unstubAllGlobals(); });

describe('career job discovery', () => {
  it('searches, de-duplicates across sources, scores, and isolates users', async () => {
    stubNetwork(); uid = 'cj_userA';
    const r = await (await discover.POST(req('/api/career/discover', post()))).json();
    expect(r.result.fetched).toBe(5);
    expect(r.result.noBoard).toEqual(['Nonexistent Co careers']);
    expect(r.result.added).toBe(2);                    // Acme (once, despite two boards) + Initech React Developer
    expect(r.result.duplicates).toBeGreaterThanOrEqual(1);
    expect(await prisma.jobListing.count({ where: { userId: 'cj_userA' } })).toBe(2);

    const m = await (await jobs.GET(req('/api/career/jobs?view=matches'))).json();
    expect(m.discovered).toBe(2); expect(m.jobs.map((j: { company: string }) => j.company)).toEqual(expect.arrayContaining(['Acme', 'Initech']));
    expect(m.jobs.every((j: { score: number }) => j.score >= 75)).toBe(true);
    expect(m.jobs[0].reasons.length).toBeGreaterThan(0); expect(m.jobs.find((j: { company: string }) => j.company === 'Acme').source).toMatch(/Remotive|Arbeitnow/);

    // a second search finds nothing new
    clearJobCache(); stubNetwork();
    const again = await (await discover.POST(req('/api/career/discover', post()))).json();
    expect(again.result.added).toBe(0);
    expect(await prisma.jobListing.count({ where: { userId: 'cj_userA' } })).toBe(2);

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
    stubNetwork({ remotiveFails: true }); uid = 'cj_userA';
    const r = await (await discover.POST(req('/api/career/discover', post()))).json();
    expect(r.result.sources.some((s: { ok: boolean; name: string }) => !s.ok && /Remotive/.test(s.name))).toBe(true);
    expect(r.result.added).toBeGreaterThan(0);
  });

  it('a paused agent does not search', async () => {
    await prisma.careerPreference.update({ where: { userId: 'cj_userA' }, data: { status: 'paused' } }); uid = 'cj_userA';
    const res = await discover.POST(req('/api/career/discover', post())); expect(res.status).toBe(400);
    await prisma.careerPreference.update({ where: { userId: 'cj_userA' }, data: { status: 'active' } });
  });

  it('the cron needs the secret, then only runs agents that are due', async () => {
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
