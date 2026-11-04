'use client';

import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { BASIS_STYLE, OFFER_NAMES, dateTime, valueText, apiResult } from './format';

/* eslint-disable @typescript-eslint/no-explicit-any */

function Badge({ basis }: { basis: string }) {
  const s = BASIS_STYLE[basis] ?? BASIS_STYLE.unknown;
  return <span title={s.hint} className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${s.cls}`}>{s.label}</span>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-white/8 bg-white/[0.02] rounded-2xl p-5 space-y-3">
      <h2 className="text-sm font-bold text-white">{title}</h2>
      {children}
    </section>
  );
}

const OUTCOMES = [
  ['sent', 'Recorded as sent outside RUNVAX'], ['reply', 'Reply received'], ['opt_out', 'Opt-out'], ['objection', 'Objection'],
  ['meeting_booked', 'Meeting booked'], ['proposal_sent', 'Proposal sent'], ['won', 'Won'], ['lost', 'Lost'],
] as const;

/**
 * Human review of one pitch draft: the text, the evidence behind it, the
 * decision history, and the review actions. Approval binds to this exact
 * text and evidence version. Nothing on this screen delivers anything; the
 * outcome form only records what happened outside RUNVAX.
 */
export default function DraftReview({ detail, onChanged, flash }: { detail: any; onChanged?: (message?: string) => void; flash?: string }) {
  const { draft, prospect, offer, recipient, evidence, history, validity, warnings } = detail;
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(draft.subject ?? '');
  const [body, setBody] = useState(draft.body);
  const [blockers, setBlockers] = useState<Array<{ code: string; detail: string }>>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<any>({ type: 'reply', sentiment: 'neutral', amount: '', currency: 'NGN', reason: '', note: '', attest: false });

  const act = async (payload: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true); setBlockers([]); setMsg('');
    try {
      const r = await apiResult<any>(`/api/acquisition/drafts/${draft.id}/actions`, { method: 'POST', body: JSON.stringify(payload) });
      if (r.body.ok) { const m = `${payload.action}: ${r.body.status}${r.body.warnings?.length ? ` — ${r.body.warnings.join('; ')}` : ''}`; setMsg(m); setEditing(false); onChanged?.(m); }
      else setBlockers(r.body.blockers ?? []);
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
  };

  const reject = () => {
    const reason = window.prompt('Reason for rejecting (recorded in the history):');
    if (reason && reason.trim().length >= 3) act({ action: 'reject', reason });
  };

  const recordOutcome = async () => {
    if (busy) return;
    setBusy(true); setBlockers([]); setMsg('');
    const t = out.type;
    const payload: Record<string, unknown> = { type: t };
    if (t === 'sent') { payload.draftId = draft.id; payload.attest = out.attest; }
    if (t === 'reply') payload.sentiment = out.sentiment;
    if (['proposal_sent', 'won'].includes(t)) { payload.amount = Number(out.amount); payload.currency = out.currency; }
    if (['objection', 'won', 'lost'].includes(t)) payload.reason = out.reason;
    if (['reply', 'opt_out', 'meeting_booked', 'proposal_sent'].includes(t) && out.note.trim()) payload.note = out.note;
    try {
      const r = await apiResult<any>(`/api/acquisition/prospects/${prospect.id}/outcomes`, { method: 'POST', body: JSON.stringify(payload) });
      if (r.body.ok) { const m = `Outcome recorded: ${t} → prospect ${r.body.state}${r.body.suppressed ? ` (suppressed: ${r.body.suppressed.join(', ')})` : ''}`; setMsg(m); onChanged?.(m); }
      else setBlockers(r.body.blockers ?? []);
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed'); } finally { setBusy(false); }
  };

  const active = ['pending_approval', 'approved', 'ready'].includes(draft.status);
  const readiness = draft.readiness as { ready: boolean; blockers: any[]; deferred: string[]; checkedAt: string } | null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-white">{prospect.name} · pitch v{draft.version}</h1>
        <p className="text-sm text-gray-400 mt-1" data-testid="draft-status">
          Status <b className="text-gray-200">{draft.status}</b>{draft.statusReason ? ` — ${draft.statusReason}` : ''} · prospect {prospect.state}
          {' '}· {OFFER_NAMES[draft.offerId] ?? draft.offerId}
        </p>
      </div>

      {flash && <p role="status" className="text-xs text-gray-200 border border-white/10 bg-white/5 rounded-xl px-4 py-2">{flash}</p>}
      {offer && !offer.sellable && (
        <div role="note" className="flex items-start gap-2 text-xs text-amber-200 border border-amber-500/25 bg-amber-950/10 rounded-xl px-4 py-3">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          <span>{offer.name} is not approved for sale (proposal: {offer.approvalState ?? 'none'}; pricing: {offer.pricingStatus ?? 'none'}). The wording can be reviewed and approved, but this pitch cannot be marked ready.</span>
        </div>
      )}
      {validity && !validity.valid && (
        <div role="alert" className="text-xs text-red-200 border border-red-500/25 bg-red-950/10 rounded-xl px-4 py-3">
          <p className="font-bold">This draft no longer matches its evidence or offer:</p>
          <ul className="list-disc pl-5">{validity.reasons.map((r: any) => <li key={r.code + r.detail}><b>{r.code}</b>: {r.detail}</li>)}</ul>
        </div>
      )}

      <Section title="Text">
        <p className="text-xs text-gray-500">To: {recipient ? `${recipient.email ?? '—'} (${recipient.kind})` : 'no recipient'} · {draft.wordCount} words · text hash {draft.bodyHash.slice(0, 12)}</p>
        {editing ? (
          <div className="space-y-2">
            <input aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-sm text-gray-100" />
            <textarea aria-label="Body" value={body} onChange={(e) => setBody(e.target.value)} rows={12} className="w-full bg-black/40 border border-white/10 rounded px-2 py-1 text-sm text-gray-100" />
            <p className="text-[11px] text-amber-300">Saving an edit withdraws any approval. Only state what the evidence below supports.</p>
            <div className="flex gap-2">
              <button onClick={() => act({ action: 'edit', subject, body })} disabled={busy} className="disabled:opacity-40 text-xs font-bold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200">Save edit</button>
              <button onClick={() => { setEditing(false); setSubject(draft.subject ?? ''); setBody(draft.body); }} className="text-xs px-3 py-1.5 rounded-lg text-gray-400">Discard</button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-black/30 p-4">
            <p className="text-sm font-bold text-gray-100">{draft.subject}</p>
            <pre data-testid="draft-body" className="whitespace-pre-wrap font-sans text-sm text-gray-200 mt-2">{draft.body}</pre>
          </div>
        )}
        {warnings?.length > 0 && <ul className="text-xs text-amber-300 list-disc pl-5">{warnings.map((w: string) => <li key={w}>{w}</li>)}</ul>}
      </Section>

      <Section title="Evidence behind this text">
        <div className="overflow-x-auto">
        <table className="w-full text-xs" aria-label="Cited evidence">
          <thead><tr className="text-left text-gray-500"><th className="py-1 pr-2">Statement in the text</th><th className="pr-2">Signal</th><th className="pr-2">Basis</th><th className="pr-2">Source</th><th>Quote</th></tr></thead>
          <tbody>
            {evidence.observed.map((c: any) => (
              <tr key={c.signalId} className="border-t border-white/5 align-top">
                <td className="py-1 pr-2 text-gray-200">“{c.sentence}”</td>
                <td className="pr-2 text-gray-300">{c.code} = {valueText(c.value)}{c.current ? '' : <span className="text-red-300"> (no longer current)</span>}</td>
                <td className="pr-2"><Badge basis="observed" /> <span className="text-gray-500">{c.confidence}</span></td>
                <td className="pr-2 text-gray-400 break-all">{c.sourceUrl ?? '—'}<br /><span className="text-gray-600 whitespace-nowrap break-normal">{dateTime(c.observedAt)}</span></td>
                <td className="text-gray-400">{c.quote ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 text-xs">
          <div>
            <p className="font-bold text-gray-300 mb-1">Inferred — not stated in the text</p>
            <ul className="space-y-0.5 text-gray-400">{evidence.inferred.length ? evidence.inferred.map((n: any) => <li key={n.code}><Badge basis="inferred" /> {n.code} = {valueText(n.value)}</li>) : <li>none</li>}</ul>
          </div>
          <div>
            <p className="font-bold text-gray-300 mb-1">Unknown — not stated in the text</p>
            <ul className="space-y-0.5 text-gray-400">{evidence.unknown.length ? evidence.unknown.map((n: any) => <li key={n.code}><Badge basis="unknown" /> {n.code} · {n.note}</li>) : <li>none</li>}</ul>
          </div>
        </div>
        <p className="text-[11px] text-gray-500">Bound to evidence {String(draft.evidenceHash).slice(0, 12)} · offer config {String(draft.offerHash).slice(0, 12)} (v{draft.offerConfigVersion ?? '—'}) · industry config v{draft.industryConfigVersion ?? '—'}</p>
      </Section>

      <Section title="Review">
        <div className="flex flex-wrap gap-2">
          {active && !editing && <button onClick={() => setEditing(true)} disabled={busy} className="disabled:opacity-40 text-xs font-bold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200">Edit</button>}
          {draft.status === 'pending_approval' && <button onClick={() => act({ action: 'approve' })} disabled={busy} className="disabled:opacity-40 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600/70 hover:bg-emerald-600 text-white">Approve wording</button>}
          {draft.status === 'approved' && <button onClick={() => act({ action: 'mark_ready' })} disabled={busy} className="disabled:opacity-40 text-xs font-bold px-3 py-1.5 rounded-lg bg-purple-600/70 hover:bg-purple-600 text-white">Mark ready</button>}
          {active && <button onClick={reject} disabled={busy} className="disabled:opacity-40 text-xs font-bold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-red-200">Reject</button>}
          {!['sent', 'blocked', 'invalidated'].includes(draft.status) && <button onClick={() => act({ action: 'regenerate' })} disabled={busy} className="disabled:opacity-40 text-xs font-bold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200">Regenerate from current evidence</button>}
        </div>
        {['blocked', 'invalidated', 'sent'].includes(draft.status) && <p className="text-xs text-gray-400">No review actions are available for a {draft.status} draft.</p>}
        {readiness && (
          <p className="text-xs text-gray-400">Last readiness check {dateTime(readiness.checkedAt)}: {readiness.ready ? 'ready' : 'not ready'}
            {readiness.deferred?.length ? ` · still required before any delivery: ${readiness.deferred.join(', ')}` : ''}</p>
        )}
        {blockers.length > 0 && (
          <div role="alert" className="text-xs border border-amber-500/25 bg-amber-950/10 rounded-xl px-3 py-2 text-amber-100">
            <p className="font-bold">Refused:</p>
            <ul className="list-disc pl-5">{blockers.map((b) => <li key={b.code + b.detail}><b>{b.code}</b>: {b.detail}</li>)}</ul>
          </div>
        )}
        {msg && msg !== flash && <p className="text-xs text-gray-300">{msg}</p>}
      </Section>

      <Section title="Decision history">
        <ul className="text-xs text-gray-400 space-y-0.5" aria-label="Decision history">
          {history.length === 0 && <li>No decisions recorded yet.</li>}
          {history.map((h: any) => (
            <li key={h.id}>{dateTime(h.at)} · <b className="text-gray-200">{h.action}</b> · {h.actor}{h.note ? ` · ${h.note}` : ''}
              {h.bodyHashAfter ? ` · text ${h.bodyHashAfter.slice(0, 8)}` : ''}{h.evidenceHash ? ` · evidence ${h.evidenceHash.slice(0, 8)}` : ''}</li>
          ))}
        </ul>
      </Section>

      <Section title="Record an outcome (manual)">
        <p className="text-[11px] text-gray-500">Records what happened outside RUNVAX. Nothing is delivered or scheduled. An opt-out or objection suppresses the contact immediately. Don’t paste message contents or personal details.</p>
        <div className="grid sm:grid-cols-3 gap-2 text-xs text-gray-300">
          <label className="flex flex-col gap-1">Outcome
            <select value={out.type} onChange={(e) => setOut({ ...out, type: e.target.value })} className="bg-black/40 border border-white/10 rounded px-2 py-1">
              {OUTCOMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          {out.type === 'reply' && (
            <label className="flex flex-col gap-1">Sentiment
              <select value={out.sentiment} onChange={(e) => setOut({ ...out, sentiment: e.target.value })} className="bg-black/40 border border-white/10 rounded px-2 py-1">
                <option value="positive">positive</option><option value="neutral">neutral</option><option value="negative">negative</option>
              </select>
            </label>
          )}
          {['proposal_sent', 'won'].includes(out.type) && (
            <>
              <label className="flex flex-col gap-1">Amount (whole units)
                <input inputMode="numeric" value={out.amount} onChange={(e) => setOut({ ...out, amount: e.target.value.replace(/\D/g, '') })} className="bg-black/40 border border-white/10 rounded px-2 py-1" />
              </label>
              <label className="flex flex-col gap-1">Currency
                <input value={out.currency} maxLength={3} onChange={(e) => setOut({ ...out, currency: e.target.value.toUpperCase() })} className="bg-black/40 border border-white/10 rounded px-2 py-1" />
              </label>
            </>
          )}
        </div>
        {['objection', 'won', 'lost'].includes(out.type) && (
          <label className="flex flex-col gap-1 text-xs text-gray-300">Reason
            <input value={out.reason} onChange={(e) => setOut({ ...out, reason: e.target.value })} className="bg-black/40 border border-white/10 rounded px-2 py-1" />
          </label>
        )}
        {out.type === 'sent' && (
          <label className="flex items-center gap-2 text-xs text-gray-300">
            <input type="checkbox" checked={out.attest} onChange={(e) => setOut({ ...out, attest: e.target.checked })} />
            I delivered exactly this approved text myself, outside RUNVAX.
          </label>
        )}
        <button onClick={recordOutcome} disabled={busy} className="disabled:opacity-40 text-xs font-bold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200">Record outcome</button>
      </Section>
    </div>
  );
}
