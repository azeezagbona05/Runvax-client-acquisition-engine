'use client';

import { useState } from 'react';
import { Check, Plus } from 'lucide-react';

const lbl = { display: 'block', fontSize: 12.5, fontWeight: 600, color: '#475569', marginBottom: 6 } as const;
const chip = (_on: boolean, off = false) => ({ display: 'inline-flex', alignItems: 'center', gap: 5, textAlign: 'left' as const, lineHeight: 1.35, whiteSpace: 'normal' as const, maxWidth: '100%', minWidth: 0, opacity: off ? 0.45 : 1, cursor: off ? 'not-allowed' : 'pointer' });

/**
 * Multi-select: tick the ready-made options, untick to remove, or add your own.
 * Selected items keep their order; your own items show as chips too, so everything can be removed with one click.
 */
export function MultiChips({ id, label, hint, options, value, onChange, max, addLabel = 'Add your own', placeholder, custom = true }: {
  id: string; label: string; hint?: string; options: readonly string[]; value: string[]; onChange: (v: string[]) => void; max?: number; addLabel?: string; placeholder?: string; custom?: boolean;
}) {
  const [draft, setDraft] = useState(''); const [adding, setAdding] = useState(false);
  const picked = value.map((x) => x.trim()).filter(Boolean);
  const has = (o: string) => picked.some((p) => p.toLowerCase() === o.toLowerCase());
  const all = [...options, ...picked.filter((p) => !options.some((o) => o.toLowerCase() === p.toLowerCase()))];
  const full = max !== undefined && picked.length >= max;
  const toggle = (o: string) => has(o) ? onChange(picked.filter((p) => p.toLowerCase() !== o.toLowerCase())) : !full && onChange([...picked, o]);
  const add = () => { const t = draft.trim(); if (t && !has(t) && !full) onChange([...picked, t]); setDraft(''); };
  return (
    <div role="group" aria-labelledby={`${id}-l`}>
      <span id={`${id}-l`} style={lbl}>{label}{max !== undefined && <span className="acq-faint" style={{ fontWeight: 500 }}> · {picked.length}/{max}</span>}</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {all.map((o) => { const on = has(o); return (
          <button key={o} type="button" aria-pressed={on} disabled={!on && full} className={`acq-chip${on ? ' on' : ''}`} style={chip(on, !on && full)} onClick={() => toggle(o)}>
            {on ? <Check size={13} aria-hidden="true" /> : <Plus size={13} aria-hidden="true" />}{o}
          </button>
        ); })}
        {!custom ? null : !adding ? (
          <button type="button" className="acq-chip" style={{ ...chip(false, full), borderStyle: 'dashed' }} disabled={full} onClick={() => setAdding(true)}><Plus size={13} aria-hidden="true" />{addLabel}</button>
        ) : (
          <span style={{ display: 'inline-flex', gap: 6, flex: '1 1 260px' }}>
            <input id={`${id}-add`} autoFocus className="acq-input" style={{ height: 34 }} aria-label={`${label}: ${addLabel}`} placeholder={placeholder ?? 'Type and press Enter'} maxLength={200} value={draft}
              onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } if (e.key === 'Escape') { setDraft(''); setAdding(false); } }} onBlur={() => { add(); setAdding(false); }} />
          </span>
        )}
      </div>
      {(hint || full) && <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>{full ? `That is the most this can hold (${max}). Untick one to choose another.` : hint}</p>}
    </div>
  );
}

/** Single choice shown as chips (tone, schedule, length…). */
export function ChoiceChips<T extends string | number>({ id, label, options, value, onChange }: {
  id: string; label: string; options: ReadonlyArray<readonly [T, string]>; value: T; onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-labelledby={`${id}-l`}>
      <span id={`${id}-l`} style={lbl}>{label}</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {options.map(([v, text]) => { const on = v === value; return (
          <button key={String(v)} type="button" role="radio" aria-checked={on} className={`acq-chip${on ? ' on' : ''}`} style={chip(on)} onClick={() => onChange(v)}>
            {on && <Check size={13} aria-hidden="true" />}{text}
          </button>
        ); })}
      </div>
    </div>
  );
}
