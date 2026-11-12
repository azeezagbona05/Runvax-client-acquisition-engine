'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bot, Check, CheckCheck, Download, ExternalLink, Loader2, RotateCcw, Search, Send, X } from 'lucide-react';
import type { CareerProfileData } from '@/lib/career/types';
import { downloadCvPdf } from './cvPdf';
import { api, box, hint, json } from './shared';
import { StaleNotice } from './ui';

export interface AppRow {
  id: string; status: 'prepared' | 'approved' | 'rejected' | 'applied'; cv: CareerProfileData; coverLetter: string; answers: Array<{ question: string; answer: string }>; gaps: string[]; flags: string[];
  submission: { id: string; status: string; trigger: string; reason: string; questions: Array<{ label: string; reason: string }>; evidence: string; finalUrl: string; platform: string; createdAt: string; finishedAt: string | null } | null;
  source: string; edited: boolean; approvedAt: string | null; appliedAt: string | null; appliedBy: string | null; updatedAt: string; score: number;
  job: { title: string; company: string; location: string; remote: boolean; url: string; source: string };
}
export const STATUS: Record<AppRow['status'], [string, string]> = { prepared: ['Waiting for your approval', 'acq-pill-amber'], approved: ['Approved, not sent', 'acq-pill-blue'], rejected: ['Rejected', 'acq-pill-gray'], applied: ['Applied by you', 'acq-pill-green'] };
export const statusOf = (a: Pick<AppRow, 'status' | 'appliedBy' | 'submission'>): [string, string] => a.status === 'applied' && a.appliedBy === 'agent' ? ['Submitted by the agent', 'acq-pill-green'] : a.status === 'approved' && a.submission && ['queued', 'running'].includes(a.submission.status) ? ['Waiting to be submitted', 'acq-pill-blue'] : a.status === 'approved' && a.submission?.status === 'needs_you' ? ['Needs you', 'acq-pill-amber'] : a.status === 'approved' && a.submission?.status === 'unconfirmed' ? ['Sent? Not confirmed', 'acq-pill-red'] : STATUS[a.status];
export interface SubInfo { enabled: boolean; message: string; supported: string[]; permMode: string }
const stamp = (d: string | null) => (d ? new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

function Card({ a, open, onToggle, onChanged, selected, onSelect, sub }: { a: AppRow; open: boolean; onToggle: () => void; onChanged: () => void; selected?: boolean; onSelect?: (v: boolean) => void; sub: SubInfo }) {
  const [fu, setFu] = useState(''); const [fuBusy, setFuBusy] = useState(false);
  const [letter, setLetter] = useState(a.coverLetter); const [answers, setAnswers] = useState(a.answers); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const editable = a.status === 'prepared'; const dirty = letter !== a.coverLetter || JSON.stringify(answers) !== JSON.stringify(a.answers);
  const act = async (action?: string) => {
    setBusy(true); setErr('');
    const r = await api<{ ok: boolean }>(`/api/career/applications/${a.id}`, json('PATCH', { ...(action ? { action } : {}), ...(dirty ? { coverLetter: letter, answers } : {}) }));
    setBusy(false); if (r.error) setErr(r.error); else onChanged();
  };
  const draftFu = async () => { setFuBusy(true); setErr(''); const r = await api<{ draft: string }>('/api/career/followup', json('POST', { applicationId: a.id })); setFuBusy(false); if (r.error) setErr(r.error); else setFu(r.draft); };
  const sentFu = async () => { setFuBusy(true); const r = await api('/api/career/responses', json('POST', { applicationId: a.id, kind: 'followed_up', summary: 'Candidate sent a follow-up.', receivedAt: new Date().toISOString() })); setFuBusy(false); if (r.error) setErr(r.error); else { setFu(''); onChanged(); } };
  const queue = async (mode: 'submit' | 'check') => { setBusy(true); setErr(''); const r = await api<{ results: Array<{ ok: boolean; error?: string }> }>('/api/career/submissions', json('POST', { applicationIds: [a.id], mode })); setBusy(false); if (r.error) setErr(r.error); else onChanged(); };
  const cancelSub = async () => { if (!a.submission) return; setBusy(true); const r = await api(`/api/career/submissions/${a.submission.id}`, { method: 'DELETE' }); setBusy(false); if (r.error) setErr(r.error); else onChanged(); };
  const sm = a.submission; const supported = sub.supported.includes(a.id); const active = !!sm && ['queued', 'running'].includes(sm.status);
  const [label, tone] = statusOf(a);
  return (
    <div style={{ ...box, display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          {onSelect && <input type="checkbox" aria-label={`Select ${a.job.title}`} checked={!!selected} onChange={(e) => onSelect(e.target.checked)} style={{ marginTop: 4 }} />}
          <div><b style={{ fontSize: 14.5 }}>{a.job.title}</b><div style={hint}>{a.job.company} · {a.score}% match · via {a.job.source}</div></div>
        </div>
        <span className={`acq-pill ${tone}`}>{label}</span>
      </div>
      <div style={hint}>CV used: tailored copy for this job, built from your confirmed profile · written by the {a.source === 'ai' ? 'AI writer' : 'basic writer'}{a.edited ? ' · edited by you' : ''}{a.approvedAt && a.status === 'approved' ? ` · approved ${stamp(a.approvedAt)}` : ''}{a.appliedAt ? (a.appliedBy === 'agent' ? ` · submitted by the agent ${stamp(a.appliedAt)}` : ` · you marked it applied ${stamp(a.appliedAt)}`) : ''}</div>
      <div><button className="acq-btn acq-btn-sm" onClick={onToggle} aria-expanded={open}>{open ? 'Hide details' : 'Review application'}</button></div>
      {open && (
        <div style={{ display: 'grid', gap: 10 }}>
          {a.gaps.length > 0 && <div style={{ background: '#fffbeb', borderRadius: 8, padding: 10, fontSize: 13 }}><b>Asked for, but not in your profile</b> (the application does not claim these): {a.gaps.join('; ')}</div>}
          {a.flags.length > 0 && <div style={{ fontSize: 12.5, color: '#92400e' }}><b>Accuracy check:</b><ul style={{ margin: '4px 0 0 18px' }}>{a.flags.slice(0, 6).map((f) => <li key={f}>{f}</li>)}</ul></div>}
          <div><b style={{ fontSize: 13 }}>Tailored CV summary</b><p style={{ fontSize: 13.5, margin: '2px 0 0' }}>{a.cv.summary || 'Uses your profile summary.'}</p>
            <button className="acq-btn acq-btn-sm" style={{ marginTop: 6 }} onClick={() => downloadCvPdf(a.cv, a.job.company)}><Download size={13} /> Download tailored CV (PDF)</button></div>
          <label><b style={{ fontSize: 13 }}>Cover letter</b><textarea className="acq-input" rows={8} placeholder="No cover letter was written for this one. Type a short one here." value={letter} readOnly={!editable} onChange={(e) => setLetter(e.target.value)} /></label>
          {answers.map((x, i) => <label key={x.question}><b style={{ fontSize: 13 }}>{x.question}</b><textarea className="acq-input" rows={3} placeholder="Type your answer here" value={x.answer} readOnly={!editable} onChange={(e) => setAnswers(answers.map((y, j) => (j === i ? { ...y, answer: e.target.value } : y)))} /></label>)}
          {a.status === 'approved' && !sm && <div className="acq-notice" style={{ fontSize: 13 }}>Approved means ready to send. {supported && sub.enabled && sub.permMode !== 'prepare' ? 'You can let the agent submit it, or apply yourself and press "I applied".' : !supported ? 'This job has no form the agent can submit on (only Greenhouse and Lever hosted forms), so apply yourself with the posting link, then press "I applied".' : !sub.enabled ? sub.message : 'Your permission is "Prepare applications only". Change it in Edit setup to let the agent submit.'}</div>}
          {a.status === 'applied' && a.appliedBy === 'agent' && sm && <div style={{ ...box, background: '#f0fdf4', borderColor: '#bbf7d0', fontSize: 13 }}><b>Submitted by the agent</b> on {stamp(a.appliedAt)} through {sm.platform === 'lever' ? 'Lever' : 'Greenhouse'}. The site's own confirmation said: “{sm.evidence}”{sm.finalUrl && <> (<a href={sm.finalUrl} target="_blank" rel="noopener noreferrer">page</a>)</>}.</div>}
          {sm && sm.status === 'checked' && <div style={{ ...box, background: '#f0f9ff', fontSize: 13 }}><b>Form check:</b> {sm.reason}</div>}
          {sm && ['needs_you', 'unconfirmed', 'failed'].includes(sm.status) && a.status !== 'applied' && (
            <div style={{ ...box, background: sm.status === 'unconfirmed' ? '#fef2f2' : '#fffbeb', borderColor: sm.status === 'unconfirmed' ? '#fecaca' : '#fde68a', fontSize: 13, display: 'grid', gap: 4 }}>
              <b>{sm.status === 'needs_you' ? 'The agent stopped and needs you' : sm.status === 'unconfirmed' ? 'Sent, but not confirmed' : 'The agent could not do this one'}</b>
              <span>{sm.reason}</span>
              {sm.questions.length > 0 && <ul style={{ margin: '2px 0 0 18px' }}>{sm.questions.map((q) => <li key={q.label}><b>{q.label}</b>: {q.reason}</li>)}</ul>}
              <span style={hint}>Open the posting and finish it yourself, then press "I applied".</span>
            </div>)}
          {active && <div className="acq-notice" style={{ fontSize: 13 }}>{sm!.status === 'running' ? 'The agent is submitting this now.' : 'Waiting for the agent worker to pick this up.'} {sm!.status === 'queued' && <button className="acq-btn acq-btn-sm" disabled={busy} onClick={cancelSub}>Cancel</button>}</div>}
          {err && <div role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>{err}</div>}
          {fu && <div style={{ display: 'grid', gap: 6 }}><b style={{ fontSize: 13 }}>Follow-up note (you send it; the agent never emails employers)</b><textarea className="acq-input" rows={8} placeholder="Your follow-up note. Edit it before you send it yourself." value={fu} onChange={(e) => setFu(e.target.value)} /><div><button className="acq-btn acq-btn-sm" disabled={fuBusy} onClick={sentFu}><Check size={13} /> I sent this</button></div></div>}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <a className="acq-btn acq-btn-sm" href={a.job.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> Open posting</a>
            {a.status === 'prepared' && <><button className="acq-btn acq-btn-primary acq-btn-sm" disabled={busy} onClick={() => act('approve')}><Check size={13} /> {dirty ? 'Save and approve' : 'Approve'}</button>
              {dirty && <button className="acq-btn acq-btn-sm" disabled={busy} onClick={() => act()}>Save edits</button>}</>}
            {(a.status === 'prepared' || a.status === 'approved') && <button className="acq-btn acq-btn-sm" disabled={busy} onClick={() => act('applied')}><Send size={13} /> I applied myself</button>}
            {(a.status === 'prepared' || a.status === 'approved') && <button className="acq-btn acq-btn-sm" disabled={busy} onClick={() => act('reject')}><X size={13} /> Reject</button>}
            {a.status === 'approved' && supported && sub.enabled && !active && sm?.status !== 'unconfirmed' && sm?.status !== 'submitted' && <>
              <button className="acq-btn acq-btn-sm" disabled={busy} onClick={() => queue('check')}><Search size={13} /> Check the form first</button>
              {sub.permMode !== 'prepare' && <button className="acq-btn acq-btn-primary acq-btn-sm" disabled={busy} onClick={() => queue('submit')}><Bot size={13} /> {sm?.status === 'needs_you' || sm?.status === 'failed' ? 'Try again' : 'Submit for me'}</button>}</>}
            {a.status === 'applied' && <button className="acq-btn acq-btn-sm" disabled={fuBusy} onClick={draftFu}><Send size={13} /> Draft a follow-up</button>}
            {(a.status === 'approved' || a.status === 'rejected') && <button className="acq-btn acq-btn-sm" disabled={busy} onClick={() => act('reopen')}><RotateCcw size={13} /> Re-open</button>}
          </div>
        </div>
      )}
    </div>
  );
}

/** mode 'queue' = Approvals tab (what waits for a decision, with batch approve); 'all' = Applications tab (everything, with status). */
export default function ApplicationsPanel({ mode, onChanged, refreshKey, permMode }: { mode: 'queue' | 'all'; onChanged: () => void; refreshKey: number; permMode: string }) {
  const [sub, setSub] = useState<SubInfo>({ enabled: false, message: '', supported: [], permMode });
  useEffect(() => { void api<{ enabled: boolean; message: string; supported: string[] }>('/api/career/submissions').then((r) => { if (!r.error) setSub({ enabled: r.enabled, message: r.message, supported: r.supported, permMode }); }); }, [refreshKey, permMode]);
  const [rows, setRows] = useState<AppRow[] | null>(null); const [err, setErr] = useState(''); const [bErr, setBErr] = useState(''); const [open, setOpen] = useState<string | null>(null); const [sel, setSel] = useState<string[]>([]); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const r = await api<{ applications: AppRow[] }>('/api/career/applications'); if (r.error) setErr(r.error); else { setErr(''); setRows(r.applications); } }, []);
  useEffect(() => { void load(); }, [load, refreshKey]);
  if (err && !rows) return <div role="alert" style={{ display: 'grid', gap: 8, color: '#b91c1c' }}>{err}<div><button className="acq-btn acq-btn-sm" onClick={() => { setErr(''); void load(); }}>Try again</button></div></div>;
  if (!rows) return <div style={{ display: 'flex', gap: 8 }}><Loader2 size={16} className="animate-spin" /> Loading…</div>;
  const list = mode === 'queue' ? rows.filter((r) => r.status === 'prepared') : rows;
  const done = () => { void load(); onChanged(); };
  const batch = async (andSubmit = false) => { setBusy(true); const ids: string[] = []; for (const id of sel) { const r = await api(`/api/career/applications/${id}`, json('PATCH', { action: 'approve' })); if (!r.error) ids.push(id); } setBErr(''); if (andSubmit && ids.length) { const r = await api('/api/career/submissions', json('POST', { applicationIds: ids })); if (r.error) setBErr(r.error); } setBusy(false); setSel([]); done(); };
  return (
    <>
      {err && <StaleNotice onRetry={() => { setErr(''); void load(); }} />}
      {bErr && <div role="alert" style={{ color: '#b91c1c', fontSize: 13.5 }}>{bErr}</div>}
      {mode === 'queue' && <p style={{ fontSize: 13.5, color: '#475569' }}>Prepared applications wait here until you decide. Open one to read it, edit it, and approve or reject it. Approving does not send anything by itself. If you allow it, the agent can then submit approved applications on Greenhouse and Lever forms; it hands back anything it cannot answer honestly.</p>}
      {mode === 'queue' && list.length > 0 && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="acq-btn acq-btn-sm" onClick={() => setSel(sel.length === list.length ? [] : list.map((r) => r.id))}>{sel.length === list.length ? 'Clear selection' : 'Select all'}</button>
        <button className="acq-btn acq-btn-primary acq-btn-sm" disabled={!sel.length || busy} onClick={() => batch(false)}>{busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCheck size={13} />} Approve {sel.length || ''} selected</button>
        {sub.enabled && permMode !== 'prepare' && <button className="acq-btn acq-btn-primary acq-btn-sm" disabled={!sel.length || busy} onClick={() => batch(true)}><Bot size={13} /> Approve and let the agent submit {sel.length || ''}</button>}
        <span style={hint}>Batch approval is for applications you have reviewed.</span></div>}
      {list.length === 0 && <p style={hint}>{mode === 'queue' ? 'Nothing is waiting for approval.' : 'No applications yet. Open Matched opportunities and press "Prepare application" on a job.'}</p>}
      {list.map((a) => <Card key={a.id} sub={sub} a={a} open={open === a.id} onToggle={() => setOpen(open === a.id ? null : a.id)} onChanged={done} selected={sel.includes(a.id)} onSelect={mode === 'queue' ? (v) => setSel(v ? [...sel, a.id] : sel.filter((x) => x !== a.id)) : undefined} />)}
    </>
  );
}
