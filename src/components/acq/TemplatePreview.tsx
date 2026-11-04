'use client';

import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { dayNumbers } from '@/lib/automation';
import { PIPELINE } from '@/lib/replyIntel';
import { WORKFORCE } from '@/lib/workforce';
import { briefFromTemplate, buildFromTemplate } from '@/lib/templateEngine';
import { parseKnobs } from '@/lib/campaignBuilder';
import type { TemplateConfig } from '@/lib/templateLibrary';

const H = ({ children }: { children: string }) => <p style={{ fontWeight: 700, fontSize: 12.5, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.04em', margin: '16px 0 6px' }}>{children}</p>;
const List = ({ items }: { items: string[] }) => <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 3, fontSize: 13.5 }}>{items.map((i) => <li key={i}>{i}</li>)}</ul>;

/** Everything a template contains, with the sequence it would write. Example wording only: it shows no results. */
export default function TemplatePreview({ t, onClose, onUse }: { t: TemplateConfig; onClose: () => void; onUse: () => void }) {
  const seq = useMemo(() => t.savedAutomation ?? buildFromTemplate(t, briefFromTemplate(t), parseKnobs('')), [t]);
  const days = dayNumbers(seq);
  const [open, setOpen] = useState(0);
  return (
    <div role="dialog" aria-modal="true" aria-label={`${t.name} preview`} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.45)', zIndex: 60, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '4vh 12px', overflowY: 'auto' }} onClick={onClose}>
      <div className="acq-card" style={{ width: '100%', maxWidth: 780, padding: 24 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div><p className="acq-sub" style={{ fontSize: 12.5 }}>{t.industry} · {t.category}</p><h2 className="acq-title" style={{ fontSize: 20 }}>{t.name}</h2><p className="acq-sub" style={{ marginTop: 4 }}>{t.description}</p></div>
          <button className="acq-icon-btn" aria-label="Close preview" onClick={onClose}><X size={18} /></button>
        </div>
        <H>Ideal customer</H><p style={{ fontSize: 13.5 }}>{t.idealCustomer}</p>
        <H>Who it targets</H><List items={t.audienceCriteria} />
        <H>Campaign objectives</H><List items={t.objectives} />
        <H>Messaging strategy</H><List items={t.messagingStrategy} />
        <H>Recommended call to action</H><p style={{ fontSize: 13.5 }}><b>{t.cta.recommended}</b>. Alternatives: {t.cta.alternatives.join('; ')}.</p>
        <H>Channels</H><p style={{ fontSize: 13.5 }}>Email sends today. {t.channels.filter((c) => c !== 'email').map((c) => c[0].toUpperCase() + c.slice(1)).join(', ')} {t.channels.length > 1 ? 'is planned and not switched on.' : ''}</p>
        <H>Example follow-up sequence (editable)</H>
        <div style={{ display: 'grid', gap: 8 }}>
          {seq.emails.map((e, i) => (
            <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
              <button style={{ width: '100%', display: 'flex', gap: 10, padding: '10px 12px', border: 0, background: open === i ? '#faf5ff' : '#fff', textAlign: 'left', alignItems: 'center' }} aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
                <span className="acq-pill acq-pill-purple">Day {days[i]}</span><span style={{ fontWeight: 600, fontSize: 13.5 }}>{e.subject}</span>
              </button>
              {open === i && <pre style={{ margin: 0, padding: '4px 14px 14px', whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, color: '#334155' }}>{e.body}</pre>}
            </div>
          ))}
        </div>
        <p className="acq-faint" style={{ fontSize: 12, marginTop: 6 }}>Placeholders like {'{{business}}'} are filled for each contact. This wording is an example until you enter your own details.</p>
        <H>Conversion stages</H><p style={{ fontSize: 13.5 }}>{PIPELINE.map((p) => t.stageLabels[p.id]).join(' → ')}</p>
        <H>Metrics tracked</H><p style={{ fontSize: 13.5 }}>{t.metrics.map((m) => m.label).join(', ')}. Real numbers only, counted as the campaign runs.</p>
        <H>What each agent focuses on</H>
        <List items={WORKFORCE.map((w) => `${w.name}: ${t.agents[w.id]}`)} />
        <H>Contacting this audience</H><p style={{ fontSize: 13.5 }}>{t.contactNote}</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="acq-btn" onClick={onClose}>Close</button>
          <button className="acq-btn acq-btn-primary" onClick={onUse}>Use template</button>
        </div>
      </div>
    </div>
  );
}
