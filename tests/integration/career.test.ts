import { describe, it, expect, vi, beforeAll } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { NextRequest } from 'next/server';

// Career Agent routes against a real (disposable) MySQL. Auth is faked; no AI keys exist here, so the basic reader/writer run.
let uid = 'career_userA';
vi.mock('@/lib/campaignAuth', () => ({ requireCampaignUser: async () => ({ ok: true, userId: uid }) }));

import { prisma } from '@/lib/prisma';
import * as root from '@/app/api/career/route';
import * as cv from '@/app/api/career/cv/route';
import * as prof from '@/app/api/career/profile/route';
import * as test from '@/app/api/career/test/route';
import * as deploy from '@/app/api/career/deploy/route';
import * as suggest from '@/app/api/career/suggest/route';
import * as rewrite from '@/app/api/career/rewrite/route';

const P = (t: string) => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`;
const CV = ['Ada Obi', 'ada.obi@example.com | Lagos, Nigeria', 'Experience', '', 'Frontend Developer | Bright Labs', 'Jan 2021 - Present', '- Built a React dashboard used by 300 customers', '', 'Education', 'BSc Computer Science', 'University of Lagos, 2018', '', 'Skills', 'React, TypeScript'];
const docx = () => zipSync({ 'word/document.xml': strToU8(`<w:document><w:body>${CV.map(P).join('')}</w:body></w:document>`) });
const req = (url: string, init?: RequestInit) => new NextRequest('http://x' + url, init as never);
const j = (body: unknown, method = 'PUT') => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const IDS = ['career_userA', 'career_userB'];

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: IDS } } });
  for (const id of IDS) await prisma.user.create({ data: { id, email: `${id}@t.test` } });
});

describe('career routes', () => {
  it('upload -> review -> confirm -> settings -> test -> deploy, isolated per user', async () => {
    uid = 'career_userA';
    let s = await (await root.GET(req('/api/career'))).json();
    expect(s.status).toBe('draft'); expect(s.issues[0]).toMatch(/Upload/);

    expect((await suggest.POST(req('/api/career/suggest', { method: 'POST' }))).status).toBe(400);      // nothing to suggest from yet
    const bad = new FormData(); bad.append('file', new File(['hello'], 'cv.txt'));
    expect((await cv.POST(req('/api/career/cv', { method: 'POST', body: bad }))).status).toBe(400);

    const fd = new FormData(); fd.append('file', new File([docx() as BlobPart], 'ada.docx'));
    const up = await cv.POST(req('/api/career/cv', { method: 'POST', body: fd })); s = await up.json();
    expect(up.status).toBe(200); expect(s.profile.name).toBe('Ada Obi'); expect(s.profile.experience[0].company).toBe('Bright Labs');
    expect(s.profileConfirmed).toBe(false); expect(s.documents).toHaveLength(1);

    // What was read from the CV is kept untouched (a baseline); edits never change it, and it can always be restored
    expect(s.baseline).toEqual(s.profile); expect(s.documents.every((d: { kind: string }) => d.kind === 'uploaded')).toBe(true);
    const original = s.profile;
    let e = await (await prof.PUT(req('/api/career/profile', j({ profile: { ...original, headline: 'Rockstar Ninja' } })))).json();
    expect(e.profile.headline).toBe('Rockstar Ninja'); expect(e.baseline).toEqual(original);                  // the CV version is unchanged by the edit
    expect((await rewrite.POST(req('/api/career/rewrite', j({ kind: 'summary', text: 'Frontend developer with five years.' }, 'POST')))).status).toBe(503);   // no AI here: said plainly
    expect((await rewrite.POST(req('/api/career/rewrite', j({ kind: 'nonsense', text: 'x' }, 'POST')))).status).toBe(400);
    e = await (await prof.PUT(req('/api/career/profile', j({ revert: true })))).json();
    expect(e.profile).toEqual(original); expect(e.profileConfirmed).toBe(false);

    // "set it up for me": suggestions come from the CV, nothing is saved, and nothing the candidate alone can state is proposed
    const sg = (await (await suggest.POST(req('/api/career/suggest', { method: 'POST' }))).json()).suggestion;
    expect(sg.preferences.titles).toContain('Frontend Developer'); expect(sg.preferences.country).toBe('Nigeria'); expect(sg.preferences.level).toBe('mid');
    expect(Object.keys(sg.standing).sort()).toEqual(['github', 'linkedin', 'residenceCountry', 'website']);
    expect((await prisma.careerPreference.count({ where: { userId: 'career_userA' } }))).toBe(0);

    expect((await deploy.POST(req('/api/career/deploy', j({ action: 'deploy' }, 'POST')))).status).toBe(400);

    s = await (await prof.PUT(req('/api/career/profile', j({ profile: s.profile, confirm: true })))).json(); expect(s.profileConfirmed).toBe(true);
    s = await (await prof.PUT(req('/api/career/profile', j({ profile: { ...s.profile, headline: 'Dev' } })))).json(); expect(s.profileConfirmed).toBe(false);
    s = await (await prof.PUT(req('/api/career/profile', j({ confirm: true })))).json(); expect(s.profileConfirmed).toBe(true);

    s = await (await root.PUT(req('/api/career', j({ preferences: { titles: ['Frontend Developer'], workModes: ['remote'], salaryMin: 3000 }, discovery: { sources: ['job_feeds'], minScore: 80 }, permissions: { mode: 'batch' } })))).json();
    expect(s.issues).toEqual([]); expect(s.permissions.mode).toBe('batch');

    const t = await (await test.POST(req('/api/career/test', j({ job: 'We are hiring a Frontend Developer who knows React and TypeScript to build dashboards for customers.', role: 'Frontend Developer' }, 'POST')))).json();
    expect(t.result.source).toBe('rules'); expect(t.result.matchedSkills).toContain('React'); expect(t.result.coverLetter).toContain('Bright Labs');
    expect((await test.POST(req('/api/career/test', j({ job: 'short' }, 'POST')))).status).toBe(400);

    s = await (await deploy.POST(req('/api/career/deploy', j({ action: 'deploy' }, 'POST')))).json(); expect(s.status).toBe('active'); expect(s.deployedAt).toBeTruthy();
    s = await (await deploy.POST(req('/api/career/deploy', j({ action: 'pause' }, 'POST')))).json(); expect(s.status).toBe('paused');
    expect(s.events.map((e: { action: string }) => e.action)).toEqual(expect.arrayContaining(['cv_parsed', 'profile_confirmed', 'settings_saved', 'test_run', 'deployed', 'paused']));

    uid = 'career_userB';
    const b = await (await root.GET(req('/api/career'))).json();
    expect(b.profile).toBeNull(); expect(b.documents).toEqual([]); expect(b.events).toEqual([]); expect(b.status).toBe('draft');

    uid = 'career_userA'; await root.DELETE(req('/api/career', { method: 'DELETE' }));
    expect(await prisma.careerProfile.count({ where: { userId: 'career_userA' } })).toBe(0);
    expect(await prisma.careerAgentEvent.count({ where: { userId: 'career_userA' } })).toBe(0);
  });
});
