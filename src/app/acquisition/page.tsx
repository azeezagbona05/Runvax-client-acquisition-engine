'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Play, ShieldCheck, AlertCircle } from 'lucide-react';
import DiscoveryPanel from './_components/DiscoveryPanel';
import ImportPanel from './_components/ImportPanel';
import AgentCentre from './_components/AgentCentre';
import ActivityPanel from './_components/ActivityPanel';
import { api, BAND_STYLE, scoreText, pct, dateTime } from './_components/format';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Status {
  industries: Array<{
    id: string; version: number; displayName: string; city: string; liveSendingEnabled: boolean;
    offers: Array<{ id: string; name: string; status: string }>;
    categories: Array<{ id: string; label: string; weight: number; provisional: boolean }>;
  }>;
  tasks: Record<string, number>;
  overview: {
    results: { prospects: number; byState: Record<string, number>; contactPoints: Record<string, number>; crmConflicts: number; deadTasks: number; importBatches: number };
    estimates: { scoredProspectsByBand: Record<string, number> };
    budgets: Array<{ provider: string; used: number; cap: number; pausedUntil: string | null }>;
    activation: { switches: Record<string, boolean>; crawler: string; places: string[]; sending: string };
  };
}

const TABS = ['Overview', 'Prospects', 'Discovery', 'Import', 'Activity'] as const;
type Tab = (typeof TABS)[number];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border border-white/8 bg-white/[0.02] rounded-2xl p-5 space-y-3"><h2 className="text-sm font-bold text-white">{title}</h2>{children}</section>;
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-xl bg-white/5 px-3 py-2"><div className="text-lg font-black text-white">{value}</div><div className="text-[11px] text-gray-500">{label}</div></div>;
}

const rateText = (r: number | null) => (r == null ? '—' : `${Math.round(r * 1000) / 10}%`);
const money = (m: Record<string, number>) => Object.entries(m).map(([c, v]) => `${c} ${v.toLocaleString('en-GB')}`).join(' · ') || '—';

