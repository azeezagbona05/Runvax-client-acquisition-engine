/**
 * Agent Command Centre data: every value must come from persisted records,
 * unknowns must be null, and secrets / contact details must never be shown.
 * Synthetic data only; the queue is driven with injected stub handlers.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rows, seed } from '../helpers/fakePrisma';
import { agentInfo, agentOverview, listActivity, getTaskDetail, clinicTimeline, sanitizeValue, taskState, summarizeTask } from '@/lib/acquisition/agents';
import { AGENTS } from '@/lib/acquisition/models';
import { drainAcqTasks, enqueueAcqTask } from '@/lib/acquisition/tasks/queue';
import { TASK_TYPES, type AcqTaskType } from '@/lib/acquisition/tasks/types';
import type { AcqTaskHandler } from '@/lib/acquisition/tasks/types';

const U = 'u1';
const NOW = new Date('2026-10-17T12:00:00Z');
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000);
const ahead = (min: number) => new Date(NOW.getTime() + min * 60_000);

beforeEach(() => { process.env.INDUSTRY_ACQUISITION_ENABLED = 'true'; });
afterEach(() => { delete process.env.INDUSTRY_ACQUISITION_ENABLED; });

function clinic(id = 'ap1', name = 'Fixture Dental') {
  seed('prospect', { id: `p_${id}`, userId: U, businessName: name });
  return seed('acquisitionProspect', { id, userId: U, prospectId: `p_${id}`, industryKey: 'dental', state: 'strategized', orgDomain: 'fixture-dental.ng' });
}
const task = (over: Record<string, unknown>) => seed('acquisitionTask', { userId: U, idempotencyKey: `k${Math.random()}`, createdAt: ago(60), ...over });
const run = (over: Record<string, unknown>) => seed('acquisitionAgentRun', { userId: U, startedAt: ago(30), ...over });
const byKey = async (key: string) => (await agentOverview(U, NOW)).agents.find((a) => a.key === key)!;

describe('what the agents really are', () => {
  it('lists all seven defined agents and labels them honestly', () => {
    const info = agentInfo();
    expect(info.map((a) => a.key)).toEqual([...AGENTS]);
    const by = Object.fromEntries(info.map((a) => [a.key, a.implementation]));
    expect(by).toEqual({ discovery: 'disabled', contacts: 'rule_based', audit: 'rule_based', strategy: 'rule_based', outreach: 'manual', followup: 'not_implemented', conversion: 'not_implemented' });
    // Nothing is described as AI, and every task type belongs to exactly one agent.
    for (const a of info) expect(a.capability).not.toMatch(/\bAI[- ]powered|machine learning|LLM|GPT\b/i);
    expect(info.flatMap((a) => a.taskTypes).sort()).toEqual(Object.keys(TASK_TYPES).sort());
  });

  it('with no records at all, nothing is invented', async () => {
    const o = await agentOverview(U, NOW);
    for (const a of o.agents) {
      expect(a.lastRun).toBeNull();
      expect(a.recent).toEqual([]);
      expect(a.currentTask).toBeNull();
      expect(a.skipReasons).toEqual([]);
      expect(a.failures).toEqual([]);
    }
    const strategy = o.agents.find((a) => a.key === 'strategy')!;
    expect(strategy.state).toBe('idle');
    expect(strategy.nextAction).toMatch(/Waiting for work/);
    // Model / token / cost figures are not applicable to rule-based agents: reported as unavailable, never zero.
    expect(strategy.metrics.find((m) => m.label === 'Model, tokens, cost')!.value).toBeNull();
    expect(o.agents.find((a) => a.key === 'followup')!.metrics).toEqual([]);
    expect(o.agents.find((a) => a.key === 'discovery')!.state).toBe('disabled');
    expect(o.note).toMatch(/3 are implemented \(all rule-based, no AI\).*no scheduler/);
  });
});

describe('queued, running, completed and idle are different things', () => {
  it('separates a queued task, an executing task, a retry wait and a stale lease', () => {
    const base = { error: null as string | null, lockedUntil: null as Date | null };
    expect(taskState({ status: 'pending', scheduledAt: ago(1), ...base }, NOW)).toBe('queued');
    expect(taskState({ status: 'pending', scheduledAt: ahead(10), ...base }, NOW)).toBe('waiting_retry');
    expect(taskState({ status: 'pending', scheduledAt: ago(1), ...base, error: 'boom' }, NOW)).toBe('failed_retrying');
    expect(taskState({ status: 'pending', scheduledAt: ago(1), ...base, error: 'deferred: budget' }, NOW)).toBe('queued');
    expect(taskState({ status: 'running', scheduledAt: ago(5), ...base, lockedUntil: ahead(1) }, NOW)).toBe('running');
    expect(taskState({ status: 'running', scheduledAt: ago(5), ...base, lockedUntil: ago(1) }, NOW)).toBe('running_stale');
    expect(taskState({ status: 'completed', scheduledAt: ago(5), ...base }, NOW)).toBe('completed');
  });

  it('derives each agent state from persisted tasks and runs', async () => {
    const a = clinic('ap1', 'Alpha Dental');
    clinic('ap2', 'Beta Dental');
    // audit: executing now (live lease)
    const running = task({ type: 'acq.audit', status: 'running', acqProspectId: a.id, lockedUntil: ahead(1), attempts: 1 });
    run({ taskId: running.id, agent: 'audit', attempt: 1, status: 'running' });
    // strategy: two queued
    task({ type: 'acq.strategize', status: 'pending', acqProspectId: 'ap1', scheduledAt: ago(2) });
    task({ type: 'acq.strategize', status: 'pending', acqProspectId: 'ap2', scheduledAt: ago(1) });
    // contacts: latest run failed, retry in 10 minutes
    const failed = task({ type: 'acq.research_contacts', status: 'pending', acqProspectId: 'ap2', attempts: 1, error: 'fetch failed', scheduledAt: ahead(10) });
    run({ taskId: failed.id, agent: 'contacts', attempt: 1, status: 'failed', error: 'fetch failed', startedAt: ago(5), durationMs: 120 });

    const audit = await byKey('audit');
    expect(audit.state).toBe('running');
    expect(audit.currentTask).toMatchObject({ taskId: running.id, clinic: { id: 'ap1', name: 'Alpha Dental' } });
    expect(audit.counts.running).toBe(1);

    const strategy = await byKey('strategy');
    expect(strategy.state).toBe('queued');
    expect(strategy.counts.queued).toBe(2);
    expect(strategy.nextAction).toMatch(/Run queue now/);
    expect(strategy.currentTask).toBeNull(); // queued is not executing

    const contacts = await byKey('contacts');
    expect(contacts.state).toBe('failed');
    expect(contacts.counts.waitingRetry).toBe(1);
    expect(contacts.lastRun).toMatchObject({ status: 'failed', clinic: { name: 'Beta Dental' } });
    expect(contacts.failures[0]).toMatchObject({ error: 'fetch failed', attempts: 1, nextRetryAt: ahead(10) });
  });

  it('shows a lease that expired as a stale lease, not as running', async () => {
    clinic();
    task({ type: 'acq.audit', status: 'running', acqProspectId: 'ap1', lockedUntil: ago(3), attempts: 1 });
    const audit = await byKey('audit');
    expect(audit.state).toBe('idle');
    expect(audit.currentTask).toBeNull();
    expect(audit.counts.staleLease).toBe(1);
    expect(audit.nextAction).toMatch(/lease expired/);
    // Every place that describes the task says so, instead of "Running now".
    const t = rows('acquisitionTask')[0];
    expect((await listActivity(U, {}, NOW)).rows[0].summary).toMatch(/lease expired/);
    expect((await getTaskDetail(U, t.id as string, NOW))!.summary).toMatch(/lease expired/);
  });

  it('groups skipped tasks by the reason the handler recorded', async () => {
    clinic();
    task({ type: 'acq.discover', status: 'skipped', output: { reason: 'places_disabled' } });
    task({ type: 'acq.discover', status: 'skipped', output: { reason: 'places_disabled' } });
    task({ type: 'acq.audit', status: 'skipped', acqProspectId: 'ap1', output: { reason: 'prospect_suppressed' } });
    task({ type: 'acq.audit', status: 'skipped', output: null });
    expect((await byKey('discovery')).skipReasons).toEqual([{ reason: 'places_disabled', label: 'Google Places is disabled', count: 2 }]);
    const reasons = (await byKey('audit')).skipReasons.map((r) => r.label).sort();
    expect(reasons).toEqual(['The clinic is suppressed', 'no reason recorded']);
  });

  it('reports only recorded outputs: counts of work done and "unavailable" for what is not stored', async () => {
    clinic();
    task({ type: 'acq.audit', status: 'completed', acqProspectId: 'ap1', output: { fetchStatus: 'crawler_disabled', findings: 4 }, completedAt: ago(10) });
    task({ type: 'acq.research_contacts', status: 'completed', acqProspectId: 'ap1', output: { fetchStatus: 'crawler_disabled' }, completedAt: ago(10) });
    const audit = await byKey('audit');
    expect(audit.metrics.find((m) => m.label.startsWith('Clinics audited'))!.value).toBe(1);
    expect(audit.metrics.find((m) => m.label === 'Found by the latest run')!.value).toBe(4);
    // The contacts handler did not record "stored" in this output, so it is unavailable rather than 0.
    expect((await byKey('contacts')).metrics.find((m) => m.label === 'Stored by the latest run')!.value).toBeNull();
    expect(audit.limitation).toMatch(/Website fetching is off/);
  });
});

describe('what an attempt amounted to (found in the browser)', () => {
  it('a run the queue recorded as "succeeded" is labelled skipped when its task was skipped', async () => {
    clinic();
    const t = task({ type: 'acq.audit', status: 'skipped', acqProspectId: 'ap1', output: { reason: 'prospect_suppressed' }, completedAt: ago(5) });
    run({ taskId: t.id, agent: 'audit', attempt: 1, status: 'succeeded', durationMs: 6 });
    const audit = await byKey('audit');
    expect(audit.lastRun).toMatchObject({ status: 'succeeded', outcome: 'skipped', summary: 'Skipped: The clinic is suppressed' });
    expect(audit.recent[0].outcome).toBe('skipped');
    const tl = (await clinicTimeline(U, 'ap1', NOW)).find((i) => i.kind === 'agent_run')!;
    expect(tl).toMatchObject({ status: 'succeeded', outcome: 'skipped' });
  });

  it('a last attempt of a task that is now dead reads "failed permanently", not "retry due"', async () => {
    clinic();
    const t = task({ type: 'acq.research_contacts', status: 'dead', acqProspectId: 'ap1', attempts: 3, error: 'fetch failed', completedAt: ago(5) });
    for (const n of [1, 2, 3]) run({ taskId: t.id, agent: 'contacts', attempt: n, status: 'failed', error: 'fetch failed', startedAt: ago(40 - n) });
    const c = await byKey('contacts');
    expect(c.state).toBe('failed');
    expect(c.lastRun).toMatchObject({ outcome: 'dead', summary: 'Failed permanently: fetch failed' });
    // Earlier attempts of the same task are plain failed attempts.
    expect(c.recent.map((r) => r.outcome)).toEqual(['dead', 'attempt_failed', 'attempt_failed']);
  });

  it('a live run and a run whose lease expired are not both called "running"', async () => {
    clinic();
    const live = task({ type: 'acq.audit', status: 'running', acqProspectId: 'ap1', lockedUntil: ahead(5), attempts: 1 });
    const stale = task({ type: 'acq.audit', status: 'running', acqProspectId: 'ap1', lockedUntil: ago(5), attempts: 1 });
    run({ taskId: live.id, agent: 'audit', attempt: 1, status: 'running', startedAt: ago(1) });
    run({ taskId: stale.id, agent: 'audit', attempt: 1, status: 'running', startedAt: ago(20) });
    const outcomes = (await byKey('audit')).recent.map((r) => r.outcome).sort();
    expect(outcomes).toEqual(['running', 'running_stale']);
  });
});

describe('failures and secrets', () => {
  it('redacts credentials and contact details from every error and output it shows', async () => {
    clinic();
    const t = task({
      type: 'acq.audit', status: 'dead', acqProspectId: 'ap1', attempts: 3, completedAt: ago(5),
      error: 'upstream said Bearer abc123def456 and key sk-abcdefghijklmnop1234 for ada@fixture-dental.ng',
      input: { industryKey: 'dental', apiKey: 'sk-should-never-show-0000' },
      output: { note: 'phone 08031234567 and reception@fixture-dental.ng', nested: { token: 'xyz', ok: true } },
    });
    run({ taskId: t.id, agent: 'audit', attempt: 3, status: 'failed', error: 'password=hunter2 at https://user:pw@host.test/x' });
    const overview = JSON.stringify(await agentOverview(U, NOW));
    const detail = JSON.stringify(await getTaskDetail(U, t.id as string, NOW));
    for (const text of [overview, detail]) {
      expect(text).not.toMatch(/sk-abcdefghijklmnop1234|sk-should-never-show|abc123def456|hunter2|user:pw|ada@fixture-dental\.ng|reception@fixture-dental\.ng|08031234567/);
    }
    expect(JSON.parse(detail).input.apiKey).toBe('[hidden]');
    expect(JSON.parse(detail).output.nested.token).toBe('[hidden]');
    expect(sanitizeValue({ a: { b: { c: { d: { e: 'deep' } } } } })).toEqual({ a: { b: { c: { d: '[nested data omitted]' } } } });
  });
});

describe('task detail', () => {
  it('shows attempts, retry history, related tasks and links, from persisted rows only', async () => {
    clinic('ap1', 'Alpha Dental');
    const parent = task({ type: 'acq.research_contacts', status: 'completed', acqProspectId: 'ap1', output: { fetchStatus: 'crawler_disabled', stored: 1, suppressed: 0 } });
    const t = task({ type: 'acq.audit', status: 'completed', acqProspectId: 'ap1', parentTaskId: parent.id, attempts: 2, completedAt: ago(10), input: { industryKey: 'dental', runKey: 'manual-evidence-1' }, output: { fetchStatus: 'no_website', findings: 3 } });
    const child = task({ type: 'acq.strategize', status: 'pending', acqProspectId: 'ap1', parentTaskId: t.id, scheduledAt: ago(1) });
    run({ taskId: t.id, agent: 'audit', attempt: 1, status: 'failed', error: 'timed out', startedAt: ago(40), finishedAt: ago(39), durationMs: 45000 });
    run({ taskId: t.id, agent: 'audit', attempt: 2, status: 'succeeded', startedAt: ago(20), finishedAt: ago(19), durationMs: 800, evidenceRefs: ['sig1', 'sig2'] });

    const d = (await getTaskDetail(U, t.id as string, NOW))!;
    expect(d.task).toMatchObject({ type: 'acq.audit', agent: 'audit', agentName: 'Website audit', state: 'completed', attempts: 2, maxAttempts: 3, lastAttemptDurationMs: 800 });
    expect(d.task.firstStartedAt).toEqual(ago(40));
    expect(d.attemptsLog.map((a) => [a.attempt, a.status, a.error, a.durationMs])).toEqual([[1, 'failed', 'timed out', 45000], [2, 'succeeded', null, 800]]);
    expect(d.attemptsLog[1].evidenceRefs).toEqual(['sig1', 'sig2']);
    expect(d.attemptsLog.every((a) => a.usedModel === false)).toBe(true);
    expect(d.summary).toBe('Website: no_website; 3 finding(s)');
    expect(d.input).toEqual({ industryKey: 'dental', runKey: 'manual-evidence-1' });
    expect(d.parent).toMatchObject({ id: parent.id, type: 'acq.research_contacts' });
    expect(d.children).toEqual([expect.objectContaining({ id: child.id, state: 'queued' })]);
    expect(d.clinic).toMatchObject({ id: 'ap1', name: 'Alpha Dental' });
    expect(d.links).toEqual({ clinic: '/acquisition/prospects/ap1', auditTrail: '/acquisition/prospects/ap1#audit-trail' });
  });

  it('explains a skipped task and a task that is waiting to retry', async () => {
    const s = task({ type: 'acq.discover', status: 'skipped', output: { reason: 'places_disabled', detail: ['IA_PLACES_ENABLED is not true'] } });
    const d = (await getTaskDetail(U, s.id as string, NOW))!;
    expect(d.skipReason).toEqual({ code: 'places_disabled', label: 'Google Places is disabled' });
    expect(d.attemptsLog).toEqual([]); // no run is recorded for a task the runner never executed: not invented
    const r = task({ type: 'acq.audit', status: 'pending', attempts: 1, error: 'temporary failure', scheduledAt: ahead(20) });
    const rd = (await getTaskDetail(U, r.id as string, NOW))!;
    expect(rd.task).toMatchObject({ state: 'waiting_retry', nextRetryAt: ahead(20) });
    expect(rd.summary).toMatch(/Last attempt failed: temporary failure/);
  });

  it('never returns another account’s task', async () => {
    const t = seed('acquisitionTask', { userId: 'someone-else', type: 'acq.audit', idempotencyKey: 'x' });
    expect(await getTaskDetail(U, t.id as string, NOW)).toBeNull();
    expect(await getTaskDetail(U, 'nope', NOW)).toBeNull();
  });

  it('summarises outcomes only from what each handler recorded', () => {
    expect(summarizeTask({ type: 'acq.strategize', status: 'completed', output: { total: 36, band: 'medium', primaryOfferId: 'ai_receptionist' } })).toBe('Score 36 (medium); recommended offer: ai_receptionist');
    expect(summarizeTask({ type: 'acq.audit', status: 'completed', output: null })).toBeNull();
    expect(summarizeTask({ type: 'acq.audit', status: 'cancelled', error: 'cancelled: suppressed' })).toBe('Cancelled: suppressed');
  });
});

describe('activity list and clinic timeline', () => {
  it('lists queued tasks as well as finished ones, newest first, and filters by status', async () => {
    clinic();
    task({ type: 'acq.audit', status: 'completed', acqProspectId: 'ap1', completedAt: ago(30), output: { fetchStatus: 'x', findings: 1 } });
    task({ type: 'acq.strategize', status: 'pending', acqProspectId: 'ap1', createdAt: ago(5), scheduledAt: ago(5) });
    const all = await listActivity(U, {}, NOW);
    expect(all.rows.map((r) => [r.type, r.state])).toEqual([['acq.strategize', 'queued'], ['acq.audit', 'completed']]);
    expect(all.rows[0].clinic).toMatchObject({ id: 'ap1', name: 'Fixture Dental' });
    expect((await listActivity(U, { status: 'completed' }, NOW)).rows).toHaveLength(1);
    expect((await listActivity('other', {}, NOW)).rows).toEqual([]);
  });

  it('puts agent executions, queued work and business state changes in one chronological list, clearly labelled', async () => {
    clinic();
    seed('acquisitionPipelineEvent', { userId: U, acqProspectId: 'ap1', fromState: 'none', toState: 'discovered', reason: 'Imported (csv, row 2)', actor: 'admin@h.test', createdAt: ago(60) });
    const t = task({ type: 'acq.audit', status: 'completed', acqProspectId: 'ap1', createdAt: ago(55), completedAt: ago(50), output: { fetchStatus: 'crawler_disabled', findings: 2 } });
    run({ taskId: t.id, agent: 'audit', attempt: 1, status: 'succeeded', startedAt: ago(52), durationMs: 90, evidenceRefs: ['s1', 's2', 's3'] });
    seed('acquisitionPipelineEvent', { userId: U, acqProspectId: 'ap1', fromState: 'contacts_researched', toState: 'audited', reason: 'Audit: 2 finding(s)', actor: 'audit', createdAt: ago(50) });
    seed('acquisitionPipelineEvent', { userId: U, acqProspectId: 'ap1', fromState: 'strategized', toState: 'strategized', reason: 'Manual evidence: contact_form_present = false', actor: 'admin@h.test', createdAt: ago(20) });
    task({ type: 'acq.strategize', status: 'pending', acqProspectId: 'ap1', createdAt: ago(10), scheduledAt: ago(10) });

    const tl = await clinicTimeline(U, 'ap1', NOW);
    expect(tl.map((i) => i.kind)).toEqual(['state_change', 'agent_run', 'state_change', 'note', 'queued_task']);
    expect(tl[0]).toMatchObject({ title: 'State: none → discovered', by: 'admin' });
    expect(tl[1]).toMatchObject({ kind: 'agent_run', taskId: t.id, status: 'succeeded', durationMs: 90, evidenceRefCount: 3, detail: 'Website: crawler_disabled; 2 finding(s)' });
    expect(tl[2]).toMatchObject({ by: 'audit (system)' });
    expect(tl[4]).toMatchObject({ kind: 'queued_task', status: 'queued', attempt: null });
    for (let i = 1; i < tl.length; i++) expect(tl[i].at.getTime()).toBeGreaterThanOrEqual(tl[i - 1].at.getTime());
  });

  it('a failed attempt and its retry appear as two separate executions', async () => {
    clinic();
    const t = task({ type: 'acq.audit', status: 'completed', acqProspectId: 'ap1', attempts: 2, output: { fetchStatus: 'ok', findings: 1 } });
    run({ taskId: t.id, agent: 'audit', attempt: 1, status: 'failed', error: 'timed out', startedAt: ago(40) });
    run({ taskId: t.id, agent: 'audit', attempt: 2, status: 'succeeded', startedAt: ago(30) });
    const runsOnly = (await clinicTimeline(U, 'ap1', NOW)).filter((i) => i.kind === 'agent_run');
    expect(runsOnly.map((i) => [i.attempt, i.status, i.detail])).toEqual([[1, 'failed', 'Attempt 1 failed: timed out'], [2, 'succeeded', 'Website: ok; 1 finding(s)']]);
  });
});

describe('what “Run queue now” really does (stub handlers, fake DB)', () => {
  const ok: AcqTaskHandler = async () => ({ status: 'completed', output: { findings: 1 } });
  const all = (h: AcqTaskHandler) => Object.fromEntries(Object.keys(TASK_TYPES).map((t) => [t, h])) as Record<AcqTaskType, AcqTaskHandler>;

  it('processes tasks one after another, up to the budget, and leaves the rest queued', async () => {
    clinic();
    for (const k of ['a', 'b', 'c']) await enqueueAcqTask({ userId: U, type: 'acq.audit', acqProspectId: 'ap1', input: { industryKey: 'dental', runKey: k } });
    let active = 0; let maxActive = 0;
    const handler: AcqTaskHandler = async () => { active++; maxActive = Math.max(maxActive, active); await new Promise((r) => setTimeout(r, 5)); active--; return { status: 'completed', output: {} }; };
    const res = await drainAcqTasks({ budget: 2, handlers: all(handler) });
    expect(res).toMatchObject({ claimed: 2, completed: 2 });
    expect(maxActive).toBe(1); // one task at a time within a run
    expect(rows('acquisitionTask').map((t) => t.status).sort()).toEqual(['completed', 'completed', 'pending']);
  });

  it('persists a failure with its error, attempt and retry time, then kills the task after the last attempt', async () => {
    clinic();
    const { id } = (await enqueueAcqTask({ userId: U, type: 'acq.audit', acqProspectId: 'ap1', input: { industryKey: 'dental' } }))!;
    const boom: AcqTaskHandler = async () => { throw new Error('upstream failed with Bearer abcdef123456'); };
    expect(await drainAcqTasks({ budget: 5, handlers: all(boom) })).toMatchObject({ claimed: 1, retried: 1, dead: 0 });
    let d = (await getTaskDetail(U, id as string))!;
    expect(d.task).toMatchObject({ status: 'pending', attempts: 1, state: 'waiting_retry' });
    expect(d.task.nextRetryAt).not.toBeNull();
    expect(d.attemptsLog).toHaveLength(1);
    expect(d.attemptsLog[0]).toMatchObject({ status: 'failed', attempt: 1 });
    expect(JSON.stringify(d)).not.toContain('abcdef123456');
    // Not due yet, so another run does nothing.
    expect(await drainAcqTasks({ budget: 5, handlers: all(boom) })).toMatchObject({ claimed: 0 });
    // Make the retry due and fail twice more.
    for (let i = 0; i < 2; i++) {
      for (const t of rows('acquisitionTask')) t.scheduledAt = new Date(Date.now() - 1000);
      await drainAcqTasks({ budget: 5, handlers: all(boom) });
    }
    d = (await getTaskDetail(U, id as string))!;
    expect(d.task).toMatchObject({ status: 'dead', attempts: 3, state: 'dead' });
    expect(d.attemptsLog.map((a) => a.status)).toEqual(['failed', 'failed', 'failed']);
    expect(d.summary).toMatch(/^Failed permanently/);
  });

  it('records a skip reason, and a rule-based run stores no model, provider or token data', async () => {
    clinic();
    const { id } = (await enqueueAcqTask({ userId: U, type: 'acq.discover', input: { industryKey: 'dental' } }))!;
    await drainAcqTasks({ budget: 5, handlers: all(async () => ({ status: 'skipped', output: { reason: 'places_disabled' } })) });
    const d = (await getTaskDetail(U, id as string))!;
    expect(d.skipReason).toMatchObject({ code: 'places_disabled' });
    expect(d.attemptsLog).toHaveLength(1);
    expect(d.attemptsLog[0]).toMatchObject({ status: 'succeeded', usedModel: false, model: null, provider: null });
  });

  it('works with the real handlers registry too: an unimplemented agent records a skip, it does not pretend to work', async () => {
    const { id } = (await enqueueAcqTask({ userId: U, type: 'acq.qualify', input: { industryKey: 'dental' } }))!;
    await drainAcqTasks({ budget: 5 });
    const d = (await getTaskDetail(U, id as string))!;
    expect(d.task).toMatchObject({ status: 'skipped', agent: 'conversion' });
    expect(d.skipReason).toEqual({ code: 'not_implemented', label: 'This agent is not implemented' });
    void ok;
  });
});
