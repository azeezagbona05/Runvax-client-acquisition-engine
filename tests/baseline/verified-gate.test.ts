import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ getToken: vi.fn(), findUnique: vi.fn() }));
vi.mock('next-auth/jwt', () => ({ getToken: mocks.getToken }));
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));

import { requireVerifiedUser } from '@/lib/requireUser';
import { GET as details } from '@/app/api/details/route';
import { POST as saveProspect } from '@/app/api/prospects/route';

const req = (url = 'http://localhost/x', init?: { method?: string; body?: string }) => new NextRequest(url, init);

beforeEach(() => { mocks.getToken.mockReset(); mocks.findUnique.mockReset(); });

describe('requireVerifiedUser', () => {
  it('signed out: 401', async () => {
    mocks.getToken.mockResolvedValue(null);
    const r = await requireVerifiedUser(req());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });
  it('verified token: allowed without touching the database', async () => {
    mocks.getToken.mockResolvedValue({ id: 'u1', emailVerified: new Date() });
    expect((await requireVerifiedUser(req())).ok).toBe(true);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
  it('unverified: 403 with a code the UI can recognise', async () => {
    mocks.getToken.mockResolvedValue({ id: 'u1', emailVerified: null });
    mocks.findUnique.mockResolvedValue({ emailVerified: null });
    const r = await requireVerifiedUser(req());
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.response.status).toBe(403); expect((await r.response.json()).code).toBe('EMAIL_UNVERIFIED'); }
  });
  it('a stale token is double-checked: just verified in another tab, so allowed', async () => {
    mocks.getToken.mockResolvedValue({ id: 'u1', emailVerified: null });
    mocks.findUnique.mockResolvedValue({ emailVerified: new Date() });
    expect((await requireVerifiedUser(req())).ok).toBe(true);
  });
  it('fails closed if the database check errors', async () => {
    mocks.getToken.mockResolvedValue({ id: 'u1', emailVerified: null });
    mocks.findUnique.mockRejectedValue(new Error('db down'));
    expect((await requireVerifiedUser(req())).ok).toBe(false);
  });
});

describe('the prospect routes enforce it', () => {
  beforeEach(() => {
    mocks.getToken.mockResolvedValue({ id: 'u1', sub: 'u1', plan: 'free', emailVerified: null });
    mocks.findUnique.mockResolvedValue({ emailVerified: null });
  });
  it('opening a prospect (details) is refused before any lookup', async () => {
    const res = await details(req('http://localhost/api/details?id=ChIJabc'));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe('EMAIL_UNVERIFIED');
  });
  it('saving a prospect is refused', async () => {
    const res = await saveProspect(req('http://localhost/api/prospects', { method: 'POST', body: JSON.stringify({ business: { id: 'x', name: 'X' } }) }));
    expect(res.status).toBe(403);
  });
});
