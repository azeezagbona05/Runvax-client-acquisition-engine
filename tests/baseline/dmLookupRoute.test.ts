import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({ find: vi.fn(), paid: { on: true }, plan: vi.fn(), limit: { ok: true } }));
vi.mock('@/lib/requireUser', () => ({ requireUser: async () => ({ ok: true, userId: 'u1' }) }));
vi.mock('@/lib/rateLimiter', () => ({ rateLimit: () => ({ ok: m.limit.ok }) }));
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: m.plan } } }));
vi.mock('@/lib/dmFinder', () => ({ findDecisionMakers: m.find, paidProvidersConfigured: () => m.paid.on }));

import { POST } from '@/app/api/decision-maker/lookup/route';

const req = (body: unknown) => new NextRequest('http://x/api/decision-maker/lookup', { method: 'POST', body: JSON.stringify(body) });

beforeEach(() => {
  m.paid.on = true; m.limit.ok = true;
  m.plan.mockReset().mockResolvedValue({ plan: 'pro' });
  m.find.mockReset().mockResolvedValue({ candidates: [{ name: 'Ada Obi', title: 'Owner', source: 'snov', confidence: 'high', email: 'ada@x.com', emailStatus: 'Snov.io: valid' }], best: null, ran: ['website', 'snov'], paidAvailable: false });
});

describe('decision-maker lookup for unsaved businesses', () => {
  it('returns people with emails and runs only the free sources by default', async () => {
    const j = await (await POST(req({ name: 'Clinic', website: 'x.com', address: '1 Rd, Lekki, Lagos' }))).json();
    expect(j.candidates[0]).toMatchObject({ name: 'Ada Obi', email: 'ada@x.com' });
    expect(m.find.mock.calls[0][1]).toEqual({ deep: false });
    expect(m.find.mock.calls[0][0]).toMatchObject({ businessName: 'Clinic', city: 'Lekki', website: 'x.com' });
  });
  it('needs a business name', async () => {
    expect((await POST(req({}))).status).toBe(400);
  });
  it('deep search needs paid sources configured and a paid plan', async () => {
    m.paid.on = false;
    expect((await POST(req({ name: 'C', deep: true }))).status).toBe(501);
    m.paid.on = true; m.plan.mockResolvedValue({ plan: 'free' });
    expect((await POST(req({ name: 'C', deep: true }))).status).toBe(403);
    expect(m.find).not.toHaveBeenCalled();
    m.plan.mockResolvedValue({ plan: 'pro' });
    expect((await POST(req({ name: 'C', deep: true }))).status).toBe(200);
    expect(m.find.mock.calls[0][1]).toEqual({ deep: true });
  });
  it('is rate limited', async () => {
    m.limit.ok = false;
    expect((await POST(req({ name: 'C' }))).status).toBe(429);
  });
});
