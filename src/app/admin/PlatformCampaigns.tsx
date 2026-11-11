'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle, Eye, Loader2, Pause, Play, Plus, Send, Sparkles, Square, Trash2, Users, X } from 'lucide-react';
import { GOALS, MAX_STEPS, MAX_WAIT_DAYS, MAX_DAILY_CAP, type CampaignConfig, type Goal, type PlanKind, type Purpose, type Segment, type Step } from '@/lib/platformCampaignShared';

interface PurposeInfo { id: Purpose; label: string; hint: string; goal: Goal; placeholder: string }
interface Row { id: string; name: string; purpose: string; status: string; emails: number; perStep: number[]; audience: string; updatedAt: string }
interface StepStats { sent: number; matching: number; eligible: number; waiting: number; notReached: number; goalReached: number; optedOut: number }
interface Detail { campaign: { id: string; name: string; purpose: string; status: string; config: CampaignConfig }; steps: StepStats[]; last24h: number; audience: string }

const card = 'bg-gray-900 border border-white/10 rounded-2xl p-5';
const btn = 'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50';
const input = 'w-full bg-gray-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/60';
const lbl = 'block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5';
const CTA_PAGES = [{ v: '', t: 'No button' }, { v: '/client-acquisition', t: 'Client Acquisition home' }, { v: '/client-acquisition/find', t: 'Find Prospects' }, { v: '/client-acquisition/campaigns', t: 'Campaigns' }, { v: '/client-acquisition/agents', t: 'AI Agents' }, { v: '/claim-pro', t: 'Claim free Pro page' }, { v: '/auth/signin', t: 'Sign-in page' }];
const STATUS: Record<string, string> = { draft: 'bg-gray-500/20 text-gray-300', active: 'bg-green-500/15 text-green-400', paused: 'bg-orange-500/15 text-orange-300', finished: 'bg-blue-500/15 text-blue-300' };

