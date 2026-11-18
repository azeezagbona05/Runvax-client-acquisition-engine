'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { call, send, stageLabel, MANUAL, dateLabel, who, type Person } from './shared';

interface Detail {
  contact: { id: string; email: string; name: string | null; business: string | null; website: string | null; stage: string | null; campaign: { name: string }; demoAt: string | null; dealValue: number | null; unsubscribed: boolean; appointmentOutcome: string | null; assigneeId: string | null; assigneeName: string | null };
  tasks: Array<{ id: string; title: string; dueAt: string | null; doneAt: string | null; assigneeName: string | null }>;
  timeline: Array<{ at: string; kind: string; text: string; by?: string | null }>;
  users: Person[]; me: { id: string; role: string };
}
const KIND: Record<string, string> = { email: 'Email', open: 'Opened', click: 'Clicked', reply: 'Reply', note: 'Note', call: 'Call', whatsapp: 'WhatsApp', meeting: 'Meeting', system: 'Update' };

/** One contact: who they are, who owns them, what has happened, and what to do next. Everything the team logs here is visible to the team. */
export default function ContactPanel({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<Detail | null>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState('note'); const [text, setText] = useState(''); const [task, setTask] = useState(''); const [due, setDue] = useState('');
  const load = useCallback(async () => { const r = await call<Detail>(`/api/crm/contacts/${id}`); if (r.ok) { setD(r.j); setErr(''); } else setErr(r.error); }, [id]);
  useEffect(() => { void load(); }, [load]);
  const run = async (fn: () => Promise<{ ok: true; j: unknown } | { ok: false; error: string }>) => { setBusy(true); const r = await fn(); setBusy(false); if (!r.ok) setErr(r.error); else { setErr(''); await load(); onChanged(); } return r.ok; };
  const manager = d && (d.me.role === 'owner' || d.me.role === 'admin');

  return (
    <div role="dialog" aria-modal="true" aria-label="Contact" className="fixed inset-0 z-[90] flex justify-end bg-slate-950/40" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ width: 'min(560px,100%)', background: '#fff', height: '100%', overflowY: 'auto', padding: 18, display: 'grid', gap: 14, alignContent: 'start' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <div><h2 style={{ fontSize: 18, fontWeight: 700 }}>{d ? d.contact.business || d.contact.name || d.contact.email : 'Loading…'}</h2>{d && <p className="acq-faint" style={{ fontSize: 13 }}>{d.contact.name ? `${d.contact.name} · ` : ''}{d.contact.email} · {d.contact.campaign.name}</p>}</div>
          <button onClick={onClose} aria-label="Close" className="acq-btn acq-btn-sm"><X size={14} /></button>
        </div>
        {err && <div role="alert" className="acq-notice">{err}</div>}
        {!d ? <Loader2 className="animate-spin" size={18} /> : <>
          {d.contact.unsubscribed && <div className="acq-notice">This contact opted out of emails. Do not email them.</div>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <label style={{ fontSize: 13 }}>Owner <select className="acq-input" style={{ height: 34, width: 'auto' }} value={d.contact.assigneeId ?? ''} disabled={busy} onChange={(e) => void run(() => call(`/api/crm/contacts/${id}`, send('PATCH', { assigneeId: e.target.value || null })))}>
              <option value="">Unassigned</option>
              {d.users.filter((u) => manager || u.id === d.me.id || u.id === d.contact.assigneeId).map((u) => <option key={u.id} value={u.id}>{who(u)}{u.id === d.me.id ? ' (me)' : ''}</option>)}
            </select></label>
            {!d.contact.assigneeId && <button className="acq-btn acq-btn-sm" disabled={busy} onClick={() => void run(() => call(`/api/crm/contacts/${id}`, send('PATCH', { assigneeId: d.me.id })))}>Take this contact</button>}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 13 }}>Stage</span>
            {MANUAL.map(([k, l]) => <button key={k} className={`acq-btn acq-btn-sm${d.contact.stage === k ? ' acq-btn-primary' : ''}`} disabled={busy} onClick={() => void run(() => call(`/api/crm/contacts/${id}`, send('PATCH', { stage: d.contact.stage === k ? null : k })))}>{l}</button>)}
            {d.contact.stage && <span className="acq-faint" style={{ fontSize: 12.5 }}>Now: {stageLabel(d.contact.stage)}. Follow-up emails stop at these stages.</span>}
          </div>

          <section style={{ display: 'grid', gap: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 650 }}>Next steps</h3>
            {d.tasks.length === 0 && <p className="acq-faint" style={{ fontSize: 13 }}>No tasks yet.</p>}
            {d.tasks.map((t) => (
              <div key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, opacity: t.doneAt ? 0.55 : 1 }}>
                <button className="acq-btn acq-btn-sm" aria-label={t.doneAt ? 'Reopen task' : 'Mark done'} disabled={busy} onClick={() => void run(() => call(`/api/crm/tasks/${t.id}`, send('PATCH', { done: !t.doneAt })))}><Check size={13} /></button>
                <span style={{ flex: 1, textDecoration: t.doneAt ? 'line-through' : 'none' }}>{t.title}</span>
                <span className="acq-faint" style={{ fontSize: 12 }}>{t.assigneeName ? `${t.assigneeName} · ` : ''}{dateLabel(t.dueAt)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input className="acq-input" aria-label="New task" placeholder="e.g. Call to confirm the proposal" value={task} onChange={(e) => setTask(e.target.value)} maxLength={300} style={{ flex: 1, minWidth: 200, height: 34 }} />
              <input className="acq-input" type="date" aria-label="Due date" value={due} onChange={(e) => setDue(e.target.value)} style={{ height: 34, width: 'auto' }} />
              <button className="acq-btn acq-btn-sm" disabled={busy || !task.trim()} onClick={async () => { if (await run(() => call('/api/crm/tasks', send('POST', { title: task, leadId: id, dueAt: due ? new Date(`${due}T09:00:00`).toISOString() : null })))) { setTask(''); setDue(''); } }}>Add task</button>
            </div>
          </section>

          <section style={{ display: 'grid', gap: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 650 }}>Log what happened</h3>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{['note', 'call', 'whatsapp', 'meeting', 'email'].map((k) => <button key={k} className={`acq-btn acq-btn-sm${kind === k ? ' acq-btn-primary' : ''}`} onClick={() => setKind(k)}>{KIND[k]}</button>)}</div>
            <textarea className="acq-input" aria-label="What happened" rows={3} placeholder="What was said, and what was agreed?" value={text} onChange={(e) => setText(e.target.value)} maxLength={4000} style={{ height: 'auto', padding: 10 }} />
            <div><button className="acq-btn acq-btn-primary acq-btn-sm" disabled={busy || !text.trim()} onClick={async () => { if (await run(() => call(`/api/crm/contacts/${id}/notes`, send('POST', { kind, body: text })))) setText(''); }}>Save to timeline</button> <span className="acq-faint" style={{ fontSize: 12 }}>This only records it. Nothing is sent.</span></div>
          </section>

          <section style={{ display: 'grid', gap: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 650 }}>Timeline</h3>
            {d.timeline.length === 0 && <p className="acq-faint" style={{ fontSize: 13 }}>Nothing has happened yet.</p>}
            {d.timeline.map((e, i) => <div key={i} style={{ borderLeft: '3px solid #e9d5ff', paddingLeft: 10, fontSize: 13.5 }}><div className="acq-faint" style={{ fontSize: 12 }}>{KIND[e.kind] ?? e.kind} · {new Date(e.at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{e.by ? ` · ${e.by}` : ''}</div><div style={{ whiteSpace: 'pre-wrap' }}>{e.text}</div></div>)}
          </section>
        </>}
      </div>
    </div>
  );
}
