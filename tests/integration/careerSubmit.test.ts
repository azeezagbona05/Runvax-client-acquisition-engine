import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { NextRequest } from 'next/server';

let uid = 'cs_userA';
vi.mock('@/lib/campaignAuth', () => ({ requireCampaignUser: async () => ({ ok: true, userId: uid }) }));

import { prisma } from '@/lib/prisma';
import * as subs from '@/app/api/career/submissions/route';
import * as subOne from '@/app/api/career/submissions/[id]/route';
import * as appOne from '@/app/api/career/applications/[id]/route';
import * as deploy from '@/app/api/career/deploy/route';
import * as root from '@/app/api/career/route';
import { autoSubmitFor, claimNext, finishSubmission, queueSubmissions, reapStale } from '@/lib/career/submit/queue';
import { runExecutor } from '@/lib/career/submit/executor';
import { sanitizeProfile } from '@/lib/career/types';

const IDS = ['cs_userA', 'cs_userB'];
const req = (url: string, init?: RequestInit) => new NextRequest('http://x' + url, init as never);
const body = (b: unknown, m = 'POST') => ({ method: m, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const UUID = (n: number) => `6ed76ce8-4156-4b60-b120-${String(n).padStart(12, '0')}`;
const PERM = (o: object = {}) => ({ mode: 'batch', autoMinScore: 90, autoMaxPerDay: 5, autoBlockedEmployers: [], remindByEmail: true, ...o });
let n = 0;

async function mkApp(o: { company?: string; source?: 'lever' | 'greenhouse' | 'remotive'; status?: string; score?: number; user?: string; noApp?: boolean } = {}) {
  n++; const user = o.user ?? 'cs_userA'; const source = o.source ?? 'lever';
  const l = await prisma.jobListing.create({ data: { userId: user, source, externalId: source === 'greenhouse' ? `acme/${100000 + n}` : source === 'lever' ? `lv${n}` : `rm${n}`, dedupeKey: `k${n}`.padEnd(40, '0'), title: 'Frontend Developer', company: o.company ?? `Co${n}`, location: 'Remote', remote: true, url: source === 'lever' ? `https://jobs.lever.co/acme/${UUID(n)}` : `https://x.test/${n}`, description: 'Build dashboards with React and TypeScript.', match: { create: { userId: user, score: o.score ?? 80, reasons: [] } } }, include: { match: true } });
  if (o.noApp) return { matchId: l.match!.id, appId: '' };
  const a = await prisma.jobApplication.create({ data: { userId: user, matchId: l.match!.id, status: o.status ?? 'approved', approvedAt: new Date(), cv: sanitizeProfile({ name: 'Ada Obi', email: 'ada@example.com', phone: '+234 801 234 5678', location: 'Lagos', skills: ['React'] }) as object, coverLetter: 'Dear team', answers: [{ question: 'Why do you want this role?', answer: 'I build React dashboards.' }], gaps: [], flags: [] } });
  return { matchId: l.match!.id, appId: a.id };
}
const clean = async () => { await prisma.applicationSubmission.deleteMany({ where: { userId: { in: IDS } } }); await prisma.jobApplication.deleteMany({ where: { userId: { in: IDS } } }); await prisma.jobListing.deleteMany({ where: { userId: { in: IDS } } }); };

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: IDS } } });
  for (const id of IDS) await prisma.user.create({ data: { id, email: `${id}@t.test` } });
  await prisma.careerProfile.create({ data: { userId: 'cs_userA', confirmedAt: new Date(), profile: { name: 'Ada Obi', email: 'ada@example.com', phone: '+234 801 234 5678', location: 'Lagos', headline: 'Frontend Developer', summary: '', skills: ['React', 'TypeScript'], experience: [{ title: 'Frontend Developer', company: 'Bright Labs', start: '', end: 'Present', location: '', bullets: ['Built a React dashboard used by 300 customers'] }], education: [], certifications: [], achievements: [] } } });
  await prisma.careerPreference.create({ data: { userId: 'cs_userA', status: 'active', deployedAt: new Date(), preferences: { titles: ['Frontend Developer'], workModes: ['remote'], level: 'mid', industries: [], locations: [], country: '', currency: 'USD', salaryMin: null, salaryMax: null }, discovery: { sources: ['job_feeds'], frequency: 'daily', employers: [], minScore: 75 }, permissions: PERM() } });
});
afterAll(() => { delete process.env.CAREER_AUTOSUBMIT; });

