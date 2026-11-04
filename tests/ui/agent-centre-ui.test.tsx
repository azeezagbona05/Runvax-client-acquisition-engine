// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';
import AgentCentre from '@/app/acquisition/_components/AgentCentre';
import ActivityPanel from '@/app/acquisition/_components/ActivityPanel';
import TaskDetail from '@/app/acquisition/_components/TaskDetail';
import TaskTimeline from '@/app/acquisition/_components/TaskTimeline';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

afterEach(() => { cleanup(); push.mockReset(); });

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
const route = (map: Record<string, () => Promise<Response>>) => vi.fn((url: string) => {
  const hit = Object.keys(map).find((k) => String(url).startsWith(k));
  return hit ? map[hit]() : json({ error: 'unexpected ' + url }, 500);
}) as unknown as typeof fetch;

const counts = { queued: 0, waitingRetry: 0, running: 0, staleLease: 0, completed: 0, skipped: 0, failedRetrying: 0, dead: 0, cancelled: 0 };
const agent = (over: Record<string, unknown>) => ({
  key: 'audit', name: 'Website audit', purpose: 'Turn website evidence into findings.', implementation: 'rule_based', capability: 'Rule-based, no AI.',
  taskTypes: ['acq.audit'], state: 'idle', limitation: null, currentTask: null, counts, lastRun: null, metrics: [], skipReasons: [], failures: [], recent: [],
  nextAction: 'Waiting for work. Nothing is queued.', ...over,
});
const OVERVIEW = {
  asOf: '2026-10-17T12:00:00Z', note: '3 are implemented (all rule-based, no AI). There is no scheduler.',
  agents: [
    agent({
      state: 'running', counts: { ...counts, running: 1, queued: 2, completed: 4 }, limitation: 'Website fetching is off (crawler_disabled).',
      currentTask: { taskId: 't-run', clinic: { id: 'ap1', name: 'Alpha Dental', state: 'audited' }, startedAt: '2026-10-17T11:59:00Z' },
      lastRun: { runId: 'r1', taskId: 't-last', status: 'succeeded', outcome: 'completed', attempt: 1, startedAt: '2026-10-17T11:00:00Z', durationMs: 850, clinic: { id: 'ap2', name: 'Beta Dental', state: 'strategized' }, summary: 'Website: no_website; 3 finding(s)' },
      metrics: [{ label: 'Findings on file', value: 7 }, { label: 'Model, tokens, cost', value: null, note: 'not applicable: no model is used' }],
      skipReasons: [{ reason: 'domain_suppressed', label: 'The clinic’s domain is suppressed', count: 2 }],
    }),
    agent({ key: 'contacts', name: 'Contacts', state: 'failed', counts: { ...counts, dead: 1 }, failures: [{ taskId: 't-dead', state: 'dead', attempts: 3, maxAttempts: 3, error: 'timed out', nextRetryAt: null, clinic: { id: 'ap3', name: 'Gamma Dental', state: 'audited' } }] }),
    agent({ key: 'discovery', name: 'Discovery', implementation: 'disabled', state: 'disabled', capability: 'Disabled. Google Places is switched off.', limitation: 'Places disabled pending legal review', nextAction: 'None. Needs legal review.' }),
    agent({ key: 'followup', name: 'Follow-up', implementation: 'not_implemented', state: 'not_implemented', capability: 'Not implemented.', nextAction: 'None. This agent does not exist yet.' }),
  ],
};

