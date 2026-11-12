import { describe, it, expect, vi, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';

let uid = 'ca_userA';
vi.mock('@/lib/campaignAuth', () => ({ requireCampaignUser: async () => ({ ok: true, userId: uid }) }));

import { prisma } from '@/lib/prisma';
import * as root from '@/app/api/career/route';
import * as apps from '@/app/api/career/applications/route';
import * as one from '@/app/api/career/applications/[id]/route';
import * as jobs from '@/app/api/career/jobs/route';

const IDS = ['ca_userA', 'ca_userB'];
const req = (url: string, init?: RequestInit) => new NextRequest('http://x' + url, init as never);
const body = (b: unknown, method = 'POST') => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const patch = (id: string, b: unknown) => one.PATCH(req('/x', body(b, 'PATCH')), { params: Promise.resolve({ id }) });
let matchId = '', matchId2 = '';

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: IDS } } });
  for (const id of IDS) await prisma.user.create({ data: { id, email: `${id}@t.test` } });
  await prisma.careerProfile.create({ data: { userId: 'ca_userA', confirmedAt: new Date(), profile: { name: 'Ada Obi', email: '', phone: '', location: '', headline: 'Frontend Developer', summary: 'Frontend developer with five years building React applications.', skills: ['React', 'TypeScript', 'CSS'], experience: [{ title: 'Frontend Developer', company: 'Bright Labs', start: '2021', end: 'Present', location: '', bullets: ['Built a React dashboard used by 300 customers', 'Cut page load time by 40%'] }], education: [], certifications: [], achievements: [] } } });
  await prisma.careerPreference.create({ data: { userId: 'ca_userA', status: 'active', deployedAt: new Date(), preferences: { titles: ['Frontend Developer'], workModes: ['remote'], level: 'mid', industries: [], locations: [], country: '', currency: 'USD', salaryMin: null, salaryMax: null }, discovery: { sources: ['job_feeds'], frequency: 'daily', employers: [], minScore: 75 }, permissions: { mode: 'batch', autoMinScore: 90, autoMaxPerDay: 5, autoBlockedEmployers: [] } } });
  const mk = async (k: string, title: string) => (await prisma.jobListing.create({ data: { userId: 'ca_userA', source: 'remotive', externalId: k, dedupeKey: k.padEnd(40, '0'), title, company: 'Acme', location: 'Worldwide', remote: true, url: `https://remotive.com/j/${k}`, description: 'Build dashboards with React and TypeScript. Kubernetes experience is a plus.', match: { create: { userId: 'ca_userA', score: 90, reasons: ['x'] } } }, include: { match: true } })).match!.id;
  matchId = await mk('a1', 'Frontend Developer'); matchId2 = await mk('a2', 'React Developer');
});

