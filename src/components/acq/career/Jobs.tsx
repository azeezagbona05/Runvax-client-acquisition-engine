'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, FilePen, LayoutList, Layers, Loader2, Search, Star, X } from 'lucide-react';
import type { DiscoveryResult } from '@/lib/career/jobs/discover';
import { api, box, hint, json, type CareerState } from './shared';
import { StaleNotice } from './ui';
import SwipeDeck from './SwipeDeck';

export interface JobRow { id: string; applicationStatus: string | null; score: number; reasons: string[]; status: string; title: string; company: string; location: string; remote: boolean; url: string; source: string; sourceId?: string; postedAt: string | null; foundAt: string }
export interface JobsData { discovered: number; matched: number; minScore: number; jobs: JobRow[]; total?: number; sources?: Array<{ id: string; label: string; count: number }> }
const tone = (s: number) => (s >= 85 ? 'acq-pill-green' : s >= 70 ? 'acq-pill-blue' : 'acq-pill-gray');
const ago = (d: string) => { const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000); return days < 1 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`; };
const isNew = (d: string) => Date.now() - new Date(d).getTime() < 36 * 3_600_000;
const PAGE = 30;
const activeStyle = { background: '#f3e8ff', borderColor: '#7e22ce', color: '#6b21a8' } as const;

/** Search now, and what the last search did. The jobs it found are listed below this, in "Jobs found". */
export function DiscoveryPanel({ state, onChanged }: { state: CareerState; onChanged: () => void }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [res, setRes] = useState<DiscoveryResult | null>(null);
  const last = state.events.find((e) => e.agent === 'job_discovery' && e.action === 'discovery_run');
  const run = async () => { setBusy(true); setErr(''); const r = await api<{ result: DiscoveryResult }>('/api/career/discover', json('POST', {})); setBusy(false); if (r.error) setErr(r.error); else { setRes(r.result); onChanged(); } };
  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="acq-btn acq-btn-primary" disabled={busy || state.status !== 'active'} onClick={run}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />} Search for jobs now</button>
        <span style={hint}>{state.status !== 'active' ? 'Resume the agent to search.' : `It also searches ${state.discovery.frequency === 'daily' ? 'every day' : 'every week'} on its own.`}</span>
      </div>
      {last && !res && <span style={hint}>Last search {new Date(last.createdAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}: {last.detail}</span>}
      {err && <div role="alert" style={{ color: '#b91c1c', fontSize: 13.5 }}>{err}</div>}
      {res && (
        <div style={{ ...box, display: 'grid', gap: 6, fontSize: 13.5 }} aria-label="Search result">
          <b>{res.fetched} jobs read · {res.added} new saved · {res.relevant} relevant · {res.matched} at or above {state.discovery.minScore}%</b>
          {res.sources.map((s) => <div key={s.name} style={{ color: s.ok ? '#475569' : '#b91c1c' }}>{s.ok ? '✓' : '✕'} {s.name}: {s.ok ? `${s.count} found` : `could not be read (${s.error})`}</div>)}
          {res.noBoard.length > 0 && <div style={hint}>No public job board (Greenhouse or Lever) was found for: {res.noBoard.join(', ')}. Check the employer name.</div>}
          {(res.notes ?? []).map((n) => <div key={n} style={hint}>{n}</div>)}
          {res.sources.length === 0 && res.noBoard.length === 0 && (res.notes ?? []).length === 0 && <div style={hint}>No places to look are selected. Edit your setup and choose at least one.</div>}
        </div>
      )}
    </>
  );
}

/** Jobs found: EVERYTHING a search found is saved, so this is the full list. Best matches first by default; search, filter and page through it. */
export function MatchesPanel({ onChanged, refreshKey, onOpenApplications, canPrepare }: { onChanged: () => void; refreshKey: number; onOpenApplications: () => void; canPrepare: boolean }) {
  const [prep, setPrep] = useState<string[]>([]); const [perr, setPerr] = useState('');
  const [layout, setLayout] = useState<'swipe' | 'list'>(() => (typeof window !== 'undefined' && window.innerWidth < 760 ? 'swipe' : 'list'));   // phones start on the swipe cards
  const [view, setView] = useState<'matches' | 'all' | 'saved' | 'dismissed'>('matches');
  const [qInput, setQInput] = useState(''); const [q, setQ] = useState(''); const [source, setSource] = useState(''); const [sort, setSort] = useState<'score' | 'new'>('score');
  const [data, setData] = useState<JobsData | null>(null); const [jobs, setJobs] = useState<JobRow[]>([]); const [err, setErr] = useState(''); const [more, setMore] = useState(false);
  const seq = useRef(0);

  useEffect(() => { const t = setTimeout(() => setQ(qInput.trim()), 350); return () => clearTimeout(t); }, [qInput]);   // search as you type, without a request per key

  const url = useCallback((offset: number) => `/api/career/jobs?view=${view}&sort=${sort}&offset=${offset}&limit=${PAGE}${q ? `&q=${encodeURIComponent(q)}` : ''}${source ? `&source=${encodeURIComponent(source)}` : ''}`, [view, sort, q, source]);
  const load = useCallback(async () => {
    const my = ++seq.current; const r = await api<JobsData>(url(0)); if (my !== seq.current) return;      // an older answer must not overwrite a newer one
    if (r.error) setErr(r.error); else { setErr(''); setData(r); setJobs(r.jobs); }
  }, [url]);
  useEffect(() => { void load(); }, [load, refreshKey]);
  const loadMore = async () => { setMore(true); const r = await api<JobsData>(url(jobs.length)); setMore(false); if (!r.error) { setJobs((j) => [...j, ...r.jobs.filter((x) => !j.some((y) => y.id === x.id))]); setData(r); } };

  const prepare = async (ids: string[]) => {
    setPerr(''); setPrep((p) => [...p, ...ids]);
    const r = await api<{ results: Array<{ ok: boolean; error?: string }> }>('/api/career/applications', json('POST', { matchIds: ids }));
    setPrep((p) => p.filter((x) => !ids.includes(x)));
    if (r.error) setPerr(r.error); else { const bad = r.results.find((x) => !x.ok); if (bad) setPerr(bad.error ?? ''); await load(); onChanged(); }
  };
  const mark = async (id: string, status: string) => { await api(`/api/career/jobs/${id}`, json('PATCH', { status })); await load(); onChanged(); };
  /** Swipe right = prepare an application (a draft; nothing is sent). Swipe left = not interested. */
  const swipePrepare = async (id: string) => {
    const r = await api<{ results: Array<{ ok: boolean; error?: string }> }>('/api/career/applications', json('POST', { matchIds: [id] }));
    if (r.error) return { ok: false, error: r.error }; const bad = r.results.find((x) => !x.ok); if (bad) return { ok: false, error: bad.error };
    void load(); onChanged(); return { ok: true };
  };
  const swipeMark = async (id: string, status: string) => { const r = await api(`/api/career/jobs/${id}`, json('PATCH', { status })); if (r.error) return { ok: false, error: r.error }; void load(); onChanged(); return { ok: true }; };

  if (err && !data) return <div role="alert" style={{ display: 'grid', gap: 8, color: '#b91c1c' }}>{err}<div><button className="acq-btn acq-btn-sm" onClick={() => { setErr(''); void load(); }}>Try again</button></div></div>;
  if (!data) return <div style={{ display: 'flex', gap: 8 }}><Loader2 size={16} className="animate-spin" /> Loading…</div>;
  const total = data.total ?? data.jobs.length; const sources = data.sources ?? [];
  const filtered = !!q || !!source;
  const VIEWS: Array<['matches' | 'all' | 'saved' | 'dismissed', string]> = [['matches', `Best matches (${data.matched})`], ['all', `All found (${data.discovered})`], ['saved', 'Saved'], ['dismissed', 'Not interested']];
  const label = (j: JobRow) => (j.sourceId === 'places' ? 'Prepare open application' : 'Prepare application');

  return (
    <>
      {err && <StaleNotice onRetry={() => { setErr(''); void load(); }} />}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {VIEWS.map(([v, l]) => <button key={v} className="acq-btn acq-btn-sm" aria-pressed={view === v} onClick={() => setView(v)} style={view === v ? activeStyle : undefined}>{l}</button>)}
        <span role="group" aria-label="Layout" style={{ display: 'inline-flex', gap: 4, marginLeft: 'auto' }}>
          <button className="acq-btn acq-btn-sm" aria-pressed={layout === 'swipe'} onClick={() => setLayout('swipe')} style={layout === 'swipe' ? activeStyle : undefined}><Layers size={13} /> Swipe</button>
          <button className="acq-btn acq-btn-sm" aria-pressed={layout === 'list'} onClick={() => setLayout('list')} style={layout === 'list' ? activeStyle : undefined}><LayoutList size={13} /> List</button>
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="acq-input" aria-label="Search the jobs found" placeholder="Search title or company" value={qInput} onChange={(e) => setQInput(e.target.value)} style={{ maxWidth: 260 }} />
        <select className="acq-input" aria-label="Source" value={source} onChange={(e) => setSource(e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">All sources</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.label} ({s.count})</option>)}
        </select>
        <select className="acq-input" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as 'score' | 'new')} style={{ maxWidth: 170 }}>
          <option value="score">Best match first</option><option value="new">Newest first</option>
        </select>
        <span style={hint}>{filtered ? `${total} match your search` : `${total} shown`} · {data.discovered} found in all</span>
        {canPrepare && layout === 'list' && jobs.some((j) => !j.applicationStatus) && <button className="acq-btn acq-btn-sm" disabled={prep.length > 0} onClick={() => prepare(jobs.filter((j) => !j.applicationStatus).slice(0, 5).map((j) => j.id))}><FilePen size={13} /> Prepare the top {Math.min(5, jobs.filter((j) => !j.applicationStatus).length)}</button>}
      </div>
      {perr && <div role="alert" style={{ color: '#b91c1c', fontSize: 13.5 }}>{perr}</div>}

      {layout === 'swipe' && view === 'matches' && jobs.length > 0 && (
        <SwipeDeck items={jobs.filter((j) => !j.applicationStatus || j.applicationStatus === 'rejected')} keyOf={(j) => j.id}
          labels={{ right: 'Prepare application', left: 'Not interested' }} rightBlocked={canPrepare ? undefined : 'Deploy your agent and confirm your profile to prepare applications.'}
          onDecide={(j, dir) => (dir === 'right' ? swipePrepare(j.id) : swipeMark(j.id, 'dismissed'))}
          onUndo={(j) => swipeMark(j.id, 'new')} undoable={(dir) => dir === 'left'}
          empty={<div style={{ ...box, background: '#f8fafc' }}><b>All caught up.</b><p style={{ ...hint, marginTop: 4 }}>You have gone through every match. Open Applications to review what was prepared.</p></div>}
          render={(j) => (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}><div><b style={{ fontSize: 17 }}>{j.title}</b><div style={hint}>{j.company}</div></div><span className={`acq-pill ${tone(j.score)}`}>{j.score}% match</span></div>
              <div style={hint}>{j.remote ? 'Remote' : ''}{j.remote && j.location ? ' · ' : ''}{j.location} · via {j.source}{j.postedAt ? ` · posted ${ago(j.postedAt)}` : ''}</div>
              {j.reasons.length > 0 && <ul style={{ margin: '0 0 0 18px', fontSize: 14 }}>{j.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
              <a className="acq-btn acq-btn-sm" style={{ justifySelf: 'start' }} href={j.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> View posting</a>
            </div>)} />
      )}
      {layout === 'swipe' && view === 'matches' && jobs.length > 0 && <p style={{ ...hint, maxWidth: 440 }}>Applications you prepare wait in the Applications tab. Nothing is sent until you approve.</p>}

      {jobs.length === 0 && (
        <div style={{ ...box, background: '#f8fafc' }}>
          {data.discovered === 0 ? <p style={{ margin: 0 }}>Nothing found yet. Press <b>Search for jobs now</b>.</p>
            : view === 'matches' && !filtered ? <><p style={{ margin: 0 }}>No jobs are at {data.minScore}% or above yet, but <b>{data.discovered} were found</b>.</p><button className="acq-btn acq-btn-sm" style={{ marginTop: 8 }} onClick={() => setView('all')}>Show everything found</button></>
              : <p style={{ margin: 0 }}>{filtered ? 'Nothing matches that search.' : 'Nothing here.'}</p>}
        </div>
      )}

      {(layout === 'list' || view !== 'matches') && jobs.map((j) => (
        <div key={j.id} style={{ ...box, display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div><b style={{ fontSize: 14.5 }}>{j.title}</b>{isNew(j.foundAt) && <span className="acq-pill acq-pill-green" style={{ marginLeft: 8 }}>New</span>}
              <div style={hint}>{j.company} · {j.remote ? 'Remote' : ''}{j.remote && j.location ? ' · ' : ''}{j.location} · via {j.source}{j.postedAt ? ` · posted ${ago(j.postedAt)}` : ''}</div></div>
            <span className={`acq-pill ${tone(j.score)}`} style={{ alignSelf: 'start' }}>{j.score}% match</span>
          </div>
          {j.reasons.length > 0 && <ul style={{ margin: '0 0 0 18px', fontSize: 13 }}>{j.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <a className="acq-btn acq-btn-sm" href={j.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> {j.sourceId === 'places' ? 'Visit employer' : 'View posting'}</a>
            {j.status === 'dismissed' ? <button className="acq-btn acq-btn-sm" onClick={() => mark(j.id, 'new')}>Put back</button> : <>
              {j.applicationStatus && j.applicationStatus !== 'rejected'
                ? <button className="acq-btn acq-btn-sm" onClick={onOpenApplications}><FilePen size={13} /> Application: {j.applicationStatus}</button>
                : <button className="acq-btn acq-btn-primary acq-btn-sm" disabled={!canPrepare || prep.includes(j.id)} onClick={() => prepare([j.id])}>{prep.includes(j.id) ? <Loader2 size={13} className="animate-spin" /> : <FilePen size={13} />} {label(j)}</button>}
              <button className="acq-btn acq-btn-sm" onClick={() => mark(j.id, j.status === 'saved' ? 'new' : 'saved')}><Star size={13} /> {j.status === 'saved' ? 'Unsave' : 'Save'}</button>
              <button className="acq-btn acq-btn-sm" onClick={() => mark(j.id, 'dismissed')}><X size={13} /> Not interested</button></>}
          </div>
        </div>
      ))}
      {(layout === 'list' || view !== 'matches') && jobs.length > 0 && jobs.length < total && <div><button className="acq-btn" disabled={more} onClick={loadMore}>{more ? <Loader2 size={15} className="animate-spin" /> : null} Load more ({total - jobs.length} left)</button></div>}
    </>
  );
}
