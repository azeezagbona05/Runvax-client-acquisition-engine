/**
 * Baseline: pins the behaviour of the existing RUNVAX agent queue
 * (src/lib/tasks/queue.ts) so the acquisition work can prove it never changed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rows, seed } from '../helpers/fakePrisma';

const handlerMocks = vi.hoisted(() => ({
  detect_opportunity: vi.fn(),
  draft_outreach: vi.fn(),
}));
vi.mock('@/lib/tasks/handlers', () => ({ handlers: handlerMocks }));

import { enqueueTask, drainTasks } from '@/lib/tasks/queue';

beforeEach(() => {
  handlerMocks.detect_opportunity.mockReset();
  handlerMocks.draft_outreach.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('enqueueTask', () => {
  it('creates a pending task', async () => {
    const id = await enqueueTask({ userId: 'u1', type: 'detect_opportunity', prospectId: 'p1' });
    expect(id).toBeTruthy();
    expect(rows('agentTask')).toHaveLength(1);
    expect(rows('agentTask')[0]).toMatchObject({ status: 'pending', type: 'detect_opportunity', prospectId: 'p1' });
  });

  it('skips a duplicate while the same type is open for that prospect', async () => {
    await enqueueTask({ userId: 'u1', type: 'detect_opportunity', prospectId: 'p1' });
    const second = await enqueueTask({ userId: 'u1', type: 'detect_opportunity', prospectId: 'p1' });
    expect(second).toBeNull();
    expect(rows('agentTask')).toHaveLength(1);
  });

  it('allows a new task once the previous one is finished', async () => {
    seed('agentTask', { userId: 'u1', type: 'detect_opportunity', prospectId: 'p1', status: 'completed' });
    const id = await enqueueTask({ userId: 'u1', type: 'detect_opportunity', prospectId: 'p1' });
    expect(id).toBeTruthy();
  });
});

describe('drainTasks', () => {
  it('runs a due task, stores its output and enqueues the follow-up', async () => {
    seed('agentTask', { userId: 'u1', type: 'detect_opportunity', prospectId: 'p1' });
    handlerMocks.detect_opportunity.mockResolvedValue({
      status: 'completed',
      output: { ok: 1 },
      next: [{ type: 'draft_outreach' }],
    });

    // Limit 1: the follow-up is enqueued but left for a later drain.
    const result = await drainTasks(1);

    expect(result).toEqual({ claimed: 1, completed: 1, skipped: 0, retried: 0, failed: 0 });
    const [first, second] = rows('agentTask');
    expect(first).toMatchObject({ status: 'completed', output: { ok: 1 }, attempts: 1, error: null });
    expect(second).toMatchObject({ type: 'draft_outreach', prospectId: 'p1', parentTaskId: first.id, status: 'pending' });
  });

  it('runs the follow-up in the same drain when capacity is left', async () => {
    seed('agentTask', { userId: 'u1', type: 'detect_opportunity', prospectId: 'p1' });
    handlerMocks.detect_opportunity.mockResolvedValue({ status: 'completed', next: [{ type: 'draft_outreach' }] });
    handlerMocks.draft_outreach.mockResolvedValue({ status: 'completed' });
    const result = await drainTasks(5);
    expect(result).toEqual({ claimed: 2, completed: 2, skipped: 0, retried: 0, failed: 0 });
  });

  it('does not run tasks scheduled in the future', async () => {
    seed('agentTask', { userId: 'u1', type: 'detect_opportunity', prospectId: 'p1', scheduledAt: new Date(Date.now() + 60_000) });
    const result = await drainTasks(5);
    expect(result.claimed).toBe(0);
    expect(handlerMocks.detect_opportunity).not.toHaveBeenCalled();
  });

  it('retries a failure with a 10-minute backoff', async () => {
    seed('agentTask', { userId: 'u1', type: 'detect_opportunity', prospectId: 'p1' });
    handlerMocks.detect_opportunity.mockRejectedValue(new Error('boom'));
    const before = Date.now();

    const result = await drainTasks(5);

    expect(result.retried).toBe(1);
    const task = rows('agentTask')[0];
    expect(task).toMatchObject({ status: 'pending', error: 'boom', attempts: 1 });
    const delay = (task.scheduledAt as Date).getTime() - before;
    expect(delay).toBeGreaterThanOrEqual(10 * 60 * 1000 - 50);
    expect(delay).toBeLessThan(10 * 60 * 1000 + 5000);
  });

  it('marks a task failed once attempts are exhausted', async () => {
    seed('agentTask', { userId: 'u1', type: 'detect_opportunity', prospectId: 'p1', attempts: 2, maxAttempts: 3 });
    handlerMocks.detect_opportunity.mockRejectedValue(new Error('still broken'));
    const result = await drainTasks(5);
    expect(result.failed).toBe(1);
    expect(rows('agentTask')[0]).toMatchObject({ status: 'failed', error: 'still broken', attempts: 3 });
  });

  it('fails a task whose type has no handler', async () => {
    seed('agentTask', { userId: 'u1', type: 'unknown_type', prospectId: 'p1', attempts: 2, maxAttempts: 3 });
    const result = await drainTasks(5);
    expect(result.failed).toBe(1);
    expect(rows('agentTask')[0].error).toContain('No handler for task type "unknown_type"');
  });

  it('recovers a task stuck in running for over 5 minutes', async () => {
    seed('agentTask', { userId: 'u1', type: 'detect_opportunity', prospectId: 'p1', status: 'running', startedAt: new Date(Date.now() - 6 * 60 * 1000) });
    handlerMocks.detect_opportunity.mockResolvedValue({ status: 'skipped' });
    const result = await drainTasks(5);
    expect(result).toMatchObject({ claimed: 1, skipped: 1 });
  });

  it('leaves a recently started running task alone', async () => {
    seed('agentTask', { userId: 'u1', type: 'detect_opportunity', prospectId: 'p1', status: 'running', startedAt: new Date() });
    const result = await drainTasks(5);
    expect(result.claimed).toBe(0);
  });

  it('respects the limit', async () => {
    for (let i = 0; i < 4; i++) seed('agentTask', { userId: 'u1', type: 'detect_opportunity', prospectId: `p${i}` });
    handlerMocks.detect_opportunity.mockResolvedValue({ status: 'completed' });
    const result = await drainTasks(3);
    expect(result.claimed).toBe(3);
    expect(rows('agentTask').filter((t) => t.status === 'pending')).toHaveLength(1);
  });

  it('only reads the agentTask table', async () => {
    seed('agentTask', { userId: 'u1', type: 'detect_opportunity', prospectId: 'p1' });
    seed('acquisitionTask', { userId: 'u1', type: 'acq.discover', idempotencyKey: 'k' });
    handlerMocks.detect_opportunity.mockResolvedValue({ status: 'completed' });
    await drainTasks(15);
    expect(rows('acquisitionTask')[0].status).toBe('pending');
  });
});
