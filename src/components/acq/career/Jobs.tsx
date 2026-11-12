'use client';

import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, FilePen, Loader2, Search, Star, X } from 'lucide-react';
import type { DiscoveryResult } from '@/lib/career/jobs/discover';
import { api, box, hint, json, type CareerState } from './shared';

export interface JobRow { id: string; applicationStatus: string | null; score: number; reasons: string[]; status: string; title: string; company: string; location: string; remote: boolean; url: string; source: string; postedAt: string | null; foundAt: string }
export interface JobsData { discovered: number; matched: number; minScore: number; jobs: JobRow[] }
const tone = (s: number) => (s >= 85 ? 'acq-pill-green' : s >= 70 ? 'acq-pill-blue' : 'acq-pill-gray');
const ago = (d: string) => { const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000); return days < 1 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`; };

/** Job discovery tab: search now, and what the last search did. */
export function DiscoveryPanel({ state, onChanged }: { state: CareerState; onChanged: () => void }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [res, setRes] = useState<DiscoveryResult | null>(null);
  const last = state.events.find((e) => e.agent === 'job_discovery' && e.action === 'discovery_run');
  const run = async () => { setBusy(true); setErr(''); const r = await api<{ result: DiscoveryResult }>('/api/career/discover', json('POST', {})); setBusy(false); if (r.error) setErr(r.error); else { setRes(r.result); onChanged(); } };
  return (
    <>
      <p style={{ fontSize: 13.5, color: '#475569' }}>The agent reads public vacancies from the sources you chose ({state.discovery.sources.length ? state.discovery.sources.map((s) => (s === 'job_feeds' ? 'job feeds' : 'company career pages')).join(' and ') : 'none'}), removes repeats, and scores each job against your confirmed profile. It searches {state.discovery.frequency} automatically while deployed.</p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="acq-btn acq-btn-primary" disabled={busy || state.status !== 'active'} onClick={run}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Search now</button>
        {state.status !== 'active' && <span style={hint}>Resume the agent to search.</span>}
        {last && !res && <span style={hint}>Last search {new Date(last.createdAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}: {last.detail}</span>}
      </div>
      {err && <div role="alert" style={{ color: '#b91c1c', fontSize: 13.5 }}>{err}</div>}
      {res && (
        <div style={{ ...box, display: 'grid', gap: 6, fontSize: 13.5 }} aria-label="Search result">
          <b>{res.added} new job(s) found · {res.duplicates} repeat(s) removed · {res.matched} at or above {state.discovery.minScore}%</b>
          {res.sources.map((s) => <div key={s.name} style={{ color: s.ok ? '#475569' : '#b91c1c' }}>{s.ok ? '✓' : '✕'} {s.name}: {s.ok ? `${s.count} jobs read` : `could not be read (${s.error})`}</div>)}
          {res.noBoard.length > 0 && <div style={hint}>No public job board (Greenhouse or Lever) was found for: {res.noBoard.join(', ')}. Check the employer name, or add their jobs from a job feed.</div>}
          {res.sources.length === 0 && res.noBoard.length === 0 && <div style={hint}>No sources are selected. Edit your setup and choose at least one.</div>}
        </div>
      )}
      <div style={{ ...box, background: '#f8fafc', fontSize: 12.5 }}>Sources: Remotive (remote jobs), Arbeitnow (mostly Europe) and the public job boards of the employers you list, when they use Greenhouse or Lever. Jobs from Remotive link back to Remotive. The agent only reads vacancies here; it does not apply to anything yet.</div>
    </>
  );
}

/** Matched opportunities tab: best first, with the reasons for each score. */
export function MatchesPanel({ onChanged, refreshKey, onOpenApplications, canPrepare }: { onChanged: () => void; refreshKey: number; onOpenApplications: () => void; canPrepare: boolean }) {
  const [prep, setPrep] = useState<string[]>([]); const [perr, setPerr] = useState('');
  const [view, setView] = useState<'matches' | 'saved' | 'all'>('matches'); const [data, setData] = useState<JobsData | null>(null); const [err, setErr] = useState('');
  const load = useCallback(async () => { const r = await api<JobsData>(`/api/career/jobs?view=${view}`); if (r.error) setErr(r.error); else setData(r); }, [view]);
  useEffect(() => { void load(); }, [load, refreshKey]);
  const prepare = async (ids: string[]) => {
    setPerr(''); setPrep((p) => [...p, ...ids]);
    const r = await api<{ results: Array<{ ok: boolean; error?: string }> }>('/api/career/applications', json('POST', { matchIds: ids }));
    setPrep((p) => p.filter((x) => !ids.includes(x)));
    if (r.error) setPerr(r.error); else { const bad = r.results.find((x) => !x.ok); if (bad) setPerr(bad.error ?? ''); await load(); onChanged(); }
  };
  const mark = async (id: string, status: string) => { await api(`/api/career/jobs/${id}`, json('PATCH', { status })); await load(); onChanged(); };
  if (err) return <div role="alert" style={{ color: '#b91c1c' }}>{err}</div>;
  if (!data) return <div style={{ display: 'flex', gap: 8 }}><Loader2 size={16} className="animate-spin" /> Loading…</div>;
  return (
    <>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {([['matches', `Matches (${data.minScore}%+)`], ['saved', 'Saved'], ['all', 'All found']] as const).map(([v, l]) => <button key={v} className="acq-btn acq-btn-sm" aria-pressed={view === v} onClick={() => setView(v)} style={view === v ? { background: '#f3e8ff', borderColor: '#7e22ce', color: '#6b21a8' } : undefined}>{l}</button>)}
        <span style={hint}>{data.discovered} found · {data.matched} match</span>
        {canPrepare && data.jobs.some((j) => !j.applicationStatus) && <button className="acq-btn acq-btn-sm" disabled={prep.length > 0} onClick={() => prepare(data.jobs.filter((j) => !j.applicationStatus).slice(0, 5).map((j) => j.id))}><FilePen size={13} /> Prepare the top {Math.min(5, data.jobs.filter((j) => !j.applicationStatus).length)}</button>}
      </div>
      {perr && <div role="alert" style={{ color: '#b91c1c', fontSize: 13.5 }}>{perr}</div>}
      {data.jobs.length === 0 && <p style={hint}>{data.discovered === 0 ? 'Nothing found yet. Open Job discovery and press Search now.' : view === 'matches' ? `No jobs at ${data.minScore}% or above yet. Look at "All found" or lower the minimum in your setup.` : 'Nothing here.'}</p>}
      {data.jobs.map((j) => (
        <div key={j.id} style={{ ...box, display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div><b style={{ fontSize: 14.5 }}>{j.title}</b><div style={hint}>{j.company} · {j.remote ? 'Remote' : ''}{j.remote && j.location ? ' · ' : ''}{j.location} · via {j.source}{j.postedAt ? ` · posted ${ago(j.postedAt)}` : ''}</div></div>
            <span className={`acq-pill ${tone(j.score)}`} style={{ alignSelf: 'start' }}>{j.score}% match</span>
          </div>
          {j.reasons.length > 0 && <ul style={{ margin: '0 0 0 18px', fontSize: 13 }}>{j.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <a className="acq-btn acq-btn-sm" href={j.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> View posting</a>
            {j.applicationStatus && j.applicationStatus !== 'rejected'
              ? <button className="acq-btn acq-btn-sm" onClick={onOpenApplications}><FilePen size={13} /> Application: {j.applicationStatus}</button>
              : <button className="acq-btn acq-btn-primary acq-btn-sm" disabled={!canPrepare || prep.includes(j.id)} onClick={() => prepare([j.id])}>{prep.includes(j.id) ? <Loader2 size={13} className="animate-spin" /> : <FilePen size={13} />} Prepare application</button>}
            <button className="acq-btn acq-btn-sm" onClick={() => mark(j.id, j.status === 'saved' ? 'new' : 'saved')}><Star size={13} /> {j.status === 'saved' ? 'Unsave' : 'Save'}</button>
            <button className="acq-btn acq-btn-sm" onClick={() => mark(j.id, 'dismissed')}><X size={13} /> Not interested</button>
          </div>
        </div>
      ))}
    </>
  );
}
