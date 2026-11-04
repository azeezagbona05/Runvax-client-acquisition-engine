'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarCheck, Check, Loader2, RefreshCw, Send } from 'lucide-react';
import { timeAgo } from '@/lib/acqOverview';
import { PIPELINE, REPLY_CLASSES, STAGE_INDEX, type StageId } from '@/lib/replyIntel';
import { BizLogo, Card, EmptyState, Pill, Skeleton } from './ui';
import { useAcq } from './AcqProvider';

interface Reply {
  id: string; campaignId: string; campaignName: string; leadId: string; email: string; name: string | null; business: string | null;
  subject: string | null; text: string; receivedAt: string; source: string; replyClass: string; confidence: number; classifiedBy: string;
  suggestion: string | null; suggestionBy: string | null; respondedAt: string | null; stage: StageId; demoAt: string | null; dealValue: number | null;
}

const TONE = { green: 'acq-pill-green', blue: 'acq-pill-blue', amber: 'acq-pill-amber', gray: 'acq-pill-gray', red: 'acq-pill-red' } as const;
const classInfo = (id: string) => REPLY_CLASSES.find((c) => c.id === id);
const NO_ANSWER = ['unsubscribe', 'out_of_office'];

function Stepper({ stage }: { stage: StageId }) {
  const at = STAGE_INDEX[stage];
  return (
    <ol aria-label="Acquisition pipeline" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {PIPELINE.map((p, i) => (
        <li key={p.id} title={p.hint} className="acq-pill" style={{ background: i < at ? '#dcfce7' : i === at ? '#9333ea' : '#f1f5f9', color: i < at ? '#15803d' : i === at ? '#fff' : '#64748b', gap: 4 }}>
          {i < at && <Check size={11} strokeWidth={3} />}{p.label}
        </li>
      ))}
    </ol>
  );
}

function Detail({ r, onChanged }: { r: Reply; onChanged: () => Promise<void> }) {
  const [draft, setDraft] = useState(r.suggestion ?? '');
  const [demo, setDemo] = useState(r.demoAt ? r.demoAt.slice(0, 16) : '');
  const [value, setValue] = useState(r.dealValue != null ? String(r.dealValue) : '');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const call = async (key: string, url: string, init: RequestInit, ok: string) => {
    setBusy(key); setMsg('');
    try {
      const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json' } });
      const j = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { setMsg(j.error ?? 'That did not work.'); return; }
      setMsg(ok); await onChanged();
    } catch { setMsg('Could not reach the server.'); } finally { setBusy(''); }
  };
  const stage = (st: string | null, extra: Record<string, unknown> = {}) => call(`s-${st}`, `/api/client-acquisition/pipeline/${r.leadId}`, { method: 'PATCH', body: JSON.stringify({ stage: st, ...extra }) }, st ? 'Saved. Follow-ups to this contact have stopped.' : 'Saved.');
  const saveDemo = () => call('demo', `/api/client-acquisition/pipeline/${r.leadId}`, { method: 'PATCH', body: JSON.stringify({ stage: 'demo_booked', demoAt: new Date(demo).toISOString() }) }, 'Demo recorded. Follow-ups to this contact have stopped.');
  const closed = r.stage === 'customer';

  return (
    <div style={{ padding: '4px 0 14px 46px', display: 'grid', gap: 14 }}>
      <div style={{ background: '#f8fafc', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 14px', fontSize: 13.5, whiteSpace: 'pre-wrap' }}>{r.text.slice(0, 1500)}</div>
      <Stepper stage={r.stage} />
      {!NO_ANSWER.includes(r.replyClass) && (
        <div>
          <label className="acq-sub" style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }} htmlFor={`sug-${r.id}`}>
            Suggested answer ({r.suggestionBy === 'ai' ? 'written by AI' : 'from your campaign'}). Edit it, then send. Nothing goes out until you press Send.
          </label>
          <textarea id={`sug-${r.id}`} className="acq-textarea" rows={9} value={draft} disabled={!!r.respondedAt} onChange={(e) => setDraft(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="acq-btn acq-btn-primary acq-btn-sm" disabled={!!busy || !!r.respondedAt || !draft.trim()} onClick={() => void call('send', `/api/client-acquisition/replies/${r.id}/respond`, { method: 'POST', body: JSON.stringify({ body: draft }) }, 'Sent from your mailbox.')}>
              {busy === 'send' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} {r.respondedAt ? 'Answered' : 'Send this answer'}
            </button>
            {r.respondedAt && <span className="acq-sub" style={{ fontSize: 12.5 }}>You answered {timeAgo(r.respondedAt)}.</span>}
          </div>
        </div>
      )}
      {!NO_ANSWER.includes(r.replyClass) && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div><label className="acq-sub" style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }} htmlFor={`demo-${r.id}`}>Demo date and time</label><input id={`demo-${r.id}`} type="datetime-local" className="acq-input" style={{ height: 36 }} value={demo} onChange={(e) => setDemo(e.target.value)} /></div>
          <button className="acq-btn acq-btn-sm" disabled={!demo || !!busy} onClick={() => void saveDemo()}><CalendarCheck size={14} /> Demo booked</button>
          <button className="acq-btn acq-btn-sm" disabled={!!busy} onClick={() => void stage('proposal_sent')}>Proposal sent</button>
          <div><label className="acq-sub" style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }} htmlFor={`val-${r.id}`}>Deal value (whole number)</label><input id={`val-${r.id}`} inputMode="numeric" className="acq-input" style={{ height: 36, width: 130 }} value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 9))} /></div>
          <button className="acq-btn acq-btn-green acq-btn-sm" disabled={!!busy || closed} onClick={() => void stage('customer', value ? { dealValue: Number(value) } : {})}><Check size={14} /> Customer acquired</button>
          <button className="acq-btn acq-btn-sm" style={{ color: '#64748b' }} disabled={!!busy} onClick={() => void stage('lost')}>Lost</button>
        </div>
      )}
      {msg && <p role="status" className="acq-sub" style={{ fontSize: 12.5 }}>{msg}</p>}
    </div>
  );
}

