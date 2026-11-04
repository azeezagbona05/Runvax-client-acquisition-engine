import Link from 'next/link';
import { dateTime, fmtDuration } from './format';
import { TaskStateBadge } from './StateBadge';

/* eslint-disable @typescript-eslint/no-explicit-any */

const KIND: Record<string, { label: string; cls: string }> = {
  agent_run: { label: 'Agent execution', cls: 'bg-purple-500/20 text-purple-200 border-purple-500/30' },
  queued_task: { label: 'Task, not executed yet', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  state_change: { label: 'Clinic state change', cls: 'bg-white/5 text-gray-300 border-white/15' },
  note: { label: 'Recorded action', cls: 'bg-white/5 text-gray-400 border-white/10' },
};

/**
 * Chronological record for one clinic. Agent executions and queued tasks (with
 * their outcome and a link to the task) are visibly different from business
 * state changes and admin actions, which are only entries in the audit trail.
 */
export default function TaskTimeline({ items }: { items: any[] }) {
  if (items.length === 0) return <p className="text-xs text-gray-400">Nothing recorded for this clinic yet.</p>;
  return (
    <ol className="space-y-2" aria-label="Task timeline">
      {items.map((i, idx) => {
        const k = KIND[i.kind] ?? KIND.note;
        return (
          <li key={`${i.kind}-${i.taskId ?? ''}-${i.attempt ?? ''}-${idx}`} className={`text-xs border-l-2 pl-3 ${i.kind === 'agent_run' ? 'border-purple-400/60' : i.kind === 'queued_task' ? 'border-amber-400/60' : 'border-white/10'}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-gray-500 whitespace-nowrap">{dateTime(i.at)}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${k.cls}`}>{k.label}</span>
              <span className="text-gray-200 font-bold">{i.title}</span>
              {i.kind === 'agent_run' && i.outcome && <TaskStateBadge state={i.outcome} />}
              {i.kind === 'queued_task' && i.status && <TaskStateBadge state={i.status} />}
            </div>
            {i.detail && <p className="text-gray-400 mt-0.5">{i.detail}</p>}
            <p className="text-gray-500 mt-0.5">
              {i.kind === 'agent_run' && <>Attempt {i.attempt} · took {fmtDuration(i.durationMs)} · evidence refs {i.evidenceRefCount == null ? <span className="italic">unavailable</span> : i.evidenceRefCount} · </>}
              {i.by && <>by {i.by} · </>}
              {i.taskId && <Link href={`/acquisition/tasks/${i.taskId}`} className="text-purple-300 hover:underline">open task</Link>}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
