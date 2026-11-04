import { prisma } from '@/lib/prisma';
import { AGENTS, type AgentKey } from './models';
import { TASK_TYPES, isTaskType, type AcqTaskType } from './tasks/types';
import { crawlerIdentity } from './web/fetcher';
import { placesActivation } from './places/adapter';
import { redactSecrets } from './redact';
import { maskContactValues } from './web/extract';

/**
 * Read-only observability for the acquisition "agents". Everything returned
 * here comes from rows the queue already persists (AcquisitionTask,
 * AcquisitionAgentRun, AcquisitionPipelineEvent and the research tables).
 * Nothing is simulated or estimated: a number the system has no record of is
 * returned as null and shown as "unavailable".
 *
 * Honest labelling matters here. Every implemented agent is deterministic,
 * rule-based code — no model is called anywhere in the acquisition engine —
 * and several of the seven planned agents do not exist yet.
 */

export type Implementation = 'rule_based' | 'disabled' | 'manual' | 'not_implemented';

export interface AgentInfo {
  key: AgentKey;
  name: string;
  purpose: string;
  implementation: Implementation;
  /** What it really does today, in one sentence. */
  capability: string;
  taskTypes: AcqTaskType[];
}

const typesFor = (agent: AgentKey) => (Object.keys(TASK_TYPES) as AcqTaskType[]).filter((t) => TASK_TYPES[t] === agent);

export function agentInfo(): AgentInfo[] {
  return [
    {
      key: 'discovery', name: 'Discovery', implementation: 'disabled', taskTypes: typesFor('discovery'),
      purpose: 'Find dental clinics that are not yet prospects.',
      capability: 'Built but switched off: the Google Places finder (place IDs only) runs only when its code switch and env flag are both on, which waits on legal review. Meanwhile clinics enter by CSV import or manual entry, and any Places finds still need an independent source before they become prospects.',
    },
    {
      key: 'contacts', name: 'Contacts', implementation: 'rule_based', taskTypes: typesFor('contacts'),
      purpose: 'Record a clinic’s role inboxes and business phones.',
      capability: 'Keeps contact points from the import and, when website fetching is on, reads the clinic’s own site for role inboxes and phones. Never extracts named people.',
    },
    {
      key: 'audit', name: 'Website audit', implementation: 'rule_based', taskTypes: typesFor('audit'),
      purpose: 'Turn website evidence into signals and findings.',
      capability: 'Reads the clinic’s site when website fetching is on, then derives findings from all recorded signals, including evidence entered by hand.',
    },
    {
      key: 'strategy', name: 'Strategy', implementation: 'rule_based', taskTypes: typesFor('strategy'),
      purpose: 'Score each clinic and recommend an offer.',
      capability: 'Computes the deterministic fit score from recorded signals and maps it to an internal offer recommendation.',
    },
    {
      key: 'outreach', name: 'Outreach', implementation: 'manual', taskTypes: typesFor('outreach'),
      purpose: 'Draft the first message to a clinic.',
      capability: 'Its queue task is a no-op. Pitch drafts are generated on request from the clinic profile using fixed templates, then reviewed by a human. Nothing is sent.',
    },
    {
      key: 'followup', name: 'Follow-up', implementation: 'not_implemented', taskTypes: typesFor('followup'),
      purpose: 'Classify replies and schedule follow-ups.',
      capability: 'Its tasks are no-ops. Replies are logged by hand.',
    },
    {
      key: 'conversion', name: 'Qualification', implementation: 'not_implemented', taskTypes: typesFor('conversion'),
      purpose: 'Qualify interested clinics and track proposals.',
      capability: 'Its task is a no-op. Meetings and proposals are logged by hand.',
    },
  ];
}

// ─── Sanitising ─────────────────────────────────────────────────────────────

// Names that hold secrets. A bare "key" is not enough: industryKey and runKey are harmless and useful.
const SENSITIVE_KEY = /api[-_]?key|private[-_]?key|secret|token|password|passwd|^pass$|authorization|cookie|credential/i;

