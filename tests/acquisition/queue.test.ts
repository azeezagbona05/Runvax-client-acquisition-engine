import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { rows, seed } from '../helpers/fakePrisma';
import {
  enqueueAcqTask, drainAcqTasks, cancelAcqTasks, resolveBudget, backoffMs, idempotencyKeyFor,
} from '@/lib/acquisition/tasks/queue';
import { acqHandlers } from '@/lib/acquisition/tasks/handlers';
import { TASK_TYPES } from '@/lib/acquisition/tasks/types';
import type { AcqTaskHandler, AcqTaskType } from '@/lib/acquisition/tasks/types';
import { drainTasks } from '@/lib/tasks/queue';

const input = { industryKey: 'dental' };

function handlersWith(overrides: Partial<Record<AcqTaskType, AcqTaskHandler>>) {
  return { ...acqHandlers, ...overrides } as Record<AcqTaskType, AcqTaskHandler>;
}

beforeEach(() => {
  process.env.INDUSTRY_ACQUISITION_ENABLED = 'true';
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  delete process.env.INDUSTRY_ACQUISITION_ENABLED;
  delete process.env.IA_TASK_BUDGET;
  delete process.env.IA_TASK_TIMEOUT_MS;
});

describe('task types', () => {
  it('maps all seven agents', () => {
    expect(new Set(Object.values(TASK_TYPES))).toEqual(new Set(['discovery', 'contacts', 'audit', 'strategy', 'outreach', 'followup', 'conversion']));
  });
});

describe('enqueueAcqTask', () => {
  it('is idempotent for identical work', async () => {
    const a = await enqueueAcqTask({ userId: 'u1', type: 'acq.audit', acqProspectId: 'ap1', input });
    const b = await enqueueAcqTask({ userId: 'u1', type: 'acq.audit', acqProspectId: 'ap1', input: { industryKey: 'dental' } });
    expect(a.created).toBe(true);
    expect(b).toEqual({ id: a.id, created: false });
    expect(rows('acquisitionTask')).toHaveLength(1);
  });

  it('stays idempotent after the first task finished', async () => {
    const a = await enqueueAcqTask({ userId: 'u1', type: 'acq.audit', acqProspectId: 'ap1', input });
    rows('acquisitionTask')[0].status = 'completed';
    const b = await enqueueAcqTask({ userId: 'u1', type: 'acq.audit', acqProspectId: 'ap1', input });
    expect(b.created).toBe(false);
    expect(b.id).toBe(a.id);
  });

  it('a different runKey is deliberately new work', async () => {
    await enqueueAcqTask({ userId: 'u1', type: 'acq.audit', acqProspectId: 'ap1', input });
    const b = await enqueueAcqTask({ userId: 'u1', type: 'acq.audit', acqProspectId: 'ap1', input: { ...input, runKey: '2026-11' } });
    expect(b.created).toBe(true);
  });

  it('key ignores object key order', () => {
    expect(idempotencyKeyFor('acq.audit', 'x', { a: 1, b: 2 })).toBe(idempotencyKeyFor('acq.audit', 'x', { b: 2, a: 1 }));
  });

  it('rejects unknown types and invalid input', async () => {
    await expect(enqueueAcqTask({ userId: 'u1', type: 'detect_opportunity' as AcqTaskType, input })).rejects.toThrow(/Unknown/);
    await expect(enqueueAcqTask({ userId: 'u1', type: 'acq.audit', input: {} })).rejects.toThrow();
    await expect(enqueueAcqTask({ userId: 'u1', type: 'acq.audit', input: { industryKey: 'dental', sneaky: true } })).rejects.toThrow();
    expect(rows('acquisitionTask')).toHaveLength(0);
  });

  it('never writes to the existing AgentTask table', async () => {
    await enqueueAcqTask({ userId: 'u1', type: 'acq.discover', input });
    expect(rows('agentTask')).toHaveLength(0);
  });
});