const api = async <T,>(url: string, method = 'GET', body?: unknown): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> => {
  try {
    const res = await fetch(url, { method, ...(body !== undefined ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) as T & { error?: string } };
  } catch { return { ok: false, status: 0, data: { error: 'Request failed' } as T & { error?: string } }; }
};

function Chip({ status }: { status: string }) { return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${STATUS[status] ?? STATUS.draft}`}>{status}</span>; }
function Num({ id, label, value, onChange, min = 0, max = 3650, placeholder }: { id: string; label: string; value: number | null; onChange: (v: number | null) => void; min?: number; max?: number; placeholder?: string }) {
  return (
    <div>
      <label htmlFor={id} className={lbl}>{label}</label>
      <input id={id} type="number" inputMode="numeric" min={min} max={max} placeholder={placeholder ?? 'Any'} value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} className={input} />
    </div>
  );
}

// ───────────────────────── the editor (used for a new campaign and for editing one) ─────────────────────────

function Editor({ name, setName, cfg, setCfg, lockedSteps = [] }: { name: string; setName: (v: string) => void; cfg: CampaignConfig; setCfg: (c: CampaignConfig) => void; lockedSteps?: boolean[] }) {
  const [count, setCount] = useState<{ matching: number; verified: number; optedOut: number } | null>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [previewErr, setPreviewErr] = useState('');
  const seg = cfg.segment;
  const segKey = JSON.stringify(seg);

  useEffect(() => {
    let live = true; setCount(null);
    const t = setTimeout(() => { void api<{ matching: number; verified: number; optedOut: number }>('/api/admin/platform-campaigns', 'POST', { action: 'audience', segment: seg }).then((r) => { if (live && r.ok) setCount(r.data); }); }, 400);
    return () => { live = false; clearTimeout(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segKey]);

  const setSeg = (p: Partial<Segment>) => setCfg({ ...cfg, segment: { ...seg, ...p } });
  const togglePlan = (k: PlanKind) => setSeg({ plans: seg.plans.includes(k) ? seg.plans.filter((x) => x !== k) : [...seg.plans, k] });
  const setStep = (i: number, p: Partial<Step>) => setCfg({ ...cfg, steps: cfg.steps.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const showPreview = async (s: Step) => {
    setPreviewErr(''); setPreview(null);
    const r = await api<{ subject: string; html: string }>('/api/admin/platform-campaigns', 'POST', { action: 'preview', step: s });
    if (r.ok) setPreview(r.data); else setPreviewErr(r.data.error ?? 'Could not preview');
  };

  return (
    <div className="space-y-5">
      <div><label htmlFor="pc-name" className={lbl}>Campaign name</label><input id="pc-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} className={input} /></div>

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

      <fieldset className="rounded-xl border border-white/8 p-4">
        <legend className="px-2 text-sm font-bold text-white">Goal</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2"><label htmlFor="pc-goal" className={lbl}>What do you want people to do?</label>
            <select id="pc-goal" value={cfg.goal} onChange={(e) => setCfg({ ...cfg, goal: e.target.value as Goal })} className={input}>{GOALS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></div>
          <Num id="pc-cap" label="Daily cap (emails per 24h)" value={cfg.dailyCap} min={1} max={MAX_DAILY_CAP} onChange={(v) => setCfg({ ...cfg, dailyCap: v ?? 200 })} />
        </div>
        {cfg.goal !== 'none' && (
          <label className="mt-3 flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={cfg.stopOnGoal} onChange={(e) => setCfg({ ...cfg, stopOnGoal: e.target.checked })} /> Stop emailing someone once they have done this</label>
        )}
      </fieldset>

      <div className="space-y-4">
        <h4 className="text-sm font-bold text-white">The emails</h4>
        {cfg.steps.map((s, i) => {
          const locked = !!lockedSteps[i];
          return (
            <div key={i} className="rounded-xl border border-white/8 p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-sm font-bold text-white">Email {i + 1}{locked && <span className="ml-2 text-[11px] font-semibold text-gray-500">already sent, can&apos;t be changed</span>}</p>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => void showPreview(s)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 text-gray-200"><Eye className="w-3.5 h-3.5" /> Preview</button>
                  {!locked && cfg.steps.length > 1 && <button type="button" aria-label={`Remove email ${i + 1}`} onClick={() => setCfg({ ...cfg, steps: cfg.steps.filter((_, j) => j !== i) })} className="px-2 py-1.5 rounded-lg text-gray-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>}
                </div>
              </div>
              <div className="grid gap-3">
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="sm:col-span-3"><label htmlFor={`s-sub-${i}`} className={lbl}>Subject</label><input id={`s-sub-${i}`} disabled={locked} value={s.subject} maxLength={120} onChange={(e) => setStep(i, { subject: e.target.value })} className={input} /></div>
                  {i > 0 && <div><label htmlFor={`s-wait-${i}`} className={lbl}>Send after (days)</label><input id={`s-wait-${i}`} disabled={locked} type="number" min={0} max={MAX_WAIT_DAYS} value={s.waitDays} onChange={(e) => setStep(i, { waitDays: Number(e.target.value) })} className={input} /></div>}
                </div>
                <div><label htmlFor={`s-body-${i}`} className={lbl}>Message</label><textarea id={`s-body-${i}`} disabled={locked} rows={8} value={s.body} maxLength={2500} onChange={(e) => setStep(i, { body: e.target.value })} className={`${input} leading-relaxed`} />
                  <p className="text-[11px] text-gray-600 mt-1">Blank line = new paragraph. Start lines with “- ” for bullets. You can use {'{{name}}'}, {'{{appName}}'}, {'{{trialDays}}'} and {'{{plan}}'}. Links aren&apos;t allowed in the text; use the button.</p></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label htmlFor={`s-cta-${i}`} className={lbl}>Button goes to</label>
                    <select id={`s-cta-${i}`} disabled={locked} value={s.ctaPath} onChange={(e) => setStep(i, { ctaPath: e.target.value, ctaLabel: e.target.value ? (s.ctaLabel || 'Open {{appName}}') : '' })} className={input}>{CTA_PAGES.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}</select></div>
                  {s.ctaPath && <div><label htmlFor={`s-ctal-${i}`} className={lbl}>Button text</label><input id={`s-ctal-${i}`} disabled={locked} value={s.ctaLabel} maxLength={40} onChange={(e) => setStep(i, { ctaLabel: e.target.value })} className={input} /></div>}
                </div>
              </div>
            </div>
          );
        })}
        {cfg.steps.length < MAX_STEPS && (
          <button type="button" onClick={() => setCfg({ ...cfg, steps: [...cfg.steps, { subject: '', body: 'Hi {{name}},\n\n\n\nThe {{appName}} team', waitDays: 3, ctaLabel: '', ctaPath: '' }] })} className={`${btn} bg-white/5 border border-white/10 text-gray-200`}><Plus className="w-4 h-4" /> Add a follow-up email</button>
        )}
      </div>

      {(preview || previewErr) && (
        <div role="dialog" aria-label="Email preview" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={() => { setPreview(null); setPreviewErr(''); }}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-gray-900 border border-white/10" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <p className="text-sm text-white font-semibold truncate">{preview ? `Subject: ${preview.subject}` : 'Preview'}</p>
              <button type="button" aria-label="Close preview" onClick={() => { setPreview(null); setPreviewErr(''); }} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            {previewErr ? <p role="alert" className="p-4 text-sm text-red-400">{previewErr}</p> : <iframe title="Email preview" sandbox="" srcDoc={preview?.html} className="w-full h-[70vh] bg-white" />}
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── a new campaign ─────────────────────────

function NewCampaign({ purposes, samples, aiAvailable, onSaved, onCancel }: { purposes: PurposeInfo[]; samples: Array<{ id: string; label: string; hint: string }>; aiAvailable: boolean; onSaved: (id: string) => void; onCancel: () => void }) {
  const [purpose, setPurpose] = useState<Purpose>('announce');
  const [detail, setDetail] = useState('');
  const [useAi, setUseAi] = useState(aiAvailable);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [draft, setDraft] = useState<{ name: string; config: CampaignConfig } | null>(null);
  const [pickedPurpose, setPickedPurpose] = useState<Purpose | null>(null);
  const info = purposes.find((p) => p.id === purpose);

  const write = async () => {
    setBusy(true); setError(''); setNote('');
    const r = await api<{ name: string; config: CampaignConfig; usedAi: boolean; aiRequestedButUnavailable: boolean }>('/api/admin/platform-campaigns', 'POST', { action: 'plan', purpose, detail, useAi });
    setBusy(false);
    if (!r.ok) { setError(r.data.error ?? 'Could not write the campaign'); return; }
    setDraft({ name: r.data.name, config: r.data.config });
    setNote(r.data.usedAi ? 'Written by AI. Read every email before you send it.' : r.data.aiRequestedButUnavailable ? 'The AI writer was not available, so the built-in writer drafted this. Edit anything you like.' : 'Drafted for you. Edit anything you like.');
  };
  const useSample = async (id: string) => {
    setBusy(true); setError(''); setNote('');
    const r = await api<{ name: string; purpose: Purpose; config: CampaignConfig }>('/api/admin/platform-campaigns', 'POST', { action: 'sample', id });
    setBusy(false);
    if (!r.ok) { setError(r.data.error ?? 'Could not load the sample'); return; }
    setPickedPurpose(r.data.purpose); setDraft({ name: r.data.name, config: r.data.config });
    setNote('A ready-made sample. Read it, change anything you like, then save it as a draft and send yourself a test.');
  };
  const save = async () => {
    if (!draft) return;
    setBusy(true); setError('');
    const r = await api<{ id: string }>('/api/admin/platform-campaigns', 'POST', { action: 'create', name: draft.name, purpose: pickedPurpose ?? purpose, config: draft.config });
    setBusy(false);
    if (!r.ok) { setError(r.data.error ?? 'Could not save'); return; }
    onSaved(r.data.id);
  };

  return (
    <div className={card}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold">{draft ? 'Review your campaign' : 'New campaign for your users'}</h3>
        <button type="button" onClick={onCancel} className={`${btn} text-gray-400 hover:text-white`}>Cancel</button>
      </div>

      {!draft ? (
        <div className="space-y-4">
          <div role="radiogroup" aria-label="What is the campaign for?" className="grid gap-2 sm:grid-cols-2">
            {purposes.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={purpose === p.id} onClick={() => setPurpose(p.id)} className={`text-left rounded-xl border p-3 ${purpose === p.id ? 'border-purple-500 bg-purple-500/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/5'}`}>
                <p className="text-sm font-bold text-white">{p.label}</p><p className="text-xs text-gray-500 mt-0.5">{p.hint}</p>
              </button>
            ))}
          </div>
          <div><label htmlFor="pc-detail" className={lbl}>What do you want to tell them? (a sentence or two)</label>
            <textarea id="pc-detail" rows={3} value={detail} maxLength={400} onChange={(e) => setDetail(e.target.value)} placeholder={info?.placeholder} className={input} />
            <p className="text-[11px] text-gray-600 mt-1">Only facts you give here are used. The writer never invents numbers, discounts or features.</p></div>
          {aiAvailable && <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} /> <Sparkles className="w-4 h-4 text-purple-400" /> Let AI write the emails (you review them before anything is sent)</label>}
          <button type="button" onClick={() => void write()} disabled={busy} className={`${btn} bg-purple-600 hover:bg-purple-700 text-white`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Write my campaign</button>
          {samples.length > 0 && (
            <div className="border-t border-white/8 pt-4">
              <p className="text-sm font-bold text-white mb-2">Or start from a ready-made sample</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {samples.map((x) => (
                  <button key={x.id} type="button" disabled={busy} onClick={() => void useSample(x.id)} className="text-left rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/5 p-3 disabled:opacity-50">
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
          <Editor name={draft.name} setName={(v) => setDraft({ ...draft, name: v })} cfg={draft.config} setCfg={(c) => setDraft({ ...draft, config: c })} />
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void save()} disabled={busy} className={`${btn} bg-purple-600 hover:bg-purple-700 text-white`}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Save as draft</button>
            <button type="button" onClick={() => setDraft(null)} disabled={busy} className={`${btn} bg-white/5 border border-white/10 text-gray-200`}>Start over</button>
          </div>
          <p className="text-xs text-gray-500">Saving does not send anything. Next you can send yourself a test and then send each email when you are ready.</p>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-400 mt-3">{error}</p>}
    </div>
  );
}

// ───────────────────────── one campaign: send controls ─────────────────────────

function StepCard({ id, index, step, stats, status, maxBatch, onDone }: { id: string; index: number; step: Step; stats: StepStats; status: string; maxBatch: number; onDone: () => void }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [word, setWord] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, failed: 0 });
  const stop = useRef(false);
  const blocked = status === 'paused' || status === 'finished';

  const test = async () => {
    setTesting(true); setMsg(null);
    const r = await api<{ sentTo: string }>(`/api/admin/platform-campaigns/${id}/send`, 'POST', { step: index, action: 'test' });
    setMsg(r.ok ? { ok: true, text: `Test sent to ${r.data.sentTo}. Check your inbox and spam.` } : { ok: false, text: r.data.error ?? 'Failed' });
    setTesting(false);
  };
  const sendAll = async () => {
    setRunning(true); setMsg(null); stop.current = false;
    let sent = 0, failed = 0; setProgress({ sent, failed });
    for (;;) {
      const r = await api<{ sent: number; failed: number; remaining: number; capped: boolean }>(`/api/admin/platform-campaigns/${id}/send`, 'POST', { step: index, action: 'send', confirm: 'SEND' });
      if (!r.ok) { setMsg({ ok: false, text: r.data.error ?? 'Failed' }); break; }
      sent += r.data.sent; failed += r.data.failed; setProgress({ sent, failed });
      const done = r.data.remaining === 0;
      if (done || r.data.sent === 0 || stop.current) {
        setMsg({ ok: done && failed === 0, text: done ? `Done. ${sent} sent${failed ? `, ${failed} failed` : ''}.` : r.data.capped ? `Daily cap reached. ${sent} sent, ${r.data.remaining} left for tomorrow.` : `Stopped. ${sent} sent, ${r.data.remaining} still to go.` });
        break;
      }
    }
    setRunning(false); setConfirming(false); setWord(''); onDone();
  };

  return (
    <div className={card}>
      <p className="text-xs font-bold uppercase tracking-wide text-purple-400">Email {index + 1}{index > 0 ? ` · ${step.waitDays} days after the previous` : ''}</p>
      <h4 className="text-white font-bold text-sm mt-1">{step.subject}</h4>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
        {[['Will receive now', stats.eligible], ['Already sent', stats.sent], ...(index > 0 ? [['Waiting for the gap', stats.waiting], ['Not sent the previous one', stats.notReached]] : []), ['Reached the goal (skipped)', stats.goalReached], ['Unsubscribed', stats.optedOut]].map(([t, n]) => (
          <div key={t as string} className="bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2"><p className="text-lg font-black text-white">{n as number}</p><p className="text-[10px] text-gray-500 uppercase tracking-wide">{t as string}</p></div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-4">
        <button type="button" onClick={() => void test()} disabled={testing || running} className={`${btn} bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200`}>{testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send test to me</button>
        {!confirming && !running && <button type="button" onClick={() => setConfirming(true)} disabled={stats.eligible === 0 || blocked} className={`${btn} bg-purple-600 hover:bg-purple-700 text-white`}><Play className="w-4 h-4" /> Send to {stats.eligible} {stats.eligible === 1 ? 'person' : 'people'}</button>}
        {blocked && <span className="text-xs text-orange-300">Campaign is {status}.</span>}
      </div>
      {confirming && !running && (
        <div className="mt-3 rounded-xl border border-orange-500/30 bg-orange-500/[0.06] p-4">
          <p className="text-sm text-orange-300 font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> This emails {stats.eligible} real users and can&apos;t be undone.</p>
          <p className="text-xs text-gray-400 mt-1">Sent in batches of {maxBatch}; each person gets it once. Check the test email first. Type SEND to confirm.</p>
          <div className="flex gap-2 mt-3">
            <input value={word} onChange={(e) => setWord(e.target.value)} placeholder="SEND" aria-label="Type SEND to confirm" className="w-28 bg-gray-800/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/60" />
            <button type="button" onClick={() => void sendAll()} disabled={word !== 'SEND'} className={`${btn} bg-orange-600 hover:bg-orange-500 text-white`}>Send now</button>
            <button type="button" onClick={() => { setConfirming(false); setWord(''); }} className={`${btn} text-gray-400 hover:text-white`}>Cancel</button>
          </div>
        </div>
      )}
      {running && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-purple-500/25 bg-purple-500/[0.06] p-4">
          <Loader2 className="w-4 h-4 text-purple-400 animate-spin flex-shrink-0" />
          <p className="text-sm text-gray-200 flex-1">Sending… {progress.sent} sent{progress.failed ? `, ${progress.failed} failed` : ''}. Keep this tab open.</p>
          <button type="button" onClick={() => { stop.current = true; }} className={`${btn} bg-white/5 text-gray-200 border border-white/10`}><Square className="w-3.5 h-3.5" /> Stop after this batch</button>
        </div>
      )}
      {msg && <p role="status" className={`text-sm mt-3 flex items-center gap-2 ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.ok && <CheckCircle className="w-4 h-4" />}{msg.text}</p>}
    </div>
  );
}

