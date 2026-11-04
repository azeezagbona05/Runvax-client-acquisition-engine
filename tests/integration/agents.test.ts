/**
 * Queue behaviour and the Agent Command Centre reads on a REAL disposable
 * MySQL: concurrent runs never execute a task twice, failures are persisted,
 * and every observability query works against real JSON columns and ordering.
 * Synthetic data only; handlers are stubs, nothing touches a network.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { drainAcqTasks, enqueueAcqTask } from '@/lib/acquisition/tasks/queue';
import { TASK_TYPES, type AcqTaskType, type AcqTaskHandler } from '@/lib/acquisition/tasks/types';
import { agentOverview, listActivity, getTaskDetail, clinicTimeline } from '@/lib/acquisition/agents';

const USER = 'u_integration_agents';
const stubs = (h: AcqTaskHandler) => Object.fromEntries(Object.keys(TASK_TYPES).map((t) => [t, h])) as Record<AcqTaskType, AcqTaskHandler>;

beforeAll(async () => {
  await prisma.$executeRawUnsafe('DELETE FROM `AcquisitionProspect` WHERE userId = ?', USER);
  await prisma.$executeRawUnsafe('DELETE FROM `AcquisitionTask` WHERE userId = ?', USER);
  await prisma.$executeRawUnsafe('DELETE FROM `Prospect` WHERE userId = ?', USER);
  await prisma.$executeRawUnsafe('DELETE FROM `User` WHERE id = ?', USER);
  await prisma.$executeRawUnsafe('DELETE FROM `AcquisitionProviderUsage`');
  await prisma.user.create({ data: { id: USER, email: 'agents@integration.test', plan: 'agency' } });
  process.env.INDUSTRY_ACQUISITION_ENABLED = 'true';
});
afterAll(async () => { await prisma.$disconnect(); });

describe('real MySQL: queue behaviour', () => {
  it('two simultaneous runs never execute the same task twice; each run handles one task at a time', async () => {
    for (let i = 0; i < 8; i++) await enqueueAcqTask({ userId: USER, type: 'acq.audit', input: { industryKey: 'dental', runKey: `c${i}` } });
    const seen: string[] = [];
    let active = 0; let overlapWithinRun = 0;
    const make = (): AcqTaskHandler => {
      let mine = 0;
      return async (ctx) => {
        mine++; if (mine > 1) overlapWithinRun++; // would mean one run executed two tasks at once
        active++;
        seen.push(ctx.taskId);
        await new Promise((r) => setTimeout(r, 25));
        active--; mine--;
        return { status: 'completed', output: { findings: 1 } };
      };
    };
    const [a, b] = await Promise.all([drainAcqTasks({ budget: 10, handlers: stubs(make()) }), drainAcqTasks({ budget: 10, handlers: stubs(make()) })]);
    expect(a.claimed + b.claimed).toBe(8);
    expect(new Set(seen).size).toBe(8); // no task executed twice
    expect(seen).toHaveLength(8);
    expect(overlapWithinRun).toBe(0);
    const runs = await prisma.acquisitionAgentRun.findMany({ where: { userId: USER } });
    expect(runs).toHaveLength(8);
    expect(runs.every((r) => r.status === 'succeeded' && r.provider === null && r.model === null)).toBe(true);
    expect(await prisma.acquisitionTask.count({ where: { userId: USER, status: 'completed' } })).toBe(8);
  });

  it('persists a failure (error, attempt count, retry time, failed run) and finally marks the task dead', async () => {
    const t = (await enqueueAcqTask({ userId: USER, type: 'acq.strategize', input: { industryKey: 'dental', runKey: 'fail' } }))!;
    const boom: AcqTaskHandler = async () => { throw new Error('synthetic failure, token=abc123secret'); };
    expect(await drainAcqTasks({ budget: 3, handlers: stubs(boom) })).toMatchObject({ claimed: 1, retried: 1 });
    let row = (await prisma.acquisitionTask.findUnique({ where: { id: t.id } }))!;
    expect(row).toMatchObject({ status: 'pending', attempts: 1 });
    expect(row.error).toContain('synthetic failure');
    expect(row.error).not.toContain('abc123secret');
    expect(row.scheduledAt.getTime()).toBeGreaterThan(Date.now());
    const d1 = (await getTaskDetail(USER, t.id))!;
    expect(d1.task.state).toBe('waiting_retry');
    expect(d1.attemptsLog).toHaveLength(1);
    for (let i = 0; i < 2; i++) {
      await prisma.acquisitionTask.update({ where: { id: t.id }, data: { scheduledAt: new Date(Date.now() - 1000) } });
      await drainAcqTasks({ budget: 3, handlers: stubs(boom) });
    }
    row = (await prisma.acquisitionTask.findUnique({ where: { id: t.id } }))!;
    expect(row).toMatchObject({ status: 'dead', attempts: 3 });
    const d2 = (await getTaskDetail(USER, t.id))!;
    expect(d2.attemptsLog.map((a) => a.status)).toEqual(['failed', 'failed', 'failed']);
    expect(d2.summary).toMatch(/^Failed permanently/);
  });

  it('a task whose runner died (expired lease) is reset and retried by the next run', async () => {
    const t = (await enqueueAcqTask({ userId: USER, type: 'acq.audit', input: { industryKey: 'dental', runKey: 'stale' } }))!;
    await prisma.acquisitionTask.update({ where: { id: t.id }, data: { status: 'running', attempts: 1, lockedUntil: new Date(Date.now() - 60_000) } });
    expect((await getTaskDetail(USER, t.id))!.task.state).toBe('running_stale');
    await drainAcqTasks({ budget: 3, handlers: stubs(async () => ({ status: 'completed', output: {} })) });
    expect((await prisma.acquisitionTask.findUnique({ where: { id: t.id } }))!).toMatchObject({ status: 'completed', attempts: 2 });
  });
});

describe('real MySQL: observability reads', () => {
  it('overview, activity, detail and clinic timeline run against real JSON columns and ordering', async () => {
    const crm = await prisma.prospect.create({ data: { userId: USER, businessId: 'acq_agents_1', businessName: 'Synthetic Agents Dental', businessData: {}, source: 'industry-acquisition' } });
    const acq = await prisma.acquisitionProspect.create({ data: { userId: USER, prospectId: crm.id, industryKey: 'dental', state: 'strategized', orgDomain: 'agents-fixture.ng' } });
    await prisma.acquisitionPipelineEvent.create({ data: { userId: USER, acqProspectId: acq.id, fromState: 'none', toState: 'discovered', reason: 'Imported (synthetic)', actor: 'admin@integration.test' } });
    const t = (await enqueueAcqTask({ userId: USER, type: 'acq.audit', acqProspectId: acq.id, input: { industryKey: 'dental', runKey: 'obs' } }))!;
    await enqueueAcqTask({ userId: USER, type: 'acq.discover', input: { industryKey: 'dental', runKey: 'skip' } });
    await drainAcqTasks({ budget: 5, handlers: stubs(async (ctx) => (ctx.acqProspectId ? { status: 'completed', output: { fetchStatus: 'crawler_disabled', findings: 2 }, evidenceRefs: ['s1', 's2'] } : { status: 'skipped', output: { reason: 'places_disabled' } })) });
    await enqueueAcqTask({ userId: USER, type: 'acq.strategize', acqProspectId: acq.id, input: { industryKey: 'dental', runKey: 'queued' } });

    const o = await agentOverview(USER);
    const audit = o.agents.find((a) => a.key === 'audit')!;
    expect(audit.lastRun).toMatchObject({ status: 'succeeded', clinic: { name: 'Synthetic Agents Dental' } });
    expect(audit.counts.completed).toBeGreaterThanOrEqual(1);
    expect(o.agents.find((a) => a.key === 'strategy')!.counts.queued).toBe(1);
    expect(o.agents.find((a) => a.key === 'discovery')!.skipReasons[0]).toMatchObject({ reason: 'places_disabled', count: 1 });

    const act = await listActivity(USER, {});
    expect(act.rows.length).toBeGreaterThan(5);
    expect(act.rows.some((r) => r.state === 'queued' && r.type === 'acq.strategize')).toBe(true);
    expect((await listActivity(USER, { status: 'skipped' })).rows.every((r) => r.status === 'skipped')).toBe(true);

    const d = (await getTaskDetail(USER, t.id))!;
    expect(d.output).toEqual({ fetchStatus: 'crawler_disabled', findings: 2 });
    expect(d.attemptsLog[0].evidenceRefs).toEqual(['s1', 's2']);
    expect(d.clinic).toMatchObject({ name: 'Synthetic Agents Dental' });

    const tl = await clinicTimeline(USER, acq.id);
    expect(tl.map((i) => i.kind)).toEqual(['state_change', 'agent_run', 'queued_task']);
    expect(await getTaskDetail('some-other-account', t.id)).toBeNull();
  });
});