describe('submission queue', () => {
  it('is OFF by default, and says so', async () => {
    delete process.env.CAREER_AUTOSUBMIT; const { appId } = await mkApp();
    const r = await subs.POST(req('/x', body({ applicationIds: [appId] }))); expect(r.status).toBe(400); expect((await r.json()).error).toMatch(/switched off/);
    expect((await (await subs.GET(req('/x'))).json()).enabled).toBe(false); expect(await prisma.applicationSubmission.count()).toBe(0);
  });

  it('queues only approved applications on supported forms, once, and respects the permission', async () => {
    process.env.CAREER_AUTOSUBMIT = '1'; await clean();
    const lever = await mkApp({ source: 'lever' }), gh = await mkApp({ source: 'greenhouse' }), other = await mkApp({ source: 'remotive' }), prepared = await mkApp({ status: 'prepared' });
    const res = await queueSubmissions('cs_userA', [lever.appId, gh.appId, other.appId, prepared.appId], 'user');
    expect(res.filter((r) => r.ok)).toHaveLength(2);
    expect(res.find((r) => r.applicationId === other.appId)!.error).toMatch(/no supported application form/i);
    expect(res.find((r) => r.applicationId === prepared.appId)!.error).toMatch(/approve it first/i);
    expect((await queueSubmissions('cs_userA', [lever.appId], 'user'))[0].error).toMatch(/already waiting/);                 // no double queue
    expect((await queueSubmissions('cs_userA', [prepared.appId], 'check'))[0].ok).toBe(true);                               // a dry-run check may look at prepared ones
    await prisma.careerPreference.update({ where: { userId: 'cs_userA' }, data: { permissions: PERM({ mode: 'prepare' }) } });
    expect((await queueSubmissions('cs_userA', [other.appId], 'user'))[0].error).toMatch(/Prepare applications only/);
    await prisma.careerPreference.update({ where: { userId: 'cs_userA' }, data: { permissions: PERM() } });
  });

  it('the worker lock: two workers cannot take the same job; order is oldest first', async () => {
    await clean(); const a = await mkApp(), b = await mkApp();
    await queueSubmissions('cs_userA', [a.appId], 'user'); await new Promise((r) => setTimeout(r, 15)); await queueSubmissions('cs_userA', [b.appId], 'user');
    const [x, y, z] = await Promise.all([claimNext(), claimNext(), claimNext()]);
    const got = [x, y, z].filter(Boolean); expect(got).toHaveLength(2); expect(new Set(got.map((g) => g!.submission.id)).size).toBe(2);
    expect(got.every((g) => g!.target?.platform === 'lever' && g!.target.applyUrl.endsWith('/apply'))).toBe(true);
    expect((await prisma.applicationSubmission.findMany({ where: { userId: 'cs_userA', status: 'running' } })).every((s) => s.attempts === 1)).toBe(true);
  });

  it('outcomes: needs_you leaves the application alone; submitted marks it applied BY THE AGENT with evidence; it cannot be queued again', async () => {
    await clean(); const a = await mkApp(); const b = await mkApp();
    const [qa] = await queueSubmissions('cs_userA', [a.appId], 'user'); const j1 = (await claimNext())!;
    await finishSubmission(qa.submissionId!, { status: 'needs_you', reason: 'Needs a question answered.', questions: [{ label: 'Kubernetes?', reason: 'No approved answer fits this question.' }], steps: [], evidence: '', finalUrl: '' }, j1.label);
    expect((await prisma.jobApplication.findUnique({ where: { id: a.appId } }))!.status).toBe('approved');
    expect((await queueSubmissions('cs_userA', [a.appId], 'user'))[0].ok).toBe(true);                                       // a retry is allowed after needs_you

    const [qb] = await queueSubmissions('cs_userA', [b.appId], 'user'); await claimNext(); await claimNext();
    await finishSubmission(qb.submissionId!, { status: 'submitted', reason: 'The site confirmed the application.', questions: [], steps: [{ label: 'Email', source: 'profile' }], evidence: 'Thank you for applying to Co', finalUrl: 'https://jobs.lever.co/x/thanks' }, 'x');
    const app = (await prisma.jobApplication.findUnique({ where: { id: b.appId } }))!; expect(app).toMatchObject({ status: 'applied', appliedBy: 'agent' }); expect(app.appliedAt).toBeTruthy();
    expect((await queueSubmissions('cs_userA', [b.appId], 'user'))[0].error).toMatch(/already submitted/);
    expect((await appOne.PATCH(req('/x', body({ action: 'applied' }, 'PATCH')), ctx(b.appId))).status).toBe(400);              // provenance cannot be overwritten
    const list = (await (await (await import('@/app/api/career/applications/route')).GET(req('/x'))).json()).applications.find((x: { id: string }) => x.id === b.appId);
    expect(list.submission).toMatchObject({ status: 'submitted', evidence: 'Thank you for applying to Co' }); expect(list.appliedBy).toBe('agent');
  });

  it('"unconfirmed" is never retried; a dead worker becomes unconfirmed, not queued again', async () => {
    await clean(); const a = await mkApp(); const [q] = await queueSubmissions('cs_userA', [a.appId], 'user'); await claimNext();
    await finishSubmission(q.submissionId!, { status: 'unconfirmed', reason: 'No confirmation.', questions: [], steps: [], evidence: '', finalUrl: '' }, 'x');
    expect((await queueSubmissions('cs_userA', [a.appId], 'user'))[0].error).toMatch(/could not be confirmed/);
    const b = await mkApp(); const [q2] = await queueSubmissions('cs_userA', [b.appId], 'user'); await claimNext();
    await prisma.applicationSubmission.update({ where: { id: q2.submissionId! }, data: { startedAt: new Date(Date.now() - 20 * 60_000) } }); await reapStale();
    expect((await prisma.applicationSubmission.findUnique({ where: { id: q2.submissionId! } }))!.status).toBe('unconfirmed');
    expect(await claimNext()).toBeNull();
  });

  it('cancelling: the queue entry, applying yourself, rejecting, and pausing all stop a waiting submission', async () => {
    await clean(); const a = await mkApp(), b = await mkApp(), c = await mkApp();
    const [qa, qb, qc] = await queueSubmissions('cs_userA', [a.appId, b.appId, c.appId], 'user');
    expect((await subOne.DELETE(req('/x', { method: 'DELETE' }), ctx(qa.submissionId!))).status).toBe(200);
    expect((await appOne.PATCH(req('/x', body({ action: 'applied' }, 'PATCH')), ctx(b.appId))).status).toBe(200);
    expect((await prisma.applicationSubmission.findUnique({ where: { id: qb.submissionId! } }))!.status).toBe('cancelled');
    expect((await deploy.POST(req('/x', body({ action: 'pause' })))).status).toBe(200);
    expect((await prisma.applicationSubmission.findUnique({ where: { id: qc.submissionId! } }))!.status).toBe('cancelled');
    expect((await queueSubmissions('cs_userA', [c.appId], 'user'))[0].error).toMatch(/paused/);
    expect(await claimNext()).toBeNull();
    await deploy.POST(req('/x', body({ action: 'resume' })));
  });

  it('daily cap holds whatever the settings say', async () => {
    await clean(); const a = await mkApp();
    const base = await mkApp(); for (let i = 0; i < 15; i++) await prisma.applicationSubmission.create({ data: { userId: 'cs_userA', applicationId: base.appId, platform: 'lever', status: 'cancelled', trigger: 'user' } });
    expect((await queueSubmissions('cs_userA', [a.appId], 'user'))[0].error).toMatch(/daily limit/);
  });

  it('users are isolated', async () => {
    await clean(); const a = await mkApp();
    uid = 'cs_userB'; expect((await queueSubmissions('cs_userB', [a.appId], 'user'))[0].ok).toBe(false);
    expect(((await (await subs.GET(req('/x'))).json()).supported as string[])).toEqual([]);
    uid = 'cs_userA'; expect(((await (await subs.GET(req('/x'))).json()).supported as string[])).toEqual([a.appId]);
  });
});