/** Makes persisted JSON safe to show: secrets redacted, contact values masked, bounded size. */
export function sanitizeValue(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return maskContactValues(redactSecrets(value, 500));
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (depth >= 4) return '[nested data omitted]';
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => sanitizeValue(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, 30)) {
      out[k] = SENSITIVE_KEY.test(k) ? '[hidden]' : sanitizeValue(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

const safeText = (s: string | null | undefined, max = 300) => (s ? maskContactValues(redactSecrets(s, max)) : null);

const SKIP_LABELS: Record<string, string> = {
  places_disabled: 'Google Places is disabled',
  not_implemented: 'This agent is not implemented',
  budget_exhausted: 'Daily provider budget used up; deferred',
  prospect_missing: 'The clinic no longer exists',
  domain_suppressed: 'The clinic’s domain is suppressed',
};

export function skipLabel(reason: string): string {
  if (SKIP_LABELS[reason]) return SKIP_LABELS[reason];
  const m = reason.match(/^prospect_(.+)$/);
  return m ? `The clinic is ${m[1].replace(/_/g, ' ')}` : reason;
}

interface TaskLike { type: string; status: string; output?: unknown; error?: string | null }

/** One-line outcome for a task, built only from what its handler persisted. */
export function summarizeTask(t: TaskLike): string | null {
  const out = (t.output ?? null) as Record<string, unknown> | null;
  if (t.status === 'skipped') return `Skipped: ${skipLabel(String(out?.reason ?? 'no reason recorded'))}`;
  if (t.status === 'dead') return `Failed permanently: ${safeText(t.error, 160) ?? 'no error recorded'}`;
  if (t.status === 'cancelled') return `Cancelled${t.error ? `: ${safeText(t.error.replace(/^cancelled: ?/, ''), 120)}` : ''}`;
  if (t.error && (t.status === 'pending' || t.status === 'failed')) return `Last attempt failed: ${safeText(t.error, 160)}`;
  if (t.status === 'pending') return 'Waiting in the queue';
  if (t.status === 'running') return 'Running now';
  if (t.status !== 'completed' || !out) return null;
  const n = (k: string) => (typeof out[k] === 'number' ? (out[k] as number) : null);
  switch (t.type) {
    case 'acq.research_contacts':
      return `Website: ${String(out.fetchStatus ?? 'unrecorded')}; ${n('stored') ?? 0} contact point(s) stored, ${n('suppressed') ?? 0} suppressed`;
    case 'acq.audit':
      return `Website: ${String(out.fetchStatus ?? 'unrecorded')}; ${n('findings') ?? 0} finding(s)`;
    case 'acq.strategize':
      return `Score ${n('total') ?? '?'} (${String(out.band ?? '?')}); recommended offer: ${String(out.primaryOfferId ?? 'none')}`;
    default:
      return 'Completed';
  }
}

// ─── Shared lookups ─────────────────────────────────────────────────────────

const STALE_LEASE_TEXT = 'Marked running, but its lease expired: the runner stopped';

export interface ClinicRef { id: string; name: string; state: string }

async function clinicMap(userId: string, ids: Array<string | null | undefined>): Promise<Map<string, ClinicRef>> {
  const want = Array.from(new Set(ids.filter((x): x is string => !!x)));
  const map = new Map<string, ClinicRef>();
  if (want.length === 0) return map;
  const acqs = await prisma.acquisitionProspect.findMany({ where: { userId, id: { in: want } }, select: { id: true, prospectId: true, state: true } }) as Array<{ id: string; prospectId: string; state: string }>;
  const crm = await prisma.prospect.findMany({ where: { userId, id: { in: acqs.map((a) => a.prospectId) } }, select: { id: true, businessName: true } }) as Array<{ id: string; businessName: string }>;
  const names = new Map(crm.map((p) => [p.id, p.businessName]));
  for (const a of acqs) map.set(a.id, { id: a.id, name: names.get(a.prospectId) ?? '(unknown)', state: a.state });
  return map;
}

interface TaskRow {
  id: string; type: string; status: string; acqProspectId: string | null; parentTaskId: string | null;
  attempts: number; maxAttempts: number; scheduledAt: Date; lockedUntil: Date | null; completedAt: Date | null;
  error: string | null; output: unknown; input: unknown; createdAt: Date;
}
interface RunRow {
  id: string; taskId: string; agent: string; attempt: number; status: string; provider: string | null; model: string | null;
  durationMs: number | null; evidenceRefs: unknown; error: string | null; startedAt: Date; finishedAt: Date | null;
}

export type TaskState = 'queued' | 'waiting_retry' | 'running' | 'running_stale' | 'completed' | 'skipped' | 'failed_retrying' | 'dead' | 'cancelled';

/** Plain-language state: separates a queued task from an executing one, and a retry wait from both. */
export function taskState(t: Pick<TaskRow, 'status' | 'scheduledAt' | 'lockedUntil' | 'error'>, now = new Date()): TaskState {
  switch (t.status) {
    case 'pending':
      if (t.scheduledAt > now) return 'waiting_retry';
      return t.error && !t.error.startsWith('deferred:') ? 'failed_retrying' : 'queued';
    case 'running': return t.lockedUntil && t.lockedUntil > now ? 'running' : 'running_stale';
    case 'completed': return 'completed';
    case 'skipped': return 'skipped';
    case 'dead': return 'dead';
    case 'cancelled': return 'cancelled';
    default: return 'failed_retrying';
  }
}

/** summarizeTask, but a task whose lease expired is not described as running. */
function taskSummary(t: TaskRow, now: Date): string | null {
  return taskState(t, now) === 'running_stale' ? STALE_LEASE_TEXT : summarizeTask(t);
}

// ─── Agent overview ─────────────────────────────────────────────────────────

/**
 * What one attempt actually amounted to. The queue records a run as "succeeded"
 * even when the handler skipped the work, so the outcome comes from the task's
 * real state, never from the run status alone.
 */
export type RunOutcome = TaskState | 'attempt_failed';

function runOutcome(r: Pick<RunRow, 'status' | 'attempt'>, t: TaskRow | undefined, now: Date): RunOutcome {
  const ts = t ? taskState(t, now) : null;
  if (r.status === 'failed') return ts === 'dead' && t && r.attempt >= t.attempts ? 'dead' : 'attempt_failed';
  if (r.status === 'running') return ts === 'running_stale' ? 'running_stale' : 'running';
  if (r.status === 'deferred') return 'waiting_retry';
  if (ts === 'skipped' || ts === 'cancelled' || ts === 'dead') return ts;
  return 'completed';
}

export type AgentState = 'running' | 'failed' | 'queued' | 'waiting_retry' | 'idle' | 'disabled' | 'manual' | 'not_implemented';

export interface AgentMetric { label: string; value: number | string | null; note?: string }
export interface AgentActivityItem {
  runId: string; taskId: string; status: string; outcome: RunOutcome; attempt: number; startedAt: Date; durationMs: number | null;
  clinic: ClinicRef | null; summary: string | null;
}
export interface AgentSummary extends AgentInfo {
  state: AgentState;
  limitation: string | null;
  currentTask: { taskId: string; clinic: ClinicRef | null; startedAt: Date | null } | null;
  counts: { queued: number; waitingRetry: number; running: number; staleLease: number; completed: number; skipped: number; failedRetrying: number; dead: number; cancelled: number };
  lastRun: AgentActivityItem | null;
  metrics: AgentMetric[];
  skipReasons: Array<{ reason: string; label: string; count: number }>;
  failures: Array<{ taskId: string; state: TaskState; attempts: number; maxAttempts: number; error: string; nextRetryAt: Date | null; clinic: ClinicRef | null }>;
  recent: AgentActivityItem[];
  nextAction: string;
}

const distinct = (xs: Array<string | null>) => new Set(xs.filter(Boolean)).size;

export async function agentOverview(userId: string, now = new Date()): Promise<{ asOf: Date; agents: AgentSummary[]; note: string }> {
  const [tasksRaw, runsRaw, findings, contacts, scores, recs, drafts] = await Promise.all([
    prisma.acquisitionTask.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 2000 }),
    prisma.acquisitionAgentRun.findMany({ where: { userId }, orderBy: { startedAt: 'desc' }, take: 500 }),
    prisma.acquisitionFinding.count({ where: { userId } }),
    prisma.acquisitionDecisionMaker.count({ where: { userId } }),
    prisma.acquisitionScore.count({ where: { userId } }),
    prisma.acquisitionRecommendation.count({ where: { userId } }),
    prisma.acquisitionDraft.count({ where: { userId } }),
  ]);
  const tasks = tasksRaw as TaskRow[];
  const runs = runsRaw as RunRow[];
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  const crawler = crawlerIdentity();
  const places = placesActivation();

  // Clinics referenced by anything we are about to show.
  const showRuns = runs.slice(0, 60);
  const clinics = await clinicMap(userId, [...showRuns.map((r) => taskById.get(r.taskId)?.acqProspectId), ...tasks.slice(0, 200).map((t) => t.acqProspectId)]);

  const item = (r: RunRow): AgentActivityItem => {
    const t = taskById.get(r.taskId);
    const outcome = runOutcome(r, t, now);
    return {
      runId: r.id, taskId: r.taskId, status: r.status, outcome, attempt: r.attempt, startedAt: r.startedAt, durationMs: r.durationMs,
      clinic: t?.acqProspectId ? clinics.get(t.acqProspectId) ?? null : null,
      summary: !t ? null
        : r.status === 'failed' ? (outcome === 'dead' ? summarizeTask(t) : `Attempt ${r.attempt} failed: ${safeText(r.error, 160) ?? 'no error recorded'}`)
          : taskSummary(t, now),
    };
  };

  const agents: AgentSummary[] = agentInfo().map((info) => {
    const mine = tasks.filter((t) => info.taskTypes.includes(t.type as AcqTaskType));
    const states = mine.map((t) => ({ t, s: taskState(t, now) }));
    const count = (...ss: TaskState[]) => states.filter((x) => ss.includes(x.s)).length;
    const counts = {
      queued: count('queued'), waitingRetry: count('waiting_retry'), running: count('running'), staleLease: count('running_stale'),
      completed: count('completed'), skipped: count('skipped'), failedRetrying: count('failed_retrying'),
      dead: count('dead'), cancelled: count('cancelled'),
    };
    const myRuns = runs.filter((r) => r.agent === info.key);
    const lastRun = myRuns[0] ? item(myRuns[0]) : null;

    let state: AgentState;
    if (info.implementation === 'not_implemented') state = 'not_implemented';
    else if (info.implementation === 'disabled') state = 'disabled';
    else if (info.implementation === 'manual') state = 'manual';
    else if (counts.running > 0) state = 'running';
    else if (myRuns[0]?.status === 'failed') state = 'failed';
    else if (counts.queued > 0 || counts.failedRetrying > 0) state = 'queued';
    else if (counts.waitingRetry > 0) state = 'waiting_retry';
    else state = 'idle';

    const running = states.find((x) => x.s === 'running');
    const currentTask = running
      ? {
        taskId: running.t.id, clinic: running.t.acqProspectId ? clinics.get(running.t.acqProspectId) ?? null : null,
        startedAt: myRuns.find((r) => r.taskId === running.t.id && r.status === 'running')?.startedAt ?? null,
      }
      : null;

    const skipMap = new Map<string, number>();
    for (const { t, s } of states) {
      if (s !== 'skipped') continue;
      const reason = String((t.output as { reason?: unknown } | null)?.reason ?? 'no reason recorded');
      skipMap.set(reason, (skipMap.get(reason) ?? 0) + 1);
    }
    const skipReasons = Array.from(skipMap, ([reason, count]) => ({ reason, label: skipLabel(reason), count })).sort((a, b) => b.count - a.count);

    const failures = states
      .filter(({ s, t }) => t.error && (s === 'failed_retrying' || s === 'dead' || (s === 'waiting_retry' && !t.error.startsWith('deferred:'))))
      .slice(0, 3)
      .map(({ t, s }) => ({
        taskId: t.id, state: s, attempts: t.attempts, maxAttempts: t.maxAttempts, error: safeText(t.error, 200) ?? '',
        nextRetryAt: s !== 'dead' && t.scheduledAt > now ? t.scheduledAt : null,
        clinic: t.acqProspectId ? clinics.get(t.acqProspectId) ?? null : null,
      }));

    const completed = states.filter((x) => x.s === 'completed').map((x) => x.t);
    const lastOut = (completed[0]?.output ?? null) as Record<string, unknown> | null;
    const metrics: AgentMetric[] = [];
    if (info.key === 'contacts') {
      metrics.push({ label: 'Clinics processed (completed tasks)', value: distinct(completed.map((t) => t.acqProspectId)) });
      metrics.push({ label: 'Contact points on file', value: contacts, note: 'all sources, including imports' });
      metrics.push({ label: 'Stored by the latest run', value: typeof lastOut?.stored === 'number' ? (lastOut.stored as number) : null });
    } else if (info.key === 'audit') {
      metrics.push({ label: 'Clinics audited (completed tasks)', value: distinct(completed.map((t) => t.acqProspectId)) });
      metrics.push({ label: 'Findings on file', value: findings, note: 'current findings across all clinics' });
      metrics.push({ label: 'Found by the latest run', value: typeof lastOut?.findings === 'number' ? (lastOut.findings as number) : null });
    } else if (info.key === 'strategy') {
      metrics.push({ label: 'Clinics scored (completed tasks)', value: distinct(completed.map((t) => t.acqProspectId)) });
      metrics.push({ label: 'Scores on file', value: scores, note: 'append-only history' });
      metrics.push({ label: 'Recommendations on file', value: recs });
    } else if (info.key === 'outreach') {
      metrics.push({ label: 'Pitch drafts generated on request', value: drafts, note: 'not produced by the queue' });
    }
    if (info.implementation === 'rule_based') {
      metrics.push({ label: 'Model, tokens, cost', value: null, note: 'not applicable: no model is used' });
    }

    let limitation: string | null = null;
    if ((info.key === 'contacts' || info.key === 'audit') && !crawler.ok) limitation = `Website fetching is off (${crawler.reason}), so this agent only works from imported and manually entered data.`;
    if (info.key === 'discovery') limitation = places.reasons.join('; ');

    let nextAction: string;
    if (info.implementation === 'not_implemented') nextAction = 'None. This agent does not exist yet; building it is a separate decision.';
    else if (info.implementation === 'disabled') nextAction = 'None. Needs legal review and a Places connection before it can be switched on.';
    else if (info.implementation === 'manual') nextAction = 'Generate a pitch from a clinic’s profile, or open the review queue.';
    else if (counts.staleLease > 0) nextAction = `${counts.staleLease} task(s) are marked running but their lease expired (the runner stopped). The next “Run queue now” resets and retries them.`;
    else if (counts.dead > 0) nextAction = `Review ${counts.dead} permanently failed task(s) below; re-audit or re-score from the clinic’s profile to retry.`;
    else if (counts.queued + counts.failedRetrying > 0) nextAction = 'Press “Run queue now” to process the queued task(s).';
    else if (counts.waitingRetry > 0) nextAction = 'Waiting for a retry time; press “Run queue now” after it passes.';
    else nextAction = 'Waiting for work. Nothing is queued.';

    return {
      ...info, state, limitation, currentTask, counts, lastRun, metrics, skipReasons, failures,
      recent: myRuns.slice(0, 5).map(item), nextAction,
    };
  });

  return {
    asOf: now,
    agents,
    note: `${AGENTS.length} agents are defined; ${agents.filter((a) => a.implementation === 'rule_based').length} are implemented (all rule-based, no AI). The queue only runs when you press “Run queue now”: there is no scheduler.`,
  };
}

