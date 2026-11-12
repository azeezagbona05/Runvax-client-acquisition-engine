'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, Check, GraduationCap, Loader2, Plus, Trash2 } from 'lucide-react';
import type { Analytics } from '@/lib/career/manage/analytics';
import { KIND_LABEL, RESPONSE_KINDS, type Analysis, type ResponseKind } from '@/lib/career/manage/classify';
import type { Prep } from '@/lib/career/manage/coach';
import { api, box, hint, json } from './shared';

const fmt = (d: string) => new Date(d).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

// ── Needs you today ──
interface Rem { kind: string; id: string; title: string; detail: string; due: string }
export function TodayCard({ refreshKey, goto }: { refreshKey: number; goto: (tab: 'Interviews' | 'Applications' | 'Approvals') => void }) {
  const [rows, setRows] = useState<Rem[]>([]);
  useEffect(() => { void api<{ reminders: Rem[] }>('/api/career/reminders').then((r) => { if (!r.error) setRows(r.reminders); }); }, [refreshKey]);
  if (!rows.length) return null;
  return (
    <section className="acq-card acq-card-pad" aria-label="Needs you" style={{ display: 'grid', gap: 8, borderColor: '#fde68a', background: '#fffbeb' }}>
      <h2 className="acq-title" style={{ fontSize: 15 }}>Needs you</h2>
      {rows.map((r) => <button key={r.kind + r.id} type="button" onClick={() => goto(r.kind === 'interview' ? 'Interviews' : r.kind === 'approval' ? 'Approvals' : 'Applications')} style={{ textAlign: 'left', background: 'transparent', border: 0, padding: 0, cursor: 'pointer' }}><b style={{ fontSize: 13.5 }}>{r.title}</b><span style={{ display: 'block', ...hint, marginTop: 0 }}>{r.kind === 'interview' ? fmt(r.due) + ' · ' : ''}{r.detail}</span></button>)}
    </section>
  );
}