describe('automatic mode (the candidate\'s own rules)', () => {
  it('prepares, approves and queues only strong, allowed, supported matches, within the daily limit', async () => {
    await clean(); process.env.CAREER_AUTOSUBMIT = '1';
    const strong = await mkApp({ noApp: true, score: 95, company: 'Strong Co' }), weak = await mkApp({ noApp: true, score: 80, company: 'Weak Co' }), blocked = await mkApp({ noApp: true, score: 96, company: 'Evil Corp' }), unsupported = await mkApp({ noApp: true, score: 97, source: 'remotive' });
    await prisma.careerPreference.update({ where: { userId: 'cs_userA' }, data: { permissions: PERM({ mode: 'batch' }) } });
    expect(await autoSubmitFor('cs_userA')).toEqual({ prepared: 0, queued: 0 });                                              // not in auto mode: does nothing
    await prisma.careerPreference.update({ where: { userId: 'cs_userA' }, data: { permissions: PERM({ mode: 'auto', autoBlockedEmployers: ['evil'] }) } });
    expect(await autoSubmitFor('cs_userA')).toEqual({ prepared: 1, queued: 1 });
    const apps = await prisma.jobApplication.findMany({ where: { userId: 'cs_userA' } }); expect(apps).toHaveLength(1); expect(apps[0].matchId).toBe(strong.matchId); expect(apps[0].status).toBe('approved');
    const s = await prisma.applicationSubmission.findFirst({ where: { userId: 'cs_userA' } }); expect(s!.trigger).toBe('rules');
    for (const m of [weak, blocked, unsupported]) expect(await prisma.jobApplication.count({ where: { matchId: m.matchId } })).toBe(0);
    expect((await prisma.careerAgentEvent.findMany({ where: { userId: 'cs_userA', action: 'application_auto_approved' } }))).toHaveLength(1);
    expect(await autoSubmitFor('cs_userA')).toEqual({ prepared: 0, queued: 0 });                                              // nothing else qualifies
  });
  it('autoMaxPerDay is a hard limit', async () => {
    await clean(); await mkApp({ noApp: true, score: 95 }); await mkApp({ noApp: true, score: 95 });
    await prisma.careerPreference.update({ where: { userId: 'cs_userA' }, data: { permissions: PERM({ mode: 'auto', autoMaxPerDay: 1 }) } });
    expect((await autoSubmitFor('cs_userA')).queued).toBe(1); expect((await autoSubmitFor('cs_userA')).queued).toBe(0);
    await prisma.careerPreference.update({ where: { userId: 'cs_userA' }, data: { permissions: PERM() } });
  });
  it('does nothing when the switch is off', async () => {
    await clean(); await mkApp({ noApp: true, score: 95 }); delete process.env.CAREER_AUTOSUBMIT;
    await prisma.careerPreference.update({ where: { userId: 'cs_userA' }, data: { permissions: PERM({ mode: 'auto' }) } });
    expect(await autoSubmitFor('cs_userA')).toEqual({ prepared: 0, queued: 0 }); process.env.CAREER_AUTOSUBMIT = '1';
    await prisma.careerPreference.update({ where: { userId: 'cs_userA' }, data: { permissions: PERM() } });
  });
});