// ─── Activity list ──────────────────────────────────────────────────────────

export interface ActivityRow {
  taskId: string; type: string; agent: AgentKey | 'unknown'; agentName: string; clinic: ClinicRef | null;
  state: TaskState; status: string; attempts: number; maxAttempts: number;
  at: Date; durationMs: number | null; summary: string | null;
}

const agentName = (k: string) => agentInfo().find((a) => a.key === k)?.name ?? k;

export async function listActivity(userId: string, q: { status?: string; limit?: number } = {}, now = new Date()): Promise<{ asOf: Date; rows: ActivityRow[] }> {
  const where: Record<string, unknown> = { userId };
  if (q.status) where.status = q.status;
  const tasks = await prisma.acquisitionTask.findMany({ where, orderBy: { createdAt: 'desc' }, take: Math.min(Math.max(q.limit ?? 100, 1), 200) }) as TaskRow[];
  const runs = tasks.length
    ? await prisma.acquisitionAgentRun.findMany({ where: { userId, taskId: { in: tasks.map((t) => t.id) } }, orderBy: { startedAt: 'desc' } }) as RunRow[]
    : [];
  const clinics = await clinicMap(userId, tasks.map((t) => t.acqProspectId));
  const lastRun = new Map<string, RunRow>();
  for (const r of runs) if (!lastRun.has(r.taskId)) lastRun.set(r.taskId, r);
  const rows = tasks.map((t): ActivityRow => {
    const agent = isTaskType(t.type) ? TASK_TYPES[t.type] : 'unknown';
    const r = lastRun.get(t.id);
    return {
      taskId: t.id, type: t.type, agent, agentName: agent === 'unknown' ? 'Unknown' : agentName(agent),
      clinic: t.acqProspectId ? clinics.get(t.acqProspectId) ?? null : null,
      state: taskState(t, now), status: t.status, attempts: t.attempts, maxAttempts: t.maxAttempts,
      at: t.completedAt ?? r?.startedAt ?? t.createdAt, durationMs: r?.durationMs ?? null, summary: taskSummary(t, now),
    };
  });
  // Most recent activity first: a finished task sorts by when it finished, a queued one by when it was created.
  rows.sort((a, b) => b.at.getTime() - a.at.getTime());
  return { asOf: now, rows };
}

