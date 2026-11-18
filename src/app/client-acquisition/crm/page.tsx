'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Card, EmptyState } from '@/components/acq/ui';
import ContactPanel from '@/components/acq/crm/ContactPanel';
import { ago, call, dateLabel, send, STAGES, stageLabel, who, type Person } from '@/components/acq/crm/shared';

type Tab = 'today' | 'contacts' | 'tasks' | 'team';
interface QueueItem { leadId: string; score: number; reasons: string[]; action: string; business: string | null; name: string | null; email: string; stage: string; campaign: string; assigneeName: string | null; unassigned: boolean }
interface ContactRow { id: string; email: string; name: string | null; business: string | null; stage: string; campaign: string; assigneeId: string | null; assigneeName: string | null; nextTask: { title: string; dueAt: string | null } | null; lastTouchAt: string | null; needsAttention: boolean }
interface TaskRow { id: string; title: string; dueAt: string | null; assigneeName: string | null; overdue: boolean; contact: { id: string; label: string } | null }
interface Workspace { me: { id: string; role: string; name: string | null; email: string }; users: Person[]; members: Array<{ id: string; email: string; role: string; status: string }> }

function Today({ me, open, version }: { me: string; open: (id: string) => void; version: number }) {
  const [scope, setScope] = useState<'mine' | 'all'>('mine'); const [list, setList] = useState<QueueItem[] | null>(null); const [err, setErr] = useState('');
  useEffect(() => { void call<{ queue: QueueItem[] }>(`/api/crm/today?scope=${scope}`).then((r) => { if (r.ok) { setList(r.j.queue); setErr(''); } else setErr(r.error); }); }, [scope, version]);
  return (
    <Card title="Who to reach out to today">
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className={`acq-btn acq-btn-sm${scope === 'mine' ? ' acq-btn-primary' : ''}`} onClick={() => setScope('mine')}>Mine and unassigned</button>
        <button className={`acq-btn acq-btn-sm${scope === 'all' ? ' acq-btn-primary' : ''}`} onClick={() => setScope('all')}>Whole team</button>
        <span className="acq-faint" style={{ fontSize: 12.5 }}>Most urgent first. Each line says why.</span>
      </div>
      {err && <div role="alert" className="acq-notice">{err}</div>}
      {!list && !err ? <Loader2 size={16} className="animate-spin" /> : list && list.length === 0 ? <EmptyState title="Nobody needs you right now" body="When a contact replies, a task is due or a meeting passes without an update, they appear here." />
        : <div style={{ display: 'grid', gap: 10 }}>{list?.map((i) => (
          <button key={i.leadId} onClick={() => open(i.leadId)} style={{ textAlign: 'left', border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, background: '#fff', cursor: 'pointer', display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><b style={{ flex: 1, minWidth: 140 }}>{i.business || i.name || i.email}</b><span className="acq-pill acq-pill-amber">{i.action}</span>{i.unassigned ? <span className="acq-pill">Unassigned</span> : <span className="acq-pill acq-pill-blue">{i.assigneeName === me ? 'Mine' : i.assigneeName}</span>}</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, color: '#475569' }}>{i.reasons.slice(0, 3).map((r) => <li key={r}>{r}</li>)}</ul>
            <div className="acq-faint" style={{ fontSize: 12 }}>{stageLabel(i.stage)} · {i.campaign}</div>
          </button>))}</div>}
    </Card>
  );
}

