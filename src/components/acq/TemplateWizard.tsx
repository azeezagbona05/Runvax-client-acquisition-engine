'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BookOpen, Search, Sparkles, Star } from 'lucide-react';
import { INDUSTRIES_INTEL, industryById, type IndustryId } from '@/lib/industryIntel';
import { OFFICIAL_TEMPLATES, type TemplateConfig } from '@/lib/templateLibrary';
import { TEMPLATE_ICON } from './templateIcons';
import IndustryGuide from './IndustryGuide';

type Step = 'industry' | 'campaign' | 'guide';
const LAST_KEY = 'runvax_last_industry';

/** Pick an industry, pick a campaign, go. One idea per screen, with an optional short guide behind a button. */
export default function TemplateWizard({ onUse, onPreview }: { onUse: (t: TemplateConfig) => void; onPreview: (t: TemplateConfig) => void }) {
  const [step, setStep] = useState<Step>('industry');
  const [industry, setIndustry] = useState<IndustryId | null>(null);
  const [q, setQ] = useState('');
  const [last, setLast] = useState<IndustryId | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  useEffect(() => { try { const v = localStorage.getItem(LAST_KEY); if (v && industryById(v)) setLast(v as IndustryId); } catch { /* none remembered */ } }, []);
  // Move focus to the new screen's heading when the step changes (for keyboard and screen-reader users), but not on first load.
  useEffect(() => { if (first.current) { first.current = false; return; } heading.current?.focus(); }, [step]);

  const choose = (id: IndustryId) => {
    setIndustry(id); setStep('campaign'); setQ('');
    try { localStorage.setItem(LAST_KEY, id); } catch { /* not remembered */ }
  };
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...INDUSTRIES_INTEL].sort((a, b) => Number(!!b.highPriority) - Number(!!a.highPriority))
      .filter((i) => !needle || `${i.label} ${i.targets} ${i.plural}`.toLowerCase().includes(needle));
  }, [q]);
  const ind = industry ? industryById(industry) : undefined;
  const templates = useMemo(() => OFFICIAL_TEMPLATES.filter((t) => t.industryId === industry), [industry]);
  const lastInd = last ? industryById(last) : undefined;

  if (step === 'guide' && industry) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <button type="button" className="acq-link" style={{ justifySelf: 'start' }} onClick={() => setStep('campaign')}><ArrowLeft size={14} /> Back to campaigns</button>
        <IndustryGuide key={industry} id={industry} onDone={() => setStep('campaign')} />
      </div>
    );
  }

  if (step === 'campaign' && ind) {
    return (
      <div style={{ display: 'grid', gap: 14 }}>
        <button type="button" className="acq-link" style={{ justifySelf: 'start' }} onClick={() => setStep('industry')}><ArrowLeft size={14} /> All industries</button>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <h2 className="acq-title" style={{ fontSize: 22, outline: 'none' }} ref={heading} tabIndex={-1}>{ind.label}</h2>
            <p className="acq-sub" style={{ fontSize: 14 }}>Pick a campaign to start from.</p>
          </div>
          <button type="button" className="acq-btn" onClick={() => setStep('guide')}><BookOpen size={16} /> Industry guide</button>
        </div>
        {ind.compliance && <p className="acq-warn" role="note" style={{ fontSize: 13 }}>{ind.compliance}</p>}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => {
            const Icon = TEMPLATE_ICON[t.art.icon];
            return (
              <section key={t.id} className="acq-card" style={{ padding: 16, display: 'grid', gap: 10, alignContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <span aria-hidden style={{ width: 40, height: 40, borderRadius: 12, background: '#f3e8ff', color: '#9333ea', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon size={20} /></span>
                  <div><h3 className="acq-title" style={{ fontSize: 15.5, fontWeight: 700 }}>{t.name}</h3><p className="acq-sub" style={{ fontSize: 13.5, marginTop: 2 }}>{t.description}</p></div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className="acq-btn acq-btn-primary" onClick={() => onUse(t)}>Use this <ArrowRight size={15} /></button>
                  <button className="acq-link" onClick={() => onPreview(t)}>See the emails</button>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <h2 className="acq-title" style={{ fontSize: 22, outline: 'none' }} ref={heading} tabIndex={-1}>What do you sell?</h2>
        <p className="acq-sub" style={{ fontSize: 14 }}>Pick the industry you want to win clients in.</p>
      </div>
      {lastInd && (
        <button type="button" className="acq-btn acq-btn-primary" style={{ justifySelf: 'start' }} onClick={() => choose(lastInd.id)}>Continue with {lastInd.label} <ArrowRight size={15} /></button>
      )}
      <div style={{ position: 'relative', maxWidth: 420 }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: 14, color: '#94a3b8' }} />
        <input className="acq-input" style={{ paddingLeft: 34 }} placeholder="Search industries" aria-label="Search industries" name="industry-search" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {list.length === 0
        ? <p className="acq-sub" style={{ fontSize: 14 }}>No industry matches. Try another word, or describe what you sell below.</p>
        : <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4" role="group" aria-label="Industries">
            {list.map((i) => {
              const Icon = TEMPLATE_ICON[i.icon];
              return (
                <button key={i.id} type="button" onClick={() => choose(i.id)} aria-label={i.label}
                  style={{ position: 'relative', display: 'grid', justifyItems: 'center', gap: 8, padding: '18px 10px', borderRadius: 16, border: '1.5px solid #e2e8f0', background: '#fff', minHeight: 104 }}>
                  {i.highPriority && <Star size={14} aria-label="Popular" style={{ position: 'absolute', top: 10, right: 10, color: '#f59e0b' }} fill="#f59e0b" />}
                  <span aria-hidden style={{ width: 44, height: 44, borderRadius: 14, background: '#f3e8ff', color: '#9333ea', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={22} /></span>
                  <b style={{ fontSize: 14, color: '#0f172a', textAlign: 'center', lineHeight: 1.25 }}>{i.label}</b>
                </button>
              );
            })}
          </div>}
      <p style={{ fontSize: 13.5 }}><Link href="/client-acquisition/automation" className="acq-link"><Sparkles size={13} /> Not sure? Describe what you sell in one sentence</Link></p>
    </div>
  );
}