describe('drainAcqTasks', () => {
  it('does nothing while the flag is off', async () => {
    delete process.env.INDUSTRY_ACQUISITION_ENABLED;
    await enqueueAcqTask({ userId: 'u1', type: 'acq.discover', input });
    const r = await drainAcqTasks();
    expect(r.disabled).toBe(true);
    expect(rows('acquisitionTask')[0].status).toBe('pending');
  });

  it('acq.discover is skipped as places_disabled (Phase 2: Places off)', async () => {
    await enqueueAcqTask({ userId: 'u1', type: 'acq.discover', input });
    const r = await drainAcqTasks();
    expect(r).toMatchObject({ claimed: 1, skipped: 1 });
    expect(rows('acquisitionTask')[0]).toMatchObject({ status: 'skipped' });
    expect((rows('acquisitionTask')[0].output as { reason: string }).reason).toBe('places_disabled');
    expect(rows('acquisitionAgentRun')[0]).toMatchObject({ agent: 'discovery', attempt: 1, status: 'succeeded' });
  });

  it('respects the budget (env default 10, request clamp 1..50)', async () => {
    expect(resolveBudget()).toBe(10);
    process.env.IA_TASK_BUDGET = '3';
    expect(resolveBudget()).toBe(3);
    expect(resolveBudget(500)).toBe(50);
    expect(resolveBudget(0)).toBe(1);
    process.env.IA_TASK_BUDGET = 'nonsense';
    expect(resolveBudget()).toBe(10);

    process.env.IA_TASK_BUDGET = '2';
    for (let i = 0; i < 5; i++) await enqueueAcqTask({ userId: 'u1', type: 'acq.discover', input: { ...input, runKey: String(i) } });
    const r = await drainAcqTasks();
    expect(r.claimed).toBe(2);
    expect(rows('acquisitionTask').filter((t) => t.status === 'pending')).toHaveLength(3);
  });

  it('enqueues follow-up tasks with the parent id', async () => {
    await enqueueAcqTask({ userId: 'u1', type: 'acq.discover', acqProspectId: 'ap1', input });
    const discover = vi.fn<AcqTaskHandler>(async () => ({ status: 'completed', next: [{ type: 'acq.research_contacts', input }] }));
    await drainAcqTasks({ budget: 1, handlers: handlersWith({ 'acq.discover': discover }) });
    const [parent, child] = rows('acquisitionTask');
    expect(child).toMatchObject({ type: 'acq.research_contacts', acqProspectId: 'ap1', parentTaskId: parent.id, status: 'pending' });
  });

  it('retries with exponential backoff, then dead-letters', async () => {
    expect([1, 2, 3].map(backoffMs)).toEqual([600_000, 1_200_000, 2_400_000]);
    expect(backoffMs(20)).toBe(2 * 60 * 60 * 1000);

    await enqueueAcqTask({ userId: 'u1', type: 'acq.audit', acqProspectId: 'ap1', input });
    const failing = handlersWith({ 'acq.audit': async () => { throw new Error('upstream 500 with key sk-abcdefghijklmnop1234'); } });

    expect((await drainAcqTasks({ handlers: failing })).retried).toBe(1);
    const t = rows('acquisitionTask')[0];
    expect(t.status).toBe('pending');
    expect(t.error).toContain('sk-[redacted]');
    expect(t.error).not.toContain('abcdefghijklmnop');

    t.scheduledAt = new Date(Date.now() - 1);
    await drainAcqTasks({ handlers: failing });
    t.scheduledAt = new Date(Date.now() - 1);
    expect((await drainAcqTasks({ handlers: failing })).dead).toBe(1);
    expect(t.status).toBe('dead');
    expect(t.attempts).toBe(3);
    expect(rows('acquisitionAgentRun').map((r) => r.status)).toEqual(['failed', 'failed', 'failed']);
  });

  it('times out a hung handler', async () => {
    process.env.IA_TASK_TIMEOUT_MS = '1000';
    await enqueueAcqTask({ userId: 'u1', type: 'acq.audit', input });
    let aborted = false;
    const hung = handlersWith({
      'acq.audit': ({ signal }) => new Promise((resolve) => {
        signal.addEventListener('abort', () => { aborted = true; resolve({ status: 'completed' }); });
      }),
    });
    vi.useFakeTimers();
    const p = drainAcqTasks({ handlers: hung });
    await vi.advanceTimersByTimeAsync(1100);
    const r = await p;
    vi.useRealTimers();
    expect(r.retried).toBe(1);
    expect(aborted).toBe(true);
    expect(rows('acquisitionTask')[0].error).toContain('timed out');
  });

  it('rejects malformed handler output', async () => {
    await enqueueAcqTask({ userId: 'u1', type: 'acq.audit', input });
    const bad = handlersWith({ 'acq.audit': async () => ({ status: 'sent' } as never) });
    expect((await drainAcqTasks({ handlers: bad })).retried).toBe(1);
  });

  it('rejects follow-ups of a non-acquisition type', async () => {
    await enqueueAcqTask({ userId: 'u1', type: 'acq.audit', input });
    const bad = handlersWith({ 'acq.audit': async () => ({ status: 'completed', next: [{ type: 'draft_outreach' as AcqTaskType, input }] }) });
    expect((await drainAcqTasks({ handlers: bad })).retried).toBe(1);
    expect(rows('agentTask')).toHaveLength(0);
  });

  it('recovers a task whose lease expired', async () => {
    seed('acquisitionTask', { userId: 'u1', type: 'acq.discover', idempotencyKey: 'k1', input, status: 'running', attempts: 1, lockedUntil: new Date(Date.now() - 1000) });
    const r = await drainAcqTasks();
    expect(r).toMatchObject({ claimed: 1, skipped: 1 });
  });

  it('leaves a task with a live lease alone', async () => {
    seed('acquisitionTask', { userId: 'u1', type: 'acq.discover', idempotencyKey: 'k1', input, status: 'running', attempts: 1, lockedUntil: new Date(Date.now() + 60_000) });
    expect((await drainAcqTasks()).claimed).toBe(0);
  });

  it('dead-letters a recovered task that already used every attempt', async () => {
    seed('acquisitionTask', { userId: 'u1', type: 'acq.discover', idempotencyKey: 'k1', input, status: 'running', attempts: 3, maxAttempts: 3, lockedUntil: new Date(Date.now() - 1000) });
    const r = await drainAcqTasks();
    expect(r).toMatchObject({ claimed: 0, dead: 1 });
  });

  it('a task cancelled mid-run stays cancelled and spawns nothing', async () => {
    await enqueueAcqTask({ userId: 'u1', type: 'acq.discover', acqProspectId: 'ap1', input });
    const h = handlersWith({
      'acq.discover': async () => {
        rows('acquisitionTask')[0].status = 'cancelled';
        return { status: 'completed', next: [{ type: 'acq.research_contacts', input }] };
      },
    });
    await drainAcqTasks({ handlers: h });
    expect(rows('acquisitionTask')).toHaveLength(1);
    expect(rows('acquisitionTask')[0].status).toBe('cancelled');
  });

  it('cancelAcqTasks cancels only that prospect’s pending work', async () => {
    await enqueueAcqTask({ userId: 'u1', type: 'acq.audit', acqProspectId: 'ap1', input });
    await enqueueAcqTask({ userId: 'u1', type: 'acq.audit', acqProspectId: 'ap2', input });
    expect(await cancelAcqTasks('u1', 'ap1', 'opt_out')).toBe(1);
    expect(rows('acquisitionTask').map((t) => t.status)).toEqual(['cancelled', 'pending']);
  });
});

