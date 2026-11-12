import { describe, it, expect, vi, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';

let uid = 'cm_userA';
vi.mock('@/lib/campaignAuth', () => ({ requireCampaignUser: async () => ({ ok: true, userId: uid }) }));
const sendMail = vi.fn(async (_m: { to: string; html: string }) => ({}));
vi.mock('@/lib/email', async (orig) => ({ ...(await orig<typeof import('@/lib/email')>()), createTransporter: () => ({ sendMail }) }));

import { prisma } from '@/lib/prisma';
import * as root from '@/app/api/career/route';
import * as inbox from '@/app/api/career/inbox/route';
import * as responses from '@/app/api/career/responses/route';
import * as ivs from '@/app/api/career/interviews/route';
import * as ivOne from '@/app/api/career/interviews/[id]/route';
import * as ivPrep from '@/app/api/career/interviews/[id]/prep/route';
import * as followup from '@/app/api/career/followup/route';
import * as reminders from '@/app/api/career/reminders/route';
import * as analytics from '@/app/api/career/analytics/route';
import * as cron from '@/app/api/cron/career-reminders/route';

const IDS = ['cm_userA', 'cm_userB'];
const DAY = 86_400_000;
const req = (url: string, init?: RequestInit) => new NextRequest('http://x' + url, init as never);
const body = (b: unknown, m = 'POST') => ({ method: m, headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
let appliedId = '', notAppliedId = '', staleId = '';

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: IDS } } });
  for (const id of IDS) await prisma.user.create({ data: { id, email: `${id}@t.test`, name: 'Ada Obi' } });
  await prisma.careerProfile.create({ data: { userId: 'cm_userA', confirmedAt: new Date(), profile: { name: 'Ada Obi', email: '', phone: '', location: '', headline: 'Frontend Developer', summary: '', skills: ['React', 'TypeScript'], experience: [{ title: 'Frontend Developer', company: 'Bright Labs', start: '', end: '', location: '', bullets: ['Built a React dashboard used by 300 customers'] }], education: [], certifications: [], achievements: [] } } });
  await prisma.careerPreference.create({ data: { userId: 'cm_userA', status: 'active', deployedAt: new Date(), preferences: { titles: ['Frontend Developer'], workModes: ['remote'], level: 'mid', industries: [], locations: [], country: '', currency: 'USD', salaryMin: null, salaryMax: null }, discovery: { sources: ['job_feeds'], frequency: 'daily', employers: [], minScore: 75 }, permissions: { mode: 'prepare', autoMinScore: 90, autoMaxPerDay: 5, autoBlockedEmployers: [], remindByEmail: true } } });
  const mk = async (k: string, company: string, status: string, appliedDaysAgo: number | null) => {
    const l = await prisma.jobListing.create({ data: { userId: 'cm_userA', source: 'remotive', externalId: k, dedupeKey: k.padEnd(40, '0'), title: 'Frontend Developer', company, location: 'Worldwide', remote: true, url: `https://remotive.com/${k}`, description: 'Build dashboards with React.', match: { create: { userId: 'cm_userA', score: 90, reasons: [] } } }, include: { match: true } });
    return (await prisma.jobApplication.create({ data: { userId: 'cm_userA', matchId: l.match!.id, status, cv: {}, coverLetter: 'x', answers: [], gaps: [], flags: [], appliedAt: appliedDaysAgo == null ? null : new Date(Date.now() - appliedDaysAgo * DAY), appliedBy: appliedDaysAgo == null ? null : 'user' } })).id;
  };
  appliedId = await mk('m1', 'Acme Ltd', 'applied', 3); notAppliedId = await mk('m2', 'Beta Corp', 'approved', null); staleId = await mk('m3', 'Gamma Inc', 'applied', 9);
});

