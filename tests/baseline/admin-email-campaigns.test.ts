import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  sendLaunchBatch: vi.fn(),
  sendLaunchTest: vi.fn(),
  sendSafetyProblem: vi.fn(),
  runLifecycle: vi.fn(),
  auditCreate: vi.fn(),
}));

vi.mock('@/lib/adminAuth', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('@/lib/prisma', () => ({ prisma: { adminAuditLog: { create: mocks.auditCreate } } }));
vi.mock('@/lib/launchCampaign', () => ({
  launchAudience: vi.fn(), sendLaunchBatch: mocks.sendLaunchBatch, sendLaunchTest: mocks.sendLaunchTest,
  sendSafetyProblem: mocks.sendSafetyProblem, MAX_BATCH: 60,
}));
vi.mock('@/lib/lifecycleRunner', () => ({ runLifecycle: mocks.runLifecycle, emailConfigured: () => true }));

import { POST } from '@/app/api/admin/email-campaigns/route';

const post = (body: object) => POST(new NextRequest('http://localhost/api/admin/email-campaigns', { method: 'POST', body: JSON.stringify(body) }));

beforeEach(() => {
  Object.values(mocks).forEach((m) => m.mockReset());
  mocks.requireAdmin.mockResolvedValue({ ok: true, userId: 'a1', email: 'admin@runvax.com' });
  mocks.sendSafetyProblem.mockReturnValue(null);
  mocks.sendLaunchBatch.mockResolvedValue({ sent: 3, failed: 0, remaining: 0 });
  mocks.auditCreate.mockResolvedValue({});
  mocks.runLifecycle.mockResolvedValue({ ok: true, dryRun: true, considered: 5, sent: { first_search: 2 }, failed: 0 });
});

describe('admin email campaigns', () => {
  it('is admin only', async () => {
    mocks.requireAdmin.mockResolvedValue({ ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) });
    const res = await post({ campaign: 'launch_1', action: 'send', confirm: 'SEND' });
    expect(res.status).toBe(403);
    expect(mocks.sendLaunchBatch).not.toHaveBeenCalled();
  });

  it('a real send needs the typed confirmation word', async () => {
    expect((await post({ campaign: 'launch_1', action: 'send' })).status).toBe(400);
    expect((await post({ campaign: 'launch_1', action: 'send', confirm: 'yes' })).status).toBe(400);
    expect(mocks.sendLaunchBatch).not.toHaveBeenCalled();
  });

  it('refuses to send to customers when the app URL is not a public https address', async () => {
    mocks.sendSafetyProblem.mockReturnValue('Refusing to send to customers: the app URL is "http://localhost:3000"');
    const res = await post({ campaign: 'launch_1', action: 'send', confirm: 'SEND' });
    expect(res.status).toBe(503);
    expect(mocks.sendLaunchBatch).not.toHaveBeenCalled();
  });

  it('sends a batch, reports what remains, and writes an audit entry', async () => {
    mocks.sendLaunchBatch.mockResolvedValue({ sent: 60, failed: 1, remaining: 12 });
    const res = await post({ campaign: 'launch_2', action: 'send', confirm: 'SEND' });
    expect(await res.json()).toMatchObject({ ok: true, sent: 60, failed: 1, remaining: 12 });
    expect(mocks.sendLaunchBatch).toHaveBeenCalledWith(2);
    expect(mocks.auditCreate).toHaveBeenCalledTimes(1);
    expect(mocks.auditCreate.mock.calls[0][0].data.actorEmail).toBe('admin@runvax.com');
  });

  it('test sends go to the admin only, and nobody else, and need no confirmation', async () => {
    const res = await post({ campaign: 'launch_1', action: 'test', to: 'someone-else@example.com' });
    expect(await res.json()).toMatchObject({ ok: true, sentTo: 'admin@runvax.com' });
    expect(mocks.sendLaunchTest).toHaveBeenCalledWith(1, 'admin@runvax.com');
    expect(mocks.sendLaunchBatch).not.toHaveBeenCalled();
  });

  it('workflow: preview is a dry run with no confirmation; run needs SEND', async () => {
    const prev = await post({ campaign: 'workflow', action: 'preview' });
    expect(prev.status).toBe(200);
    expect(mocks.runLifecycle).toHaveBeenCalledWith({ dryRun: true });

    mocks.runLifecycle.mockClear();
    expect((await post({ campaign: 'workflow', action: 'run' })).status).toBe(400);
    expect(mocks.runLifecycle).not.toHaveBeenCalled();

    mocks.runLifecycle.mockResolvedValue({ ok: true, dryRun: false, considered: 5, sent: { first_search: 2 }, failed: 0 });
    expect((await post({ campaign: 'workflow', action: 'run', confirm: 'SEND' })).status).toBe(200);
    expect(mocks.runLifecycle).toHaveBeenCalledWith({ dryRun: false });
    expect(mocks.auditCreate).toHaveBeenCalledTimes(1);
  });

  it('a pending migration comes back as a clear 503, not a crash', async () => {
    mocks.runLifecycle.mockResolvedValue({ ok: false, skipped: true, reason: 'Lifecycle data unavailable. Has migration 4_lifecycle_emails been applied?', dryRun: true, considered: 0, sent: {}, failed: 0 });
    const res = await post({ campaign: 'workflow', action: 'preview' });
    expect(res.status).toBe(503);
    expect((await res.json()).reason).toContain('migration');
  });

  it('rejects unknown campaigns and actions', async () => {
    expect((await post({ campaign: 'nope', action: 'send', confirm: 'SEND' })).status).toBe(400);
    expect((await post({ campaign: 'workflow', action: 'delete' })).status).toBe(400);
  });
});