describe('worker round trip with a real browser (local fixture, no employer contacted)', () => {
  let server: http.Server; let base = ''; const posts: string[] = [];
  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.method === 'POST') { const c: Buffer[] = []; req.on('data', (d) => c.push(d)); req.on('end', () => { posts.push(Buffer.concat(c).toString('latin1')); res.writeHead(200, { 'content-type': 'text/html' }); res.end('<h1>Application submitted!</h1>'); }); return; }
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<form method="POST" enctype="multipart/form-data"><label for="name">Full name</label><input id="name" name="name" required><label for="email">Email</label><input id="email" name="email" type="email" required><label for="resume">Resume/CV</label><input id="resume" name="resume" type="file"><button type="submit">Submit application</button></form>');
    });
    await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok)); base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  });
  afterAll(() => new Promise<void>((ok) => server.close(() => ok())));
  it('queue -> claim -> real submit on the fixture -> confirmation -> application marked applied by the agent', async () => {
    await clean(); const a = await mkApp(); const [q] = await queueSubmissions('cs_userA', [a.appId], 'user'); const job = (await claimNext())!;
    expect(job.target!.platform).toBe('lever');
    const res = await runExecutor({ applyUrl: base, platform: 'fixture', cv: job.cv, coverLetter: job.coverLetter, answers: job.answers, mode: 'submit', extraHosts: [new URL(base).host], confirmWaitMs: 3000 });
    expect(res.status).toBe('submitted'); await finishSubmission(q.submissionId!, res, job.label);
    expect(posts).toHaveLength(1); expect(posts[0]).toContain('ada@example.com'); expect(posts[0]).toContain('%PDF-');
    expect(await prisma.jobApplication.findUnique({ where: { id: a.appId } })).toMatchObject({ status: 'applied', appliedBy: 'agent' });
    expect((await prisma.applicationSubmission.findUnique({ where: { id: q.submissionId! } }))!.evidence).toMatch(/Application submitted/);
  });
});

describe('deleting career data', () => {
  it('removes submissions too', async () => {
    uid = 'cs_userA'; await root.DELETE(req('/x', { method: 'DELETE' }));
    expect(await prisma.applicationSubmission.count({ where: { userId: 'cs_userA' } })).toBe(0); expect(await prisma.jobApplication.count({ where: { userId: 'cs_userA' } })).toBe(0);
  });
});