function CampaignDetail({ id, maxBatch, onBack }: { id: string; maxBatch: number; onBack: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<{ name: string; cfg: CampaignConfig } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await api<Detail>(`/api/admin/platform-campaigns/${id}`);
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

  if (!d) return <div className={card}>{error ? <p role="alert" className="text-sm text-red-400">{error}</p> : <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />}</div>;
  const c = d.campaign; const anySent = d.steps.some((s) => s.sent > 0);

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white"><ArrowLeft className="w-4 h-4" /> All campaigns</button>
      <div className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><div className="flex items-center gap-2"><h3 className="text-white font-bold">{c.name}</h3><Chip status={c.status} /></div>
            <p className="text-xs text-gray-500 mt-1">To: {d.audience}. Goal: {GOALS.find((g) => g.id === c.config.goal)?.label}. Cap {c.config.dailyCap} per 24h ({d.last24h} sent in the last 24h).</p></div>
          <div className="flex flex-wrap gap-2">
            {!editing && c.status !== 'finished' && <button type="button" onClick={() => setEditing({ name: c.name, cfg: c.config })} className={`${btn} bg-white/5 border border-white/10 text-gray-200`}>Edit</button>}
            {c.status === 'paused' && <button type="button" disabled={busy} onClick={() => void patch({ status: 'active' })} className={`${btn} bg-green-600 hover:bg-green-500 text-white`}><Play className="w-4 h-4" /> Resume</button>}
            {(c.status === 'active' || c.status === 'draft') && <button type="button" disabled={busy} onClick={() => void patch({ status: 'paused' })} className={`${btn} bg-white/5 border border-white/10 text-gray-200`}><Pause className="w-4 h-4" /> Pause</button>}
            {anySent && c.status !== 'finished' && <button type="button" disabled={busy} onClick={() => { if (window.confirm('Mark this campaign finished? No more emails will go out from it.')) void patch({ status: 'finished' }); }} className={`${btn} bg-white/5 border border-white/10 text-gray-200`}>Mark finished</button>}
            {!anySent && <button type="button" onClick={() => void remove()} className={`${btn} text-red-400 hover:text-red-300`}><Trash2 className="w-4 h-4" /> Delete</button>}
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-red-400 mt-3">{error}</p>}
      </div>

      {editing ? (
        <div className={card}>
          <Editor name={editing.name} setName={(v) => setEditing({ ...editing, name: v })} cfg={editing.cfg} setCfg={(cfg) => setEditing({ ...editing, cfg })} lockedSteps={d.steps.map((s) => s.sent > 0)} />
          <div className="flex gap-2 mt-5">
            <button type="button" disabled={busy} onClick={async () => { if (await patch({ name: editing.name, config: editing.cfg })) setEditing(null); }} className={`${btn} bg-purple-600 hover:bg-purple-700 text-white`}>{busy && <Loader2 className="w-4 h-4 animate-spin" />} Save changes</button>
            <button type="button" onClick={() => setEditing(null)} className={`${btn} text-gray-400 hover:text-white`}>Cancel</button>
          </div>
        </div>
      ) : (
        c.config.steps.map((s, i) => <StepCard key={`${i}-${s.subject}`} id={id} index={i} step={s} stats={d.steps[i]} status={c.status} maxBatch={maxBatch} onDone={() => void load()} />)
      )}
    </div>
  );
}