export default function Conversations() {
  const { reload } = useAcq();
  const [replies, setReplies] = useState<Reply[] | null>(null);
  const [open, setOpen] = useState('');
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/client-acquisition/replies');
      const j = await res.json() as { replies?: Reply[]; error?: string };
      if (!res.ok) { setError(j.error ?? 'Could not load replies.'); return; }
      setReplies(j.replies ?? []); setError('');
    } catch { setError('Could not load replies.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const check = async () => {
    setChecking(true); setNote('');
    try {
      const res = await fetch('/api/client-acquisition/replies/check', { method: 'POST' });
      const j = await res.json().catch(() => ({})) as { error?: string; replies?: number; scanned?: number };
      setNote(res.ok ? `Looked at ${j.scanned ?? 0} recent message${j.scanned === 1 ? '' : 's'}: ${j.replies ?? 0} new repl${j.replies === 1 ? 'y' : 'ies'} from your contacts.` : j.error ?? 'Could not check your mailbox.');
      await Promise.all([load(), reload()]);
    } catch { setNote('Could not check your mailbox.'); } finally { setChecking(false); }
  };
  const changed = async () => { await Promise.all([load(), reload()]); };

  return (
    <Card title="Conversations" right={<button className="acq-btn acq-btn-sm" disabled={checking} onClick={() => void check()}>{checking ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Check my inbox</button>}>
      {note && <p role="status" className="acq-sub" style={{ fontSize: 13, marginBottom: 8 }}>{note}</p>}
      {error && <p className="acq-warn">{error}</p>}
      {!replies && !error ? <div style={{ display: 'grid', gap: 14 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={44} />)}</div>
        : replies && replies.length === 0 ? (
          <EmptyState title="No replies yet" body="When a contact answers, press Check my inbox: RUNVAX reads your mailbox, finds replies from your campaign contacts, works out what they want, stops their follow-ups and writes a suggested answer. You can also paste a reply on the campaign page." />
        ) : (
          <div>
            {replies?.map((r) => {
              const info = classInfo(r.replyClass);
              return (
                <div key={r.id} style={{ borderTop: '1px solid var(--line)' }}>
                  <button className="acq-row" style={{ width: '100%', background: 'transparent', border: 0, textAlign: 'left', alignItems: 'center' }} aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? '' : r.id)}>
                    <BizLogo name={r.business || r.name || r.email} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.business || r.name || r.email}</p>
                      <p className="acq-sub" style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.text.replace(/\s+/g, ' ').slice(0, 110)}</p>
                    </div>
                    <span className="acq-sub" style={{ fontSize: 12.5, whiteSpace: 'nowrap' }}>{timeAgo(r.receivedAt)}</span>
                    <span className={`acq-pill ${TONE[info?.tone ?? 'gray']}`} title={`${Math.round(r.confidence * 100)}% sure, read by ${r.classifiedBy === 'ai' ? 'AI' : 'rules'}`}>{info?.label ?? r.replyClass}</span>
                    <Pill label={PIPELINE[STAGE_INDEX[r.stage]].label} tone="acq-pill-purple" />
                  </button>
                  {open === r.id && <Detail r={r} onChanged={changed} />}
                </div>
              );
            })}
          </div>
        )}
      <p className="acq-faint" style={{ fontSize: 12, marginTop: 10 }}>Part of a campaign? <Link href="/client-acquisition" style={{ textDecoration: 'underline' }}>See all campaigns</Link>. Only messages from people you have emailed are read.</p>
    </Card>
  );
}
