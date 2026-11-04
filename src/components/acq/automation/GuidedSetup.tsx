'use client';

import { Loader2, Wand2 } from 'lucide-react';
import { CONVERSIONS, OBJECTIVES, type CampaignBrief, type Conversion, type Objective } from '@/lib/campaignBrief';
import { WORKFORCE } from '@/lib/workforce';
import type { Strategy } from '@/lib/templateEngine';
import type { TemplateConfig } from '@/lib/templateLibrary';
import { Card } from '../ui';

const label = { fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6, display: 'block' } as const;
const CHANNELS: Array<{ id: string; name: string; live: boolean }> = [
  { id: 'email', name: 'Email', live: true }, { id: 'whatsapp', name: 'WhatsApp (planned)', live: false }, { id: 'sms', name: 'SMS (planned)', live: false }, { id: 'linkedin', name: 'LinkedIn (planned)', live: false },
];

/** The nine guided questions for a template, worded for its industry. Answers fill the campaign brief. */
export function GuidedSetup({ tpl, brief, setBrief, featuresText, setFeaturesText, busy, built, contactsCount, onGenerate }: {
  tpl: TemplateConfig; brief: CampaignBrief; setBrief: (b: CampaignBrief) => void; featuresText: string; setFeaturesText: (s: string) => void;
  busy: boolean; built: boolean; contactsCount: number; onGenerate: () => void;
}) {
  const q = tpl.questions;
  const channels = brief.channels?.length ? brief.channels : ['email'];
  const num = (n: number, text: string) => <label style={label}>{n}. {text}</label>;
  return (
    <section className="acq-card" aria-label="Guided campaign setup">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <div><p className="acq-sub" style={{ fontSize: 12.5 }}>{tpl.industry} template</p><h2 className="acq-title" style={{ fontSize: 17, fontWeight: 800 }}>{tpl.name}</h2><p className="acq-sub" style={{ fontSize: 12.5 }}>Answer what you can. Anything left blank uses the template&apos;s default. Everything the assistant writes stays editable.</p></div>
        <button className="acq-btn acq-btn-primary" disabled={busy} onClick={onGenerate}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />} {built ? 'Regenerate campaign' : 'Generate campaign'}</button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>{num(1, q.offer.label)}<input className="acq-input" maxLength={120} value={brief.offer} placeholder={q.offer.placeholder} onChange={(e) => setBrief({ ...brief, offer: e.target.value })} /></div>
        <div>{num(4, q.market.label)}<input className="acq-input" maxLength={120} value={brief.market ?? ''} placeholder={q.market.placeholder} onChange={(e) => setBrief({ ...brief, market: e.target.value })} /></div>
        <div className="md:col-span-2">{num(2, q.summary.label)}<textarea className="acq-textarea" rows={2} maxLength={500} value={brief.offerSummary} placeholder={q.summary.placeholder} onChange={(e) => setBrief({ ...brief, offerSummary: e.target.value })} /></div>
        <div>{num(3, q.features.label)}<textarea className="acq-textarea" rows={5} value={featuresText} placeholder={q.features.placeholder} onChange={(e) => { setFeaturesText(e.target.value); setBrief({ ...brief, features: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 8) }); }} /></div>
        <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <div>{num(5, q.audience.label)}<input className="acq-input" maxLength={160} value={brief.audience} placeholder={q.audience.placeholder} onChange={(e) => setBrief({ ...brief, audience: e.target.value })} /></div>
          <div>{num(6, q.objective.label)}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select className="acq-select" style={{ width: 'auto', minWidth: 180 }} aria-label="Campaign objective" value={brief.objective} onChange={(e) => setBrief({ ...brief, objective: e.target.value as Objective })}>{OBJECTIVES.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select>
              <input className="acq-input" style={{ flex: '1 1 160px' }} maxLength={200} aria-label="Campaign goal" value={brief.goal} placeholder={q.objective.placeholder} onChange={(e) => setBrief({ ...brief, goal: e.target.value })} />
            </div></div>
        </div>
        <div>{num(7, q.contacts.label)}<p style={{ fontSize: 13.5 }}>{contactsCount ? <b>{contactsCount} contact{contactsCount === 1 ? '' : 's'} added.</b> : 'None added yet.'} <span className="acq-sub">{q.contacts.help}</span></p></div>
        <div>{num(8, q.channels.label)}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{CHANNELS.map((c) => (
            <label key={c.id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, opacity: c.live ? 1 : .55 }}>
              <input type="checkbox" disabled={!c.live} checked={channels.includes(c.id)} onChange={(e) => setBrief({ ...brief, channels: e.target.checked ? [...channels, c.id] : channels.filter((x) => x !== c.id) })} style={{ accentColor: '#9333ea' }} />{c.name}
            </label>))}</div>
          <p className="acq-faint" style={{ fontSize: 11.5, marginTop: 4 }}>{q.channels.help}</p></div>
        <div>{num(9, q.conversion.label)}<select className="acq-select" aria-label="Desired conversion action" value={brief.conversion ?? tpl.conversion} onChange={(e) => setBrief({ ...brief, conversion: e.target.value as Conversion })}>{CONVERSIONS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
        <div><label style={label}>How your emails end</label><input className="acq-input" maxLength={200} value={brief.signOff} placeholder="e.g. Azeez, Harzotech Innovative Solutions" onChange={(e) => setBrief({ ...brief, signOff: e.target.value })} /></div>
      </div>
      <p className="acq-faint" style={{ fontSize: 12, marginTop: 12 }}>{tpl.contactNote}</p>
    </section>
  );
}

/** What the assistant planned, in plain words. A plan, not a forecast. */
export function StrategyPanel({ s }: { s: Strategy }) {
  const name = Object.fromEntries(WORKFORCE.map((w) => [w.id, w.name]));
  return (
    <Card title="Campaign strategy">
      <p style={{ fontSize: 13.5 }}>{s.summary}</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2" style={{ marginTop: 12 }}>
        <div><b style={{ fontSize: 13 }}>Audience recommendations</b><ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13, display: 'grid', gap: 2 }}>{s.audience.map((a) => <li key={a}>{a}</li>)}</ul></div>
        <div><b style={{ fontSize: 13 }}>Messaging angles</b><ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13, display: 'grid', gap: 2 }}>{s.angles.map((a) => <li key={a}>{a}</li>)}</ul></div>
        <div><b style={{ fontSize: 13 }}>Recommended call to action</b><p style={{ fontSize: 13, marginTop: 6 }}>{s.cta.recommended}. Alternatives: {s.cta.alternatives.join('; ')}.</p></div>
        <div><b style={{ fontSize: 13 }}>Execution plan</b><ol style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13, display: 'grid', gap: 2 }}>{s.plan.map((p) => <li key={p}>{p}</li>)}</ol></div>
      </div>
      <details style={{ marginTop: 12 }}><summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>What each agent will focus on</summary>
        <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13, display: 'grid', gap: 2 }}>{s.agents.map((a) => <li key={a.id}><b>{name[a.id] ?? a.id}:</b> {a.focus}</li>)}</ul></details>
    </Card>
  );
}