function Contacts({ open, ws, version }: { open: (id: string) => void; ws: Workspace; version: number }) {
  const [q, setQ] = useState(''); const [stage, setStage] = useState(''); const [assignee, setAssignee] = useState(''); const [rows, setRows] = useState<ContactRow[] | null>(null); const [total, setTotal] = useState(0); const [err, setErr] = useState('');
  useEffect(() => { const t = setTimeout(() => { void call<{ contacts: ContactRow[]; total: number }>(`/api/crm/contacts?q=${encodeURIComponent(q)}&stage=${stage}&assignee=${assignee}&limit=100`).then((r) => { if (r.ok) { setRows(r.j.contacts); setTotal(r.j.total); setErr(''); } else setErr(r.error); }); }, 250); return () => clearTimeout(t); }, [q, stage, assignee, version]);
  return (
    <Card title={`Contacts${rows ? ` (${total})` : ''}`}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <input className="acq-input" aria-label="Search contacts" placeholder="Search name, business or email" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 200, height: 36 }} />
        <select className="acq-input" aria-label="Stage" value={stage} onChange={(e) => setStage(e.target.value)} style={{ height: 36, width: 'auto' }}><option value="">All stages</option>{STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select className="acq-input" aria-label="Owner" value={assignee} onChange={(e) => setAssignee(e.target.value)} style={{ height: 36, width: 'auto' }}><option value="">Everyone</option><option value="me">Mine</option><option value="none">Unassigned</option>{ws.users.filter((u) => u.id !== ws.me.id).map((u) => <option key={u.id} value={u.id}>{who(u)}</option>)}</select>
      </div>
      {err && <div role="alert" className="acq-notice">{err}</div>}
      {!rows && !err ? <Loader2 size={16} className="animate-spin" /> : rows && rows.length === 0 ? <EmptyState title="No contacts match" body="Contacts appear here when they are added to a campaign." />
        : <div style={{ display: 'grid', gap: 8 }}>{rows?.map((r) => (
          <button key={r.id} onClick={() => open(r.id)} style={{ textAlign: 'left', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 12px', background: '#fff', cursor: 'pointer', display: 'grid', gap: 2 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><b style={{ flex: 1, minWidth: 140 }}>{r.business || r.name || r.email}</b>{r.needsAttention && <span className="acq-pill acq-pill-amber">Needs attention</span>}<span className="acq-pill">{stageLabel(r.stage)}</span><span className="acq-pill acq-pill-blue">{r.assigneeName ?? 'Unassigned'}</span></div>
            <div className="acq-faint" style={{ fontSize: 12.5 }}>{r.email} · last activity {ago(r.lastTouchAt)}{r.nextTask ? ` · Next: ${r.nextTask.title}${r.nextTask.dueAt ? ` (${dateLabel(r.nextTask.dueAt)})` : ''}` : ''}</div>
          </button>))}</div>}
    </Card>
  );
}

function Tasks({ open, version, bump }: { open: (id: string) => void; version: number; bump: () => void }) {
  const [scope, setScope] = useState<'mine' | 'all'>('mine'); const [rows, setRows] = useState<TaskRow[] | null>(null); const [err, setErr] = useState('');
  useEffect(() => { void call<{ tasks: TaskRow[] }>(`/api/crm/tasks?scope=${scope}`).then((r) => { if (r.ok) { setRows(r.j.tasks); setErr(''); } else setErr(r.error); }); }, [scope, version]);
  const done = async (id: string) => { const r = await call(`/api/crm/tasks/${id}`, send('PATCH', { done: true })); if (!r.ok) setErr(r.error); else bump(); };
  return (
    <Card title="Tasks">
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}><button className={`acq-btn acq-btn-sm${scope === 'mine' ? ' acq-btn-primary' : ''}`} onClick={() => setScope('mine')}>Mine</button><button className={`acq-btn acq-btn-sm${scope === 'all' ? ' acq-btn-primary' : ''}`} onClick={() => setScope('all')}>Whole team</button></div>
      {err && <div role="alert" className="acq-notice">{err}</div>}
      {!rows && !err ? <Loader2 size={16} className="animate-spin" /> : rows && rows.length === 0 ? <EmptyState title="No open tasks" body="Add a task from any contact to remember the next step." />
        : <div style={{ display: 'grid', gap: 8 }}>{rows?.map((t) => (
          <div key={t.id} style={{ display: 'flex', gap: 10, alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 12, padding: '8px 12px', flexWrap: 'wrap' }}>
            <button className="acq-btn acq-btn-sm" aria-label={`Mark done: ${t.title}`} onClick={() => void done(t.id)}><Check size={13} /></button>
            <span style={{ flex: 1, minWidth: 160 }}>{t.title}{t.contact && <> · <button className="acq-link" onClick={() => open(t.contact!.id)}>{t.contact.label}</button></>}</span>
            {t.overdue && <span className="acq-pill acq-pill-red">Overdue</span>}<span className="acq-faint" style={{ fontSize: 12.5 }}>{t.assigneeName ?? 'Unassigned'}{t.dueAt ? ` · ${dateLabel(t.dueAt)}` : ''}</span>
          </div>))}</div>}
    </Card>
  );
}

