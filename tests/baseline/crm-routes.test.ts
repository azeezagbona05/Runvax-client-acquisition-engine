/**
 * Baseline: the existing CRM routes (/api/prospects, /api/prospects/[id]).
 * Pins current behaviour so the acquisition work can't change it: ordinary
 * save / list / update still work, a user only sees and edits their own rows,
 * and Industry Acquisition clinics remain ordinary, visible CRM rows (their
 * `source` passes through; only messaging and automation are restricted).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { rows, seed } from '../helpers/fakePrisma';

const auth = vi.hoisted(() => ({ getToken: vi.fn() }));
vi.mock('next-auth/jwt', () => ({ getToken: auth.getToken }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => null) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

import { GET as list, POST as save } from '@/app/api/prospects/route';
import { PATCH as patch } from '@/app/api/prospects/[id]/route';

const req = (url: string, method: string, body?: unknown) =>
  new NextRequest(`http://localhost${url}`, { method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const BIZ = { id: 'place_1', name: 'Ordinary Dental', address: 'Lekki, Lagos', hasWebsite: false, category: 'dentist', phone: '0803 123 4567', rating: 4.5, reviewCount: 30 };

beforeEach(() => {
  auth.getToken.mockReset().mockResolvedValue({ id: 'u1', sub: 'u1', plan: 'agency', emailVerified: new Date() });
  seed('user', { id: 'u1', plan: 'agency' });
});

describe('GET /api/prospects', () => {
  it('401 when signed out', async () => {
    auth.getToken.mockResolvedValue(null);
    expect((await list(req('/api/prospects', 'GET'))).status).toBe(401);
  });

  it("lists the user's own prospects only, ordinary and Industry Acquisition alike, with source passed through", async () => {
    seed('prospect', { id: 'p1', userId: 'u1', businessId: 'b1', businessName: 'Ordinary Dental', businessData: BIZ, source: null });
    seed('prospect', { id: 'p2', userId: 'u1', businessId: 'b2', businessName: 'Campaign Dental', businessData: BIZ, source: 'campaign' });
    seed('prospect', { id: 'p3', userId: 'u1', businessId: 'acq_x', businessName: 'Engine Clinic', businessData: {}, source: 'industry-acquisition' });
    seed('prospect', { id: 'p4', userId: 'u2', businessId: 'b9', businessName: "Someone Else's", businessData: BIZ });
    const res = await list(req('/api/prospects', 'GET'));
    expect(res.status).toBe(200);
    const body = await res.json() as Array<{ _dbId: string; source?: string; stage: string }>;
    expect(body.map((p) => p._dbId).sort()).toEqual(['p1', 'p2', 'p3']);
    expect(body.find((p) => p._dbId === 'p3')).toMatchObject({ source: 'industry-acquisition', stage: 'found' });
    expect(body.find((p) => p._dbId === 'p1')!.source).toBeUndefined();
  });
});

describe('POST /api/prospects', () => {
  it('saves an ordinary business as stage "found" with no source, and saving it again updates rather than duplicates', async () => {
    const res = await save(req('/api/prospects', 'POST', { business: BIZ }));
    expect(res.status).toBe(201);
    expect(rows('prospect')).toHaveLength(1);
    expect(rows('prospect')[0]).toMatchObject({ userId: 'u1', businessId: 'place_1', businessName: 'Ordinary Dental', stage: 'found', source: null });
    await save(req('/api/prospects', 'POST', { business: { ...BIZ, name: 'Ordinary Dental (renamed)' } }));
    expect(rows('prospect')).toHaveLength(1);
    expect(rows('prospect')[0].businessName).toBe('Ordinary Dental (renamed)');
  });

  it('400 without a business id; 401 signed out', async () => {
    expect((await save(req('/api/prospects', 'POST', { business: {} }))).status).toBe(400);
    auth.getToken.mockResolvedValue(null);
    expect((await save(req('/api/prospects', 'POST', { business: BIZ }))).status).toBe(401);
  });
});

describe('PATCH /api/prospects/[id]', () => {
  it('updates stage, notes and the outreach date for the owner', async () => {
    seed('prospect', { id: 'p1', userId: 'u1', businessId: 'b1', businessName: 'Ordinary Dental', businessData: BIZ });
    const res = await patch(req('/api/prospects/p1', 'PATCH', { stage: 'contacted', notes: 'Called reception', outreachSentAt: '2026-10-17T09:00:00Z' }), { params: { id: 'p1' } });
    expect(res.status).toBe(200);
    expect(rows('prospect')[0]).toMatchObject({ stage: 'contacted', notes: 'Called reception' });
    expect(rows('prospect')[0].outreachSentAt).toEqual(new Date('2026-10-17T09:00:00Z'));
  });

  it("404 for another user's prospect, and nothing changes", async () => {
    seed('prospect', { id: 'p9', userId: 'u2', businessId: 'b9', businessName: 'Theirs', businessData: BIZ });
    const res = await patch(req('/api/prospects/p9', 'PATCH', { stage: 'won' }), { params: { id: 'p9' } });
    expect(res.status).toBe(404);
    expect(rows('prospect')[0].stage).toBe('found');
  });

  it('an Industry Acquisition clinic is still an ordinary CRM row: its stage can be edited, and it keeps its source', async () => {
    seed('prospect', { id: 'p3', userId: 'u1', businessId: 'acq_x', businessName: 'Engine Clinic', businessData: {}, source: 'industry-acquisition' });
    expect((await patch(req('/api/prospects/p3', 'PATCH', { stage: 'interested' }), { params: { id: 'p3' } })).status).toBe(200);
    expect(rows('prospect')[0]).toMatchObject({ stage: 'interested', source: 'industry-acquisition' }); // still excluded from Rex / Atlas / the send routes
  });
});
