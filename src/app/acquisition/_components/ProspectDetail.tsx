'use client';

import { useState } from 'react';
import { ShieldAlert, Info } from 'lucide-react';
import PitchPanel from './PitchPanel';
import TaskTimeline from './TaskTimeline';
import { BASIS_STYLE, BAND_STYLE, OFFER_NAMES, scoreText, pct, dateTime, valueText, api } from './format';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Detail {
  prospect: any; sources: any[]; signals: any[]; findings: any[]; scores: any[]; recommendation: any | null;
  contacts: any[]; events: any[]; tasks: any[]; timeline?: any[]; pitchReadiness?: any; labels: { scoreIsEstimate: boolean; offerNotice: string };
}

function Badge({ basis }: { basis: string }) {
  const s = BASIS_STYLE[basis] ?? BASIS_STYLE.unknown;
  return <span title={s.hint} className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${s.cls}`}>{s.label}</span>;
}

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="border border-white/8 bg-white/[0.02] rounded-2xl p-5 space-y-3">
      <h2 className="text-sm font-bold text-white">{title}</h2>
      {children}
    </section>
  );
}

const ACTIONS = [
  ['rescore', 'Re-score'], ['reaudit', 'Re-audit'], ['needs_review', 'Mark needs review'], ['disqualify', 'Disqualify'],
  ['block_crawling', 'Block crawling of this domain'], ['suppress_domain', 'Suppress domain'], ['erase_contacts', 'Erase contacts'],
] as const;

/**
 * Research record for one clinic, admin housekeeping actions, and pitch
 * generation for human review. There is intentionally no send / follow-up
 * control: nothing is delivered from RUNVAX.
 */
export default function ProspectDetail({ detail, onChanged }: { detail: Detail; onChanged?: () => void }) {
  const { prospect, signals, findings, scores, recommendation, contacts, events, sources } = detail;
  const score = scores[0];
  const active = signals.filter((s) => !s.supersededAt);
  const [msg, setMsg] = useState('');

  const act = async (action: string) => {
    const reason = window.prompt(`Reason for "${action}" (recorded in the audit trail):`);
    if (!reason || reason.trim().length < 3) return;
    try {
      await api(`/api/acquisition/prospects/${prospect.id}/actions`, { method: 'POST', body: JSON.stringify({ action, reason }) });
      setMsg(`${action}: done`);
      onChanged?.();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed'); }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-white">{prospect.name}</h1>
        <p className="text-sm text-gray-400 mt-1">
          {prospect.website ?? 'No website'} · state <b className="text-gray-200">{prospect.state}</b>{prospect.area ? ` · ${prospect.area}` : ''}
          {prospect.crmConflict && <span className="ml-2 text-amber-300">CRM conflict: {prospect.crmConflict}</span>}
        </p>
      </div>

      <div role="note" className="flex items-start gap-2 text-xs text-amber-200 border border-amber-500/25 bg-amber-950/10 rounded-xl px-4 py-3">
        <ShieldAlert className="w-4 h-4 flex-shrink-0" />
        <span>{detail.labels.offerNotice}. Nothing is sent from this page: pitches are generated for human review only.</span>
      </div>

      <Section title="Next step: pitch and evidence" id="pitch">
        <PitchPanel prospectId={prospect.id} domain={prospect.orgDomain ?? null} readiness={detail.pitchReadiness} onChanged={onChanged} />
      </Section>

      <Section title="Score">
        {score ? (
          <>
            <p className="text-sm text-gray-200" data-testid="score">
              {scoreText(score.total)} · <span className={`px-2 py-0.5 rounded ${BAND_STYLE[score.band]?.cls ?? ''}`}>{BAND_STYLE[score.band]?.label ?? score.band}</span>
              {' '}· evidence coverage {pct(score.coverage)} · contactability {score.contactability} · {score.eligible ? 'eligible' : 'not eligible'}
            </p>
            <p className="text-[11px] text-gray-500">Model {score.scoreVersion}, config v{score.configVersion}, computed {dateTime(score.computedAt)}. Scores are rule-based estimates, not results.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" aria-label="Score breakdown">
                <thead><tr className="text-left text-gray-500"><th className="py-1 pr-2">Category (weight)</th><th className="pr-2">Rule</th><th className="pr-2">Evidence</th><th className="pr-2">Contribution</th></tr></thead>
                <tbody>
                  {(score.breakdown as any[]).flatMap((c) => c.rules.map((r: any, i: number) => (
                    <tr key={`${c.id}-${i}`} className="border-t border-white/5 align-top">
                      <td className="py-1 pr-2 text-gray-300">{i === 0 ? `${c.label} (${Math.round(c.weight * 100)}%${c.provisional ? ', provisional' : ''}) → ${c.points} pts` : ''}</td>
                      <td className="pr-2 text-gray-400">{r.signal} = {String(r.when)} (w {r.weight})</td>
                      <td className="pr-2 text-gray-400">{r.basis ? <><Badge basis={r.basis} /> {valueText(r.value)} · {r.confidence} · fresh ×{r.freshness}</> : 'no data'}</td>
                      <td className={`pr-2 ${r.fired ? 'text-gray-100' : 'text-gray-600'}`}>{r.contribution}</td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
            <ul className="text-xs text-gray-400 space-y-0.5" aria-label="Eligibility">
              {(score.eligibility as any[]).map((e) => <li key={e.check}>{e.pass ? '✓' : '✗'} {e.check}: {e.detail}</li>)}
            </ul>
          </>
        ) : <p className="text-xs text-gray-400">Not scored yet.</p>}
      </Section>

      <Section title="Internal recommendation">
        {recommendation ? (
          <div className="text-xs text-gray-300 space-y-2">
            <p>Primary: <b>{OFFER_NAMES[recommendation.primaryOfferId] ?? recommendation.primaryOfferId}</b>
              {recommendation.secondaryOfferId && <> · secondary: <b>{OFFER_NAMES[recommendation.secondaryOfferId] ?? recommendation.secondaryOfferId}</b></>}
              {' '}· offer status at the time: {recommendation.offerStatusAtTime} · confidence {recommendation.confidence}</p>
            <pre className="whitespace-pre-wrap text-gray-400 font-sans">{recommendation.rationale}</pre>
            {Array.isArray(recommendation.missingInfo) && recommendation.missingInfo.length > 0 && (
              <ul className="list-disc pl-5 text-gray-500">{recommendation.missingInfo.map((m: string) => <li key={m}>{m}</li>)}</ul>
            )}
          </div>
        ) : <p className="text-xs text-gray-400">None yet.</p>}
      </Section>

      <Section title={`Evidence (${active.length} active signal${active.length === 1 ? '' : 's'})`}>
        <p className="flex items-center gap-1 text-[11px] text-gray-500"><Info className="w-3 h-3" /> Only independent sources: the clinic’s own website, imports and manual entries. Nothing from Google Places is stored.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" aria-label="Signals">
            <thead><tr className="text-left text-gray-500"><th className="py-1 pr-2">Signal</th><th className="pr-2">Value</th><th className="pr-2">Basis</th><th className="pr-2">Source</th><th>Quote</th></tr></thead>
            <tbody>
              {active.map((s) => (
                <tr key={s.id} className="border-t border-white/5 align-top">
                  <td className="py-1 pr-2 text-gray-200">{s.code}</td>
                  <td className="pr-2 text-gray-300">{valueText(s.value)}</td>
                  <td className="pr-2"><Badge basis={s.basis} /> <span className="text-gray-500">{s.confidence} · {s.method}</span></td>
                  <td className="pr-2 text-gray-400 break-all">{s.sourceUrl ?? '—'}<br /><span className="text-gray-600">{dateTime(s.lastVerifiedAt)}</span></td>
                  <td className="text-gray-400">{s.evidenceQuote ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={`Findings (${findings.length})`}>
        <ul className="text-xs space-y-1.5">
          {findings.map((f) => (
            <li key={f.id} className="text-gray-300">
              <span className={f.polarity === 'strength' ? 'text-emerald-300' : 'text-amber-300'}>{f.polarity}</span> · {f.category} · {f.finding} <Badge basis={f.basis} />
              <div className="text-gray-500">Evidence: {f.evidence}{f.impactHypothesis ? ` · Hypothesis: ${f.impactHypothesis}` : ''}{f.validationQuestion ? ` · Validate: ${f.validationQuestion}` : ''}</div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={`Contact points (${contacts.length})`}>
        <ul className="text-xs text-gray-300 space-y-1">
          {contacts.map((c) => (
            <li key={c.id}>
              <b>{c.kind}</b>{c.name ? ` · ${c.name}${c.role ? ` (${c.role})` : ''}` : ''} · {c.email ?? c.phone ?? '—'} · confidence {c.confidence}
              {c.flags?.duplicateOf ? <span className="text-amber-300"> · shared with another prospect</span> : null}
              <span className="text-gray-500"> · {c.sourceUrl ?? c.sourceNote ?? 'no source'} · basis {c.lawfulBasis}{c.retainUntil ? ` · retain until ${dateTime(c.retainUntil)} (provisional)` : ''}</span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-gray-500">Named people are only ever added manually by an admin with a source and lawful basis.</p>
      </Section>

      <Section title="Sources">
        <ul className="text-xs text-gray-400 space-y-0.5">{sources.map((s) => <li key={s.id}>{s.kind} · {s.method ?? '—'} · {s.url ?? '—'} · HTTP {s.httpStatus ?? '—'} · {dateTime(s.fetchedAt)}</li>)}</ul>
      </Section>

      <Section title="Task timeline: agent runs and state changes" id="task-timeline">
        <p className="text-[11px] text-gray-500">Agent executions are the saved runs of the queue’s tasks. State changes and admin actions are entries from the audit trail. Queued tasks have not been executed yet.</p>
        <TaskTimeline items={detail.timeline ?? []} />
      </Section>

      <Section title="Audit trail" id="audit-trail">
        <ul className="text-xs text-gray-400 space-y-0.5">{events.map((e) => <li key={e.id}>{dateTime(e.createdAt)} · {e.fromState} → {e.toState} · {e.actor} · {e.reason}</li>)}</ul>
      </Section>

      <Section title="Admin actions">
        <div className="flex flex-wrap gap-2">
          {ACTIONS.map(([a, label]) => (
            <button key={a} onClick={() => act(a)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200">{label}</button>
          ))}
        </div>
        {msg && <p className="text-xs text-gray-400">{msg}</p>}
      </Section>
    </div>
  );
}
