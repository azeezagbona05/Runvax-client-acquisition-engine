'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api, apiResult } from './format';

/* eslint-disable @typescript-eslint/no-explicit-any */

// What an admin can record from the clinic's own website. The first group are the signals the AI Receptionist
// pitch is built from; the rest are available but rarely needed.
export const PITCH_SIGNALS: Array<[string, string]> = [
  ['online_booking_present', 'Online appointment booking'],
  ['contact_form_present', 'Enquiry / contact form'],
  ['whatsapp_entry_point', 'WhatsApp link or button'],
  ['chat_widget_present', 'Chat widget'],
  ['opening_hours_published', 'Opening hours published'],
  ['click_to_call', 'Tap-to-call phone link'],
];
export const OTHER_SIGNALS: Array<[string, string]> = [
  ['website_present', 'Website exists'], ['booking_cta_to_form', 'Booking button leads to a form'], ['structured_data_dentist', 'Dentist structured data'],
  ['service_pages', 'Service pages'], ['mobile_viewport', 'Mobile-friendly viewport'], ['https', 'Served over HTTPS'],
];
export const EVIDENCE_CODES = [...PITCH_SIGNALS, ...OTHER_SIGNALS].map(([c]) => c);
const SIGNAL_LABEL: Record<string, string> = Object.fromEntries([...PITCH_SIGNALS, ...OTHER_SIGNALS]);

type Answer = 'unchecked' | 'yes' | 'no';

/**
 * Pitch preparation for one clinic: what is in place and what is missing,
 * shown before anyone clicks Generate; one-step evidence entry; and the
 * button. Generating only creates a draft for human review; nothing is
 * delivered from RUNVAX.
 */