describe('career management', () => {
  it('paste an email -> proposal -> confirm -> interview, reply logged, nothing stored from the email body', async () => {
    const email = 'Subject: Interview with Acme Ltd\n\nHi Ada, we would like to invite you to an interview for the Frontend Developer role at Acme Ltd. Are you free on 30 November 2099 at 2:30 PM? Join: https://acme.zoom.us/j/1';
    const p = await (await inbox.POST(req('/x', body({ text: email })))).json();
    expect(p.analysis.kind).toBe('interview'); expect(p.likelyApplicationId).toBe(appliedId); expect(p.analysis.interviewDates).toEqual(['2099-11-30T14:30']);
    expect((await inbox.POST(req('/x', body({ text: 'short' })))).status).toBe(400);
    expect(await prisma.careerResponse.count({ where: { userId: 'cm_userA' } })).toBe(0);      // analysing saves nothing

    // not allowed against an application that was never marked applied
    expect((await responses.POST(req('/x', body({ applicationId: notAppliedId, kind: 'rejected' })))).status).toBe(400);

    const ok = await responses.POST(req('/x', body({ applicationId: appliedId, kind: 'interview', subject: p.analysis.subject, summary: p.analysis.summary, receivedAt: new Date().toISOString(), interview: { startsAt: new Date(Date.now() + 20 * 3_600_000).toISOString(), kind: 'video', location: 'https://acme.zoom.us/j/1' } })));
    expect(ok.status).toBe(200); expect((await ok.json()).interviewCreated).toBe(true);
    const row = await prisma.careerResponse.findFirst({ where: { userId: 'cm_userA' } });
    expect(row!.summary.length).toBeLessThanOrEqual(600); expect(JSON.stringify(row)).not.toContain('Are you free on 30 November 2099 at 2:30 PM? Join');
    expect((await responses.POST(req('/x', body({ applicationId: appliedId, kind: 'nonsense' })))).status).toBe(400);
  });

  it('interviews: list, edit, coach prep (profile only), delete', async () => {
    const list = (await (await ivs.GET(req('/x'))).json()).interviews; expect(list).toHaveLength(1);
    const prep = await ivPrep.POST(req('/x', body({})), ctx(list[0].id)); expect(prep.status).toBe(200);
    const p = (await prep.json()).prep; expect(p.source).toBe('rules'); expect(p.questions.map((q: { talkingPoint: string }) => q.talkingPoint).join(' ')).toContain('Built a React dashboard used by 300 customers');
    expect((await prisma.careerInterview.findUnique({ where: { id: list[0].id } }))!.prep).toBeTruthy();
    expect((await ivOne.PATCH(req('/x', body({ status: 'bogus' }, 'PATCH')), ctx(list[0].id))).status).toBe(400);
    expect((await ivOne.PATCH(req('/x', body({ notes: 'bring laptop' }, 'PATCH')), ctx(list[0].id))).status).toBe(200);
    const manual = await ivs.POST(req('/x', body({ company: 'Gamma Inc', title: 'Dev', startsAt: new Date(Date.now() + 9 * DAY).toISOString(), kind: 'phone' }))); expect(manual.status).toBe(201);
    expect((await ivs.POST(req('/x', body({ company: '', title: 'Dev', startsAt: 'x' })))).status).toBe(400);
    expect((await ivOne.DELETE(req('/x', { method: 'DELETE' }), ctx((await manual.json()).interview.id))).status).toBe(200);
  });

  it('reminders: the interview, and a follow-up only for the application with no reply', async () => {
    const r = (await (await reminders.GET(req('/x'))).json()).reminders as Array<{ kind: string; title: string }>;
    expect(r.map((x) => x.kind).sort()).toEqual(['follow_up', 'interview']);
    expect(r.find((x) => x.kind === 'follow_up')!.title).toContain('Gamma Inc');      // Acme replied; Beta never applied
    const d = await followup.POST(req('/x', body({ applicationId: staleId }))); expect(d.status).toBe(200); expect((await d.json()).draft).toContain('Gamma Inc');
    expect((await followup.POST(req('/x', body({ applicationId: notAppliedId })))).status).toBe(404);
    // recording a sent follow-up removes it from today's list (the next one is 7 days away)
    await responses.POST(req('/x', body({ applicationId: staleId, kind: 'followed_up', summary: 'sent' })));
    expect(((await (await reminders.GET(req('/x'))).json()).reminders as Array<{ kind: string }>).map((x) => x.kind)).toEqual(['interview']);
  });

  it('analytics counts real records; a follow-up is not a reply', async () => {
    const a = await (await analytics.GET(req('/x'))).json();
    expect(a.funnel).toMatchObject({ discovered: 3, prepared: 3, applied: 2, replies: 1, interviews: 1 });
    expect(a.rates.replyRate).toBe(50); expect(a.rates.interviewRate).toBe(50); expect(a.bySource[0]).toMatchObject({ source: 'remotive', applied: 2, replies: 1 });
    expect(a.appliedPerWeek).toHaveLength(8);
  });

  it('daily email: one digest for the interview, once only; respects the opt-out; needs the cron secret', async () => {
    process.env.CRON_SECRET = 's'; process.env.RESEND_API_KEY = 'test';
    const hdr = { headers: { authorization: 'Bearer s' } };
    expect((await cron.GET(req('/x'))).status).toBe(401);
    const first = await (await cron.GET(req('/x', hdr))).json();
    expect(first.emailed).toBe(1); expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0]).toMatchObject({ to: 'cm_userA@t.test' }); expect(String(sendMail.mock.calls[0][0].html)).toContain('Acme Ltd');
    expect((await (await cron.GET(req('/x', hdr))).json()).emailed).toBe(0);                  // not repeated
    await prisma.careerInterview.updateMany({ where: { userId: 'cm_userA' }, data: { reminderSentAt: null } });
    const perm = (await prisma.careerPreference.findUnique({ where: { userId: 'cm_userA' } }))!.permissions as object;
    await prisma.careerPreference.update({ where: { userId: 'cm_userA' }, data: { permissions: { ...perm, remindByEmail: false } } });
    expect((await (await cron.GET(req('/x', hdr))).json()).emailed).toBe(0); expect(sendMail).toHaveBeenCalledTimes(1);
    delete process.env.RESEND_API_KEY;
  });

  it('other users see none of it, and deleting career data removes replies and interviews', async () => {
    uid = 'cm_userB';
    expect((await (await ivs.GET(req('/x'))).json()).interviews).toEqual([]); expect((await (await responses.GET(req('/x'))).json()).responses).toEqual([]);
    expect((await (await analytics.GET(req('/x'))).json()).funnel.applied).toBe(0);
    expect((await responses.POST(req('/x', body({ applicationId: appliedId, kind: 'rejected' })))).status).toBe(404);
    const iv = await prisma.careerInterview.findFirst({ where: { userId: 'cm_userA' } });
    expect((await ivOne.PATCH(req('/x', body({ status: 'done' }, 'PATCH')), ctx(iv!.id))).status).toBe(404);
    expect((await ivPrep.POST(req('/x', body({})), ctx(iv!.id))).status).toBe(404);
    uid = 'cm_userA'; await root.DELETE(req('/x', { method: 'DELETE' }));
    expect(await prisma.careerResponse.count({ where: { userId: 'cm_userA' } })).toBe(0); expect(await prisma.careerInterview.count({ where: { userId: 'cm_userA' } })).toBe(0);
  });
});
