import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), count: vi.fn(), updateMany: vi.fn(), leadCount: vi.fn(),
  user: { ok: true as boolean, userId: 'u1' },
}));
vi.mock('@/lib/prisma', () => ({ prisma: { outreachCampaign: { findFirst: m.findFirst, update: m.update, create: m.create, count: m.count }, outreachLead: { updateMany: m.updateMany, count: m.leadCount, createMany: vi.fn() } } }));
vi.mock('@/lib/campaignAuth', () => ({ requireCampaignUser: async () => (m.user.ok ? m.user : { ok: false, response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) }) }));
vi.mock('@/lib/outreachSender', () => ({ loadMailbox: async () => ({}) }));
vi.mock('@/lib/outreachLeads', () => ({ addLeads: vi.fn() }));

import { PATCH } from '@/app/api/outreach-campaigns/[id]/route';
import { POST } from '@/app/api/outreach-campaigns/route';
import { quickSetup, ruleBasedPlan } from '@/lib/automation';

const req = (body: unknown, method = 'PATCH') => new NextRequest('http://x/api/outreach-campaigns/c1', { method, body: JSON.stringify(body) });
const ctx = { params: { id: 'c1' } };

beforeEach(() => { m.findFirst.mockReset().mockResolvedValue({ id: 'c1', userId: 'u1', startedAt: null }); m.update.mockReset().mockImplementation(async (a: { data: unknown }) => ({ id: 'c1', ...(a.data as object) })); m.create.mockReset().mockResolvedValue({ id: 'new1' }); m.count.mockReset().mockResolvedValue(0); m.user.ok = true; });

describe('saving an automation on a campaign', () => {
  it('stores the plan and copies the part the engine runs into the campaign fields', async () => {
    const a = quickSetup();
    const res = await PATCH(req({ automation: a }), ctx);
    expect(res.status).toBe(200);
    const data = m.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ subject: a.emails[0].subject, body: a.emails[0].body, maxFollowUps: 2, followUpAfterDays: 3, dailyCap: 30, followUpSubject: 'Re: {{subject}}' });
    expect(data.automation.sendMode).toBe('review');
    expect(data.automation.emails).toHaveLength(3);
  });
  it('refuses a plan with a problem, and does not write anything', async () => {
    const bad = quickSetup(); bad.emails[0].subject = '   ';
    const r1 = await PATCH(req({ automation: bad }), ctx);
    expect(r1.status).toBe(400);
    const r2 = await PATCH(req({ automation: { emails: [] } }), ctx);
    expect(r2.status).toBe(400);
    expect(m.update).not.toHaveBeenCalled();
  });
  it('cannot be tricked into auto-send, links or unknown placeholders', async () => {
    const sneaky = { emails: [{ subject: 'Hi {{card}}', body: 'See http://evil.com {{name}}' }, { subject: 's', body: 'b' }], sendMode: 'auto', __confirmedAuto: false };
    await PATCH(req({ automation: sneaky }), ctx);
    const saved = m.update.mock.calls[0][0].data.automation;
    expect(saved.sendMode).toBe('review');
    expect(JSON.stringify(saved)).not.toMatch(/http|card/);
  });
  it("only works on the signed-in user's own campaign, and needs sign-in", async () => {
    m.findFirst.mockResolvedValue(null);
    expect((await PATCH(req({ automation: quickSetup() }), ctx)).status).toBe(404);
    m.user.ok = false;
    expect((await PATCH(req({ automation: quickSetup() }), ctx)).status).toBe(401);
  });
  it('maps a one-email plan to no follow-ups', async () => {
    await PATCH(req({ automation: ruleBasedPlan('1 email') }), ctx);
    const d = m.update.mock.calls[0][0].data;
    expect(d.maxFollowUps).toBe(0);
    expect(d.followUpBody).toBeNull();
  });
  it('creates a draft campaign from a plan, named after it', async () => {
    const res = await POST(new NextRequest('http://x/api/outreach-campaigns', { method: 'POST', body: JSON.stringify({ automation: quickSetup() }) }));
    expect(res.status).toBe(201);
    const data = m.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ userId: 'u1', maxFollowUps: 2 });
    expect(data.name).toMatch(/outreach/i);
    expect(data.automation.emails).toHaveLength(3);
  });
});