describe('AgentCentre', () => {
  it('shows each agent’s real capability and state, and nothing that was not recorded', async () => {
    globalThis.fetch = route({ '/api/acquisition/agents': () => json(OVERVIEW) });
    render(<AgentCentre />);
    const audit = await screen.findByRole('article', { name: 'Website audit agent' });
    expect(within(audit).getByText('Running')).toBeTruthy();
    expect(within(audit).getByText(/Executing a task for/)).toBeTruthy();
    expect(within(audit).getByRole('link', { name: 'Alpha Dental' }).getAttribute('href')).toBe('/acquisition/prospects/ap1');
    expect(within(audit).getByText(/Queued:/).textContent).toMatch(/Queued: 2/);
    expect(within(audit).getByText(/Limitation: Website fetching is off/)).toBeTruthy();
    expect(within(audit).getByText('2 × The clinic’s domain is suppressed')).toBeTruthy();
    // A metric the system has no record of is "unavailable", not 0.
    const model = within(audit).getByText(/Model, tokens, cost/).closest('li')!;
    expect(model.textContent).toMatch(/unavailable/);
    expect(within(audit).getByRole('link', { name: 'details' }).getAttribute('href')).toBe('/acquisition/tasks/t-last');
  });

  it('labels a skipped or permanently failed last run by its real outcome, not the raw run status', async () => {
    const skipped = agent({ key: 'audit', name: 'Website audit', lastRun: { runId: 'r9', taskId: 't9', status: 'succeeded', outcome: 'skipped', attempt: 1, startedAt: '2026-10-17T11:00:00Z', durationMs: 6, clinic: null, summary: 'Skipped: The clinic is suppressed' }, recent: [{ runId: 'r9', taskId: 't9', status: 'succeeded', outcome: 'skipped', attempt: 1, startedAt: '2026-10-17T11:00:00Z', durationMs: 6, clinic: null, summary: null }] });
    globalThis.fetch = route({ '/api/acquisition/agents': () => json({ ...OVERVIEW, agents: [skipped, agent({ key: 'contacts', name: 'Contacts', lastRun: { runId: 'r8', taskId: 't8', status: 'failed', outcome: 'dead', attempt: 3, startedAt: '2026-10-17T11:00:00Z', durationMs: 8000, clinic: null, summary: 'Failed permanently: timed out' } })] }) });
    render(<AgentCentre />);
    const audit = await screen.findByRole('article', { name: 'Website audit agent' });
    expect(within(audit).getAllByText('Skipped').length).toBeGreaterThan(0);
    expect(within(audit).queryByText('Completed')).toBeNull();
    const contacts = screen.getByRole('article', { name: 'Contacts agent' });
    expect(within(contacts).getByText('Failed permanently')).toBeTruthy();
    expect(within(contacts).queryByText('Retry due')).toBeNull();
  });

  it('shows failures with the error and a link, and labels disabled and unbuilt agents plainly', async () => {
    globalThis.fetch = route({ '/api/acquisition/agents': () => json(OVERVIEW) });
    render(<AgentCentre />);
    const contacts = await screen.findByRole('article', { name: 'Contacts agent' });
    expect(within(contacts).getByText('Last run failed')).toBeTruthy();
    expect(within(contacts).getByText(/timed out/)).toBeTruthy();
    expect(within(contacts).getByText(/Failed permanently/)).toBeTruthy();
    const discovery = screen.getByRole('article', { name: 'Discovery agent' });
    expect(within(discovery).getByText('Disabled', { selector: 'span.rounded-full' })).toBeTruthy();
    expect(within(discovery).queryByText('Right now')).toBeNull(); // no fake activity for a disabled agent
    const followup = screen.getByRole('article', { name: 'Follow-up agent' });
    expect(within(followup).getAllByText('Not implemented').length).toBeGreaterThan(0);
    expect(within(followup).queryByText('Last run')).toBeNull();
    expect(within(followup).getByText(/does not exist yet/)).toBeTruthy();
  });

  it('says "never run" instead of inventing a last run, and shows the snapshot time', async () => {
    globalThis.fetch = route({ '/api/acquisition/agents': () => json({ ...OVERVIEW, agents: [agent({ key: 'strategy', name: 'Strategy' })] }) });
    render(<AgentCentre />);
    const a = await screen.findByRole('article', { name: 'Strategy agent' });
    expect(within(a).getByText(/Never run. No record exists/)).toBeTruthy();
    expect(within(a).getByText('Nothing is executing.')).toBeTruthy();
    expect(screen.getByText(/As of 2026-10-17 12:00 UTC/)).toBeTruthy();
  });

  it('shows a loading indicator, then a permission-denied message with no cards', async () => {
    let resolve: (r: Response) => void = () => {};
    globalThis.fetch = vi.fn(() => new Promise<Response>((r) => { resolve = r; })) as unknown as typeof fetch;
    const { container } = render(<AgentCentre />);
    expect(container.querySelector('.animate-spin')).toBeTruthy();
    resolve(new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Forbidden/);
    expect(screen.queryByRole('article')).toBeNull();
  });

  it('refresh re-reads the saved records', async () => {
    const f = route({ '/api/acquisition/agents': () => json(OVERVIEW) });
    globalThis.fetch = f;
    render(<AgentCentre />);
    await screen.findByRole('article', { name: 'Website audit agent' });
    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    await waitFor(() => expect((f as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2));
  });
});

const ROWS = [
  { taskId: 't-q', type: 'acq.strategize', agentName: 'Strategy', clinic: { id: 'ap1', name: 'Alpha Dental' }, state: 'queued', status: 'pending', attempts: 0, maxAttempts: 3, at: '2026-10-17T11:55:00Z', durationMs: null, summary: 'Waiting in the queue' },
  { taskId: 't-s', type: 'acq.discover', agentName: 'Discovery', clinic: null, state: 'skipped', status: 'skipped', attempts: 1, maxAttempts: 3, at: '2026-10-17T11:00:00Z', durationMs: 4, summary: 'Skipped: Google Places is disabled' },
];

describe('ActivityPanel', () => {
  it('lists queued and finished tasks with clear states; a row opens the task', async () => {
    globalThis.fetch = route({ '/api/acquisition/activity': () => json({ asOf: '2026-10-17T12:00:00Z', rows: ROWS }) });
    render(<ActivityPanel />);
    const table = await screen.findByRole('table', { name: 'Task activity' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Queued')).toBeTruthy();
    expect(within(rows[0]).getByText('Waiting in the queue')).toBeTruthy();
    expect(within(rows[0]).getByText('unavailable')).toBeTruthy(); // never ran: no duration, not 0
    expect(within(rows[1]).getByText('Skipped')).toBeTruthy();
    expect(within(rows[1]).getByText('Skipped: Google Places is disabled')).toBeTruthy();
    fireEvent.click(rows[0]);
    expect(push).toHaveBeenCalledWith('/acquisition/tasks/t-q');
    expect(within(rows[0]).getByRole('link', { name: 'Alpha Dental' }).getAttribute('href')).toBe('/acquisition/prospects/ap1');
  });

  it('also renders each task as a compact card for phones, with status and outcome visible', async () => {
    globalThis.fetch = route({ '/api/acquisition/activity': () => json({ asOf: '2026-10-17T12:00:00Z', rows: ROWS }) });
    render(<ActivityPanel />);
    const list = await screen.findByRole('list', { name: 'Task activity (compact)' });
    const cards = within(list).getAllByRole('listitem');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('Queued')).toBeTruthy();
    expect(within(cards[0]).getByText(/Alpha Dental/)).toBeTruthy();
    expect(within(cards[0]).getByText(/time unavailable/)).toBeTruthy();
    expect(within(cards[1]).getByText('Skipped: Google Places is disabled')).toBeTruthy();
    expect(within(cards[1]).getByRole('link').getAttribute('href')).toBe('/acquisition/tasks/t-s');
  });

  it('shows an empty state, filters by status and shows errors', async () => {
    const f = vi.fn((url: string) => json({ asOf: '2026-10-17T12:00:00Z', rows: String(url).includes('status=skipped') ? [] : ROWS }));
    globalThis.fetch = f as unknown as typeof fetch;
    render(<ActivityPanel />);
    await screen.findByRole('table', { name: 'Task activity' });
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'skipped' } });
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/No tasks recorded with this status/));
    expect(String(f.mock.calls.at(-1)![0])).toBe('/api/acquisition/activity?status=skipped');
    globalThis.fetch = route({ '/api/acquisition/activity': () => json({ error: 'Not found' }, 404) });
    fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Not found/);
  });

  it('the first-ever empty state tells the admin what to do', async () => {
    globalThis.fetch = route({ '/api/acquisition/activity': () => json({ asOf: '2026-10-17T12:00:00Z', rows: [] }) });
    render(<ActivityPanel />);
    expect((await screen.findByRole('status')).textContent).toMatch(/Import clinics, then press “Run queue now”/);
  });
});

