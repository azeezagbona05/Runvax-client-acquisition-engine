'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

type Row = { email: string | null; status: string; deployedAt: string | null; jobsFound: number; matched: number; prepared: number; applied: number; replies: number; interviews: number; aiWrites: number; actions: number; lastActive: string | null };
type Report = { totals: Record<string, number>; users: Row[] };
const card = 'bg-gray-900 border border-white/8 rounded-2xl';

export default function CareerPilotPanel() {
  const [r, setR] = useState<Report | null>(null); const [err, setErr] = useState('');
  useEffect(() => { fetch('/api/admin/career-pilot').then(async (x) => { const j = await x.json(); if (!x.ok) setErr(j.error || 'Failed'); else setR(j); }).catch(() => setErr('Could not load the report.')); }, []);
  if (err) return <div className={`${card} p-5 text-sm text-red-300`}>{err}</div>;
  if (!r) return <div className="flex items-center gap-2 text-gray-400 text-sm"><Loader2 size={14} className="animate-spin" /> Loading…</div>;
  const T = r.totals; const rate = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
  const tiles: Array<[string, string]> = [['Users', `${T.users} (${T.active} active)`], ['Jobs found', String(T.jobsFound)], ['Good matches', String(T.matched)], ['Prepared', String(T.prepared)], ['Applied', String(T.applied)], ['Reply rate', rate(T.replies, T.applied)], ['Interviews', String(T.interviews)], ['AI writes / user', T.users ? (T.aiWrites / T.users).toFixed(1) : '—']];
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">Counts only. No CV text, job content or employer emails are shown. Use it to judge the 10 to 20 person pilot.</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{tiles.map(([l, v]) => <div key={l} className={`${card} p-4`}><div className="text-xl font-bold text-white">{v}</div><div className="text-xs text-gray-500">{l}</div></div>)}</div>
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full text-sm"><thead><tr className="text-left text-xs text-gray-500">{['User', 'Status', 'Found', 'Matched', 'Prepared', 'Applied', 'Replies', 'Interviews', 'AI writes', 'Last active'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>{r.users.map((u) => <tr key={(u.email ?? '') + u.deployedAt} className="border-t border-white/5 text-gray-300"><td className="px-3 py-2">{u.email}</td><td className="px-3 py-2">{u.status}</td><td className="px-3 py-2">{u.jobsFound}</td><td className="px-3 py-2">{u.matched}</td><td className="px-3 py-2">{u.prepared}</td><td className="px-3 py-2">{u.applied}</td><td className="px-3 py-2">{u.replies}</td><td className="px-3 py-2">{u.interviews}</td><td className="px-3 py-2">{u.aiWrites}</td><td className="px-3 py-2">{u.lastActive ? new Date(u.lastActive).toLocaleDateString() : '—'}</td></tr>)}
            {r.users.length === 0 && <tr><td colSpan={10} className="px-3 py-6 text-center text-gray-500">No Career Agent users yet.</td></tr>}</tbody></table>
      </div>
    </div>
  );
}
