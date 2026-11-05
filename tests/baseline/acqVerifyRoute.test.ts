import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  campaign: vi.fn(), user: vi.fn(), leads: vi.fn(), updateMany: vi.fn(), verify: vi.fn(), enabled: { on: true }, log: vi.fn(),
}));
vi.mock('@/lib/prisma', () => ({ prisma: { outreachCampaign: { findFirst: m.campaign }, user: { findUnique: m.user }, outreachLead: { findMany: m.leads, updateMany: m.updateMany } } }));
vi.mock('@/lib/campaignAuth', () => ({ requireCampaignUser: async () => ({ ok: true, userId: 'u1' }) }));
vi.mock('@/lib/rateLimiter', () => ({ rateLimit: () => ({ ok: true }) }));
vi.mock('@/lib/acqReplies', () => ({ logAgent: m.log }));
vi.mock('@/lib/snov', () => ({ snovEnabled: () => m.enabled.on, verifyEmails: m.verify }));

import { GET, POST } from '@/app/api/outreach-campaigns/[id]/verify/route';

const req = (body: unknown = {}) => new NextRequest('http://x/api/outreach-campaigns/c1/verify', { method: 'POST', body: JSON.stringify(body) });
const ctx = { params: { id: 'c1' } };
const snov = (email: string, smtpStatus: string, disposable = false) => [email, { email, smtpStatus, disposable, webmail: false }] as const;

beforeEach(() => {
  m.enabled.on = true;
  m.campaign.mockReset().mockResolvedValue({ id: 'c1' });
  m.user.mockReset().mockResolvedValue({ plan: 'pro' });
  m.leads.mockReset().mockResolvedValue([{ id: 'a', email: 'ok@x.com' }, { id: 'b', email: 'gone@x.com' }, { id: 'c', email: 'tmp@x.com' }, { id: 'd', email: 'maybe@x.com' }, { id: 'e', email: 'silent@x.com' }]);
  m.updateMany.mockReset().mockResolvedValue({ count: 1 });
  m.log.mockReset();
  m.verify.mockReset().mockResolvedValue(new Map([snov('ok@x.com', 'valid'), snov('gone@x.com', 'not_valid'), snov('tmp@x.com', 'valid', true), snov('maybe@x.com', 'unknown')]));
});

describe('bulk email check', () => {
  it('skips addresses that do not exist or are disposable, leaves unsure ones queued, and counts the unanswered', async () => {
    const j = await (await POST(req(), ctx)).json();
    expect(j).toEqual({ checked: 4, invalid: 1, disposable: 1, unsure: 1, unanswered: 1, next: null });
    expect(m.updateMany).toHaveBeenCalledTimes(2);
    expect(m.updateMany).toHaveBeenCalledWith({ where: { id: 'b', status: 'queued' }, data: { status: 'skipped', error: expect.stringContaining('does not exist') } });
    expect(m.updateMany).toHaveBeenCalledWith({ where: { id: 'c', status: 'queued' }, data: { status: 'skipped', error: expect.stringContaining('disposable') } });
  });
  it('sends all addresses in one bulk call and only looks at waiting leads after the cursor', async () => {
    await POST(req({ after: 'a0' }), ctx);
    expect(m.verify).toHaveBeenCalledWith(['ok@x.com', 'gone@x.com', 'tmp@x.com', 'maybe@x.com', 'silent@x.com']);
    expect(m.leads.mock.calls[0][0].where).toEqual({ campaignId: 'c1', status: 'queued', id: { gt: 'a0' } });
  });
  it('returns a cursor when a full page was checked', async () => {
    m.leads.mockResolvedValue(Array.from({ length: 50 }, (_, i) => ({ id: `l${String(i).padStart(2, '0')}`, email: `p${i}@x.com` })));
    m.verify.mockResolvedValue(new Map());
    expect((await (await POST(req(), ctx)).json()).next).toBe('l49');
  });
  it('is not available without keys, on the free plan, or for someone else\'s campaign', async () => {
    m.enabled.on = false;
    expect((await POST(req(), ctx)).status).toBe(501);
    expect((await (await GET(new NextRequest('http://x'))).json()).available).toBe(false);
    m.enabled.on = true;
    m.user.mockResolvedValue({ plan: 'free' });
    expect((await POST(req(), ctx)).status).toBe(403);
    m.user.mockResolvedValue({ plan: 'pro' });
    m.campaign.mockResolvedValue(null);
    expect((await POST(req(), ctx)).status).toBe(404);
    expect(m.verify).not.toHaveBeenCalled();
  });
  it('changes nothing when the checker fails', async () => {
    m.verify.mockRejectedValue(new Error('down'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await POST(req(), ctx)).status).toBe(502);
    spy.mockRestore();
    expect(m.updateMany).not.toHaveBeenCalled();
  });
});