const DETAIL = {
  task: { id: 't1', type: 'acq.audit', agent: 'audit', agentName: 'Website audit', status: 'completed', state: 'completed', attempts: 2, maxAttempts: 3, createdAt: '2026-10-17T10:00:00Z', scheduledAt: '2026-10-17T10:00:00Z', completedAt: '2026-10-17T10:05:00Z', firstStartedAt: '2026-10-17T10:01:00Z', lastAttemptDurationMs: 800, nextRetryAt: null, leaseExpired: false },
  clinic: { id: 'ap1', name: 'Alpha Dental', state: 'audited' }, summary: 'Website: no_website; 3 finding(s)', skipReason: null, error: null,
  input: { industryKey: 'dental', apiKey: '[hidden]' }, output: { fetchStatus: 'no_website', findings: 3 },
  attemptsLog: [
    { runId: 'r1', attempt: 1, status: 'failed', startedAt: '2026-10-17T10:01:00Z', finishedAt: '2026-10-17T10:01:45Z', durationMs: 45000, error: 'timed out', evidenceRefs: null, model: null, provider: null, usedModel: false },
    { runId: 'r2', attempt: 2, status: 'succeeded', startedAt: '2026-10-17T10:04:00Z', finishedAt: null, durationMs: null, error: null, evidenceRefs: ['s1', 's2'], model: null, provider: null, usedModel: false },
  ],
  parent: { id: 'tp', type: 'acq.research_contacts', status: 'completed', state: 'completed' }, children: [{ id: 'tc', type: 'acq.strategize', status: 'pending', state: 'queued' }],
  links: { clinic: '/acquisition/prospects/ap1', auditTrail: '/acquisition/prospects/ap1#audit-trail' },
};

