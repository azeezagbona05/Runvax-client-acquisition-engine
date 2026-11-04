// Display helpers shared by the acquisition screens. Scores are always shown
// as estimates; observed / inferred / unknown evidence is always labelled.

export const BASIS_STYLE: Record<string, { label: string; cls: string; hint: string }> = {
  observed: { label: 'Observed', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', hint: 'Seen directly on an independent source (the clinic’s own site, an import)' },
  inferred: { label: 'Inferred', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30', hint: 'Assumed from the industry or an unverified import field — not an observation' },
  unknown: { label: 'Unknown', cls: 'bg-white/5 text-gray-400 border-white/10', hint: 'Could not be checked (blocked, not fetched, or page not readable)' },
};

export const BAND_STYLE: Record<string, { label: string; cls: string }> = {
  high: { label: 'High fit', cls: 'bg-purple-500/20 text-purple-200' },
  medium: { label: 'Medium fit', cls: 'bg-blue-500/15 text-blue-200' },
  low: { label: 'Low fit', cls: 'bg-white/5 text-gray-300' },
  insufficient_evidence: { label: 'Insufficient evidence', cls: 'bg-white/5 text-gray-400' },
};

export function scoreText(total: number | null | undefined): string {
  return total == null ? 'Not scored' : `${total} / 100 (estimate)`;
}

export function pct(n: number | null | undefined): string {
  return n == null ? '—' : `${Math.round(n * 100)}%`;
}

export function dateTime(v: string | Date | null | undefined): string {
  if (!v) return '—';
  const d = typeof v === 'string' ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? '—' : d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

export function valueText(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'yes' : 'no';
  return String(v);
}

export const OFFER_NAMES: Record<string, string> = {
  ai_visibility_agent: 'AI Visibility Agent',
  ai_receptionist: 'AI Receptionist',
  ai_voice_agent: 'AI Voice Agent',
  ai_follow_up_agent: 'AI Follow-Up Agent',
  none: 'No offer nominated',
};

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string; issues?: string[] }).issues?.join('; ') || (json as { error?: string }).error || `Request failed (${res.status})`);
  return json as T;
}

/** Like api(), but returns 422 refusals (reasons / blockers) instead of throwing. */
export async function apiResult<T>(url: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok && res.status !== 422) throw new Error((json as { error?: string; issues?: string[] }).issues?.join('; ') || (json as { error?: string }).error || `Request failed (${res.status})`);
  return { status: res.status, body: json as T };
}

// ─── Agent Command Centre labels (state names come from src/lib/acquisition/agents.ts) ───

export const TASK_STATE: Record<string, { label: string; cls: string; hint: string }> = {
  queued: { label: 'Queued', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30', hint: 'Waiting in the queue. Nothing is executing it yet.' },
  waiting_retry: { label: 'Waiting to retry', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30', hint: 'A previous attempt failed or was deferred; it will be retried after the time shown.' },
  failed_retrying: { label: 'Retry due', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30', hint: 'A previous attempt failed. It will run again on the next queue run.' },
  running: { label: 'Running', cls: 'bg-purple-500/20 text-purple-200 border-purple-500/30', hint: 'Claimed by a queue run that is executing it now.' },
  running_stale: { label: 'Running (lease expired)', cls: 'bg-red-500/15 text-red-300 border-red-500/30', hint: 'Marked running, but the runner stopped. The next queue run resets and retries it.' },
  completed: { label: 'Completed', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', hint: 'Finished and recorded a result.' },
  skipped: { label: 'Skipped', cls: 'bg-white/5 text-gray-400 border-white/10', hint: 'The handler chose not to do the work; the reason is recorded.' },
  attempt_failed: { label: 'Attempt failed', cls: 'bg-red-500/15 text-red-300 border-red-500/30', hint: 'This attempt failed. Other attempts for the same task are shown separately.' },
  dead: { label: 'Failed permanently', cls: 'bg-red-500/15 text-red-300 border-red-500/30', hint: 'Every attempt failed. It will not run again unless re-triggered.' },
  cancelled: { label: 'Cancelled', cls: 'bg-white/5 text-gray-400 border-white/10', hint: 'Stopped before it ran, e.g. after an opt-out.' },
};

export const AGENT_STATE: Record<string, { label: string; cls: string }> = {
  running: { label: 'Running', cls: 'bg-purple-500/20 text-purple-200 border-purple-500/30' },
  failed: { label: 'Last run failed', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
  queued: { label: 'Work queued', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  waiting_retry: { label: 'Waiting to retry', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  idle: { label: 'Idle: waiting for work', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  disabled: { label: 'Disabled', cls: 'bg-white/5 text-gray-400 border-white/10' },
  manual: { label: 'Manual, not a queue agent', cls: 'bg-blue-500/15 text-blue-200 border-blue-500/30' },
  not_implemented: { label: 'Not implemented', cls: 'bg-white/5 text-gray-400 border-white/10' },
};

export const IMPLEMENTATION_LABEL: Record<string, string> = {
  rule_based: 'Rule-based, no AI',
  disabled: 'Disabled by design',
  manual: 'Manual workflow, not a queue agent',
  not_implemented: 'Not built'
};

export function fmtDuration(ms: number | null | undefined): string {
  if (ms == null) return 'unavailable';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}
