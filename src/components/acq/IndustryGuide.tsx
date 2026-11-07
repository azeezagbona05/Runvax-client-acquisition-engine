'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Copy } from 'lucide-react';
import { decisionMakerTitles, industryById, type IndustryId, type Readiness } from '@/lib/industryIntel';
import { CHANNEL_LABEL, draftsFor, type DraftChannel } from '@/lib/outreachDrafts';
import { FACTOR_LABEL, WEIGHTS } from '@/lib/leadScoring';

const COUNTRIES = [['NG', 'Nigeria'], ['GH', 'Ghana'], ['KE', 'Kenya'], ['ZA', 'South Africa'], ['GB', 'United Kingdom'], ['US', 'United States'], ['CA', 'Canada'], ['AU', 'Australia']];
const DOT: Record<Readiness, string> = { live: '#16a34a', partial: '#f59e0b', planned: '#cbd5e1' };
const chip = { padding: '6px 12px', borderRadius: 999, fontSize: 13.5, fontWeight: 600, background: '#f3e8ff', color: '#7e22ce' } as const;
const PAGES = ['Who we contact', 'What we look for', 'How we write', 'Messages to copy', 'How leads are scored'] as const;

/** Five short pages with Back and Next: what RUNVAX does for an industry, one idea at a time. */
export default function IndustryGuide({ id, onDone }: { id: IndustryId; onDone: () => void }) {
  const ind = industryById(id)!;
  const [page, setPage] = useState(0);
  const [country, setCountry] = useState('NG');
  const [channel, setChannel] = useState<DraftChannel>('cold_email');
  const [copied, setCopied] = useState(false);
  const titles = useMemo(() => decisionMakerTitles(id, country), [id, country]);
  const drafts = useMemo(() => draftsFor(id), [id]);
  const draft = drafts.find((d) => d.channel === channel) ?? drafts[0];
  const last = page === PAGES.length - 1;

  const copy = async () => {
    try { await navigator.clipboard.writeText((draft.subject ? `Subject: ${draft.subject}\n\n` : '') + draft.body); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked: the text is on screen */ }
  };

  return (
    <section className="acq-card" aria-label={`${ind.label} guide`} style={{ padding: 20, display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <p className="acq-sub" style={{ fontSize: 13 }}>{ind.label} guide · {page + 1} of {PAGES.length}</p>
        <div aria-hidden style={{ display: 'flex', gap: 6 }}>{PAGES.map((p, i) => <span key={p} style={{ width: i === page ? 22 : 8, height: 8, borderRadius: 999, background: i <= page ? '#9333ea' : '#e9d5ff', transition: 'width .2s' }} />)}</div>
      </div>
      <h2 className="acq-title" style={{ fontSize: 22 }}>{PAGES[page]}</h2>

      <div style={{ minHeight: 190, display: 'grid', alignContent: 'start', gap: 12 }}>
        {page === 0 && (<>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{titles.primary.map((t) => <span key={t} style={chip}>{t}</span>)}</div>
          <p className="acq-sub" style={{ fontSize: 13.5 }}>Next in line: {titles.secondary.join(', ')}.</p>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, flexWrap: 'wrap' }}>In
            <select className="acq-select" style={{ width: 'auto', height: 40 }} aria-label="Country for job titles" value={country} onChange={(e) => setCountry(e.target.value)}>
              {COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            </select>
            {titles.local.length ? <span>also look for <b>{titles.local.join(', ')}</b></span> : <span className="acq-sub">the same titles apply</span>}
          </label>
        </>)}

        {page === 1 && (<>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
            {ind.intel.slice(0, 8).map((x) => (
              <li key={x.feature} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 15 }}>
                <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: DOT[x.ready], flex: 'none' }} />
                <span>{x.feature}</span><span className="sr-only">{x.ready === 'live' ? 'available now' : x.ready === 'partial' ? 'partly available' : 'coming soon'}</span>
              </li>
            ))}
          </ul>
          <p className="acq-faint" style={{ fontSize: 12.5 }}>Green is available now, amber is partly there, grey is coming.</p>
        </>)}

        {page === 2 && (<>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 8, fontSize: 15 }}>
            <li>Notice something real about the business, such as {ind.angle.reference}.</li>
            <li>Say how you can help them {ind.angle.benefit}.</li>
            <li>Ask one simple question. No hype, no promised results.</li>
          </ol>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{ind.offers.slice(0, 4).map((x) => <span key={x.name} style={chip}>{x.name}</span>)}</div>
          {ind.compliance && <p className="acq-warn" role="note" style={{ fontSize: 13 }}>{ind.compliance}</p>}
        </>)}

        {page === 3 && (<>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Message type">
            {drafts.map((d) => <button key={d.channel} type="button" aria-pressed={channel === d.channel} className={`acq-tab${channel === d.channel ? ' active' : ''}`} onClick={() => setChannel(d.channel)}>{CHANNEL_LABEL[d.channel]}</button>)}
          </div>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 14, padding: 14, display: 'grid', gap: 8 }}>
            {draft.subject && <p style={{ fontSize: 13.5 }}><span className="acq-sub">Subject: </span><b>{draft.subject}</b></p>}
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 14, color: '#334155' }}>{draft.body}</pre>
            {draft.note && <p className="acq-faint" style={{ fontSize: 12.5 }}>{draft.note}</p>}
            <button type="button" className="acq-btn acq-btn-sm" style={{ justifySelf: 'start' }} onClick={() => void copy()} aria-label={`Copy ${CHANNEL_LABEL[draft.channel]}`}>{copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}</button>
          </div>
          <p className="acq-faint" style={{ fontSize: 12.5 }}>Fill in the brackets with something you really noticed. Nothing is sent from here.</p>
        </>)}

        {page === 4 && (<>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 8 }}>
            {(Object.keys(WEIGHTS) as Array<keyof typeof WEIGHTS>).map((k) => (
              <li key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15 }}>
                <span style={{ flex: 1 }}>{FACTOR_LABEL[k]}</span>
                <span aria-hidden style={{ width: `${WEIGHTS[k] * 4}px`, height: 8, borderRadius: 999, background: '#c084fc' }} />
                <b style={{ width: 28, textAlign: 'right' }}>{WEIGHTS[k]}</b>
              </li>
            ))}
          </ul>
          <p style={{ fontSize: 14 }}><b>80+</b> top priority · <b>60+</b> good · <b>40+</b> needs review. Guesses never count as proof.</p>
        </>)}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <button type="button" className="acq-btn" onClick={() => (page === 0 ? onDone() : setPage(page - 1))}><ArrowLeft size={16} /> {page === 0 ? 'Campaigns' : 'Back'}</button>
        <button type="button" className="acq-btn acq-btn-primary" onClick={() => (last ? onDone() : setPage(page + 1))}>{last ? 'Choose a campaign' : 'Next'} <ArrowRight size={16} /></button>
      </div>
    </section>
  );
}