describe('TaskDetail', () => {
  it('shows the saved facts, the retry history, related tasks and links', () => {
    render(<TaskDetail detail={DETAIL} />);
    expect(screen.getByText('t1')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Alpha Dental' }).getAttribute('href')).toBe('/acquisition/prospects/ap1');
    const attempts = within(screen.getByRole('table', { name: 'Attempts' }));
    expect(attempts.getAllByRole('row')).toHaveLength(3);
    expect(attempts.getByText('timed out')).toBeTruthy();
    expect(screen.getByText(/none used: this is rule-based code/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'acq.research_contacts (completed)' }).getAttribute('href')).toBe('/acquisition/tasks/tp');
    expect(screen.getByRole('link', { name: 'acq.strategize' }).getAttribute('href')).toBe('/acquisition/tasks/tc');
    expect(screen.getByRole('link', { name: 'audit trail' }).getAttribute('href')).toBe('/acquisition/prospects/ap1#audit-trail');
    expect(screen.getByText(/"findings": 3/)).toBeTruthy();
  });

  it('marks fields the database does not hold as unavailable instead of inventing them', () => {
    render(<TaskDetail detail={DETAIL} />);
    const table = within(screen.getByRole('table', { name: 'Attempts' }));
    expect(table.getAllByText('unavailable').length).toBeGreaterThanOrEqual(2); // 2nd attempt: no finish time, no duration
  });

  it('explains a skipped task that never ran, and a task with an expired lease', () => {
    render(<TaskDetail detail={{
      ...DETAIL, task: { ...DETAIL.task, status: 'skipped', state: 'skipped', attempts: 0, firstStartedAt: null, completedAt: null, lastAttemptDurationMs: null },
      skipReason: { code: 'places_disabled', label: 'Google Places is disabled' }, attemptsLog: [], clinic: null, links: null, parent: null, children: [], output: null,
    }} />);
    expect(screen.getByText('Why it was skipped')).toBeTruthy();
    expect(screen.getByText('Google Places is disabled')).toBeTruthy();
    expect(screen.getByText(/No attempt has been recorded/)).toBeTruthy();
    expect(screen.getByText(/No output recorded/)).toBeTruthy();
    expect(screen.getByText(/none \(not tied to a clinic\)/)).toBeTruthy();
    cleanup();
    render(<TaskDetail detail={{ ...DETAIL, task: { ...DETAIL.task, status: 'running', state: 'running_stale', leaseExpired: true } }} />);
    expect(screen.getByRole('alert').textContent).toMatch(/lease expired/);
  });

  it('shows an error prominently', () => {
    render(<TaskDetail detail={{ ...DETAIL, task: { ...DETAIL.task, status: 'dead', state: 'dead' }, error: 'Bearer [redacted] rejected' }} />);
    expect(screen.getByRole('alert').textContent).toMatch(/Bearer \[redacted\] rejected/);
  });
});