// ─── Task detail ────────────────────────────────────────────────────────────

export async function getTaskDetail(userId: string, taskId: string, now = new Date()) {
  const t = await prisma.acquisitionTask.findFirst({ where: { id: taskId, userId } }) as TaskRow | null;
  if (!t) return null;
  const [runsRaw, parent, children] = await Promise.all([
    prisma.acquisitionAgentRun.findMany({ where: { userId, taskId: t.id }, orderBy: { startedAt: 'asc' } }),
    t.parentTaskId ? prisma.acquisitionTask.findFirst({ where: { id: t.parentTaskId, userId } }) : Promise.resolve(null),
    prisma.acquisitionTask.findMany({ where: { userId, parentTaskId: t.id }, orderBy: { createdAt: 'asc' } }),
  ]);
  const runs = runsRaw as RunRow[];
  const clinic = t.acqProspectId ? (await clinicMap(userId, [t.acqProspectId])).get(t.acqProspectId) ?? null : null;
  const agent = isTaskType(t.type) ? TASK_TYPES[t.type] : 'unknown';
  const out = (t.output ?? null) as { reason?: unknown } | null;
  const state = taskState(t, now);
  const brief = (x: TaskRow) => ({ id: x.id, type: x.type, status: x.status, state: taskState(x, now) });
  return {
    task: {
      id: t.id, type: t.type, agent, agentName: agent === 'unknown' ? 'Unknown' : agentName(agent), status: t.status, state,
      attempts: t.attempts, maxAttempts: t.maxAttempts, createdAt: t.createdAt, scheduledAt: t.scheduledAt, completedAt: t.completedAt,
      // The task row has no "started" column: the first attempt's start time is the earliest record of execution.
      firstStartedAt: runs[0]?.startedAt ?? null,
      lastAttemptDurationMs: runs.length ? runs[runs.length - 1].durationMs : null,
      nextRetryAt: state === 'failed_retrying' || state === 'waiting_retry' ? t.scheduledAt : null,
      leaseExpired: state === 'running_stale',
    },
    clinic,
    summary: taskSummary(t, now),
    skipReason: t.status === 'skipped' ? { code: String(out?.reason ?? 'no reason recorded'), label: skipLabel(String(out?.reason ?? 'no reason recorded')) } : null,
    error: safeText(t.error, 500),
    input: sanitizeValue(t.input),
    output: sanitizeValue(t.output),
    attemptsLog: runs.map((r) => ({
      runId: r.id, attempt: r.attempt, status: r.status, startedAt: r.startedAt, finishedAt: r.finishedAt, durationMs: r.durationMs,
      error: safeText(r.error, 500),
      evidenceRefs: Array.isArray(r.evidenceRefs) ? (r.evidenceRefs as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 50) : null,
      model: r.model ?? null, provider: r.provider ?? null,
      usedModel: !!(r.model || r.provider),
    })),
    parent: parent ? brief(parent as TaskRow) : null,
    children: (children as TaskRow[]).map(brief),
    links: clinic ? { clinic: `/acquisition/prospects/${clinic.id}`, auditTrail: `/acquisition/prospects/${clinic.id}#audit-trail` } : null,
  };
}