export default function PitchPanel({ prospectId, domain, readiness, onChanged }: { prospectId: string; domain: string | null; readiness?: any; onChanged?: () => void }) {
  const [refusals, setRefusals] = useState<Array<{ code: string; detail: string }>>([]);
  const [created, setCreated] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [canRun, setCanRun] = useState(false);
  const [running, setRunning] = useState(false);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [form, setForm] = useState({ sourceUrl: domain ? `https://${domain}/` : '', note: '', confidence: 'medium', attest: false });

  const items = Object.entries(answers).filter(([, a]) => a !== 'unchecked').map(([code, a]) => ({ code, value: a === 'yes' }));

  const generate = async () => {
    setRefusals([]); setCreated(null); setMsg('');
    try {
      const r = await apiResult<any>(`/api/acquisition/prospects/${prospectId}/drafts`, { method: 'POST', body: '{}' });
      if (r.body.ok) { setCreated(r.body.draftId); onChanged?.(); } else setRefusals(r.body.reasons ?? []);
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed'); }
  };

  const addEvidence = async () => {
    setMsg('');
    try {
      const r = await api<any>(`/api/acquisition/prospects/${prospectId}/evidence`, {
        method: 'POST',
        body: JSON.stringify({ items, sourceUrl: form.sourceUrl, note: form.note, confidence: form.confidence, attest: form.attest }),
      });
      const n = r.signals?.length ?? items.length;
      setMsg(`${n} observation${n === 1 ? '' : 's'} recorded${r.invalidatedDrafts ? `; ${r.invalidatedDrafts} pitch(es) invalidated` : ''}. Run the queue to re-audit and re-score.`);
      setAnswers({}); setForm({ ...form, note: '', attest: false });
      setCanRun(true);
      onChanged?.();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed'); }
  };

  const runQueue = async () => {
    setRunning(true);
    try {
      const j = await api<any>('/api/acquisition/tasks', { method: 'POST', body: '{}' });
      setMsg(`Queue run: claimed ${j.claimed} · completed ${j.completed} · skipped ${j.skipped} · dead ${j.dead}. Re-scored; the checklist above is up to date.`);
      setCanRun(false);
      onChanged?.();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed'); } finally { setRunning(false); }
  };

  const Row = ({ code, label }: { code: string; label: string }) => (
    <label className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <select aria-label={label} value={answers[code] ?? 'unchecked'} onChange={(e) => setAnswers({ ...answers, [code]: e.target.value as Answer })} className="bg-black/40 border border-white/10 rounded px-2 py-1 min-w-[10rem]">
        <option value="unchecked">Not checked</option>
        <option value="yes">Present</option>
        <option value="no">Not found</option>
      </select>
    </label>
  );

  return (
    <div className="space-y-4 text-xs text-gray-300">
      {readiness && (
        <div aria-label="Pitch readiness" className="space-y-1.5">
          <p className="font-bold text-gray-200">{readiness.canGenerate ? 'A pitch can be generated now.' : 'A pitch can’t be generated yet. What’s missing:'}</p>
          <ul className="space-y-0.5">
            {readiness.checks.map((c: any) => (
              <li key={c.label} className={c.ok ? 'text-gray-300' : c.blocking ? 'text-red-300' : 'text-amber-300'}>
                <span aria-hidden>{c.ok ? '✓' : c.blocking ? '✗' : '!'}</span> <span className="sr-only">{c.ok ? 'OK: ' : c.blocking ? 'Missing: ' : 'Note: '}</span>{c.label} <span className="text-gray-500">· {c.detail}</span>
              </li>
            ))}
          </ul>
          {!readiness.canGenerate && readiness.helpfulSignals?.length > 0 && <p className="text-gray-500">Evidence that would help: {readiness.helpfulSignals.map((c: string) => SIGNAL_LABEL[c] ?? c).join(', ')}.</p>}
          {readiness.canGenerate && !readiness.canBeMarkedReady && <p className="text-amber-300">The draft can be reviewed and approved, but not marked ready until the offer is approved for sale.</p>}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-gray-400">Pitches are built from fixed templates using only <b>observed</b> evidence. They go to the review queue; nothing is delivered from RUNVAX.</p>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={generate} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-purple-600/70 hover:bg-purple-600 text-white">Generate pitch for review</button>
          <Link href="/acquisition/drafts" className="text-xs text-purple-300 hover:text-white underline">Open review queue</Link>
        </div>
        {created && <p role="status">Created. <Link className="underline text-purple-300" href={`/acquisition/drafts/${created}`}>Review it</Link></p>}
        {refusals.length > 0 && (
          <div role="alert" className="border border-amber-500/25 bg-amber-950/10 rounded-xl px-3 py-2">
            <p className="font-bold text-amber-200">Not generated:</p>
            <ul className="list-disc pl-5">{refusals.map((r) => <li key={r.code + r.detail}><b>{r.code}</b>: {r.detail}</li>)}</ul>
          </div>
        )}
      </div>

      <fieldset className="border border-white/8 rounded-xl p-3 space-y-3" aria-label="Record observed evidence">
        <legend className="px-1 font-bold text-gray-200">Record observed evidence</legend>
        <p className="text-gray-500">Open the clinic’s own website{domain ? ` (${domain})` : ''} and record what you see, all in one go. Leave anything you didn’t check as “Not checked”. Don’t include personal details in the note.</p>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">{PITCH_SIGNALS.map(([c, l]) => <Row key={c} code={c} label={l} />)}</div>
        <details>
          <summary className="cursor-pointer text-gray-400">Other signals</summary>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 mt-2">{OTHER_SIGNALS.map(([c, l]) => <Row key={c} code={c} label={l} />)}</div>
        </details>
        <div className="grid sm:grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 sm:col-span-2">Page you checked
            <input value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} className="bg-black/40 border border-white/10 rounded px-2 py-1" />
          </label>
          <label className="flex flex-col gap-1">Confidence
            <select value={form.confidence} onChange={(e) => setForm({ ...form, confidence: e.target.value })} className="bg-black/40 border border-white/10 rounded px-2 py-1">
              <option value="high">high</option><option value="medium">medium</option><option value="low">low</option>
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1">What you saw (max 300 characters)
          <textarea maxLength={300} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="bg-black/40 border border-white/10 rounded px-2 py-1" rows={2} />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.attest} onChange={(e) => setForm({ ...form, attest: e.target.checked })} />
          I observed this myself on the clinic’s own website (not Google Maps or a directory).
        </label>
        <button onClick={addEvidence} disabled={!form.attest || form.note.trim().length < 3 || items.length === 0} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 disabled:opacity-40">
          Save evidence{items.length ? ` (${items.length})` : ''}
        </button>
      </fieldset>
      {msg && <p className="text-gray-400">{msg}</p>}
      {canRun && <button onClick={runQueue} disabled={running} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 disabled:opacity-40">Run queue now</button>}
    </div>
  );
}