describe('TaskTimeline', () => {
  const at = (m: number) => `2026-10-17T10:0${m}:00Z`;
  const ITEMS = [
    { kind: 'state_change', at: at(0), title: 'State: none → discovered', detail: 'Imported', status: null, taskId: null, attempt: null, durationMs: null, evidenceRefCount: null, by: 'admin' },
    { kind: 'agent_run', at: at(1), title: 'Website audit · acq.audit', detail: 'Website: no_website; 2 finding(s)', status: 'succeeded', outcome: 'completed', taskId: 't1', attempt: 1, durationMs: 90, evidenceRefCount: 3, by: null },
    { kind: 'note', at: at(2), title: 'Recorded', detail: 'Manual evidence: x', status: null, taskId: null, attempt: null, durationMs: null, evidenceRefCount: null, by: 'admin' },
    { kind: 'queued_task', at: at(3), title: 'Strategy · acq.strategize', detail: 'Waiting in the queue', status: 'queued', taskId: 't2', attempt: null, durationMs: null, evidenceRefCount: null, by: null },
  ];

  it('labels agent executions, queued tasks and business state changes differently', () => {
    render(<TaskTimeline items={ITEMS} />);
    const list = within(screen.getByRole('list', { name: 'Task timeline' }));
    const rows = list.getAllByRole('listitem');
    expect(within(rows[0]).getByText('Clinic state change')).toBeTruthy();
    expect(within(rows[1]).getByText('Agent execution')).toBeTruthy();
    expect(rows[1].textContent).toMatch(/Attempt 1 · took 90 ms · evidence refs 3/);
    expect(within(rows[1]).getByRole('link', { name: 'open task' }).getAttribute('href')).toBe('/acquisition/tasks/t1');
    expect(within(rows[2]).getByText('Recorded action')).toBeTruthy();
    expect(within(rows[3]).getByText('Task, not executed yet')).toBeTruthy();
    expect(within(rows[3]).getByText('Queued')).toBeTruthy();
    expect(within(rows[0]).queryByRole('link')).toBeNull(); // a state change is not a task
  });

  it('shows an empty state', () => {
    render(<TaskTimeline items={[]} />);
    expect(screen.getByText('Nothing recorded for this clinic yet.')).toBeTruthy();
  });
});
