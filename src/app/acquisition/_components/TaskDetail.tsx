import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { dateTime, fmtDuration } from './format';
import { TaskStateBadge } from './StateBadge';

/* eslint-disable @typescript-eslint/no-explicit-any */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-white/8 bg-white/[0.02] rounded-2xl p-5 space-y-3">
      <h2 className="text-sm font-bold text-white">{title}</h2>
      {children}
    </section>
  );
}

const unavailable = <span className="text-gray-500 italic">unavailable</span>;
const Pre = ({ value }: { value: unknown }) => <pre className="text-[11px] bg-black/30 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap break-all text-gray-200">{JSON.stringify(value, null, 2)}</pre>;

/**
 * One task, from persisted rows only. Where the database stores nothing
 * (e.g. a model on a rule-based run, or an attempt for a task that never
 * ran), the field says so instead of showing a made-up value.
 */
export default function TaskDetail({ detail }: { detail: any }) {
  const { task, clinic, summary, skipReason, error, input, output, attemptsLog, parent, children, links } = detail;
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-white">{task.type}</h1>
        <p className="text-sm text-gray-400 mt-1 flex items-center gap-2 flex-wrap">{task.agentName} agent <TaskStateBadge state={task.state} /> {summary && <span>· {summary}</span>}</p>
      </div>

      <div role="note" className="flex items-start gap-2 text-xs text-gray-300 border border-white/10 bg-white/5 rounded-xl px-4 py-3">
        <ShieldAlert className="w-4 h-4 flex-shrink-0" />
        <span>Shown from saved records only. Secrets are hidden and phone numbers and email addresses are masked. Rule-based tasks use no model, so there is no token or cost data.</span>
      </div>

      <Section title="Overview">
        <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
          <div><dt className="inline text-gray-500">Task ID: </dt><dd className="inline text-gray-200 font-mono break-all">{task.id}</dd></div>
          <div><dt className="inline text-gray-500">Agent: </dt><dd className="inline text-gray-200">{task.agentName}</dd></div>
          <div><dt className="inline text-gray-500">Clinic: </dt><dd className="inline">{clinic ? <Link href={links.clinic} className="text-purple-300 hover:underline">{clinic.name}</Link> : <span className="text-gray-400">none (not tied to a clinic)</span>}</dd></div>
          <div><dt className="inline text-gray-500">Status: </dt><dd className="inline text-gray-200">{task.status}</dd></div>
          <div><dt className="inline text-gray-500">Attempts: </dt><dd className="inline text-gray-200">{task.attempts} of {task.maxAttempts}</dd></div>
          <div><dt className="inline text-gray-500">Created: </dt><dd className="inline text-gray-200">{dateTime(task.createdAt)}</dd></div>
          <div><dt className="inline text-gray-500">First started: </dt><dd className="inline text-gray-200">{task.firstStartedAt ? dateTime(task.firstStartedAt) : <>{unavailable} <span className="text-gray-500">(no attempt recorded)</span></>}</dd></div>
          <div><dt className="inline text-gray-500">Finished: </dt><dd className="inline text-gray-200">{task.completedAt ? dateTime(task.completedAt) : <span className="text-gray-400">not finished</span>}</dd></div>
          <div><dt className="inline text-gray-500">Last attempt took: </dt><dd className="inline text-gray-200">{task.lastAttemptDurationMs == null ? unavailable : fmtDuration(task.lastAttemptDurationMs)}</dd></div>
          {task.nextRetryAt && <div><dt className="inline text-gray-500">Next retry: </dt><dd className="inline text-gray-200">after {dateTime(task.nextRetryAt)}</dd></div>}
        </dl>
        {task.leaseExpired && <p role="alert" className="text-xs text-red-300">This task is marked running but its lease expired: the runner stopped. The next “Run queue now” resets and retries it.</p>}
      </Section>

      {skipReason && (
        <Section title="Why it was skipped">
          <p className="text-xs text-gray-200"><b>{skipReason.label}</b> <span className="text-gray-500">({skipReason.code})</span></p>
        </Section>
      )}

      {error && (
        <Section title="Error">
          <p role="alert" className="text-xs text-red-300 whitespace-pre-wrap break-words">{error}</p>
        </Section>
      )}

      <Section title="Input summary"><Pre value={input} /></Section>
      <Section title="Output / findings">
        {output && (typeof output !== 'object' || Object.keys(output as object).length > 0) ? <Pre value={output} /> : <p className="text-xs text-gray-400">No output recorded{task.status === 'pending' || task.status === 'running' ? ' yet' : ''}.</p>}
      </Section>

      <Section title="Attempts and retry history">
        {attemptsLog.length === 0
          ? <p className="text-xs text-gray-400">No attempt has been recorded. {task.status === 'pending' ? 'The task has not been picked up by a queue run yet.' : 'The runner never executed this task (for example it was cancelled first).'}</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs" aria-label="Attempts">
                <thead><tr className="text-left text-gray-500"><th className="py-1 pr-3">Attempt</th><th className="pr-3">Result</th><th className="pr-3">Started</th><th className="pr-3">Finished</th><th className="pr-3">Took</th><th className="pr-3">Evidence refs</th><th>Error</th></tr></thead>
                <tbody>
                  {attemptsLog.map((a: any) => (
                    <tr key={a.runId} className="border-t border-white/5 align-top">
                      <td className="py-1 pr-3 text-gray-200">{a.attempt}</td>
                      <td className="pr-3 text-gray-200">{a.status}</td>
                      <td className="pr-3 text-gray-400 whitespace-nowrap">{dateTime(a.startedAt)}</td>
                      <td className="pr-3 text-gray-400 whitespace-nowrap">{a.finishedAt ? dateTime(a.finishedAt) : unavailable}</td>
                      <td className="pr-3 text-gray-400">{a.durationMs == null ? unavailable : fmtDuration(a.durationMs)}</td>
                      <td className="pr-3 text-gray-400">{a.evidenceRefs ? a.evidenceRefs.length : unavailable}</td>
                      <td className="text-red-300 break-words">{a.error ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-gray-500 mt-2">Model, provider, tokens and cost: {attemptsLog.some((a: any) => a.usedModel) ? 'recorded per attempt' : 'none used: this is rule-based code'}.</p>
            </div>
          )}
      </Section>

      <Section title="Related">
        <ul className="text-xs text-gray-300 space-y-1">
          <li>Started by: {parent ? <Link className="text-purple-300 hover:underline" href={`/acquisition/tasks/${parent.id}`}>{parent.type} ({parent.status})</Link> : <span className="text-gray-400">a person or the import (no parent task)</span>}</li>
          <li>Queued next: {children.length ? children.map((c: any) => <span key={c.id} className="mr-2"><Link className="text-purple-300 hover:underline" href={`/acquisition/tasks/${c.id}`}>{c.type}</Link> (<TaskStateBadge state={c.state} />)</span>) : <span className="text-gray-400">nothing</span>}</li>
          {links && <li>Clinic: <Link className="text-purple-300 hover:underline" href={links.clinic}>profile</Link> · <Link className="text-purple-300 hover:underline" href={links.auditTrail}>audit trail</Link></li>}
        </ul>
      </Section>
    </div>
  );
}