function Team({ ws, reload }: { ws: Workspace; reload: () => Promise<void> }) {
  const [email, setEmail] = useState(''); const [role, setRole] = useState('member'); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [err, setErr] = useState('');
  const manager = ws.me.role === 'owner' || ws.me.role === 'admin';
  const act = async (fn: () => ReturnType<typeof call>) => { setBusy(true); setErr(''); setMsg(''); const r = await fn(); setBusy(false); if (!r.ok) setErr(r.error); else { await reload(); return r.j; } return null; };
  return (
    <Card title="Your team">
      <p className="acq-sub" style={{ marginBottom: 12 }}>Teammates sign in with their own account and see these contacts, who owns them and what to do next. They cannot see your campaigns, mailbox, billing or settings.</p>
      {err && <div role="alert" className="acq-notice">{err}</div>}{msg && <div role="status" className="acq-notice">{msg}</div>}
      <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>{ws.users.map((u) => <div key={u.id} style={{ display: 'flex', gap: 10, alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 12, padding: '8px 12px' }}><b style={{ flex: 1 }}>{who(u)}{u.id === ws.me.id ? ' (you)' : ''}</b><span className="acq-faint" style={{ fontSize: 12.5 }}>{u.email}</span><span className="acq-pill">{u.role}</span></div>)}</div>
      {manager && <>
        {ws.members.filter((m) => m.status === 'invited').length > 0 && <div style={{ marginBottom: 12 }}><h3 style={{ fontSize: 14, fontWeight: 650, marginBottom: 6 }}>Waiting to join</h3>{ws.members.filter((m) => m.status === 'invited').map((m) => <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13.5, marginBottom: 4 }}><span style={{ flex: 1 }}>{m.email} <span className="acq-faint">({m.role})</span></span><button className="acq-btn acq-btn-sm" disabled={busy} onClick={() => void act(() => call(`/api/crm/team/${m.id}`, { method: 'DELETE' }))}>Cancel invitation</button></div>)}</div>}
        <h3 style={{ fontSize: 14, fontWeight: 650, marginBottom: 6 }}>Invite a teammate</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input className="acq-input" type="email" aria-label="Teammate email" placeholder="teammate@company.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 1, minWidth: 220, height: 36 }} />
          <select className="acq-input" aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)} style={{ height: 36, width: 'auto' }}><option value="member">Member</option><option value="admin">Admin</option></select>
          <button className="acq-btn acq-btn-primary acq-btn-sm" disabled={busy || !email.trim()} onClick={async () => { const j = await act(() => call('/api/crm/team', send('POST', { email, role }))); if (j) { setEmail(''); setMsg('Invited. Tell them to sign in (or sign up) at RUNVAX with that exact email address and verify it. They will land in the CRM.'); } }}>Invite</button>
        </div>
        <p className="acq-faint" style={{ fontSize: 12.5, marginTop: 8 }}>Members can add notes and tasks, take unassigned contacts and work their own. Admins can also reassign contacts and manage the team.</p>
        {ws.users.filter((u) => u.role !== 'owner' && u.id !== ws.me.id).length > 0 && <div style={{ marginTop: 14, display: 'grid', gap: 6 }}>
          <h3 style={{ fontSize: 14, fontWeight: 650 }}>Manage</h3>
          {ws.members.filter((m) => m.status === 'active').map((m) => <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13.5 }}><span style={{ flex: 1 }}>{m.email}</span>
            <select className="acq-input" aria-label={`Role for ${m.email}`} value={m.role} onChange={(e) => void act(() => call(`/api/crm/team/${m.id}`, send('PATCH', { role: e.target.value })))} style={{ height: 32, width: 'auto' }}><option value="member">Member</option><option value="admin">Admin</option></select>
            <button className="acq-btn acq-btn-sm" disabled={busy} onClick={() => { if (window.confirm(`Remove ${m.email}? Their contacts become unassigned.`)) void act(() => call(`/api/crm/team/${m.id}`, { method: 'DELETE' })); }}>Remove</button></div>)}
        </div>}
      </>}
    </Card>
  );
}

export default function CrmPage() {
  const [tab, setTab] = useState<Tab>('today'); const [ws, setWs] = useState<Workspace | null>(null); const [err, setErr] = useState(''); const [open, setOpen] = useState(''); const [version, setVersion] = useState(0);
  const load = useCallback(async () => { const r = await call<Workspace>('/api/crm/team'); if (r.ok) { setWs(r.j); setErr(''); } else setErr(r.error); }, []);
  useEffect(() => { void load(); }, [load]);
  const bump = () => setVersion((v) => v + 1);
  const tabs: Array<[Tab, string]> = [['today', 'Today'], ['contacts', 'Contacts'], ['tasks', 'Tasks'], ['team', 'Team']];
  return (
    <div className="acq-stack">
      <div style={{ paddingTop: 4 }}>
        <h1 className="acq-page-title">CRM</h1>
        <p className="acq-sub" style={{ marginTop: 2, maxWidth: 720 }}>One place for the whole team: who to reach out to, who owns each contact, and what has happened with them.</p>
      </div>
      {err && <div role="alert" className="acq-notice">{err.includes('database') || err.includes('installed') ? 'The CRM is not available yet. The database update for it has not been applied.' : err}</div>}
      {ws && <>
        <div role="tablist" aria-label="CRM" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={`acq-btn acq-btn-sm${tab === k ? ' acq-btn-primary' : ''}`} onClick={() => setTab(k)}>{l}</button>)}</div>
        {tab === 'today' && <Today me={ws.me.name || ws.me.email} open={setOpen} version={version} />}
        {tab === 'contacts' && <Contacts open={setOpen} ws={ws} version={version} />}
        {tab === 'tasks' && <Tasks open={setOpen} version={version} bump={bump} />}
        {tab === 'team' && <Team ws={ws} reload={load} />}
      </>}
      {!ws && !err && <div style={{ display: 'flex', gap: 8 }}><Loader2 size={16} className="animate-spin" /> Loading…</div>}
      {open && <ContactPanel id={open} onClose={() => setOpen('')} onChanged={bump} />}
    </div>
  );
}