describe('Phase 2 queue limits', () => {
  it('a deferred task goes back to pending without spending an attempt', async () => {
    await enqueueAcqTask({ userId: 'u1', type: 'acq.audit', acqProspectId: 'ap1', input });
    const later = new Date(Date.now() + 3_600_000);
    const h = handlersWith({ 'acq.audit': async () => ({ status: 'skipped', output: { reason: 'budget_exhausted' }, deferUntil: later }) });
    const r = await drainAcqTasks({ handlers: h });
    expect(r).toMatchObject({ claimed: 1, deferred: 1, skipped: 0 });
    expect(rows('acquisitionTask')[0]).toMatchObject({ status: 'pending', attempts: 0, scheduledAt: later });
    expect(rows('acquisitionAgentRun')[0].status).toBe('deferred');
  });

  it('IA_DAILY_TASK_CAP stops a run across drains', async () => {
    process.env.IA_DAILY_TASK_CAP = '3';
    for (let i = 0; i < 5; i++) await enqueueAcqTask({ userId: 'u1', type: 'acq.discover', input: { ...input, runKey: String(i) } });
    const first = await drainAcqTasks({ budget: 2 });
    const second = await drainAcqTasks({ budget: 10 });
    expect(first.claimed + second.claimed).toBe(3);
    expect(second.dailyCapReached).toBe(true);
    delete process.env.IA_DAILY_TASK_CAP;
  });
});

describe('isolation from the existing queue', () => {
  it('the existing drainer never runs acquisition tasks, and vice versa', async () => {
    await enqueueAcqTask({ userId: 'u1', type: 'acq.discover', input });
    seed('agentTask', { userId: 'u1', type: 'detect_opportunity', prospectId: 'p1', status: 'pending', scheduledAt: new Date(Date.now() + 3_600_000) });

    await drainTasks(15);
    expect(rows('acquisitionTask')[0].status).toBe('pending');

    await drainAcqTasks();
    expect(rows('agentTask')[0].status).toBe('pending');
    expect(rows('acquisitionTask')[0].status).toBe('skipped');
  });
});