// ───────────────────────── the section ─────────────────────────

export default function PlatformCampaigns({ maxBatch = 60 }: { maxBatch?: number } = {}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [meta, setMeta] = useState<{ purposes: PurposeInfo[]; samples: Array<{ id: string; label: string; hint: string }>; aiAvailable: boolean; emailConfigured: boolean } | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<'list' | 'new' | string>('list');
  const load = useCallback(async () => {
    const r = await api<{ campaigns: Row[]; purposes: PurposeInfo[]; samples: Array<{ id: string; label: string; hint: string }>; aiAvailable: boolean; emailConfigured: boolean }>('/api/admin/platform-campaigns');
    if (!r.ok) { setError(r.data.error ?? 'Could not load campaigns'); return; }
    setError(''); setRows(r.data.campaigns); setMeta({ purposes: r.data.purposes, samples: r.data.samples ?? [], aiAvailable: r.data.aiAvailable, emailConfigured: r.data.emailConfigured });
  }, []);
  useEffect(() => { void load(); }, [load]);

  const back = () => { setView('list'); void load(); };
  return (
    <section aria-labelledby="pc-h" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 id="pc-h" className="text-base font-bold text-white">Campaigns for your users</h2>
          <p className="text-xs text-gray-500 mt-0.5">Create a campaign for a purpose, the same way customers do: describe it, review the emails, test it, then send each one when you are ready. Nothing sends by itself.</p></div>
        {view === 'list' && meta && <button type="button" onClick={() => setView('new')} className={`${btn} bg-purple-600 hover:bg-purple-700 text-white`}><Plus className="w-4 h-4" /> New campaign</button>}
      </div>

      {error && <div role="alert" className="rounded-xl border border-orange-500/30 bg-orange-500/[0.06] p-4 text-sm text-orange-300">{error}</div>}
      {meta && !meta.emailConfigured && <div role="alert" className="rounded-xl border border-orange-500/30 bg-orange-500/[0.06] p-4 text-sm text-orange-300">Email isn&apos;t configured on this server, so nothing can be sent from here.</div>}
      {!rows && !error && <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 text-purple-400 animate-spin" /></div>}

      {view === 'new' && meta && <NewCampaign purposes={meta.purposes} samples={meta.samples} aiAvailable={meta.aiAvailable} onCancel={back} onSaved={(id) => setView(id)} />}
      {view !== 'list' && view !== 'new' && <CampaignDetail id={view} maxBatch={maxBatch} onBack={back} />}

      {view === 'list' && rows && (rows.length === 0 ? (
        <div className={`${card} text-sm text-gray-400`}>No campaigns yet. Use <strong className="text-gray-200">New campaign</strong> to write one for a purpose, such as announcing a feature or getting free users to claim the trial.</div>
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <button key={r.id} type="button" onClick={() => setView(r.id)} className={`${card} text-left hover:border-purple-500/40 transition-colors`}>
              <div className="flex items-center gap-2"><h3 className="text-white font-bold text-sm">{r.name}</h3><Chip status={r.status} /></div>
              <p className="text-xs text-gray-500 mt-1">To: {r.audience}</p>
              <p className="text-xs text-gray-400 mt-2">{r.perStep.map((n, i) => `Email ${i + 1}: ${n} sent`).join(' · ')}</p>
            </button>
          ))}
        </div>
      ))}
    </section>
  );
}