describe('career applications', () => {
  it('prepare -> review -> edit -> approve -> mark applied; nothing is ever sent', async () => {
    const pre = await apps.POST(req('/api/career/applications', body({ matchIds: [matchId] })));
    expect(pre.status).toBe(200);
    let list = (await (await apps.GET(req('/api/career/applications'))).json()).applications;
    expect(list).toHaveLength(1);
    const a = list[0];
    expect(a.status).toBe('prepared'); expect(a.source).toBe('rules'); expect(a.job.title).toBe('Frontend Developer'); expect(a.job.source).toBe('Remotive');
    expect(a.appliedBy).toBeNull(); expect(a.appliedAt).toBeNull();
    expect(a.coverLetter).toContain('Bright Labs'); expect(a.cv.skills[0]).toMatch(/React|TypeScript/);
    expect(JSON.stringify(a.cv)).not.toMatch(/Kubernetes/);   // the job asked for it; the profile lacks it; the CV must not claim it

    // preparing again reuses the same application
    await apps.POST(req('/api/career/applications', body({ matchIds: [matchId] })));
    expect(await prisma.jobApplication.count({ where: { userId: 'ca_userA' } })).toBe(1);

    // the jobs list shows its application status
    expect((await (await jobs.GET(req('/api/career/jobs?view=all'))).json()).jobs.find((j: { id: string }) => j.id === matchId).applicationStatus).toBe('prepared');

    // edit, approve
    expect((await patch(a.id, { coverLetter: 'Dear team, I would like to apply. Ada' })).status).toBe(200);
    expect((await patch(a.id, { action: 'approve' })).status).toBe(200);
    list = (await (await apps.GET(req('/api/career/applications'))).json()).applications;
    expect(list[0]).toMatchObject({ status: 'approved', edited: true, coverLetter: 'Dear team, I would like to apply. Ada' }); expect(list[0].approvedAt).toBeTruthy();
    expect((await patch(a.id, { coverLetter: 'sneaky' })).status).toBe(400);   // locked once approved
    expect((await patch(a.id, { action: 'approve' })).status).toBe(400);

    // the candidate says they applied: recorded as THEIRS
    expect((await patch(a.id, { action: 'applied' })).status).toBe(200);
    list = (await (await apps.GET(req('/api/career/applications'))).json()).applications;
    expect(list[0]).toMatchObject({ status: 'applied', appliedBy: 'user' }); expect(list[0].appliedAt).toBeTruthy();
    expect((await patch(a.id, { action: 'reject' })).status).toBe(400);

    const log = (await (await root.GET(req('/api/career'))).json()).events.map((e: { action: string }) => e.action);
    expect(log).toEqual(expect.arrayContaining(['application_prepared', 'application_edited', 'application_approved', 'marked_applied_by_candidate']));
  });

  it('reject then prepare again gives a fresh draft; an unconfirmed profile blocks approval', async () => {
    await apps.POST(req('/api/career/applications', body({ matchIds: [matchId2] })));
    const a = (await (await apps.GET(req('/api/career/applications'))).json()).applications.find((x: { job: { title: string } }) => x.job.title === 'React Developer');
    await patch(a.id, { action: 'reject' });
    await apps.POST(req('/api/career/applications', body({ matchIds: [matchId2] })));
    expect((await prisma.jobApplication.findUnique({ where: { id: a.id } }))!.status).toBe('prepared');

    await prisma.careerProfile.update({ where: { userId: 'ca_userA' }, data: { confirmedAt: null } });
    const blocked = await patch(a.id, { action: 'approve' }); expect(blocked.status).toBe(400); expect((await blocked.json()).error).toMatch(/Confirm it again/);
    expect((await apps.POST(req('/api/career/applications', body({ matchIds: [matchId] })))).status).toBe(400);   // cannot prepare from an unconfirmed profile
    await prisma.careerProfile.update({ where: { userId: 'ca_userA' }, data: { confirmedAt: new Date() } });
  });

  it('other users cannot see or change them, and a paused agent cannot prepare', async () => {
    const mine = (await (await apps.GET(req('/api/career/applications'))).json()).applications[0];
    uid = 'ca_userB';
    expect((await (await apps.GET(req('/api/career/applications'))).json()).applications).toEqual([]);
    expect((await patch(mine.id, { action: 'reject' })).status).toBe(404);
    expect((await apps.POST(req('/api/career/applications', body({ matchIds: [matchId] })))).status).toBe(400);
    uid = 'ca_userA';
    await prisma.careerPreference.update({ where: { userId: 'ca_userA' }, data: { status: 'paused' } });
    expect((await apps.POST(req('/api/career/applications', body({ matchIds: [matchId2] })))).status).toBe(400);
    await prisma.careerPreference.update({ where: { userId: 'ca_userA' }, data: { status: 'active' } });
  });

  it('deleting career data removes jobs and applications too', async () => {
    await root.DELETE(req('/api/career', { method: 'DELETE' }));
    for (const n of await Promise.all([prisma.jobApplication.count({ where: { userId: 'ca_userA' } }), prisma.jobMatch.count({ where: { userId: 'ca_userA' } }), prisma.jobListing.count({ where: { userId: 'ca_userA' } })])) expect(n).toBe(0);
  });
});
