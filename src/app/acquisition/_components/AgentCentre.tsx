'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { api, dateTime, fmtDuration, IMPLEMENTATION_LABEL } from './format';
import { AgentStateBadge, TaskStateBadge } from './StateBadge';

/* eslint-disable @typescript-eslint/no-explicit-any */

function ClinicLink({ clinic }: { clinic: { id: string; name: string } | null }) {
  return clinic ? <Link href={`/acquisition/prospects/${clinic.id}`} className="text-purple-300 hover:underline">{clinic.name}</Link> : <span className="text-gray-500">no clinic</span>;
}

function Metric({ m }: { m: { label: string; value: number | string | null; note?: string } }) {
  return (
    <li className="flex justify-between gap-3">
      <span className="text-gray-400">{m.label}{m.note ? <span className="text-gray-600"> · {m.note}</span> : null}</span>
      <span className={m.value === null ? 'text-gray-500 italic' : 'text-gray-100 font-bold'}>{m.value === null ? 'unavailable' : m.value}</span>
    </li>
  );
}

function AgentCard({ a }: { a: any }) {
  const built = a.implementation !== 'not_implemented';
  const hasRecords = a.counts.completed + a.counts.skipped + a.counts.dead + a.counts.cancelled + a.counts.queued + a.counts.running + a.counts.waitingRetry + a.counts.failedRetrying > 0;
  return (
    <article className="border border-white/8 bg-white/[0.02] rounded-2xl p-4 space-y-3 text-xs text-gray-300" aria-label={`${a.name} agent`}>
      <header className="space-y-1.5">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <h3 className="text-sm font-bold text-white">{a.name}</h3>
          <AgentStateBadge state={a.state} />
        </div>
        <p className="text-gray-400">{a.purpose}</p>
        <p><span className="font-bold text-gray-200">{IMPLEMENTATION_LABEL[a.implementation] ?? a.implementation}.</span> {a.capability}</p>
        {a.limitation && <p role="note" className="text-amber-300">Limitation: {a.limitation}</p>}
      </header>

      {built && a.implementation !== 'disabled' && (
        <>
          <div>
            <p className="font-bold text-gray-200">Right now</p>
            {a.currentTask
              ? <p>Executing a task for <ClinicLink clinic={a.currentTask.clinic} /> · started {a.currentTask.startedAt ? dateTime(a.currentTask.startedAt) : 'unavailable'} · <Link className="text-purple-300 hover:underline" href={`/acquisition/tasks/${a.currentTask.taskId}`}>open task</Link></p>
              : <p>Nothing is executing.</p>}
            <p className="text-gray-400">Queued: <b>{a.counts.queued + a.counts.failedRetrying}</b> · Waiting to retry: <b>{a.counts.waitingRetry}</b>{a.counts.staleLease ? <> · <span className="text-red-300">Lease expired: <b>{a.counts.staleLease}</b></span></> : null}</p>
          </div>

          <div>
            <p className="font-bold text-gray-200">Last run</p>
            {a.lastRun ? (
              <p>
                <TaskStateBadge state={a.lastRun.outcome} />{' '}
                {dateTime(a.lastRun.startedAt)} · {fmtDuration(a.lastRun.durationMs)} · <ClinicLink clinic={a.lastRun.clinic} />
                {a.lastRun.summary ? <span className="text-gray-400"> · {a.lastRun.summary}</span> : null}
                {' '}· <Link className="text-purple-300 hover:underline" href={`/acquisition/tasks/${a.lastRun.taskId}`}>details</Link>
              </p>
            ) : <p className="text-gray-500">Never run. No record exists.</p>}
            {hasRecords && <p className="text-gray-400">All-time tasks: completed <b>{a.counts.completed}</b> · skipped <b>{a.counts.skipped}</b> · failed permanently <b>{a.counts.dead}</b> · cancelled <b>{a.counts.cancelled}</b></p>}
          </div>

          {a.metrics.length > 0 && <ul className="space-y-1" aria-label={`${a.name} recorded metrics`}>{a.metrics.map((m: any) => <Metric key={m.label} m={m} />)}</ul>}
        </>
      )}

      {a.skipReasons.length > 0 && (
        <div>
          <p className="font-bold text-gray-200">Skipped, with reasons</p>
          <ul className="list-disc pl-5">{a.skipReasons.map((r: any) => <li key={r.reason}>{r.count} × {r.label}</li>)}</ul>
        </div>
      )}

      {a.failures.length > 0 && (
        <div>
          <p className="font-bold text-red-300">Failures</p>
          <ul className="space-y-1">
            {a.failures.map((f: any) => (
              <li key={f.taskId}>
                <TaskStateBadge state={f.state} /> attempt {f.attempts}/{f.maxAttempts} · <ClinicLink clinic={f.clinic} />: {f.error}
                {f.nextRetryAt ? <span className="text-gray-400"> · retry after {dateTime(f.nextRetryAt)}</span> : null}
                {' '}· <Link className="text-purple-300 hover:underline" href={`/acquisition/tasks/${f.taskId}`}>details</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {a.recent.length > 0 && (
        <div>
          <p className="font-bold text-gray-200">Recent activity</p>
          <ul className="space-y-0.5">
            {a.recent.slice(0, 3).map((r: any) => (
              <li key={r.runId}>{dateTime(r.startedAt)} · <TaskStateBadge state={r.outcome} /> · <ClinicLink clinic={r.clinic} /> · <Link className="text-purple-300 hover:underline" href={`/acquisition/tasks/${r.taskId}`}>task</Link></li>
            ))}
          </ul>
        </div>
      )}

      <p className="border-t border-white/8 pt-2"><span className="font-bold text-gray-200">Next:</span> {a.nextAction}</p>
    </article>
  );
}

/**
 * One card per agent, drawn only from persisted tasks and runs. A figure the
 * system has no record of reads "unavailable". There is no live feed: the
 * queue only runs when "Run queue now" is pressed, so this is a snapshot with
 * a refresh button.
 */
export default function AgentCentre() {
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await api<any>('/api/acquisition/agents')); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load agents'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <section className="border border-white/8 bg-white/[0.02] rounded-2xl p-5 space-y-4" aria-label="Agents">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-bold text-white">Agents</h2>
          <p className="text-xs text-gray-400 mt-1">What each agent really is and what it has actually done. A snapshot of saved records, not a live feed.</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 disabled:opacity-40">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
        </button>
      </div>
      {error && <p role="alert" className="flex items-center gap-2 text-xs text-red-300"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}
      {!data && !error && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
      {data && (
        <>
          <p className="text-xs text-gray-400">{data.note} <span className="text-gray-500">As of {dateTime(data.asOf)}.</span></p>
          <div className="grid lg:grid-cols-2 gap-3">{data.agents.map((a: any) => <AgentCard key={a.key} a={a} />)}</div>
        </>
      )}
    </section>
  );
}
