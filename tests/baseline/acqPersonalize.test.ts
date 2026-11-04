import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  campaign: vi.fn(), user: vi.fn(), leads: vi.fn(), update: vi.fn(), count: vi.fn(), compose: vi.fn(), ai: vi.fn(),
  auth: { ok: true as boolean },
}));
vi.mock('@/lib/prisma', () => ({ prisma: { outreachCampaign: { findFirst: m.campaign }, user: { findUnique: m.user }, outreachLead: { findMany: m.leads, update: m.update, count: m.count } } }));
vi.mock('@/lib/campaignAuth', () => ({ requireCampaignUser: async () => (m.auth.ok ? { ok: true, userId: 'u1' } : { ok: false, response: new Response('{}', { status: 401 }) }) }));
vi.mock('@/lib/usage', () => ({ checkAndIncrementAIForUser: m.ai }));
vi.mock('@/lib/outreach/compose', () => ({ composeOutreach: m.compose }));
vi.mock('@/lib/rateLimiter', () => ({ rateLimit: () => ({ ok: true }) }));

import { POST } from '@/app/api/outreach-campaigns/[id]/personalize/route';
import { isNotInstalled, notInstalledResponse, guardInstalled } from '@/lib/v2Setup';
import { NextResponse } from 'next/server';

const req = (body: unknown = {}) => new NextRequest('http://x/api/outreach-campaigns/c1/personalize', { method: 'POST', body: JSON.stringify(body) });
const ctx = { params: { id: 'c1' } };
const lead = (n: number) => ({ id: `l${n}`, email: `p${n}@clinic${n}.ng`, name: n === 1 ? 'Ada Obi' : null, business: `Clinic ${n}`, website: n === 1 ? 'clinic1.ng' : null });

beforeEach(() => {
  m.auth.ok = true;
  m.campaign.mockReset().mockResolvedValue({ id: 'c1' });
  m.user.mockReset().mockResolvedValue({ plan: 'pro' });
  m.leads.mockReset().mockResolvedValue([lead(1), lead(2)]);
  m.update.mockReset().mockResolvedValue({});
  m.count.mockReset().mockResolvedValue(5);
  m.ai.mockReset().mockResolvedValue({ ok: true });
  m.compose.mockReset().mockImplementation(async ({ business }: { business: { name: string } }) => ({ emailSubject: `Hello ${business.name}`, emailBody: `A pitch for ${business.name}`, whatsapp: 'x' }));
});

describe('personalise with the RUNVAX pitch engine', () => {
  it('writes each waiting lead its own first email and stores it', async () => {
    const res = await POST(req({ offer: 'ai_system' }), ctx);
    expect(await res.json()).toEqual({ done: 2, failed: 0, left: 5 });
    expect(m.update).toHaveBeenCalledWith({ where: { id: 'l1' }, data: { customSubject: 'Hello Clinic 1', customBody: 'A pitch for Clinic 1' } });
    expect(m.update).toHaveBeenCalledTimes(2);
  });
  it('calls the V1 engine without a user id, so nothing is recorded in the prospecting product', async () => {
    await POST(req({ offer: 'ai_system' }), ctx);
    const args = m.compose.mock.calls[0][0] as Record<string, unknown>;
    expect(args).not.toHaveProperty('userId');
    expect(args.offer).toBe('ai_system');
    expect(args.business).toMatchObject({ id: 'acq-l1', name: 'Clinic 1', email: 'p1@clinic1.ng', hasWebsite: true, website: 'https://clinic1.ng', decisionMaker: { name: 'Ada Obi' } });
    expect((m.compose.mock.calls[1][0] as { business: { hasWebsite: boolean } }).business.hasWebsite).toBe(false);
  });
  it('defaults to the website offer and only picks leads that are waiting and not yet written', async () => {
    await POST(req({ offer: 'bogus' }), ctx);
    expect((m.compose.mock.calls[0][0] as { offer: string }).offer).toBe('website');
    expect(m.leads.mock.calls[0][0].where).toEqual({ campaignId: 'c1', status: 'queued', customBody: null });
  });
  it('counts one AI call per lead and stops when the allowance is used up', async () => {
    m.ai.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, code: 'LIMIT' });
    const j = await (await POST(req(), ctx)).json();
    expect(j.done).toBe(1);
    expect(j.stopped).toMatch(/allowance/);
    expect(m.ai).toHaveBeenCalledWith('u1', 'pro');
  });
  it('skips a lead the engine fails on, and an empty answer, without stopping the rest', async () => {
    m.compose.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ emailSubject: '', emailBody: '' });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const j = await (await POST(req(), ctx)).json();
    spy.mockRestore();
    expect(j).toMatchObject({ done: 0, failed: 2 });
    expect(m.update).not.toHaveBeenCalled();
  });
  it("is limited to the user's own campaign and needs sign-in", async () => {
    m.campaign.mockResolvedValue(null);
    expect((await POST(req(), ctx)).status).toBe(404);
    m.auth.ok = false;
    expect((await POST(req(), ctx)).status).toBe(401);
  });
});

describe('setup message', () => {
  it('recognises missing tables and nothing else', async () => {
    expect(isNotInstalled({ code: 'P2021' })).toBe(true);
    expect(isNotInstalled({ code: 'P2022' })).toBe(true);
    expect(isNotInstalled({ code: 'P2002' })).toBe(false);
    expect(isNotInstalled(new Error('x'))).toBe(false);
    const r = notInstalledResponse();
    expect(r.status).toBe(503);
    expect((await r.json()).code).toBe('V2_NOT_INSTALLED');
  });
  it('turns a missing-table error into the friendly answer and lets other errors through', async () => {
    const ok = await guardInstalled(async () => NextResponse.json({ fine: true }));
    expect(ok.status).toBe(200);
    const miss = await guardInstalled(async () => { throw Object.assign(new Error('no table'), { code: 'P2021' }); });
    expect(miss.status).toBe(503);
    await expect(guardInstalled(async () => { throw new Error('real bug'); })).rejects.toThrow('real bug');
  });
});