// ── Employer replies: paste, review the proposal, confirm ──
interface Inbox { analysis: Analysis; applications: Array<{ id: string; title: string; company: string; status: string }>; likelyApplicationId: string | null }
interface Resp { id: string; kind: string; label: string; subject: string; summary: string; receivedAt: string; title: string; company: string }
export function ResponsesPanel({ onChanged, refreshKey }: { onChanged: () => void; refreshKey: number }) {
  const [text, setText] = useState(''); const [inbox, setInbox] = useState<Inbox | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [list, setList] = useState<Resp[]>([]);
  const [appId, setAppId] = useState(''); const [kind, setKind] = useState<ResponseKind>('other'); const [when, setWhen] = useState(localInput(new Date())); const [ivAt, setIvAt] = useState(''); const [ivLoc, setIvLoc] = useState('');
  const load = useCallback(async () => { const r = await api<{ responses: Resp[] }>('/api/career/responses'); if (!r.error) setList(r.responses); }, []);
  useEffect(() => { void load(); }, [load, refreshKey]);
  const analyse = async () => {
    setBusy(true); setErr(''); const r = await api<Inbox>('/api/career/inbox', json('POST', { text })); setBusy(false);
    if (r.error) return setErr(r.error);
    setInbox(r); setKind(r.analysis.kind); setAppId(r.likelyApplicationId ?? ''); setIvAt(r.analysis.interviewDates[0] ?? ''); setIvLoc(r.analysis.links[0] ?? '');
  };
  const save = async () => {
    if (!inbox) return; setBusy(true); setErr('');
    const r = await api('/api/career/responses', json('POST', { applicationId: appId, kind, subject: inbox.analysis.subject, summary: inbox.analysis.summary, receivedAt: new Date(when).toISOString(), ...(kind === 'interview' && ivAt ? { interview: { startsAt: new Date(ivAt).toISOString(), kind: inbox.analysis.interviewKind, location: ivLoc } } : {}) }));
    setBusy(false); if (r.error) return setErr(r.error);
    setInbox(null); setText(''); await load(); onChanged();
  };
  const appliedOnly = inbox?.applications.filter((a) => a.status === 'applied') ?? [];
  return (
    <>
      <p style={{ fontSize: 13.5, color: '#475569' }}>When an employer replies, paste the email here. RUNVAX reads it, suggests what it is, and you confirm. Only a short summary is saved, never the email itself. The agent does not read your inbox.</p>
      {!inbox && <>
        <textarea className="acq-input" rows={7} aria-label="Employer email" placeholder="Paste the employer's email here (subject and body)" value={text} onChange={(e) => setText(e.target.value)} />
        <div><button className="acq-btn acq-btn-primary" disabled={busy || text.trim().length < 30} onClick={analyse}>{busy ? <Loader2 size={15} className="animate-spin" /> : null} Read this email</button></div>
      </>}
      {inbox && (
        <div style={{ ...box, display: 'grid', gap: 10 }} aria-label="Proposed reading">
          <div className="acq-notice" style={{ fontSize: 13 }}>{inbox.analysis.summary}</div>
          <label><b style={{ fontSize: 13 }}>What is it?</b><select className="acq-input" value={kind} onChange={(e) => setKind(e.target.value as ResponseKind)}>{RESPONSE_KINDS.filter((k) => k !== 'followed_up').map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></label>
          <label><b style={{ fontSize: 13 }}>Which application?</b><select className="acq-input" value={appId} onChange={(e) => setAppId(e.target.value)}><option value="">Choose…</option>{appliedOnly.map((a) => <option key={a.id} value={a.id}>{a.title} at {a.company}</option>)}</select>
            <span style={hint}>{appliedOnly.length ? 'Only applications you marked as applied are listed.' : 'Mark an application as "I applied" first.'}</span></label>
          <label><b style={{ fontSize: 13 }}>Received</b><input className="acq-input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></label>
          {kind === 'interview' && <div style={{ display: 'grid', gap: 8 }}>
            <label><b style={{ fontSize: 13 }}>Interview date and time</b><input className="acq-input" type="datetime-local" value={ivAt} onChange={(e) => setIvAt(e.target.value)} /><span style={hint}>{inbox.analysis.interviewDates.length ? 'Suggested from the email. Check the time and your time zone.' : 'No date found in the email. Add it to put it in your tracker.'}</span></label>
            <label><b style={{ fontSize: 13 }}>Link or place</b><input className="acq-input" placeholder="Meeting link or address, e.g. https://zoom.us/j/123" value={ivLoc} onChange={(e) => setIvLoc(e.target.value)} /></label></div>}
          {err && <div role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8 }}><button className="acq-btn acq-btn-primary" disabled={busy || !appId} onClick={save}><Check size={14} /> Confirm and save</button><button className="acq-btn" onClick={() => setInbox(null)}>Back</button></div>
        </div>
      )}
      {err && !inbox && <div role="alert" style={{ color: '#b91c1c', fontSize: 13.5 }}>{err}</div>}
      <b style={{ fontSize: 13.5 }}>Logged replies</b>
      {list.length === 0 && <p style={hint}>None yet.</p>}
      {list.map((r) => <div key={r.id} style={{ ...box, display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><span style={{ fontSize: 13.5 }}><b>{r.label}</b> · {r.title} at {r.company}{r.summary && <span style={{ display: 'block', ...hint, marginTop: 0 }}>{r.summary}</span>}</span><span style={hint}>{fmt(r.receivedAt)}</span></div>)}
    </>
  );
}

// ── Interviews + coach ──
interface Iv { id: string; company: string; title: string; kind: string; startsAt: string; location: string; notes: string; status: string; prep: Prep | null }
export function InterviewsPanel({ onChanged, refreshKey }: { onChanged: () => void; refreshKey: number }) {
  const [list, setList] = useState<Iv[] | null>(null); const [adding, setAdding] = useState(false); const [f, setF] = useState({ company: '', title: '', startsAt: '', kind: 'video', location: '' }); const [err, setErr] = useState(''); const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => { const r = await api<{ interviews: Iv[] }>('/api/career/interviews'); if (!r.error) setList(r.interviews); }, []);
  useEffect(() => { void load(); }, [load, refreshKey]);
  const add = async () => { setErr(''); const r = await api('/api/career/interviews', json('POST', { ...f, startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : '' })); if (r.error) return setErr(r.error); setAdding(false); setF({ company: '', title: '', startsAt: '', kind: 'video', location: '' }); await load(); onChanged(); };
  const setStatus = async (id: string, status: string) => { await api(`/api/career/interviews/${id}`, json('PATCH', { status })); await load(); onChanged(); };
  const del = async (id: string) => { if (!window.confirm('Delete this interview?')) return; await api(`/api/career/interviews/${id}`, { method: 'DELETE' }); await load(); onChanged(); };
  const coach = async (id: string) => { setBusy(id); setErr(''); const r = await api(`/api/career/interviews/${id}/prep`, json('POST', {})); setBusy(null); if (r.error) setErr(r.error); else await load(); };
  if (!list) return <div style={{ display: 'flex', gap: 8 }}><Loader2 size={16} className="animate-spin" /> Loading…</div>;
  return (
    <>
      <div><button className="acq-btn acq-btn-sm" onClick={() => setAdding(!adding)}><Plus size={13} /> Add an interview</button></div>
      {adding && <div style={{ ...box, display: 'grid', gap: 8 }}>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
          <input className="acq-input" aria-label="Company" placeholder="Company" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />
          <input className="acq-input" aria-label="Role" placeholder="Role" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <input className="acq-input" aria-label="Date and time" type="datetime-local" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} />
          <select className="acq-input" aria-label="Type" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="video">Video</option><option value="phone">Phone</option><option value="onsite">On-site</option><option value="other">Other</option></select>
        </div>
        <input className="acq-input" aria-label="Link or place" placeholder="Link or place" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
        <div><button className="acq-btn acq-btn-primary acq-btn-sm" onClick={add}>Save interview</button></div></div>}
      {err && <div role="alert" style={{ color: '#b91c1c', fontSize: 13.5 }}>{err}</div>}
      {list.length === 0 && <p style={hint}>No interviews yet. They appear here when you confirm an interview invitation under Responses, or add one yourself.</p>}
      {list.map((i) => (
        <div key={i.id} style={{ ...box, display: 'grid', gap: 8, opacity: i.status === 'cancelled' ? 0.6 : 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <div><b style={{ fontSize: 14.5 }}><CalendarClock size={14} style={{ verticalAlign: -2 }} /> {i.title} at {i.company}</b><div style={hint}>{fmt(i.startsAt)} · {i.kind}{i.location ? ` · ${i.location}` : ''}</div></div>
            <span className={`acq-pill ${i.status === 'scheduled' ? 'acq-pill-blue' : 'acq-pill-gray'}`}>{i.status}</span>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button className="acq-btn acq-btn-sm" disabled={busy === i.id} onClick={() => coach(i.id)}>{busy === i.id ? <Loader2 size={13} className="animate-spin" /> : <GraduationCap size={13} />} {i.prep ? 'Refresh preparation' : 'Prepare me'}</button>
            {i.status === 'scheduled' && <><button className="acq-btn acq-btn-sm" onClick={() => setStatus(i.id, 'done')}>Mark done</button><button className="acq-btn acq-btn-sm" onClick={() => setStatus(i.id, 'cancelled')}>Cancelled</button></>}
            {i.status !== 'scheduled' && <button className="acq-btn acq-btn-sm" onClick={() => setStatus(i.id, 'scheduled')}>Re-open</button>}
            <button className="acq-btn acq-btn-sm" onClick={() => del(i.id)}><Trash2 size={13} /> Delete</button>
          </div>
          {i.prep && (
            <div style={{ display: 'grid', gap: 8, borderTop: '1px solid #e2e8f0', paddingTop: 8 }} aria-label="Interview preparation">
              <span style={hint}>Prepared by the {i.prep.source === 'ai' ? 'AI coach' : 'basic coach'} using only your confirmed profile.</span>
              {i.prep.questions.map((q) => <div key={q.question}><b style={{ fontSize: 13.5 }}>{q.question}</b>{q.talkingPoint && <p style={{ fontSize: 13, margin: '2px 0 0', color: '#475569' }}>{q.talkingPoint}</p>}</div>)}
              {i.prep.gaps.length > 0 && <div style={{ background: '#fffbeb', borderRadius: 8, padding: 10, fontSize: 13 }}><b>Not in your profile:</b> {i.prep.gaps.join('; ')}</div>}
              {i.prep.toAsk.length > 0 && <div><b style={{ fontSize: 13 }}>Questions to ask them</b><ul style={{ margin: '2px 0 0 18px', fontSize: 13 }}>{i.prep.toAsk.map((x) => <li key={x}>{x}</li>)}</ul></div>}
              {i.prep.tips.length > 0 && <div><b style={{ fontSize: 13 }}>Tips</b><ul style={{ margin: '2px 0 0 18px', fontSize: 13 }}>{i.prep.tips.map((x) => <li key={x}>{x}</li>)}</ul></div>}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

// ── Analytics ──
export function AnalyticsPanel({ refreshKey }: { refreshKey: number }) {
  const [a, setA] = useState<Analytics | null>(null); const [err, setErr] = useState('');
  useEffect(() => { void api<Analytics>('/api/career/analytics').then((r) => (r.error ? setErr(r.error) : setA(r))); }, [refreshKey]);
  if (err) return <div role="alert" style={{ color: '#b91c1c' }}>{err}</div>;
  if (!a) return <div style={{ display: 'flex', gap: 8 }}><Loader2 size={16} className="animate-spin" /> Loading…</div>;
  const F = a.funnel; const max = Math.max(1, ...a.appliedPerWeek.map((w) => w.count));
  const steps: Array<[string, number]> = [['Jobs found', F.discovered], ['Good matches', F.matched], ['Prepared', F.prepared], ['Approved', F.approved], ['Applied (by you)', F.applied], ['Employer replied', F.replies], ['Interviews', F.interviews], ['Offers', F.offers]];
  const top = Math.max(1, ...steps.map((s) => s[1]));
  return (
    <>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        {([['Reply rate', a.rates.replyRate == null ? '—' : `${a.rates.replyRate}%`, 'of applications you sent'], ['Interview rate', a.rates.interviewRate == null ? '—' : `${a.rates.interviewRate}%`, 'of applications you sent'], ['Average time to reply', a.rates.avgDaysToReply == null ? '—' : `${a.rates.avgDaysToReply} days`, 'after you applied']] as const).map(([l, v, s]) => <div key={l} style={box}><div style={{ fontSize: 24, fontWeight: 700 }}>{v}</div><div style={hint}>{l}<br />{s}</div></div>)}
      </div>
      <div style={{ ...box, display: 'grid', gap: 6 }} aria-label="Funnel">
        <b style={{ fontSize: 13.5 }}>From job found to offer</b>
        {steps.map(([l, n]) => <div key={l} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 40px', gap: 8, alignItems: 'center', fontSize: 13 }}><span>{l}</span><span style={{ background: '#f1f5f9', borderRadius: 6, height: 10 }}><span style={{ display: 'block', height: 10, borderRadius: 6, background: '#7e22ce', width: `${(n / top) * 100}%` }} /></span><b style={{ textAlign: 'right' }}>{n}</b></div>)}
      </div>
      <div style={{ ...box, display: 'grid', gap: 6 }}>
        <b style={{ fontSize: 13.5 }}>Applications you sent, per week</b>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 70 }}>{a.appliedPerWeek.map((w) => <div key={w.week} title={`${w.week}: ${w.count}`} style={{ flex: 1, display: 'grid', gap: 2, justifyItems: 'center' }}><span style={{ fontSize: 11 }}>{w.count || ''}</span><span style={{ width: '100%', background: '#c4b5fd', borderRadius: 4, height: Math.max(3, (w.count / max) * 44) }} /></div>)}</div>
      </div>
      {a.bySource.length > 0 && <div style={{ ...box, display: 'grid', gap: 4, fontSize: 13.5 }}><b>Which sources get replies</b>{a.bySource.map((s) => <div key={s.source}>{s.source}: {s.replies} repl{s.replies === 1 ? 'y' : 'ies'} from {s.applied} application{s.applied === 1 ? '' : 's'}</div>)}</div>}
      <p style={hint}>AI-written items so far: {a.aiWrites}. All numbers come from your own records.</p>
    </>
  );
}
