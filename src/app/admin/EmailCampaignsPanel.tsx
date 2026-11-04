'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Send, Mail, Eye, Play, Square, AlertTriangle, CheckCircle } from 'lucide-react';

interface AudienceStats { total: number; verified: number; unverified: number; optedOut: number; alreadySent: number; alreadyClaimed: number; eligible: number }
interface Status { ok: boolean; emailConfigured: boolean; maxBatch: number; launch: { 1: AudienceStats; 2: AudienceStats } }
interface WorkflowResult { ok: boolean; skipped?: boolean; reason?: string; dryRun: boolean; considered: number; sent: Record<string, number>; failed: number }

const STEP_LABEL: Record<string, string> = {
  verify_1: 'Verification reminder (1 hour)', verify_2: 'Final verification reminder (24 hours)',
  first_search: 'First-search guidance', research_outreach: 'Outreach guidance (day 2)', pipeline: 'Pipeline follow-up (day 3)',
  reengage: 'Re-engage idle users (day 3)', feedback: 'Feedback request (day 5)',
  trial_ending_soon: 'Trial ends tomorrow', trial_ends_today: 'Trial ends today', post_expiry: 'After the trial ends',
};

const card = 'bg-gray-900 border border-white/10 rounded-2xl p-5';
const btn = 'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-50';

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white/[0.03] border border-white/8 rounded-xl px-3 py-2.5">
      <p className="text-lg font-black text-white">{value}</p>
      <p className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</p>
    </div>
  );
}

