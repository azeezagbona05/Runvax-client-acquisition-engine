'use client';

import { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import {
  COMPLIANCE_BY_COUNTRY, GENERAL_COMPLIANCE, decisionMakerTitles, industryById, type IndustryId, type Readiness,
} from '@/lib/industryIntel';
import { CHANNEL_LABEL, LINKEDIN_CONNECT_MAX, draftsFor, outreachGuidance } from '@/lib/outreachDrafts';
import { FACTOR_LABEL, PRIORITY_LABEL, WEIGHTS, MIN_EVIDENCE_FOR_A } from '@/lib/leadScoring';

type Tab = 'look' | 'people' | 'approach' | 'drafts' | 'score';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'look', label: 'What RUNVAX looks for' }, { id: 'people', label: 'Who to approach' }, { id: 'approach', label: 'Offers and approach' },
  { id: 'drafts', label: 'Outreach drafts' }, { id: 'score', label: 'How leads are scored' },
];
const READY: Record<Readiness, { label: string; bg: string; fg: string; hint: string }> = {
  live: { label: 'Live', bg: '#dcfce7', fg: '#15803d', hint: 'Read from data RUNVAX already collects.' },
  partial: { label: 'Partial', bg: '#fef3c7', fg: '#b45309', hint: 'Checked in part, for example what a business\'s own page or listing shows.' },
  planned: { label: 'Planned', bg: '#f1f5f9', fg: '#475569', hint: 'Not collected yet.' },
};
const COUNTRIES = [['NG', 'Nigeria'], ['GH', 'Ghana'], ['KE', 'Kenya'], ['ZA', 'South Africa'], ['GB', 'United Kingdom'], ['US', 'United States'], ['CA', 'Canada'], ['AU', 'Australia'], ['IE', 'Ireland']];
const chip = { padding: '4px 10px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, background: '#f3e8ff', color: '#7e22ce' } as const;

/** What RUNVAX knows about an industry: what it investigates, who decides, what to offer, the outreach drafts and the scoring. */
export default function IndustryIntelPanel({ id }: { id: IndustryId }) {
  const ind = industryById(id)!;
  const [tab, setTab] = useState<Tab>('look');
  const [country, setCountry] = useState('NG');
  const [copied, setCopied] = useState('');
  const titles = useMemo(() => decisionMakerTitles(id, country), [id, country]);
  const drafts = useMemo(() => draftsFor(id), [id]);
  const rules = ind.compliance;
  const law = COMPLIANCE_BY_COUNTRY[country];

  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1600); } catch { /* clipboard blocked: the text is on screen to select */ }
  };

  return (
    <section className="acq-card" aria-label={`${ind.label} intelligence`} style={{ padding: 18, display: 'grid', gap: 14 }}>
      <div>
        <p className="acq-sub" style={{ fontSize: 12.5 }}>{ind.group}{ind.highPriority ? ' · High priority' : ''}</p>
        <h2 className="acq-title" style={{ fontSize: 18 }}>{ind.label} acquisition engine</h2>
        <p className="acq-sub" style={{ fontSize: 13.5, marginTop: 2 }}>{ind.targets}</p>
      </div>
      {rules && <p className="acq-warn" role="note" style={{ fontSize: 13 }}>{rules}</p>}
      <div role="tablist" aria-label="Industry intelligence" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {TABS.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} className={`acq-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>

      {tab === 'look' && (
        <div style={{ overflowX: 'auto' }}>
          <table className="acq-table acq-rt" style={{ minWidth: 520 }}>
            <thead><tr><th>Feature</th><th>What RUNVAX identifies</th><th>Status</th></tr></thead>
            <tbody>
              {ind.intel.map((it) => (
                <tr key={it.feature}>
                  <td data-primary style={{ fontWeight: 600 }}>{it.feature}</td>
                  <td data-wide>{it.identify}</td>
                  <td data-label="Status"><span title={READY[it.ready].hint} style={{ ...chip, background: READY[it.ready].bg, color: READY[it.ready].fg }}>{READY[it.ready].label}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="acq-faint" style={{ fontSize: 12, marginTop: 8 }}>Live items come from data RUNVAX already collects. Planned items are on the roadmap and are not collected yet, so nothing is claimed about them.</p>
        </div>
      )}

      {tab === 'people' && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div><p className="acq-sub" style={{ fontSize: 12.5, marginBottom: 6 }}>Primary decision-makers</p><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{titles.primary.map((t) => <span key={t} style={chip}>{t}</span>)}</div></div>
          <div><p className="acq-sub" style={{ fontSize: 12.5, marginBottom: 6 }}>Secondary</p><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{titles.secondary.map((t) => <span key={t} style={{ ...chip, background: '#f1f5f9', color: '#334155' }}>{t}</span>)}</div></div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, flexWrap: 'wrap' }}>Job titles used in
            <select className="acq-select" style={{ width: 'auto', height: 38 }} aria-label="Country for job titles" value={country} onChange={(e) => setCountry(e.target.value)}>
              {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            </select>
          </label>
          <div><p className="acq-sub" style={{ fontSize: 12.5, marginBottom: 6 }}>Also look for in this country</p>
            {titles.local.length ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{titles.local.map((t) => <span key={t} style={{ ...chip, background: '#e0f2fe', color: '#0369a1' }}>{t}</span>)}</div> : <p className="acq-sub" style={{ fontSize: 13 }}>The titles above are used as they are here.</p>}
          </div>
        </div>
      )}

      {tab === 'approach' && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div><p className="acq-sub" style={{ fontSize: 12.5, marginBottom: 6 }}>Suggested offers</p><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{ind.offers.map((x) => <span key={x.name} style={chip}>{x.name}</span>)}</div></div>
          <div><p className="acq-sub" style={{ fontSize: 12.5, marginBottom: 6 }}>How the message is written</p>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 4, fontSize: 13.5 }}>{outreachGuidance(ind).map((g) => <li key={g}>{g}</li>)}</ul></div>
          <div><p className="acq-sub" style={{ fontSize: 12.5, marginBottom: 6 }}>Growth signs that raise priority</p><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{ind.growthExamples.map((g) => <span key={g} style={{ ...chip, background: '#f1f5f9', color: '#334155' }}>{g}</span>)}</div></div>
          <div className="acq-notice" style={{ fontSize: 13 }}>
            <b>Compliance.</b> {law ? <>{law.law}: {law.note} </> : null}{GENERAL_COMPLIANCE}
          </div>
        </div>
      )}

      {tab === 'drafts' && (
        <div style={{ display: 'grid', gap: 12 }}>
          <p className="acq-sub" style={{ fontSize: 13 }}>Drafts to adapt. Replace the bracketed parts with something you really noticed about the business. Nothing here is sent automatically.</p>
          {drafts.map((d) => {
            const text = (d.subject ? `Subject: ${d.subject}\n\n` : '') + d.body;
            return (
              <div key={d.channel} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <b style={{ fontSize: 14 }}>{CHANNEL_LABEL[d.channel]}{d.channel === 'linkedin_connect' ? <span className="acq-faint" style={{ fontWeight: 500, fontSize: 12 }}> · {d.body.length} of {LINKEDIN_CONNECT_MAX} characters</span> : null}</b>
                  <button type="button" className="acq-btn acq-btn-sm" onClick={() => void copy(d.channel, text)} aria-label={`Copy ${CHANNEL_LABEL[d.channel]}`}>{copied === d.channel ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}</button>
                </div>
                {d.subject && <p style={{ fontSize: 13 }}><span className="acq-sub">Subject: </span>{d.subject}</p>}
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13.5, color: '#334155' }}>{d.body}</pre>
                {d.note && <p className="acq-faint" style={{ fontSize: 12 }}>{d.note}</p>}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'score' && (
        <div style={{ display: 'grid', gap: 12 }}>
          <table className="acq-table"><tbody>
            {(Object.keys(WEIGHTS) as Array<keyof typeof WEIGHTS>).map((k) => <tr key={k}><td>{FACTOR_LABEL[k]}</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{WEIGHTS[k]}</td></tr>)}
            <tr><td><b>Total</b></td><td style={{ textAlign: 'right', fontWeight: 700 }}>100</td></tr>
          </tbody></table>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 3, fontSize: 13.5 }}>
            <li><b>80 to 100</b>: {PRIORITY_LABEL.A}</li><li><b>60 to 79</b>: {PRIORITY_LABEL.B}</li><li><b>40 to 59</b>: {PRIORITY_LABEL.C}</li><li><b>0 to 39</b>: {PRIORITY_LABEL.Low}</li>
          </ul>
          <p className="acq-sub" style={{ fontSize: 13 }}>Missing information is never treated as proof of a problem: an opportunity scores only when it was observed. A found email is not a decision-maker: those points need an identified person. Evidence quality is reported separately. A lead cannot be Priority A below {MIN_EVIDENCE_FOR_A} evidence quality, or unless at least one opportunity was actually observed and not only inferred.</p>
        </div>
      )}
    </section>
  );
}
