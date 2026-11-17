'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Card, EmptyState } from '@/components/acq/ui';
import type { AppointmentRow } from '@/lib/appointments';

type Counts = { needsUpdate: number; missed: number; upcoming: number; followUps: number; overdue: number };
type Tab = 'needs_update' | 'missed' | 'follow_ups' | 'upcoming' | 'all';

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'No time set');
const local = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const STATE: Record<string, [string, string]> = { upcoming: ['Upcoming', 'acq-pill-blue'], needs_update: ['Needs update', 'acq-pill-amber'], missed: ['Missed', 'acq-pill-red'], held: ['Held', 'acq-pill-green'], rescheduled: ['Rebooked', 'acq-pill-green'], unscheduled: ['No time set', 'acq-pill-amber'] };

async function call(url: string, init: RequestInit) {
  try { const r = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json' } }); const j = await r.json().catch(() => ({})) as { error?: string }; return r.ok ? { ok: true as const, j } : { ok: false as const, error: j.error ?? 'That did not work.' }; }
  catch { return { ok: false as const, error: 'Could not reach the server.' }; }
}

function Row({ r, onChanged, picked, onPick }: { r: AppointmentRow; onChanged: () => Promise<void>; picked?: boolean; onPick?: () => void }) {
  const [next, setNext] = useState(r.nextAction ?? ''); const [due, setDue] = useState(r.nextActionDue ? r.nextActionDue.slice(0, 10) : ''); const [at, setAt] = useState(local(r.demoAt));
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const patch = async (body: object) => { setBusy(true); setErr(''); const x = await call(`/api/client-acquisition/appointments/${r.leadId}`, { method: 'PATCH', body: JSON.stringify(body) }); setBusy(false); if (!x.ok) setErr(x.error); else await onChanged(); };
  const [label, cls] = STATE[r.state];
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {onPick && <input type="checkbox" aria-label={`Select ${r.business || r.email}`} checked={!!picked} disabled={r.unsubscribed} onChange={onPick} />}
        <b style={{ flex: 1, minWidth: 160 }}>{r.business || r.name || r.email}</b>
        <span className={`acq-pill ${cls}`}>{label}</span>
        {r.followUp === 'overdue' && <span className="acq-pill acq-pill-red">Follow-up overdue</span>}
        {r.unsubscribed && <span className="acq-pill">Opted out</span>}
      </div>
      <div className="acq-faint" style={{ fontSize: 12.5 }}>{r.email} · {r.campaignName} · {when(r.demoAt)}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ fontSize: 13 }}>Meeting time <input type="datetime-local" className="acq-input" value={at} onChange={(e) => setAt(e.target.value)} style={{ height: 34, width: 'auto' }} /></label>
        <button className="acq-btn acq-btn-sm" disabled={busy || !at || at === local(r.demoAt)} onClick={() => void patch({ demoAt: new Date(at).toISOString() })}>Save time</button>
        <span style={{ fontSize: 13 }}>What happened?</span>
        {([['held', 'Held'], ['missed', 'Missed'], ['rescheduled', 'Rebooked']] as const).map(([k, l]) => <button key={k} className={`acq-btn acq-btn-sm${r.outcome === k ? ' acq-btn-primary' : ''}`} disabled={busy} onClick={() => void patch({ outcome: r.outcome === k ? null : k })}>{l}</button>)}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="acq-input" aria-label="Next step" placeholder="Next step after the meeting, e.g. Send the proposal" value={next} onChange={(e) => setNext(e.target.value)} style={{ flex: 1, minWidth: 220, height: 34 }} maxLength={300} />
        <input type="date" className="acq-input" aria-label="Due date" value={due} onChange={(e) => setDue(e.target.value)} style={{ height: 34, width: 'auto' }} />
        <button className="acq-btn acq-btn-sm" disabled={busy || (next === (r.nextAction ?? '') && due === (r.nextActionDue ? r.nextActionDue.slice(0, 10) : ''))} onClick={() => void patch({ nextAction: next || null, nextActionDue: due ? new Date(`${due}T09:00:00`).toISOString() : null })}>Save step</button>
        {r.nextAction && r.followUp !== 'done' && <button className="acq-btn acq-btn-sm" disabled={busy} onClick={() => void patch({ nextActionDone: true })}><Check size={13} /> Done</button>}
        {r.followUp === 'done' && <span className="acq-pill acq-pill-green">Step done</span>}
      </div>
      {err && <div role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{err}</div>}
    </div>
  );
}

