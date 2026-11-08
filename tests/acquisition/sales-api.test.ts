/**
 * The sales-workflow routes through the real route handlers: admin-only,
 * same-origin for mutations, and the review actions behave as the service
 * does. (Every route is also covered by the generic 404/401/403 sweep in
 * api.test.ts and the gate scanner in access.test.ts.)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { rows, seed } from '../helpers/fakePrisma';

const auth = vi.hoisted(() => ({ getServerSession: vi.fn() }));
vi.mock('next-auth', () => ({ getServerSession: auth.getServerSession }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.hoisted(() => { process.env.ADMIN_EMAILS = 'admin@harzotech.test'; });

import { POST as generate } from '@/app/api/acquisition/prospects/[id]/drafts/route';
import { POST as act } from '@/app/api/acquisition/drafts/[id]/actions/route';
import { GET as listDraftsGET } from '@/app/api/acquisition/drafts/route';
import { POST as outcome } from '@/app/api/acquisition/prospects/[id]/outcomes/route';
import { GET as metrics } from '@/app/api/acquisition/metrics/route';

const ADMIN = { user: { id: 'u1', email: 'admin@harzotech.test', isAdmin: true } }; // an admin session: made by the admin sign-in
const req = (method: string, body?: unknown, origin = 'http://localhost') =>
  new NextRequest('http://localhost/api/acquisition/x', { method, headers: { origin }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

function seedDraft() {
  seed('prospect', { id: 'p1', userId: 'u1', businessName: 'Fixture Dental', source: 'industry-acquisition' });
  seed('acquisitionProspect', { id: 'ap1', userId: 'u1', prospectId: 'p1', industryKey: 'dental', state: 'draft_pending_approval', orgDomain: 'fixture-dental.ng' });
  seed('acquisitionDraft', { id: 'd1', userId: 'u1', acqProspectId: 'ap1', channel: 'email', subject: 'S', body: 'Body text long enough to be edited.', offerId: 'ai_receptionist', evidenceFindingIds: [], status: 'pending_approval', version: 1, idempotencyKey: 'k1', evidenceSignalIds: [] });
}

beforeEach(() => { auth.getServerSession.mockReset(); process.env.INDUSTRY_ACQUISITION_ENABLED = 'true'; });
afterEach(() => { delete process.env.INDUSTRY_ACQUISITION_ENABLED; });

describe('admin-only review', () => {
  it('a non-admin cannot generate, review, record outcomes or read the queue — and nothing changes', async () => {
    seedDraft();
    seed('user', { id: 'u2', isSuspended: false });
    auth.getServerSession.mockResolvedValue({ user: { id: 'u2', email: 'customer@example.com' } });
    expect((await generate(req('POST', {}), { params: { id: 'ap1' } })).status).toBe(403);
    expect((await act(req('POST', { action: 'approve' }), { params: { id: 'd1' } })).status).toBe(403);
    expect((await outcome(req('POST', { type: 'opt_out' }), { params: { id: 'ap1' } })).status).toBe(403);
    expect((await listDraftsGET(req('GET'))).status).toBe(403);
    expect((await metrics()).status).toBe(403);
    expect(rows('acquisitionDraft')[0].status).toBe('pending_approval');
    expect(rows('acquisitionApproval')).toHaveLength(0);
  });

  it('a suspended admin is refused', async () => {
    seedDraft();
    seed('user', { id: 'u1', isSuspended: true });
    auth.getServerSession.mockResolvedValue(ADMIN);
    expect((await act(req('POST', { action: 'approve' }), { params: { id: 'd1' } })).status).toBe(403);
  });

  it('a cross-origin review action is refused even for an admin', async () => {
    seedDraft();
    seed('user', { id: 'u1', isSuspended: false });
    auth.getServerSession.mockResolvedValue(ADMIN);
    expect((await act(req('POST', { action: 'approve' }, 'https://evil.example'), { params: { id: 'd1' } })).status).toBe(403);
    expect(rows('acquisitionApproval')).toHaveLength(0);
  });

  it('an admin approval of a draft with no evidence binding is refused with reasons (422)', async () => {
    seedDraft();
    seed('user', { id: 'u1', isSuspended: false });
    auth.getServerSession.mockResolvedValue(ADMIN);
    const r = await act(req('POST', { action: 'approve' }), { params: { id: 'd1' } });
    expect(r.status).toBe(422);
    const j = await r.json();
    expect(j.blockers.map((b: { code: string }) => b.code)).toEqual(expect.arrayContaining(['no_evidence_binding', 'recommendation_changed']));
    expect((await act(req('POST', { action: 'nonsense' }), { params: { id: 'd1' } })).status).toBe(400);
    expect((await (await metrics()).json()).drafts.generated).toBe(1);
  });
});