// Recorded sales outcomes only (manual entries) — never estimates.
function Funnel() {
  const [m, setM] = useState<any>(null);
  useEffect(() => { api<any>('/api/acquisition/metrics').then(setM).catch(() => setM(null)); }, []);
  if (!m) return null;
  return (
    <Card title="Sales funnel (recorded outcomes)">
      {m.drafts.awaitingApproval > 0 && (
        <p role="status" className="text-xs text-gray-200">
          <b>{m.drafts.awaitingApproval}</b> pitch{m.drafts.awaitingApproval === 1 ? '' : 'es'} awaiting your approval. <Link href="/acquisition/drafts" className="underline text-purple-300">Open the review queue</Link>
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Pitches generated" value={m.drafts.generated} />
        <Stat label="Approved" value={m.drafts.approved} />
        <Stat label="Marked ready" value={m.drafts.markedReady} />
        <Stat label="Recorded as sent" value={m.sent} />
        <Stat label="Replied" value={`${m.replied} (${rateText(m.rates.reply)})`} />
        <Stat label="Positive replies" value={`${m.repliesBySentiment.positive} (${rateText(m.rates.positiveReply)})`} />
        <Stat label="Opt-outs / objections" value={`${m.optOuts} / ${m.objections}`} />
        <Stat label="Meetings" value={`${m.meetingsBooked} (${rateText(m.rates.meetingPerSent)})`} />
        <Stat label="Proposals" value={m.proposalsSent} />
        <Stat label="Proposal value" value={money(m.proposalValue)} />
        <Stat label="Won / lost" value={`${m.won} / ${m.lost}`} />
        <Stat label="Won value" value={money(m.wonValue)} />
      </div>
      <p className="text-[11px] text-gray-500">{m.note} <Link href="/acquisition/drafts" className="underline text-purple-300">Open review queue</Link></p>
    </Card>
  );
}

function Overview({ status, reload }: { status: Status; reload: () => void }) {
  const [draining, setDraining] = useState(false);
  const [lastRun, setLastRun] = useState('');
  const [tick, setTick] = useState(0); // remounts the agent cards so they re-read the saved records after a run
  const o = status.overview;
  const drain = async () => {
    setDraining(true);
    try {
      const j = await api<any>('/api/acquisition/tasks', { method: 'POST', body: '{}' });
      setLastRun(`Claimed ${j.claimed} · completed ${j.completed} · skipped ${j.skipped} · deferred ${j.deferred} · retried ${j.retried} · dead ${j.dead}${j.dailyCapReached ? ' · daily task cap reached' : ''}`);
      reload(); setTick((n) => n + 1);
    } catch (e) { setLastRun(e instanceof Error ? e.message : 'Failed'); } finally { setDraining(false); }
  };
  return (
    <div className="space-y-5">
      <Card title="Results (actual counts)">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Prospects" value={o.results.prospects} />
          <Stat label="Strategized" value={o.results.byState.strategized ?? 0} />
          <Stat label="Needs review" value={o.results.byState.needs_review ?? 0} />
          <Stat label="CRM conflicts" value={o.results.crmConflicts} />
          <Stat label="Role inboxes" value={o.results.contactPoints.role_inbox ?? 0} />
          <Stat label="Business phones" value={o.results.contactPoints.business_phone ?? 0} />
          <Stat label="Named (manual)" value={o.results.contactPoints.manual_named ?? 0} />
          <Stat label="Dead tasks" value={o.results.deadTasks} />
        </div>
      </Card>
      <Funnel />
      <Card title="Estimates (rule-based fit bands — not results)">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(BAND_STYLE).map(([k, v]) => <Stat key={k} label={v.label} value={o.estimates.scoredProspectsByBand[k] ?? 0} />)}
        </div>
      </Card>
      <Card title="Agent queue">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-gray-400">Nothing runs on its own: there is no scheduler. Pressing the button processes queued tasks one at a time, up to the per-run limit, and stops early at the daily cap. Failed tasks are saved with their error and retried on a later run.</p>
          <button onClick={drain} disabled={draining} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 disabled:opacity-40">
            {draining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} Run queue now
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">{Object.entries(status.tasks).map(([k, v]) => <Stat key={k} label={k} value={v} />)}</div>
        {lastRun && <p className="text-xs text-gray-400">{lastRun}</p>}
      </Card>
      <AgentCentre key={tick} />
      <Card title="Daily budgets (Africa/Lagos day)">
        <ul className="text-xs text-gray-300 space-y-0.5">
          {o.budgets.map((b) => <li key={b.provider}>{b.provider}: {b.used} / {b.cap}{b.pausedUntil ? ` · paused until ${dateTime(b.pausedUntil)}` : ''}</li>)}
        </ul>
      </Card>
      <Card title="Live access (all off)">
        <ul className="text-xs text-gray-300 space-y-0.5">
          {Object.entries(o.activation.switches).map(([k, v]) => <li key={k}><ShieldCheck className="w-3 h-3 inline mr-1" />{k}: {v ? 'ON' : 'off'}</li>)}
          <li>Website crawler: {o.activation.crawler}</li>
          <li>Google Places: disabled — {o.activation.places.join('; ')}</li>
          <li>Sending: {o.activation.sending}</li>
        </ul>
      </Card>
      {status.industries.map((ind) => (
        <Card key={ind.id} title={`${ind.displayName} · ${ind.city} · config v${ind.version}`}>
          <div className="grid sm:grid-cols-2 gap-2">
            {ind.offers.map((of) => (
              <div key={of.id} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                <span className="text-sm text-gray-200">{of.name}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${of.status === 'approved' ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'}`}>{of.status === 'approved' ? 'Approved' : 'Unconfigured — not sellable'}</span>
              </div>
            ))}
          </div>
          <ul className="space-y-1">
            {ind.categories.map((c) => <li key={c.id} className="flex justify-between text-sm text-gray-300"><span>{c.label}</span><span className="text-xs text-gray-500">{Math.round(c.weight * 100)}%{c.provisional ? ' · provisional' : ''}</span></li>)}
          </ul>
        </Card>
      ))}
    </div>
  );
}

function Prospects() {
  const [data, setData] = useState<{ total: number; items: any[] } | null>(null);
  const [state, setState] = useState('');
  const [band, setBand] = useState('');
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const p = new URLSearchParams();
    if (state) p.set('state', state);
    if (band) p.set('band', band);
    if (q) p.set('q', q);
    try { setData(await api(`/api/acquisition/prospects?${p}`)); } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
  }, [state, band, q]);
  useEffect(() => { load(); }, [load]);
  return (
    <Card title={`Prospects${data ? ` (${data.total})` : ''}`}>
      <div className="flex flex-wrap gap-2 text-xs">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or domain" className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-gray-200" />
        <select value={state} onChange={(e) => setState(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-gray-200">
          <option value="">Any state</option>
          {['discovered', 'contacts_researched', 'audited', 'strategized', 'needs_review', 'disqualified', 'suppressed'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={band} onChange={(e) => setBand(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-gray-200">
          <option value="">Any band</option>
          {Object.entries(BAND_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-left text-gray-500"><th className="py-1 pr-3">Clinic</th><th className="pr-3">State</th><th className="pr-3">Score</th><th className="pr-3">Band</th><th className="pr-3">Coverage</th><th className="pr-3">Contactability</th><th>Flags</th></tr></thead>
          <tbody>
            {data?.items.map((p) => (
              <tr key={p.id} className="border-t border-white/5">
                <td className="py-1 pr-3"><Link href={`/acquisition/prospects/${p.id}`} className="text-purple-300 hover:underline">{p.name}</Link><div className="text-gray-600">{p.domain ?? 'no website'}{p.area ? ` · ${p.area}` : ''}</div></td>
                <td className="pr-3 text-gray-300">{p.state}</td>
                <td className="pr-3 text-gray-300">{scoreText(p.score?.total)}</td>
                <td className="pr-3">{p.score ? <span className={`px-2 py-0.5 rounded ${BAND_STYLE[p.score.band]?.cls ?? ''}`}>{BAND_STYLE[p.score.band]?.label ?? p.score.band}</span> : '—'}</td>
                <td className="pr-3 text-gray-300">{pct(p.score?.coverage)}</td>
                <td className="pr-3 text-gray-300">{p.score?.contactability ?? '—'}</td>
                <td className="text-amber-300">{p.crmConflict ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ManualAdd({ industryKey }: { industryKey: string }) {
  const [row, setRow] = useState<Record<string, string>>({ business_name: '', source: '', website: '', phone: '', email: '', area: '' });
  const [attest, setAttest] = useState(false);
  const [msg, setMsg] = useState('');
  const submit = async () => {
    setMsg('');
    try {
      const r = await api<any>('/api/acquisition/prospects', { method: 'POST', body: JSON.stringify({ industryKey, row: Object.fromEntries(Object.entries(row).filter(([, v]) => v.trim())), attest: true }) });
      const res = r.preview.results[0];
      setMsg(r.committed ? 'Added. Research is queued.' : `Not added: ${res.outcome} — ${[...res.reasons, ...res.flags].join('; ')}`);
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed'); }
  };
  return (
    <Card title="Add one clinic manually">
      <div className="grid sm:grid-cols-3 gap-2">
        {Object.keys(row).map((k) => (
          <input key={k} aria-label={k} placeholder={k + (k === 'business_name' || k === 'source' ? ' (required)' : '')} value={row[k]} onChange={(e) => setRow({ ...row, [k]: e.target.value })}
            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-gray-200" />
        ))}
      </div>
      <label className="flex items-start gap-2 text-xs text-gray-300"><input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} className="mt-0.5" />I confirm this was obtained lawfully from the stated source and not copied from Google Maps.</label>
      <button onClick={submit} disabled={!attest || !row.business_name || !row.source} className="text-xs font-bold px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40">Add clinic</button>
      {msg && <p className="text-xs text-gray-400">{msg}</p>}
    </Card>
  );
}

// Internal research and human pitch review. Nothing is delivered from these screens.
export default function AcquisitionPage() {
  const [tab, setTab] = useState<Tab>('Overview');
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setStatus(await api<Status>('/api/acquisition/status')); } catch (e) { setError(e instanceof Error ? e.message : 'Could not load'); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const industryKey = status?.industries[0]?.id ?? 'dental';

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Industry Acquisition</h1>
        <p className="text-sm text-gray-400 mt-1">Admin-only research workspace. Evidence-backed prospect records, internal recommendations and pitches for human review — nothing is sent or contacted from here.</p>
      </div>
      <nav className="flex gap-1 border-b border-white/8 overflow-x-auto" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`text-xs font-bold px-3 py-2 -mb-px border-b-2 whitespace-nowrap ${tab === t ? 'border-purple-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>{t}</button>
        ))}
        <Link href="/acquisition/drafts" className="text-xs font-bold px-3 py-2 -mb-px border-b-2 border-transparent text-gray-400 hover:text-gray-200 whitespace-nowrap">Review queue</Link>
      </nav>
      {error && <div className="flex items-center gap-2 text-sm text-red-300"><AlertCircle className="w-4 h-4" /> {error}</div>}
      {!status && !error && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
      {status && tab === 'Overview' && <Overview status={status} reload={load} />}
      {tab === 'Prospects' && <Prospects />}
      {tab === 'Discovery' && <DiscoveryPanel industryKey={industryKey} onChanged={load} />}
      {tab === 'Import' && <div className="space-y-5"><ImportPanel industryKey={industryKey} onCommitted={load} /><ManualAdd industryKey={industryKey} /></div>}
      {tab === 'Activity' && <ActivityPanel />}
    </div>
  );
}
