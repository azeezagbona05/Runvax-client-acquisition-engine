'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { api, dateTime, fmtDuration } from './format';
import { TaskStateBadge } from './StateBadge';

/* eslint-disable @typescript-eslint/no-explicit-any */
const FILTERS: Array<[string, string]> = [['', 'All tasks'], ['pending', 'Queued / retrying'], ['running', 'Running'], ['completed', 'Completed'], ['skipped', 'Skipped'], ['dead', 'Failed permanently'], ['cancelled', 'Cancelled']];

/**
 * Persisted task activity, newest first. Queued tasks are included, so a task
 * that has not run is visible and clearly not an execution. Click a row for
 * the task's attempts, input, output and links.
 */
export default function ActivityPanel() {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await api<any>(`/api/acquisition/activity${status ? `?status=${status}` : ''}`)); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load activity'); } finally { setLoading(false); }
  }, [status]);
  useEffect(() => { load(); }, [load]);

  return (
    <section className="border border-white/8 bg-white/[0.02] rounded-2xl p-5 space-y-3" aria-label="Agent activity">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-bold text-white">Agent activity</h2>
          <p className="text-xs text-gray-400 mt-1">Saved task records, newest first. Click a row for its details.</p>
        </div>
        <div className="flex items-center gap-2">
          <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="text-xs bg-black/40 border border-white/10 rounded px-2 py-1 text-gray-200">
            {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 disabled:opacity-40">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh
          </button>
        </div>
      </div>
      {error && <p role="alert" className="flex items-center gap-2 text-xs text-red-300"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}
      {!data && !error && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
      {data && data.rows.length === 0 && (
        <p className="text-xs text-gray-400" role="status">No tasks recorded{status ? ' with this status' : ''}. {status ? '' : 'Import clinics, then press “Run queue now” on the Overview tab.'}</p>
      )}
      {data && data.rows.length > 0 && (
        <ul className="sm:hidden space-y-2" aria-label="Task activity (compact)">
          {data.rows.map((r: any) => (
            <li key={r.taskId}>
              <Link href={`/acquisition/tasks/${r.taskId}`} className="block border border-white/8 rounded-xl p-3 space-y-1 text-xs hover:bg-white/5">
                <span className="flex items-center justify-between gap-2"><span className="font-bold text-gray-100">{r.agentName}</span><TaskStateBadge state={r.state} /></span>
                <span className="block text-gray-400">{r.type} · {dateTime(r.at)}</span>
                <span className="block text-gray-300">{r.clinic ? r.clinic.name : 'no clinic'} · {r.attempts}/{r.maxAttempts} tries · {r.durationMs == null ? 'time unavailable' : fmtDuration(r.durationMs)}</span>
                <span className="block text-gray-300">{r.summary ?? 'No outcome recorded'}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {data && data.rows.length > 0 && (
        <div className="overflow-x-auto hidden sm:block">
          <table className="w-full text-xs" aria-label="Task activity">
            <thead><tr className="text-left text-gray-500"><th className="py-1 pr-3">When</th><th className="pr-3">Agent</th><th className="pr-3">Task</th><th className="pr-3">Clinic</th><th className="pr-3">Status</th><th className="pr-3">Tries</th><th className="pr-3">Time taken</th><th>Outcome</th></tr></thead>
            <tbody>
              {data.rows.map((r: any) => (
                <tr key={r.taskId} className="border-t border-white/5 align-top cursor-pointer hover:bg-white/5" onClick={() => router.push(`/acquisition/tasks/${r.taskId}`)}>
                  <td className="py-1.5 pr-3 whitespace-nowrap"><Link href={`/acquisition/tasks/${r.taskId}`} className="text-purple-300 hover:underline" onClick={(e) => e.stopPropagation()}>{dateTime(r.at)}</Link></td>
                  <td className="pr-3 text-gray-200">{r.agentName}</td>
                  <td className="pr-3 text-gray-400">{r.type}</td>
                  <td className="pr-3">{r.clinic ? <Link href={`/acquisition/prospects/${r.clinic.id}`} className="text-purple-300 hover:underline" onClick={(e) => e.stopPropagation()}>{r.clinic.name}</Link> : <span className="text-gray-500">none</span>}</td>
                  <td className="pr-3"><TaskStateBadge state={r.state} /></td>
                  <td className="pr-3 text-gray-400">{r.attempts}/{r.maxAttempts}</td>
                  <td className="pr-3 text-gray-400">{r.durationMs == null ? <span className="text-gray-500 italic">unavailable</span> : fmtDuration(r.durationMs)}</td>
                  <td className="text-gray-300">{r.summary ?? <span className="text-gray-500 italic">no outcome recorded</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