export default function AppointmentsPage() {
  const [rows, setRows] = useState<AppointmentRow[] | null>(null); const [counts, setCounts] = useState<Counts | null>(null); const [err, setErr] = useState('');
  const [tab, setTab] = useState<Tab>('needs_update'); const [sel, setSel] = useState<string[]>([]); const [busy, setBusy] = useState(false); const [made, setMade] = useState<{ id: string; added: number } | null>(null);
  const load = useCallback(async () => {
    const r = await fetch('/api/client-acquisition/appointments').catch(() => null); const j = r ? await r.json().catch(() => ({})) as { rows?: AppointmentRow[]; counts?: Counts; error?: string } : null;
    if (!r || !r.ok || !j?.rows) { setErr(j?.error ?? 'Could not load appointments.'); return; } setErr(''); setRows(j.rows); setCounts(j.counts ?? null);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const list = useMemo(() => {
    const all = rows ?? [];
    if (tab === 'needs_update') return all.filter((r) => r.state === 'needs_update');
    if (tab === 'missed') return all.filter((r) => r.state === 'missed');
    if (tab === 'upcoming') return all.filter((r) => r.state === 'upcoming');
    if (tab === 'follow_ups') return all.filter((r) => r.followUp === 'open' || r.followUp === 'overdue').sort((a, b) => Number(b.followUp === 'overdue') - Number(a.followUp === 'overdue') || (a.nextActionDue ?? '').localeCompare(b.nextActionDue ?? ''));
    return all;
  }, [rows, tab]);
  const tabs: Array<[Tab, string, number | undefined]> = [['needs_update', 'Needs update', counts?.needsUpdate], ['missed', 'Missed', counts?.missed], ['follow_ups', 'Next steps', counts?.followUps], ['upcoming', 'Upcoming', counts?.upcoming], ['all', 'Everything', rows?.length]];
  const eligible = list.filter((r) => r.state === 'missed' && !r.unsubscribed);
  const rebook = async () => { setBusy(true); const x = await call('/api/client-acquisition/appointments/reschedule', { method: 'POST', body: JSON.stringify({ leadIds: sel }) }); setBusy(false); if (!x.ok) setErr(x.error); else { setErr(''); setMade(x.j as { id: string; added: number }); setSel([]); } };

  return (
    <div className="acq-stack">
      <div style={{ paddingTop: 4 }}>
        <h1 className="acq-page-title">Appointments</h1>
        <p className="acq-sub" style={{ marginTop: 2, maxWidth: 720 }}>Every meeting booked from your campaigns. Record what happened and the next step, so the team can follow up. Missed ones can be invited to book again.</p>
      </div>
      {err && <div role="alert" className="acq-notice">{err}</div>}
      {made && <div className="acq-notice" role="status">A draft campaign was created for {made.added} contact{made.added === 1 ? '' : 's'}. Nothing has been sent. <Link href={`/client-acquisition/campaigns/${made.id}`} className="acq-link">Review and send it</Link></div>}
      <Card>
        <div role="tablist" aria-label="Appointments" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {tabs.map(([k, l, n]) => <button key={k} role="tab" aria-selected={tab === k} className={`acq-btn acq-btn-sm${tab === k ? ' acq-btn-primary' : ''}`} onClick={() => { setTab(k); setSel([]); }}>{l}{n ? ` (${n})` : ''}</button>)}
        </div>
        {tab === 'missed' && eligible.length > 0 && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <button className="acq-btn acq-btn-sm" onClick={() => setSel(sel.length === eligible.length ? [] : eligible.map((r) => r.leadId))}>{sel.length === eligible.length ? 'Clear' : 'Select all'}</button>
            <button className="acq-btn acq-btn-primary acq-btn-sm" disabled={busy || !sel.length} onClick={() => void rebook()}>{busy && <Loader2 size={13} className="animate-spin" />} Create a reschedule campaign ({sel.length})</button>
            <span className="acq-faint" style={{ fontSize: 12.5 }}>Creates a draft. You review it before anything is sent.</span>
          </div>
        )}
        {!rows && !err ? <div style={{ display: 'flex', gap: 8 }}><Loader2 size={16} className="animate-spin" /> Loading…</div>
          : list.length === 0 ? <EmptyState title={tab === 'missed' ? 'No missed appointments' : tab === 'needs_update' ? 'Nothing to update' : 'Nothing here'} body={tab === 'needs_update' ? 'Meetings whose time has passed with no outcome recorded appear here, so none is forgotten.' : 'Appointments appear when you record a meeting time on a contact in Inbox & Opportunities.'} />
          : <div style={{ display: 'grid', gap: 10 }}>{list.map((r) => <Row key={r.leadId} r={r} onChanged={load} picked={sel.includes(r.leadId)} onPick={tab === 'missed' ? () => setSel((s) => (s.includes(r.leadId) ? s.filter((x) => x !== r.leadId) : [...s, r.leadId])) : undefined} />)}</div>}
      </Card>
    </div>
  );
}
