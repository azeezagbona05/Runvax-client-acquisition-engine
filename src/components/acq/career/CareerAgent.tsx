'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Loader2, Pause, Play, Settings2, Trash2 } from 'lucide-react';
import { downloadCvPdf } from './cvPdf';
import Wizard from './Wizard';
import { DiscoveryPanel, MatchesPanel, type JobsData } from './Jobs';
import { AnalyticsPanel, InterviewsPanel, ResponsesPanel, TodayCard } from './Manage';
import ApplicationsPanel, { STATUS, statusOf, type AppRow } from './Applications';
import { AGENT_NAMES, api, box, hint, json, type CareerState } from './shared';
import { PERMISSION_MODES } from '@/lib/career/types';

const TABS = ['Career profile', 'My CVs', 'Job discovery', 'Matched opportunities', 'Applications', 'Approvals', 'Responses', 'Interviews', 'Analytics', 'AI activity log', 'Agent settings'] as const;
type Tab = typeof TABS[number];
const NEXT: Partial<Record<Tab, string>> = {
};
const when = (d: string) => new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function CareerAgent() {
  const [state, setState] = useState<CareerState | null>(null); const [err, setErr] = useState('');
  const [jobs, setJobs] = useState<Pick<JobsData, 'discovered' | 'matched'> | null>(null); const [rk, setRk] = useState(0); const [apps, setApps] = useState<AppRow[]>([]);
  const [editing, setEditing] = useState(false); const [tab, setTab] = useState<Tab>('Career profile'); const [busy, setBusy] = useState(false);

  const load = useCallback(async () => { const r = await api('/api/career'); if (r.error) setErr(r.error); else setState(r); }, []);
  const loadJobs = useCallback(async () => { const r = await api<JobsData>('/api/career/jobs?view=saved'); if (!r.error) setJobs({ discovered: r.discovered, matched: r.matched }); }, []);
  const loadApps = useCallback(async () => { const r = await api<{ applications: AppRow[] }>('/api/career/applications'); if (!r.error) setApps(r.applications); }, []);
  useEffect(() => { void load(); void loadJobs(); void loadApps(); }, [load, loadJobs, loadApps]);
  const changed = () => { void load(); void loadJobs(); void loadApps(); setRk((k) => k + 1); };

  if (err) return <div role="alert" className="acq-card acq-card-pad" style={{ color: '#b91c1c' }}>{err}</div>;
  if (!state) return <div className="acq-card acq-card-pad" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Loader2 size={16} className="animate-spin" /> Loading…</div>;
  if (state.status === 'draft' || editing) return <Wizard state={state} onState={setState} onDone={() => { setEditing(false); setTab('Career profile'); }} />;

  const p = state.profile; const active = state.status === 'active';
  const act = async (action: 'pause' | 'resume') => { setBusy(true); const r = await api('/api/career/deploy', json('POST', { action })); setBusy(false); if (r.error) setErr(r.error); else setState(r); };
  const wipe = async () => { if (!window.confirm('Delete your CVs, profile, settings and activity log? This cannot be undone.')) return; setBusy(true); await api('/api/career', { method: 'DELETE' }); setBusy(false); setEditing(false); await load(); };

  return (
    <div className="acq-stack">
      <section className="acq-card acq-card-pad" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><h2 className="acq-title">My Career Agent</h2><span className={`acq-pill ${active ? 'acq-pill-green' : 'acq-pill-amber'}`}>{active ? 'Deployed' : 'Paused'}</span></div>
            <p className="acq-faint" style={{ fontSize: 13, marginTop: 2 }}>Profile {state.profileConfirmed ? 'confirmed' : 'not confirmed'} · permission: {PERMISSION_MODES.find((m) => m.id === state.permissions.mode)?.label.toLowerCase()}</p></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="acq-btn acq-btn-sm" onClick={() => setEditing(true)}><Settings2 size={14} /> Edit setup</button>
            <button className="acq-btn acq-btn-sm" disabled={busy} onClick={() => act(active ? 'pause' : 'resume')}>{active ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Resume</>}</button>
          </div>
        </div>
        <div className="acq-notice" style={{ fontSize: 13 }}><b>Phases 1 to 5.</b> Profile, job discovery, matching, tailored applications, the approval queue, reply tracking, interviews, reminders and analytics are live. It submits only what you approved (or what your automatic rules allow), only on Greenhouse and Lever forms, and only if every required question can be answered from your confirmed profile; otherwise it hands the application back to you. It does not read your inbox; you paste employer replies. All counts are real.</div>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
          {([['CVs uploaded', state.documents.length], ['Jobs discovered', jobs?.discovered ?? 0], ['Matched jobs', jobs?.matched ?? 0], ['Waiting for approval', apps.filter((a) => a.status === 'prepared').length], ['Applied by you', apps.filter((a) => a.status === 'applied' && a.appliedBy !== 'agent').length], ['Submitted by agent', apps.filter((a) => a.status === 'applied' && a.appliedBy === 'agent').length]] as const).map(([l, v]) => <div key={l} style={box}><div style={{ fontSize: 24, fontWeight: 700 }}>{v}</div><div style={hint}>{l}</div></div>)}
        </div>
      </section>

      <TodayCard refreshKey={rk} goto={setTab} />

      <div role="tablist" aria-label="Career Agent sections" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className="acq-btn acq-btn-sm" style={tab === t ? { background: '#f3e8ff', borderColor: '#7e22ce', color: '#6b21a8' } : undefined}>{t}</button>)}
      </div>

      <section className="acq-card acq-card-pad" role="tabpanel" aria-label={tab} style={{ display: 'grid', gap: 12 }}>
        {tab === 'Career profile' && (p ? (
          <>
            <div><b style={{ fontSize: 17 }}>{p.name || 'Your profile'}</b><div style={hint}>{[p.headline, p.location, p.email].filter(Boolean).join(' · ')}</div></div>
            {p.summary && <p style={{ fontSize: 13.5 }}>{p.summary}</p>}
            {p.experience.map((r, i) => <div key={i} style={box}><b style={{ fontSize: 13.5 }}>{[r.title, r.company].filter(Boolean).join(' at ')}</b><div style={hint}>{[r.start, r.end].filter(Boolean).join(' – ')}</div>{r.bullets.length > 0 && <ul style={{ margin: '6px 0 0 18px', fontSize: 13 }}>{r.bullets.map((b) => <li key={b}>{b}</li>)}</ul>}</div>)}
            {p.education.length > 0 && <div><b style={{ fontSize: 13.5 }}>Education</b>{p.education.map((e, i) => <div key={i} style={{ fontSize: 13.5 }}>{[e.qualification, e.institution, e.end].filter(Boolean).join(' · ')}</div>)}</div>}
            {p.skills.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{p.skills.map((s) => <span key={s} className="acq-pill acq-pill-gray">{s}</span>)}</div>}
            <div><button className="acq-btn acq-btn-sm" onClick={() => setEditing(true)}>Review or edit profile</button></div>
          </>
        ) : <p>No profile yet.</p>)}

        {tab === 'My CVs' && (
          <>
            <p style={{ fontSize: 13.5, color: '#475569' }}>The clean CV below is built only from your confirmed profile, so it contains nothing you did not state.</p>
            <div><button className="acq-btn acq-btn-primary acq-btn-sm" disabled={!p || !state.profileConfirmed} onClick={() => p && downloadCvPdf(p)}><Download size={14} /> Download CV (PDF)</button>{!state.profileConfirmed && <span style={{ ...hint, marginLeft: 8 }}>Confirm your profile first.</span>}</div>
            <div style={{ ...box, background: '#f8fafc', fontSize: 12.5 }}>Word (.docx) export is not available yet. Tailored CVs are made per job when you prepare an application.</div>
            <b style={{ fontSize: 13.5 }}>Tailored CVs</b>
            {apps.length === 0 && <p style={hint}>None yet. Prepare an application from Matched opportunities.</p>}
            {apps.map((a) => <div key={a.id} style={{ ...box, display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center', fontSize: 13.5 }}><span><b>{a.job.title}</b> · {a.job.company}<span style={{ display: 'block', ...hint }}>{statusOf(a)[0]}</span></span><button className="acq-btn acq-btn-sm" onClick={() => downloadCvPdf(a.cv, a.job.company)}><Download size={13} /> PDF</button></div>)}
            <b style={{ fontSize: 13.5 }}>Uploaded CVs</b>
            {state.documents.map((d) => <div key={d.id} style={{ ...box, display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}><span>{d.name}</span><span style={hint}>{when(d.createdAt)}</span></div>)}
          </>
        )}

        {tab === 'Job discovery' && <DiscoveryPanel state={state} onChanged={changed} />}
        {tab === 'Matched opportunities' && <MatchesPanel onChanged={changed} refreshKey={rk} onOpenApplications={() => setTab('Applications')} canPrepare={active && state.profileConfirmed} />}

        {tab === 'Applications' && <ApplicationsPanel mode="all" onChanged={changed} refreshKey={rk} permMode={state.permissions.mode} />}
        {tab === 'Approvals' && <ApplicationsPanel mode="queue" onChanged={changed} refreshKey={rk} permMode={state.permissions.mode} />}

        {tab === 'Responses' && <ResponsesPanel onChanged={changed} refreshKey={rk} />}
        {tab === 'Interviews' && <InterviewsPanel onChanged={changed} refreshKey={rk} />}
        {tab === 'Analytics' && <AnalyticsPanel refreshKey={rk} />}

        {NEXT[tab] && <div style={{ ...box, background: '#f8fafc' }}><b style={{ fontSize: 14 }}>Not available yet</b><p style={{ fontSize: 13.5, color: '#475569', marginTop: 4 }}>{NEXT[tab]}</p>
        </div>}

        {tab === 'AI activity log' && (state.events.length ? state.events.map((e) => <div key={e.id} style={{ ...box, display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', borderColor: e.ok ? '#e2e8f0' : '#fecaca' }}><span style={{ fontSize: 13.5 }}><b>{AGENT_NAMES[e.agent] ?? e.agent}</b> · {e.action.replace(/_/g, ' ')}{e.detail && <span style={{ display: 'block', ...hint, marginTop: 0 }}>{e.detail}</span>}</span><span style={hint}>{when(e.createdAt)}</span></div>) : <p style={hint}>Nothing yet.</p>)}

        {tab === 'Agent settings' && (
          <>
            <div style={{ ...box, fontSize: 13.5, display: 'grid', gap: 4 }}>
              <div><b>Titles:</b> {state.preferences.titles.join(', ') || '—'}</div>
              <div><b>Work style:</b> {state.preferences.workModes.join(', ') || '—'} · <b>Level:</b> {state.preferences.level}</div>
              <div><b>Where:</b> {[state.preferences.country, ...state.preferences.locations].filter(Boolean).join(', ') || '—'}</div>
              <div><b>Sources:</b> {state.discovery.sources.length} · <b>Frequency:</b> {state.discovery.frequency} · <b>Minimum match:</b> {state.discovery.minScore}%</div>
              <div><b>Permission:</b> {PERMISSION_MODES.find((m) => m.id === state.permissions.mode)?.label}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="acq-btn acq-btn-sm" onClick={() => setEditing(true)}><Settings2 size={14} /> Edit setup</button>
              <button className="acq-btn acq-btn-sm acq-btn-danger" disabled={busy} onClick={wipe}><Trash2 size={14} /> Delete all my career data</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
