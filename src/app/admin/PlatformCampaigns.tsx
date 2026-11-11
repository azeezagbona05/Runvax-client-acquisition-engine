'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle, ExternalLink, Eye, Inbox, Loader2, Pause, Play, Plus, RefreshCw, Send, Sparkles, Square, Trash2, Users, X } from 'lucide-react';
import { SEND_IF_LABEL, MAX_EMAILS, MAX_WAIT_DAYS, type AutoEmail, type SendIf } from '@/lib/automation';
import { describeSegment, type Goal, type PlanKind, type PlatformPlan, type Purpose, type Segment } from '@/lib/platformCampaignShared';

interface PurposeInfo { id: Purpose; label: string; hint: string; goal: Goal; placeholder: string }
interface Meta { purposes: PurposeInfo[]; goals: Array<{ id: Goal; label: string }>; linkPages: Array<{ path: string; label: string }>; samples: Array<{ id: string; label: string; hint: string }>; aiAvailable: boolean; emailConfigured: boolean }
interface Stats { total: number; queued: number; sent: number; failed: number; skipped: number; unsubscribed: number; opened: number; clicked: number; replied: number; interested: number; needsFollowUp: number; followedUp: number; openRate: number; replyRate: number }
interface Row { id: string; name: string; purpose: string; status: string; audience: string; emails: number; stats: Stats | null; legacy: boolean }
interface StepInfo { index: number; subject: string; waitDays: number; sendIf: string; hasOpenedVariant: boolean; sent: number; due: number }
interface Lead { id: string; email: string; name: string | null; status: string; stage: string; pipelineStage: string | null; sentAt: string | null; lastSentAt: string | null; followUpsSent: number; openedAt: string | null; openCount: number; clickedAt: string | null; clickCount: number; repliedAt: string | null; replyClass: string | null; unsubscribedAt: string | null; error: string | null; followUpDue: boolean; goalReached: boolean }
interface Reply { id: string; from: string; email: string; subject: string | null; text: string; replyClass: string; receivedAt: string; suggestion: string | null }
interface Detail {
  legacy: false; id: string; name: string; purpose: string; status: string; dailyCap: number; audience: string; goal: Goal; stopOnGoal: boolean; linkPath: string; link: string; outreachCampaignId: string;
  mailbox: { ready: boolean; from: string }; automation: PlatformPlan['automation']; steps: StepInfo[]; stats: Stats; goalReached: number; leads: Lead[]; replies: Reply[];
}
interface LegacyDetail { legacy: true; id: string; name: string; status: string }

const card = 'bg-gray-900 border border-white/10 rounded-2xl p-5';
const btn = 'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50';
const input = 'w-full bg-gray-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/60';
const lbl = 'block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5';
const STATUS: Record<string, string> = { draft: 'bg-gray-500/20 text-gray-300', running: 'bg-green-500/15 text-green-400', active: 'bg-green-500/15 text-green-400', paused: 'bg-orange-500/15 text-orange-300', finished: 'bg-blue-500/15 text-blue-300', completed: 'bg-blue-500/15 text-blue-300' };
const STAGE: Record<string, { t: string; c: string }> = {
  queued: { t: 'Not sent yet', c: 'bg-gray-500/20 text-gray-300' }, sent: { t: 'Sent', c: 'bg-blue-500/15 text-blue-300' }, opened: { t: 'Opened', c: 'bg-purple-500/15 text-purple-300' },
  needs_follow_up: { t: 'Follow-up due', c: 'bg-orange-500/15 text-orange-300' }, replied: { t: 'Replied', c: 'bg-green-500/15 text-green-400' }, unsubscribed: { t: 'Unsubscribed', c: 'bg-red-500/15 text-red-300' },
  failed: { t: 'Failed', c: 'bg-red-500/15 text-red-300' }, skipped: { t: 'Skipped', c: 'bg-gray-500/20 text-gray-400' },
};
const REPLY_CLASS: Record<string, string> = { interested: 'Interested', info_request: 'Wants information', meeting_request: 'Wants a meeting', objection: 'Objection', not_interested: 'Not interested', out_of_office: 'Out of office', unsubscribe: 'Unsubscribe', other: 'Other' };
const SEND_IFS = Object.keys(SEND_IF_LABEL) as SendIf[];