/** Sends in batches until nobody is left, with a stop button; shows live progress. */
function LaunchCard({ which, title, blurb, stats, maxBatch, onDone }: {
  which: 1 | 2; title: string; blurb: string; stats: AudienceStats; maxBatch: number; onDone: () => void;
}) {
  const campaign = `launch_${which}`;
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [word, setWord] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ sent: number; failed: number } | null>(null);
  const stop = useRef(false);

  const post = (action: string, extra: object = {}) =>
    fetch('/api/admin/email-campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaign, action, ...extra }) });

  const test = async () => {
    setTesting(true); setMsg(null);
    try {
      const res = await post('test');
      const j = await res.json() as { error?: string; sentTo?: string };
      setMsg(res.ok ? { ok: true, text: `Test sent to ${j.sentTo}. Check your inbox and spam.` } : { ok: false, text: j.error ?? 'Failed' });
    } catch { setMsg({ ok: false, text: 'Request failed' }); }
    setTesting(false);
  };

  const sendAll = async () => {
    setRunning(true); setMsg(null); stop.current = false;
    let sent = 0, failed = 0;
    setProgress({ sent, failed });
    try {
      for (;;) {
        const res = await post('send', { confirm: 'SEND' });
        const j = await res.json() as { error?: string; sent?: number; failed?: number; remaining?: number };
        if (!res.ok) { setMsg({ ok: false, text: j.error ?? 'Failed' }); break; }
        sent += j.sent ?? 0; failed += j.failed ?? 0;
        setProgress({ sent, failed });
        // Stop when finished, when a whole batch failed (a retry would just fail again), or on request.
        if ((j.remaining ?? 0) === 0 || (j.sent ?? 0) === 0 || stop.current) {
          setMsg({ ok: failed === 0 && (j.remaining ?? 0) === 0, text: (j.remaining ?? 0) === 0 ? `Done. ${sent} sent${failed ? `, ${failed} failed` : ''}.` : `Stopped. ${sent} sent, ${j.remaining} still to go.` });
          break;
        }
      }
    } catch { setMsg({ ok: false, text: `Connection lost after ${sent} sent. Check the counts before retrying.` }); }
    setRunning(false); setConfirming(false); setWord('');
    onDone();
  };

  return (
    <div className={card}>
      <div className="flex items-start gap-3">
        <Mail className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
        <div className="min-w-0">
          <h3 className="text-white font-bold text-sm">{title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{blurb}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
        <Stat label="Will receive" value={stats.eligible} />
        <Stat label="Already sent" value={stats.alreadySent} />
        <Stat label="Unsubscribed" value={stats.optedOut} />
        {which === 2
          ? <Stat label="Already claimed (skipped)" value={stats.alreadyClaimed} />
          : <Stat label="Unverified (can't log in)" value={stats.unverified} />}
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-4">
        <button onClick={() => void test()} disabled={testing || running} className={`${btn} bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200`}>
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send test to me
        </button>
        {!confirming && !running && (
          <button onClick={() => setConfirming(true)} disabled={stats.eligible === 0} className={`${btn} bg-purple-600 hover:bg-purple-700 text-white`}>
            <Play className="w-4 h-4" /> Send to {stats.eligible} {stats.eligible === 1 ? 'person' : 'people'}
          </button>
        )}
      </div>

      {confirming && !running && (
        <div className="mt-3 rounded-xl border border-orange-500/30 bg-orange-500/[0.06] p-4">
          <p className="text-sm text-orange-300 font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> This emails {stats.eligible} real users and can&apos;t be undone.</p>
          <p className="text-xs text-gray-400 mt-1">Sent in batches of {maxBatch}; each person gets it once. Make sure you&apos;ve checked the test email first. Type SEND to confirm.</p>
          <div className="flex gap-2 mt-3">
            <input value={word} onChange={(e) => setWord(e.target.value)} placeholder="SEND" aria-label="Type SEND to confirm"
              className="w-28 bg-gray-800/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/60" />
            <button onClick={() => void sendAll()} disabled={word !== 'SEND'} className={`${btn} bg-orange-600 hover:bg-orange-500 text-white`}>Send now</button>
            <button onClick={() => { setConfirming(false); setWord(''); }} className={`${btn} text-gray-400 hover:text-white`}>Cancel</button>
          </div>
        </div>
      )}

      {running && (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-purple-500/25 bg-purple-500/[0.06] p-4">
          <Loader2 className="w-4 h-4 text-purple-400 animate-spin flex-shrink-0" />
          <p className="text-sm text-gray-200 flex-1">Sending… {progress?.sent ?? 0} sent{progress?.failed ? `, ${progress.failed} failed` : ''}. Keep this tab open.</p>
          <button onClick={() => { stop.current = true; }} className={`${btn} bg-white/5 text-gray-200 border border-white/10`}><Square className="w-3.5 h-3.5" /> Stop after this batch</button>
        </div>
      )}

      {msg && <p role="status" className={`text-sm mt-3 flex items-center gap-2 ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.ok && <CheckCircle className="w-4 h-4" />}{msg.text}</p>}
    </div>
  );
}

function WorkflowCard() {
  const [busy, setBusy] = useState<'preview' | 'run' | null>(null);
  const [result, setResult] = useState<WorkflowResult | null>(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [word, setWord] = useState('');

  const call = async (action: 'preview' | 'run') => {
    setBusy(action); setError(''); setResult(null);
    try {
      const res = await fetch('/api/admin/email-campaigns', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign: 'workflow', action, ...(action === 'run' ? { confirm: 'SEND' } : {}) }),
      });
      const j = await res.json() as WorkflowResult & { error?: string };
      if (!res.ok && !j.reason) setError(j.error ?? 'Failed');
      else setResult(j);
    } catch { setError('Request failed'); }
    setBusy(null); setConfirming(false); setWord('');
  };

  const rows = result ? Object.entries(result.sent) : [];
  const total = rows.reduce((a, [, n]) => a + n, 0);

  return (
    <div className={card}>
      <div className="flex items-start gap-3">
        <Mail className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="text-white font-bold text-sm">New-user email workflow</h3>
          <p className="text-xs text-gray-500 mt-0.5">Welcome, verification reminders, onboarding, feedback and trial emails, each sent only when the user&apos;s own actions call for it. It also runs automatically once a day; this button runs it right now. Only accounts created from 21 Oct are included.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        <button onClick={() => void call('preview')} disabled={!!busy} className={`${btn} bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200`}>
          {busy === 'preview' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />} Preview who would get what
        </button>
        {!confirming && (
          <button onClick={() => setConfirming(true)} disabled={!!busy} className={`${btn} bg-green-600 hover:bg-green-500 text-white`}>
            <Play className="w-4 h-4" /> Run workflow now
          </button>
        )}
      </div>

      {confirming && (
        <div className="mt-3 rounded-xl border border-orange-500/30 bg-orange-500/[0.06] p-4">
          <p className="text-sm text-orange-300 font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> This sends every email that is due right now.</p>
          <p className="text-xs text-gray-400 mt-1">Use Preview first to see exactly who. Type SEND to confirm.</p>
          <div className="flex gap-2 mt-3">
            <input value={word} onChange={(e) => setWord(e.target.value)} placeholder="SEND" aria-label="Type SEND to confirm"
              className="w-28 bg-gray-800/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/60" />
            <button onClick={() => void call('run')} disabled={word !== 'SEND' || !!busy} className={`${btn} bg-orange-600 hover:bg-orange-500 text-white`}>
              {busy === 'run' && <Loader2 className="w-4 h-4 animate-spin" />} Run now
            </button>
            <button onClick={() => { setConfirming(false); setWord(''); }} className={`${btn} text-gray-400 hover:text-white`}>Cancel</button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-red-400 mt-3">{error}</p>}
      {result?.skipped && <p role="alert" className="text-sm text-orange-300 mt-3">{result.reason}</p>}
      {result && !result.skipped && (
        <div className="mt-4">
          <p className="text-xs text-gray-500 mb-2">
            {result.dryRun ? 'Preview, nothing sent' : 'Run complete'} · {result.considered} accounts checked ·{' '}
            <span className="text-gray-300 font-semibold">{total} {result.dryRun ? 'would be sent' : 'sent'}</span>
            {result.failed > 0 && <span className="text-red-400"> · {result.failed} failed</span>}
          </p>
          {rows.length === 0 ? <p className="text-sm text-gray-500">Nobody is due an email right now.</p> : (
            <div className="rounded-xl border border-white/8 divide-y divide-white/5">
              {rows.map(([step, n]) => (
                <div key={step} className="flex justify-between px-3 py-2 text-sm"><span className="text-gray-300">{STEP_LABEL[step] ?? step}</span><span className="font-bold text-white">{n}</span></div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EmailCampaignsPanel() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/email-campaigns');
      const j = await res.json() as Status & { error?: string };
      if (!res.ok) { setError(j.error ?? 'Failed to load'); return; }
      setError(''); setStatus(j);
    } catch { setError('Failed to load'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-5 py-4">
      <p className="text-xs text-gray-500">Email campaigns. Real sends are logged in the audit trail. Test emails go to your admin address only.</p>

      {error && <div role="alert" className="rounded-xl border border-orange-500/30 bg-orange-500/[0.06] p-4 text-sm text-orange-300">{error}</div>}
      {status && !status.emailConfigured && <div role="alert" className="rounded-xl border border-orange-500/30 bg-orange-500/[0.06] p-4 text-sm text-orange-300">Email isn&apos;t configured on this server, so nothing can be sent from here.</div>}

      {!status && !error && <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 text-purple-400 animate-spin" /></div>}

      {status && (
        <>
          <LaunchCard which={1} title="Launch email 1: the offer" stats={status.launch[1]} maxBatch={status.maxBatch} onDone={() => void load()}
            blurb="“Get 11 days of Pro access for free.” Every button opens the claim page. Send this first." />
          <LaunchCard which={2} title="Launch email 2: the story and countdown" stats={status.launch[2]} maxBatch={status.maxBatch} onDone={() => void load()}
            blurb="The story-style follow-up with a live countdown to 1 November, for people who haven't claimed their free Pro yet. Send about two days after email 1." />
        </>
      )}
      <WorkflowCard />
    </div>
  );
}