// ─── Per-clinic timeline ────────────────────────────────────────────────────

export type TimelineKind = 'agent_run' | 'queued_task' | 'state_change' | 'note';
export interface TimelineItem {
  kind: TimelineKind;
  at: Date;
  title: string;
  detail: string | null;
  status: string | null;
  /** For agent runs: what the attempt amounted to (completed, skipped, attempt failed, failed permanently...). */
  outcome: RunOutcome | null;
  taskId: string | null;
  attempt: number | null;
  durationMs: number | null;
  evidenceRefCount: number | null;
  /** For state changes: who did it. */
  by: string | null;
}

// Event actors that are the system's own agents rather than a person.
const AGENT_ACTORS = new Set(['contacts', 'audit', 'strategy', 'discovery', 'system']);

export async function clinicTimeline(userId: string, acqProspectId: string, now = new Date()): Promise<TimelineItem[]> {
  const [tasksRaw, eventsRaw] = await Promise.all([
    prisma.acquisitionTask.findMany({ where: { userId, acqProspectId }, orderBy: { createdAt: 'asc' } }),
    prisma.acquisitionPipelineEvent.findMany({ where: { userId, acqProspectId }, orderBy: { createdAt: 'asc' } }),
  ]);
  const tasks = tasksRaw as TaskRow[];
  const runs = tasks.length ? await prisma.acquisitionAgentRun.findMany({ where: { userId, taskId: { in: tasks.map((t) => t.id) } }, orderBy: { startedAt: 'asc' } }) as RunRow[] : [];
  const byTask = new Map<string, RunRow[]>();
  for (const r of runs) byTask.set(r.taskId, [...(byTask.get(r.taskId) ?? []), r]);

  const items: TimelineItem[] = [];
  for (const t of tasks) {
    const agent = isTaskType(t.type) ? TASK_TYPES[t.type] : 'unknown';
    const label = `${agent === 'unknown' ? 'Unknown agent' : agentName(agent)} · ${t.type}`;
    const myRuns = byTask.get(t.id) ?? [];
    for (const r of myRuns) {
      const last = r.attempt === t.attempts || r === myRuns[myRuns.length - 1];
      items.push({
        kind: 'agent_run', at: r.startedAt, title: label,
        // The task's output belongs to its final attempt; earlier attempts show only their own error.
        detail: r.status === 'failed' ? `Attempt ${r.attempt} failed: ${safeText(r.error, 200) ?? 'no error recorded'}`
          : last ? taskSummary(t, now) : null,
        status: r.status, outcome: runOutcome(r, t, now), taskId: t.id, attempt: r.attempt, durationMs: r.durationMs,
        evidenceRefCount: Array.isArray(r.evidenceRefs) ? r.evidenceRefs.length : null, by: null,
      });
    }
    // A task that never ran (queued, or cancelled first), or one waiting to try again, is shown as its own
    // row so a queued task is never mistaken for an execution.
    const s = taskState(t, now);
    if (myRuns.length === 0 || s === 'queued' || s === 'waiting_retry' || s === 'failed_retrying') {
      items.push({
        kind: 'queued_task', at: s === 'queued' || myRuns.length === 0 ? t.createdAt : t.scheduledAt, title: label,
        detail: s === 'waiting_retry' ? `Waiting to retry after ${t.scheduledAt.toISOString().replace('T', ' ').slice(0, 16)} UTC` : summarizeTask(t),
        status: s, outcome: null, taskId: t.id, attempt: null, durationMs: null, evidenceRefCount: null, by: null,
      });
    }
  }
  for (const e of eventsRaw as Array<{ createdAt: Date; fromState: string; toState: string; reason: string; actor: string }>) {
    const changed = e.fromState !== e.toState;
    items.push({
      kind: changed ? 'state_change' : 'note', at: e.createdAt,
      title: changed ? `State: ${e.fromState} → ${e.toState}` : 'Recorded',
      detail: safeText(e.reason, 300), status: null, outcome: null, taskId: null, attempt: null, durationMs: null, evidenceRefCount: null,
      by: AGENT_ACTORS.has(e.actor) ? `${e.actor} (system)` : 'admin',
    });
  }
  return items.sort((a, b) => a.at.getTime() - b.at.getTime());
}