const api = async <T,>(url: string, method = 'GET', body?: unknown): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> => {
  try {
    const res = await fetch(url, { method, ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) as T & { error?: string } };
  } catch { return { ok: false, status: 0, data: { error: 'Request failed' } as T & { error?: string } }; }
};
const when = (d: string | null) => (d ? new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

function Chip({ status }: { status: string }) { return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${STATUS[status] ?? STATUS.draft}`}>{status === 'completed' ? 'finished' : status}</span>; }
function Stat({ label, value, tone = 'text-white' }: { label: string; value: number | string; tone?: string }) {
  return <div className="bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5"><p className={`text-lg font-black ${tone}`}>{value}</p><p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p></div>;
}
function Num({ id, label, value, onChange }: { id: string; label: string; value: number | null; onChange: (v: number | null) => void }) {
  return <div><label htmlFor={id} className={lbl}>{label}</label><input id={id} type="number" inputMode="numeric" min={0} max={3650} placeholder="Any" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} className={input} /></div>;
}

// ───────────────────────── the editor (new campaign, and editing one) ─────────────────────────

function Editor({ plan, setPlan, meta, editing }: { plan: PlatformPlan; setPlan: (p: PlatformPlan) => void; meta: Meta; editing?: boolean }) {
  const [count, setCount] = useState<{ matching: number; optedOut: number } | null>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [previewErr, setPreviewErr] = useState('');
  const seg = plan.segment; const segKey = JSON.stringify(seg); const emails = plan.automation.emails;

  useEffect(() => {
    if (editing) return;
    let live = true; setCount(null);
    const t = setTimeout(() => { void api<{ matching: number; optedOut: number }>('/api/admin/platform-campaigns', 'POST', { action: 'audience', segment: seg }).then((r) => { if (live && r.ok) setCount(r.data); }); }, 400);
    return () => { live = false; clearTimeout(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segKey, editing]);

  const setSeg = (p: Partial<Segment>) => setPlan({ ...plan, segment: { ...seg, ...p } });
  const togglePlan = (k: PlanKind) => setSeg({ plans: seg.plans.includes(k) ? seg.plans.filter((x) => x !== k) : [...seg.plans, k] });
  const setEmails = (next: AutoEmail[]) => setPlan({ ...plan, automation: { ...plan.automation, emails: next } });
  const setEmail = (i: number, p: Partial<AutoEmail>) => setEmails(emails.map((e, j) => (j === i ? { ...e, ...p } : e)));
  const showPreview = async (e: AutoEmail) => {
    setPreviewErr(''); setPreview(null);
    const r = await api<{ subject: string; html: string }>('/api/admin/platform-campaigns', 'POST', { action: 'preview', email: { subject: e.subject, body: e.body, firstSubject: emails[0]?.subject }, linkPath: plan.linkPath });
    if (r.ok) setPreview(r.data); else setPreviewErr(r.data.error ?? 'Could not preview');
  };

  return (
    <div className="space-y-5">
      <div><label htmlFor="pc-name" className={lbl}>Campaign name</label><input id="pc-name" value={plan.name} maxLength={120} onChange={(e) => setPlan({ ...plan, name: e.target.value })} className={input} /></div>

      {editing ? (
        <p className="text-sm text-gray-400">To: {describeSegment(seg)}. The people were added when the campaign was created; to change the audience, create a new campaign.</p>
      ) : (
        <fieldset className="rounded-xl border border-white/8 p-4">
          <legend className="px-2 text-sm font-bold text-white flex items-center gap-2"><Users className="w-4 h-4 text-purple-400" /> Who gets it</legend>
          <div className="flex flex-wrap gap-2 mb-3" role="group" aria-label="Plans">
            {([['free', 'Free accounts'], ['trial', 'On a free trial'], ['paid', 'Paying']] as Array<[PlanKind, string]>).map(([k, t]) => (
              <button key={k} type="button" aria-pressed={seg.plans.includes(k)} onClick={() => togglePlan(k)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${seg.plans.includes(k) ? 'bg-purple-600 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-gray-300'}`}>{t}</button>
            ))}
            <span className="text-[11px] text-gray-500 self-center">{seg.plans.length ? '' : 'None selected = every plan'}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div><label htmlFor="pc-ver" className={lbl}>Email verified</label>
              <select id="pc-ver" value={seg.verified} onChange={(e) => setSeg({ verified: e.target.value as Segment['verified'] })} className={input}><option value="any">Either</option><option value="yes">Verified only</option><option value="no">Not verified only</option></select></div>
            <div><label htmlFor="pc-trial" className={lbl}>Free trial</label>
              <select id="pc-trial" value={seg.trial} onChange={(e) => setSeg({ trial: e.target.value as Segment['trial'] })} className={input}><option value="any">Either</option><option value="unclaimed">Never claimed it</option><option value="claimed">Already claimed it</option></select></div>
            <Num id="pc-jw" label="Joined within (days)" value={seg.joinedWithinDays} onChange={(v) => setSeg({ joinedWithinDays: v })} />
            <Num id="pc-jo" label="Joined more than (days ago)" value={seg.joinedOlderThanDays} onChange={(v) => setSeg({ joinedOlderThanDays: v })} />
            <Num id="pc-aw" label="Active within (days)" value={seg.activeWithinDays} onChange={(v) => setSeg({ activeWithinDays: v })} />
            <Num id="pc-ia" label="Not active for (days)" value={seg.inactiveForDays} onChange={(v) => setSeg({ inactiveForDays: v })} />
          </div>
          <p className="mt-3 text-sm text-gray-300" aria-live="polite">
            {count ? <><strong className="text-white">{count.matching}</strong> {count.matching === 1 ? 'person matches' : 'people match'} right now{count.optedOut ? <span className="text-gray-500"> ({count.optedOut} unsubscribed, skipped)</span> : null}. Suspended accounts are always skipped.</> : <span className="text-gray-500">Counting…</span>}
          </p>
        </fieldset>
      )}

      <fieldset className="rounded-xl border border-white/8 p-4">
        <legend className="px-2 text-sm font-bold text-white">Goal and link</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label htmlFor="pc-goal" className={lbl}>What do you want people to do?</label>
            <select id="pc-goal" value={plan.goal} onChange={(e) => setPlan({ ...plan, goal: e.target.value as Goal })} className={input}>{meta.goals.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></div>
          <div><label htmlFor="pc-link" className={lbl}>The link in the emails opens</label>
            <select id="pc-link" value={plan.linkPath} onChange={(e) => setPlan({ ...plan, linkPath: e.target.value })} className={input}>{meta.linkPages.map((p) => <option key={p.path} value={p.path}>{p.label}</option>)}</select></div>
          <div><label htmlFor="pc-cap" className={lbl}>Most emails per day</label>
            <input id="pc-cap" type="number" min={1} max={200} value={plan.automation.dailyCap} onChange={(e) => setPlan({ ...plan, automation: { ...plan.automation, dailyCap: Math.min(200, Math.max(1, Number(e.target.value) || 1)) } })} className={input} /></div>
        </div>
        {plan.goal !== 'none' && <label className="mt-3 flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={plan.stopOnGoal} onChange={(e) => setPlan({ ...plan, stopOnGoal: e.target.checked })} /> Stop following up with someone once they have done this (they are marked converted)</label>}
        <label className="mt-2 flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={plan.automation.stopOnReply} onChange={(e) => setPlan({ ...plan, automation: { ...plan.automation, stopOnReply: e.target.checked } })} /> Stop following up when someone replies</label>
      </fieldset>

      <div className="space-y-4">
        <h4 className="text-sm font-bold text-white">The workflow: the emails and the follow-ups</h4>
        {emails.map((e, i) => (
          <div key={i} className="rounded-xl border border-white/8 p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-sm font-bold text-white">{i === 0 ? 'Email 1: the introduction' : `Follow-up ${i}`}</p>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => void showPreview(e)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-gray-200"><Eye className="w-3.5 h-3.5" /> Preview</button>
                {emails.length > 1 && <button type="button" aria-label={`Remove email ${i + 1}`} onClick={() => setEmails(emails.filter((_, j) => j !== i))} className="px-2 py-1.5 rounded-lg text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>}
              </div>
            </div>
            <div className="grid gap-3">
              <div><label htmlFor={`s-sub-${i}`} className={lbl}>Subject</label><input id={`s-sub-${i}`} value={e.subject} maxLength={190} onChange={(ev) => setEmail(i, { subject: ev.target.value })} className={input} /></div>
              {i > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label htmlFor={`s-wait-${i}`} className={lbl}>Send after (days since the previous email)</label><input id={`s-wait-${i}`} type="number" min={1} max={MAX_WAIT_DAYS} value={e.waitDays} onChange={(ev) => setEmail(i, { waitDays: Math.min(MAX_WAIT_DAYS, Math.max(1, Number(ev.target.value) || 1)) })} className={input} /></div>
                  <div><label htmlFor={`s-if-${i}`} className={lbl}>Send it</label><select id={`s-if-${i}`} value={e.sendIf} onChange={(ev) => setEmail(i, { sendIf: ev.target.value as SendIf })} className={input}>{SEND_IFS.map((k) => <option key={k} value={k}>{SEND_IF_LABEL[k]}</option>)}</select></div>
                </div>
              )}
              <div><label htmlFor={`s-body-${i}`} className={lbl}>Message</label><textarea id={`s-body-${i}`} rows={9} value={e.body} maxLength={8000} onChange={(ev) => setEmail(i, { body: ev.target.value })} className={`${input} leading-relaxed`} />
                <p className="text-[11px] text-gray-600 mt-1">{'{{name}}'} is their first name. {'{{website}}'} becomes the link above, and clicks on it are counted. {i > 0 ? '{{subject}} is the first email\'s subject. ' : ''}Links can&apos;t be typed in; the signature and unsubscribe line are added for you.{e.openedVariant ? ' This follow-up has a second version that goes to people who opened but did not reply.' : ''}</p></div>
            </div>
          </div>
        ))}
        {emails.length < MAX_EMAILS && (
          <button type="button" onClick={() => setEmails([...emails, { subject: 'Re: {{subject}}', body: 'Hi {{name}},\n\n\n\n{{website}}', waitDays: 3, sendIf: 'no_reply' }])} className={`${btn} bg-white/5 border border-white/10 text-gray-200`}><Plus className="w-4 h-4" /> Add a follow-up</button>
        )}
      </div>

      {(preview || previewErr) && (
        <div role="dialog" aria-label="Email preview" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={() => { setPreview(null); setPreviewErr(''); }}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-gray-900 border border-white/10" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <p className="text-sm text-white font-semibold truncate">{preview ? `Subject: ${preview.subject}` : 'Preview'}</p>
              <button type="button" aria-label="Close preview" onClick={() => { setPreview(null); setPreviewErr(''); }} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            {previewErr ? <p role="alert" className="p-4 text-sm text-red-400">{previewErr}</p> : <iframe title="Email preview" sandbox="" srcDoc={`<body style="margin:0;padding:24px;background:#fff">${preview?.html ?? ''}</body>`} className="w-full h-[60vh] bg-white" />}
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── a new campaign ─────────────────────────

function NewCampaign({ meta, onSaved, onCancel }: { meta: Meta; onSaved: (id: string) => void; onCancel: () => void }) {
  const [purpose, setPurpose] = useState<Purpose>('announce');
  const [detail, setDetail] = useState('');
  const [useAi, setUseAi] = useState(meta.aiAvailable);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [plan, setPlan] = useState<PlatformPlan | null>(null);
  const info = meta.purposes.find((p) => p.id === purpose);

  const load = async (body: object, okNote: string) => {
    setBusy(true); setError(''); setNote('');
    const r = await api<{ plan: PlatformPlan; usedAi: boolean; aiRequestedButUnavailable: boolean }>('/api/admin/platform-campaigns', 'POST', body);
    setBusy(false);
    if (!r.ok) { setError(r.data.error ?? 'Could not write the campaign'); return; }
    setPlan(r.data.plan);
    setNote(r.data.usedAi ? 'Written by AI. Read every email before you start the campaign.' : r.data.aiRequestedButUnavailable ? 'The AI writer was not available, so the built-in writer drafted this. Edit anything you like.' : okNote);
  };
  const save = async () => {
    if (!plan) return;
    setBusy(true); setError('');
    const r = await api<{ id: string; added: number }>('/api/admin/platform-campaigns', 'POST', { action: 'create', plan });
    setBusy(false);
    if (!r.ok) { setError(r.data.error ?? 'Could not save'); return; }
    onSaved(r.data.id);
  };

  return (
    <div className={card}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold">{plan ? 'Review your campaign' : 'New campaign for your users'}</h3>
        <button type="button" onClick={onCancel} className={`${btn} text-gray-400 hover:text-white`}>Cancel</button>
      </div>
      {!plan ? (
        <div className="space-y-4">
          <div role="radiogroup" aria-label="What is the campaign for?" className="grid gap-2 sm:grid-cols-2">
            {meta.purposes.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={purpose === p.id} onClick={() => setPurpose(p.id)} className={`text-left rounded-xl border p-3 ${purpose === p.id ? 'border-purple-500 bg-purple-500/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/5'}`}>
                <p className="text-sm font-bold text-white">{p.label}</p><p className="text-xs text-gray-500 mt-0.5">{p.hint}</p>
              </button>
            ))}
          </div>
          <div><label htmlFor="pc-detail" className={lbl}>What do you want to tell them? (a sentence or two)</label>
            <textarea id="pc-detail" rows={3} value={detail} maxLength={400} onChange={(e) => setDetail(e.target.value)} placeholder={info?.placeholder} className={input} />
            <p className="text-[11px] text-gray-600 mt-1">Only facts you give here are used. The writer never invents numbers, discounts or features.</p></div>
          {meta.aiAvailable && <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} /> <Sparkles className="w-4 h-4 text-purple-400" /> Let AI write the emails (you review them before anything is sent)</label>}
          <button type="button" onClick={() => void load({ action: 'plan', purpose, detail, useAi }, 'Drafted for you. Edit anything you like.')} disabled={busy} className={`${btn} bg-purple-600 hover:bg-purple-700 text-white`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Write my campaign</button>
          {meta.samples.length > 0 && (
            <div className="border-t border-white/8 pt-4">
              <p className="text-sm font-bold text-white mb-2">Or start from a ready-made campaign</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {meta.samples.map((x) => (
                  <button key={x.id} type="button" disabled={busy} onClick={() => void load({ action: 'sample', id: x.id }, 'A ready-made campaign. Read it, change anything you like, then create it.')} className="text-left rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/5 p-3 disabled:opacity-50">
                    <p className="text-sm font-bold text-white">{x.label}</p><p className="text-xs text-gray-500 mt-0.5">{x.hint}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {note && <p className="text-xs text-purple-300">{note}</p>}
          <Editor plan={plan} setPlan={setPlan} meta={meta} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void save()} disabled={busy} className={`${btn} bg-purple-600 hover:bg-purple-700 text-white`}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Create campaign</button>
            <button type="button" onClick={() => setPlan(null)} disabled={busy} className={`${btn} bg-white/5 border border-white/10 text-gray-200`}>Start over</button>
          </div>
          <p className="text-xs text-gray-500">Creating the campaign adds the matching people as its contacts. It sends nothing. Next you can send yourself a test, then start it.</p>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-400 mt-3">{error}</p>}
    </div>
  );
}

// ───────────────────────── one campaign ─────────────────────────

/** Sends in batches (typed SEND first), with progress and a stop button, until nobody is left or the daily cap stops it. */
function SendBox({ id, kind, count, label, disabled, disabledWhy, onDone }: { id: string; kind: 'initial' | 'followup'; count: number; label: string; disabled: boolean; disabledWhy?: string; onDone: () => void }) {
  const [confirming, setConfirming] = useState(false); const [word, setWord] = useState('');
  const [running, setRunning] = useState(false); const [progress, setProgress] = useState({ sent: 0, failed: 0 });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null); const stop = useRef(false);

  const sendAll = async () => {
    setRunning(true); setMsg(null); stop.current = false;
    let sent = 0, failed = 0; setProgress({ sent, failed });
    for (;;) {
      const r = await api<{ sent: number; failed: number; skipped: number; leftToSend: number; capReached: boolean; stoppedByGoal: number }>(`/api/admin/platform-campaigns/${id}/send`, 'POST', { action: 'send', kind, confirm: 'SEND' });
      if (!r.ok) { setMsg({ ok: false, text: r.data.error ?? 'Failed' }); break; }
      sent += r.data.sent; failed += r.data.failed; setProgress({ sent, failed });
      const done = r.data.leftToSend === 0;
      if (done || r.data.capReached || (r.data.sent === 0 && r.data.failed === 0) || stop.current) {
        setMsg({ ok: done && failed === 0, text: done ? `Done. ${sent} sent${failed ? `, ${failed} failed` : ''}${r.data.stoppedByGoal ? `, ${r.data.stoppedByGoal} left alone because they reached the goal` : ''}.` : r.data.capReached ? `Daily cap reached. ${sent} sent, ${r.data.leftToSend} left for tomorrow.` : `Stopped. ${sent} sent, ${r.data.leftToSend} still to go.` });
        break;
      }
    }
    setRunning(false); setConfirming(false); setWord(''); onDone();
  };

  return (
    <div>
      {!confirming && !running && <button type="button" onClick={() => setConfirming(true)} disabled={disabled || count === 0} className={`${btn} bg-purple-600 hover:bg-purple-700 text-white`}><Play className="w-4 h-4" /> {label}</button>}
      {disabled && disabledWhy && <p className="text-xs text-orange-300 mt-2">{disabledWhy}</p>}
      {confirming && !running && (
        <div className="mt-2 rounded-xl border border-orange-500/30 bg-orange-500/[0.06] p-4">
          <p className="text-sm text-orange-300 font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> This emails {count} real {count === 1 ? 'user' : 'users'} and can&apos;t be undone.</p>
          <p className="text-xs text-gray-400 mt-1">Check the test email first. Type SEND to confirm.</p>
          <div className="flex gap-2 mt-3">
            <input value={word} onChange={(e) => setWord(e.target.value)} placeholder="SEND" aria-label="Type SEND to confirm" className="w-28 bg-gray-800/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/60" />
            <button type="button" onClick={() => void sendAll()} disabled={word !== 'SEND'} className={`${btn} bg-orange-600 hover:bg-orange-500 text-white`}>Send now</button>
            <button type="button" onClick={() => { setConfirming(false); setWord(''); }} className={`${btn} text-gray-400 hover:text-white`}>Cancel</button>
          </div>
        </div>
      )}
      {running && (
        <div className="mt-2 flex items-center gap-3 rounded-xl border border-purple-500/25 bg-purple-500/[0.06] p-4">
          <Loader2 className="w-4 h-4 text-purple-400 animate-spin flex-shrink-0" />
          <p className="text-sm text-gray-200 flex-1">Sending… {progress.sent} sent{progress.failed ? `, ${progress.failed} failed` : ''}. Keep this tab open.</p>
          <button type="button" onClick={() => { stop.current = true; }} className={`${btn} bg-white/5 text-gray-200 border border-white/10`}><Square className="w-3.5 h-3.5" /> Stop after this batch</button>
        </div>
      )}
      {msg && <p role="status" className={`text-sm mt-2 flex items-center gap-2 ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.ok && <CheckCircle className="w-4 h-4" />}{msg.text}</p>}
    </div>
  );
}

type Tab = 'workflow' | 'people' | 'replies';
const FILTERS: Array<{ id: string; label: string; test: (l: Lead) => boolean }> = [
  { id: 'all', label: 'Everyone', test: () => true },
  { id: 'opened', label: 'Opened', test: (l) => !!l.openedAt },
  { id: 'clicked', label: 'Clicked', test: (l) => !!l.clickedAt },
  { id: 'replied', label: 'Replied', test: (l) => !!l.repliedAt },
  { id: 'due', label: 'Follow-up due', test: (l) => l.followUpDue },
  { id: 'noopen', label: 'Sent, not opened', test: (l) => !!l.sentAt && !l.openedAt },
  { id: 'unsub', label: 'Unsubscribed', test: (l) => !!l.unsubscribedAt },
  { id: 'queued', label: 'Not sent yet', test: (l) => l.status === 'queued' },
  { id: 'failed', label: 'Failed', test: (l) => l.status === 'failed' || l.status === 'skipped' },
];

function CampaignDetail({ id, meta, onBack }: { id: string; meta: Meta; onBack: () => void }) {
  const [d, setD] = useState<Detail | LegacyDetail | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('workflow');
  const [editing, setEditing] = useState<PlatformPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all'); const [q, setQ] = useState('');
  const [startWord, setStartWord] = useState(''); const [starting, setStarting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null); const [testing, setTesting] = useState<number | null>(null);
  const [inboxMsg, setInboxMsg] = useState<{ ok: boolean; text: string } | null>(null); const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    const r = await api<Detail | LegacyDetail>(`/api/admin/platform-campaigns/${id}`);
    if (r.ok) { setD(r.data); setError(''); } else setError(r.data.error ?? 'Could not load');
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const patch = async (body: object) => {
    setBusy(true); setError('');
    const r = await api(`/api/admin/platform-campaigns/${id}`, 'PATCH', body);
    setBusy(false);
    if (!r.ok) { setError(r.data.error ?? 'Could not save'); return false; }
    await load(); return true;
  };
  const remove = async () => {
    if (!window.confirm('Delete this campaign? It has not sent anything.')) return;
    const r = await api(`/api/admin/platform-campaigns/${id}`, 'DELETE');
    if (r.ok) onBack(); else setError(r.data.error ?? 'Could not delete');
  };
  const test = async (step: number) => {
    setTesting(step); setTestMsg(null);
    const r = await api<{ sentTo: string }>(`/api/admin/platform-campaigns/${id}/send`, 'POST', { action: 'test', step });
    setTestMsg(r.ok ? { ok: true, text: `Test of email ${step + 1} sent to ${r.data.sentTo}. Check your inbox and spam.` } : { ok: false, text: r.data.error ?? 'Failed' });
    setTesting(null);
  };
  const checkInbox = async () => {
    setChecking(true); setInboxMsg(null);
    const r = await api<{ scanned: number; replies: number }>(`/api/admin/platform-campaigns/${id}/replies`, 'POST');
    setInboxMsg(r.ok ? { ok: true, text: `Looked at ${r.data.scanned} messages. ${r.data.replies} new ${r.data.replies === 1 ? 'reply' : 'replies'}.` } : { ok: false, text: r.data.error ?? 'Could not read the mailbox' });
    setChecking(false); if (r.ok) await load();
  };
  const startRun = async () => {
    setStarting(true);
    const ok = await patch({ action: 'run', confirm: 'SEND' });
    setStarting(false); setStartWord(''); if (ok) setTab('workflow');
  };

  if (!d) return <div className={card}>{error ? <p role="alert" className="text-sm text-red-400">{error}</p> : <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />}</div>;
  if (d.legacy) return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white"><ArrowLeft className="w-4 h-4" /> All campaigns</button>
      <div className={card}><h3 className="text-white font-bold">{d.name}</h3>
        <p className="text-sm text-gray-400 mt-2">This was created with the first, simpler version of the builder, which had no follow-up workflow or tracking. Create it again with <strong className="text-gray-200">New campaign</strong> to get the full workflow.</p>
        <button type="button" onClick={() => void remove()} className={`${btn} text-red-400 hover:text-red-300 mt-3`}><Trash2 className="w-4 h-4" /> Delete</button>
        {error && <p role="alert" className="text-sm text-red-400 mt-2">{error}</p>}</div>
    </div>
  );

  const s = d.stats; const running = d.status === 'running'; const started = d.status !== 'draft';
  const dueFollowUps = s.needsFollowUp; const queued = s.queued;
  const rows = d.leads.filter((l) => (FILTERS.find((f) => f.id === filter) ?? FILTERS[0]).test(l)).filter((l) => !q.trim() || `${l.name ?? ''} ${l.email}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white"><ArrowLeft className="w-4 h-4" /> All campaigns</button>
      <div className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><h3 className="text-white font-bold">{d.name}</h3><Chip status={d.status} /></div>
            <p className="text-xs text-gray-500 mt-1">To: {d.audience}. Goal: {meta.goals.find((g) => g.id === d.goal)?.label}. Up to {d.dailyCap} emails a day for this campaign (and 200 a day across your account).</p>
            <p className="text-xs text-gray-500 mt-0.5">{d.mailbox.ready ? <>Sends from <strong className="text-gray-300">{d.mailbox.from}</strong>, and replies are read from the same mailbox.</> : <span className="text-orange-300">No sending mailbox is set up on this server, so nothing can be sent.</span>}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`/client-acquisition/campaigns/${d.outreachCampaignId}`} target="_blank" rel="noopener noreferrer" className={`${btn} bg-white/5 border border-white/10 text-gray-200`}><ExternalLink className="w-4 h-4" /> Full workflow</a>
            {!editing && d.status !== 'finished' && <button type="button" onClick={() => setEditing({ name: d.name, purpose: d.purpose as Purpose, goal: d.goal, stopOnGoal: d.stopOnGoal, segment: {} as Segment, linkPath: d.linkPath, automation: d.automation })} className={`${btn} bg-white/5 border border-white/10 text-gray-200`}>Edit</button>}
            {d.status === 'paused' && <button type="button" disabled={busy} onClick={() => void patch({ action: 'resume' })} className={`${btn} bg-green-600 hover:bg-green-500 text-white`}><Play className="w-4 h-4" /> Resume</button>}
            {running && <button type="button" disabled={busy} onClick={() => void patch({ action: 'pause' })} className={`${btn} bg-white/5 border border-white/10 text-gray-200`}><Pause className="w-4 h-4" /> Pause</button>}
            {started && d.status !== 'finished' && <button type="button" disabled={busy} onClick={() => { if (window.confirm('Mark this campaign finished? No more emails will go out from it.')) void patch({ action: 'finish' }); }} className={`${btn} bg-white/5 border border-white/10 text-gray-200`}>Mark finished</button>}
            {s.sent === 0 && <button type="button" onClick={() => void remove()} className={`${btn} text-red-400 hover:text-red-300`}><Trash2 className="w-4 h-4" /> Delete</button>}
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-red-400 mt-3">{error}</p>}
      </div>

      {editing ? (
        <div className={card}>
          <Editor plan={{ ...editing, segment: { plans: [], verified: 'any', trial: 'any', joinedWithinDays: null, joinedOlderThanDays: null, activeWithinDays: null, inactiveForDays: null } }} setPlan={setEditing} meta={meta} editing />
          <div className="flex gap-2 mt-5">
            <button type="button" disabled={busy} onClick={async () => { if (await patch({ name: editing.name, plan: editing })) setEditing(null); }} className={`${btn} bg-purple-600 hover:bg-purple-700 text-white`}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Save changes</button>
            <button type="button" onClick={() => setEditing(null)} className={`${btn} text-gray-400 hover:text-white`}>Cancel</button>
          </div>
          <p className="text-xs text-gray-500 mt-2">Changes apply to emails that have not been sent yet.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            <Stat label="People" value={s.total} /><Stat label="Sent" value={s.sent} /><Stat label="Opened" value={`${s.opened}${s.sent ? ` · ${s.openRate}%` : ''}`} />
            <Stat label="Clicked" value={s.clicked} /><Stat label="Replied" value={s.replied} tone="text-green-400" /><Stat label="Interested" value={s.interested} tone="text-green-400" />
            <Stat label="Follow-up due" value={dueFollowUps} tone={dueFollowUps ? 'text-orange-300' : 'text-white'} /><Stat label="Unsubscribed" value={s.unsubscribed} />
          </div>
          {d.goal !== 'none' && d.goalReached > 0 && <p className="text-xs text-green-400">{d.goalReached} {d.goalReached === 1 ? 'person has' : 'people have'} already done the goal{d.stopOnGoal ? ' and will not be followed up' : ''}.</p>}

          <div className="acq-seg flex gap-1 rounded-xl bg-white/5 p-1 w-fit" role="tablist" aria-label="Campaign sections">
            {([['workflow', 'Workflow'], ['people', `People (${s.total})`], ['replies', `Replies (${d.replies.length})`]] as Array<[Tab, string]>).map(([t, l]) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold ${tab === t ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>{l}</button>
            ))}
          </div>

          {tab === 'workflow' && (
            <div className="space-y-3">
              {!started && (
                <div className={card}>
                  <h4 className="text-white font-bold text-sm">Start the campaign</h4>
                  <p className="text-xs text-gray-500 mt-1">Send yourself a test of every email first (below). Starting lets you send the first email to all {queued} {queued === 1 ? 'person' : 'people'}, and the follow-ups as they come due. Nothing is sent until you confirm each send.</p>
                  <div className="flex gap-2 mt-3">
                    <input value={startWord} onChange={(e) => setStartWord(e.target.value)} placeholder="SEND" aria-label="Type SEND to start" className="w-28 bg-gray-800/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/60" />
                    <button type="button" disabled={startWord !== 'SEND' || starting || !d.mailbox.ready} onClick={() => void startRun()} className={`${btn} bg-orange-600 hover:bg-orange-500 text-white`}>{starting && <Loader2 className="w-4 h-4 animate-spin" />} Start campaign</button>
                  </div>
                </div>
              )}
              {d.steps.map((st) => (
                <div key={st.index} className={card}>
                  <p className="text-xs font-bold uppercase tracking-wide text-purple-400">{st.index === 0 ? 'Email 1 · Day 1 · the introduction' : `Follow-up ${st.index} · ${st.waitDays} ${st.waitDays === 1 ? 'day' : 'days'} after the previous · ${SEND_IF_LABEL[st.sendIf as SendIf] ?? st.sendIf}`}</p>
                  <h4 className="text-white font-bold text-sm mt-1">{st.subject}</h4>
                  {st.hasOpenedVariant && <p className="text-[11px] text-gray-500 mt-0.5">Has a second version for people who opened the last email but did not reply.</p>}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                    <Stat label="Sent" value={st.sent} /><Stat label={st.index === 0 ? 'Waiting to send' : 'Due now'} value={st.due} tone={st.due ? 'text-orange-300' : 'text-white'} />
                  </div>
                  <div className="mt-3"><button type="button" onClick={() => void test(st.index)} disabled={testing !== null} className={`${btn} bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200`}>{testing === st.index ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send test to me</button></div>
                </div>
              ))}
              {testMsg && <p role="status" className={`text-sm flex items-center gap-2 ${testMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{testMsg.ok && <CheckCircle className="w-4 h-4" />}{testMsg.text}</p>}
              <div className={card}>
                <h4 className="text-white font-bold text-sm">Send</h4>
                <div className="grid gap-4 sm:grid-cols-2 mt-3">
                  <div><p className="text-xs text-gray-500 mb-2">First emails not sent yet: <strong className="text-gray-200">{queued}</strong></p>
                    <SendBox id={id} kind="initial" count={queued} label={`Send the first email to ${queued} ${queued === 1 ? 'person' : 'people'}`} disabled={!running} disabledWhy={!started ? 'Start the campaign first.' : d.status === 'paused' ? 'The campaign is paused.' : d.status === 'finished' ? 'The campaign is finished.' : undefined} onDone={() => void load()} /></div>
                  <div><p className="text-xs text-gray-500 mb-2">Follow-ups due now: <strong className={dueFollowUps ? 'text-orange-300' : 'text-gray-200'}>{dueFollowUps}</strong> (each person gets their own next email, only if its condition is met)</p>
                    <SendBox id={id} kind="followup" count={dueFollowUps} label={`Send ${dueFollowUps} due ${dueFollowUps === 1 ? 'follow-up' : 'follow-ups'}`} disabled={!started || d.status === 'paused' || d.status === 'finished'} disabledWhy={!started ? 'Start the campaign first.' : undefined} onDone={() => void load()} /></div>
                </div>
                <p className="text-xs text-gray-500 mt-3">Follow-ups are sent when you ask for them, the same as in the customer campaign builder. They stop for anyone who replies, unsubscribes{d.stopOnGoal && d.goal !== 'none' ? ' or reaches the goal' : ''}. Out-of-office replies only pause them.</p>
              </div>
            </div>
          )}

          {tab === 'people' && (
            <div className={card}>
              <div className="flex flex-wrap gap-1.5 mb-3" role="group" aria-label="Filter people">
                {FILTERS.map((f) => { const n = d.leads.filter(f.test).length; return <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${filter === f.id ? 'bg-purple-600 border-purple-500 text-white' : 'bg-white/5 border-white/10 text-gray-300'}`}>{f.label} <span className="opacity-70">{n}</span></button>; })}
              </div>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or email" aria-label="Search people" className={`${input} mb-3 max-w-sm`} />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-[10px] uppercase tracking-wide text-gray-500"><th className="py-2 pr-3">Person</th><th className="pr-3">Status</th><th className="pr-3">Email</th><th className="pr-3">Opened</th><th className="pr-3">Clicked</th><th className="pr-3">Reply</th><th>Last sent</th></tr></thead>
                  <tbody className="divide-y divide-white/5">
                    {rows.slice(0, 200).map((l) => { const st = STAGE[l.stage] ?? STAGE.sent; return (
                      <tr key={l.id}>
                        <td className="py-2 pr-3"><p className="text-white font-semibold">{l.name || l.email}</p>{l.name && <p className="text-[11px] text-gray-500">{l.email}</p>}</td>
                        <td className="pr-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${st.c}`}>{st.t}</span>{l.pipelineStage === 'customer' && <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/15 text-green-400">Converted</span>}</td>
                        <td className="pr-3 text-gray-300">{l.sentAt ? `${Math.min(l.followUpsSent + 1, d.steps.length)} of ${d.steps.length}` : '–'}</td>
                        <td className="pr-3 text-gray-300">{l.openedAt ? `${l.openCount}× · ${when(l.openedAt)}` : '–'}</td>
                        <td className="pr-3 text-gray-300">{l.clickedAt ? `${l.clickCount}× · ${when(l.clickedAt)}` : '–'}</td>
                        <td className="pr-3 text-gray-300">{l.repliedAt ? (REPLY_CLASS[l.replyClass ?? ''] ?? 'Replied') : '–'}</td>
                        <td className="text-gray-400 text-xs">{when(l.lastSentAt)}{l.error ? <span className="block text-red-400" title={l.error}>{l.error.slice(0, 40)}</span> : null}</td>
                      </tr>); })}
                  </tbody>
                </table>
              </div>
              {rows.length === 0 && <p className="text-sm text-gray-500 py-4">Nobody matches this filter.</p>}
              {rows.length > 200 && <p className="text-xs text-gray-500 mt-2">Showing the first 200 of {rows.length}. Use the search box to find someone.</p>}
              <p className="text-[11px] text-gray-600 mt-3">Opens are counted when a mail app loads the tiny tracking image, so they are a good guide, not a guarantee (some apps block it, some load it automatically).</p>
            </div>
          )}

          {tab === 'replies' && (
            <div className={card}>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <button type="button" onClick={() => void checkInbox()} disabled={checking || !d.mailbox.ready} className={`${btn} bg-purple-600 hover:bg-purple-700 text-white`}>{checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Check inbox for replies</button>
                <a href={`/client-acquisition/campaigns/${d.outreachCampaignId}`} target="_blank" rel="noopener noreferrer" className="text-sm text-purple-300 hover:text-purple-200 flex items-center gap-1.5"><Inbox className="w-4 h-4" /> Answer replies in the full workflow</a>
              </div>
              {inboxMsg && <p role="status" className={`text-sm mb-3 ${inboxMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{inboxMsg.text}</p>}
              {d.replies.length === 0 ? <p className="text-sm text-gray-500">No replies yet. Replies are read from the sending mailbox when you press the button, matched to the people in this campaign, sorted (interested, wants information, objection, out of office, unsubscribe) and follow-ups to that person stop.</p> : (
                <div className="space-y-3">
                  {d.replies.map((r) => (
                    <div key={r.id} className="rounded-xl border border-white/8 p-3">
                      <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-white">{r.from}</p><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/15 text-green-400">{REPLY_CLASS[r.replyClass] ?? r.replyClass}</span><span className="text-[11px] text-gray-500">{when(r.receivedAt)}</span></div>
                      {r.subject && <p className="text-xs text-gray-500 mt-0.5">{r.subject}</p>}
                      <p className="text-sm text-gray-300 mt-2 whitespace-pre-wrap">{r.text}</p>
                      {r.suggestion && <details className="mt-2"><summary className="text-xs text-purple-300 cursor-pointer">Suggested reply</summary><p className="text-xs text-gray-400 mt-1 whitespace-pre-wrap">{r.suggestion}</p></details>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ───────────────────────── the section ─────────────────────────

export default function PlatformCampaigns() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<'list' | 'new' | string>('list');
  const load = useCallback(async () => {
    const r = await api<{ campaigns: Row[] } & Meta>('/api/admin/platform-campaigns');
    if (!r.ok) { setError(r.data.error ?? 'Could not load campaigns'); return; }
    setError(''); setRows(r.data.campaigns);
    setMeta({ purposes: r.data.purposes, goals: r.data.goals, linkPages: r.data.linkPages, samples: r.data.samples ?? [], aiAvailable: r.data.aiAvailable, emailConfigured: r.data.emailConfigured });
  }, []);
  useEffect(() => { void load(); }, [load]);
  const back = () => { setView('list'); void load(); };

  return (
    <section aria-labelledby="pc-h" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 id="pc-h" className="text-base font-bold text-white">Campaigns for your users</h2>
          <p className="text-xs text-gray-500 mt-0.5">The same campaign builder customers use: a sequence of emails with timed follow-ups, open and click tracking, replies sorted for you. Here the contacts are your own users. Nothing is sent until you confirm.</p></div>
        {view === 'list' && meta && <button type="button" onClick={() => setView('new')} className={`${btn} bg-purple-600 hover:bg-purple-700 text-white`}><Plus className="w-4 h-4" /> New campaign</button>}
      </div>

      {error && <div role="alert" className="rounded-xl border border-orange-500/30 bg-orange-500/[0.06] p-4 text-sm text-orange-300">{error}</div>}
      {meta && !meta.emailConfigured && <div role="alert" className="rounded-xl border border-orange-500/30 bg-orange-500/[0.06] p-4 text-sm text-orange-300">Email isn&apos;t configured on this server, so nothing can be sent from here.</div>}
      {!rows && !error && <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 text-purple-400 animate-spin" /></div>}

      {view === 'new' && meta && <NewCampaign meta={meta} onCancel={back} onSaved={(id) => setView(id)} />}
      {view !== 'list' && view !== 'new' && meta && <CampaignDetail id={view} meta={meta} onBack={back} />}

      {view === 'list' && rows && (rows.length === 0 ? (
        <div className={`${card} text-sm text-gray-400`}>No campaigns yet. Use <strong className="text-gray-200">New campaign</strong> to write one for a purpose, or start from a ready-made one such as announcing RUNVAX 2.0.</div>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <button key={r.id} type="button" onClick={() => setView(r.id)} className={`${card} text-left hover:border-purple-500/40 transition-colors`}>
              <div className="flex items-center gap-2"><h3 className="text-white font-bold text-sm">{r.name}</h3><Chip status={r.status} />{r.legacy && <span className="text-[10px] text-orange-300">old format</span>}</div>
              <p className="text-xs text-gray-500 mt-1">To: {r.audience}</p>
              {r.stats && <p className="text-xs text-gray-400 mt-2">{r.emails} emails · {r.stats.total} people · {r.stats.sent} sent · {r.stats.opened} opened · {r.stats.clicked} clicked · {r.stats.replied} replied{r.stats.needsFollowUp ? ` · ${r.stats.needsFollowUp} follow-ups due` : ''}</p>}
            </button>
          ))}
        </div>
      ))}
    </section>
  );
}
