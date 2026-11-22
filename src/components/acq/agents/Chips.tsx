'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, X } from 'lucide-react';

const lbl = { display: 'block', fontSize: 12.5, fontWeight: 600, color: '#475569', marginBottom: 6 } as const;
const chip = (_on: boolean, off = false) => ({ display: 'inline-flex', alignItems: 'center', gap: 5, textAlign: 'left' as const, lineHeight: 1.35, whiteSpace: 'normal' as const, maxWidth: '100%', minWidth: 0, opacity: off ? 0.45 : 1, cursor: off ? 'not-allowed' : 'pointer' });

/**
 * A searchable dropdown. `multi`: tick several (they show as removable tags); otherwise pick one.
 * Type to filter; with `custom`, type something that is not listed and add it. Keyboard: arrows, Enter, Escape, Backspace removes the last tag.
 */
function Combo({ id, label, hint, options, value, onChange, max, multi, custom = true, addLabel = 'Add', placeholder, locked = [], optionHint }: {
  id: string; label: string; hint?: string; options: readonly string[]; value: string[]; onChange: (v: string[]) => void; max?: number; multi: boolean; custom?: boolean; addLabel?: string; placeholder?: string; locked?: readonly string[]; optionHint?: (o: string) => string | undefined;
}) {
  const [q, setQ] = useState(''); const [open, setOpen] = useState(false); const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null); const input = useRef<HTMLInputElement>(null);
  const picked = value.map((x) => x.trim()).filter(Boolean);
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const has = (o: string) => picked.some((p) => same(p, o));
  const all = [...options, ...picked.filter((p) => !options.some((o) => same(o, p)))];
  const term = q.trim(); const shown = all.filter((o) => !term || o.toLowerCase().includes(term.toLowerCase()));
  const canAdd = custom && !!term && !all.some((o) => same(o, term));
  const full = multi && max !== undefined && picked.length >= max;
  const rows: Array<{ k: 'opt' | 'add'; o: string }> = [...shown.map((o) => ({ k: 'opt' as const, o })), ...(canAdd ? [{ k: 'add' as const, o: term }] : [])];
  useEffect(() => { const off = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) { setOpen(false); setQ(''); } }; document.addEventListener('mousedown', off); return () => document.removeEventListener('mousedown', off); }, []);
  const remove = (o: string) => { if (!locked.includes(o)) onChange(picked.filter((p) => !same(p, o))); };
  const choose = (r: { k: 'opt' | 'add'; o: string }) => {
    if (!multi) { onChange(has(r.o) && r.k === 'opt' ? [] : [r.o]); setOpen(false); setQ(''); return; }
    if (r.k === 'opt' && has(r.o)) remove(r.o); else if (!full) onChange([...picked, r.o]);
    setQ(''); input.current?.focus();
  };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((h) => Math.min(rows.length - 1, h + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(0, h - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (open && rows[hi]) choose(rows[hi]); else setOpen(true); }
    else if (e.key === 'Escape') { setOpen(false); setQ(''); }
    else if (e.key === 'Backspace' && !q && multi && picked.length) remove(picked[picked.length - 1]);
  };
  const list = `${id}-list`;
  return (
    <div ref={box} style={{ position: 'relative' }}>
      <label id={`${id}-l`} htmlFor={`${id}-in`} style={lbl}>{label}{multi && max !== undefined && <span className="acq-faint" style={{ fontWeight: 500 }}> · {picked.length}/{max}</span>}</label>
      <div className="acq-input" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', minHeight: 44, height: 'auto', padding: '5px 8px', cursor: 'text' }} onClick={() => { setOpen(true); input.current?.focus(); }}>
        {picked.map((p) => multi ? (
          <span key={p} className="acq-chip on" style={{ display: 'inline-flex', gap: 4, alignItems: 'center', padding: '2px 4px 2px 10px', maxWidth: '100%' }}>
            <span style={{ whiteSpace: 'normal', textAlign: 'left' }}>{p}</span>
            {!locked.includes(p) && <button type="button" aria-label={`Remove ${p}`} style={{ display: 'inline-grid', placeItems: 'center', width: 20, height: 20, borderRadius: 10 }} onClick={(e) => { e.stopPropagation(); remove(p); }}><X size={12} aria-hidden="true" /></button>}
          </span>
        ) : (!open || !q) && <span key={p} style={{ padding: '0 4px' }}>{p}</span>)}
        <input ref={input} id={`${id}-in`} role="combobox" aria-expanded={open} aria-controls={list} aria-autocomplete="list" autoComplete="off" value={q} maxLength={200}
          placeholder={picked.length && multi ? '' : placeholder ?? (multi ? 'Search or pick…' : picked.length ? '' : 'Search or pick…')}
          style={{ flex: '1 1 120px', minWidth: 90, border: 0, outline: 0, background: 'transparent', fontSize: 14, height: 30 }}
          onFocus={() => setOpen(true)} onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }} onKeyDown={key} />
        <ChevronDown size={16} aria-hidden="true" style={{ color: '#64748b', flexShrink: 0, marginLeft: 'auto' }} />
      </div>
      {open && (
        <ul id={list} role="listbox" aria-multiselectable={multi} aria-labelledby={`${id}-l`} style={{ position: 'absolute', zIndex: 30, left: 0, right: 0, top: '100%', marginTop: 4, maxHeight: 280, overflowY: 'auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 12px 30px rgba(15,23,42,.14)', padding: 4, listStyle: 'none' }}>
          {rows.length === 0 && <li style={{ padding: '10px 12px', fontSize: 13, color: '#64748b' }}>{custom ? 'Type to add your own.' : 'Nothing matches.'}</li>}
          {rows.map((r, i) => { const on = r.k === 'opt' && has(r.o); const off = !on && full; const lock = on && locked.includes(r.o); const sub = r.k === 'opt' ? optionHint?.(r.o) : undefined; return (
            <li key={`${r.k}-${r.o}`} role="option" aria-selected={on} aria-disabled={off || lock} onMouseEnter={() => setHi(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => { if (!off && !lock) choose(r); }}
              style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px', borderRadius: 8, fontSize: 14, cursor: off || lock ? 'default' : 'pointer', opacity: off ? 0.45 : 1, background: i === hi ? '#f3e8ff' : 'transparent' }}>
              {r.k === 'add' ? <Plus size={14} aria-hidden="true" /> : <span aria-hidden="true" style={{ width: 14, height: 14, display: 'inline-grid', placeItems: 'center', flexShrink: 0, borderRadius: multi ? 4 : 7, border: '1px solid #94a3b8', background: on ? '#7e22ce' : '#fff', color: '#fff' }}>{on && <Check size={11} />}</span>}
              <span style={{ minWidth: 0 }}>{r.k === 'add' ? `${addLabel} "${r.o}"` : r.o}{sub && <span className="acq-faint" style={{ display: 'block', fontSize: 12 }}>{sub}</span>}{lock && <span className="acq-faint" style={{ fontSize: 12 }}> (always on)</span>}</span>
            </li>
          ); })}
        </ul>
      )}
      {(hint || full || !open) && <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>{full ? `That is the most this can hold (${max}). Remove one to choose another.` : hint ?? (multi ? `Click to open the list, tick as many as you like${custom ? ', or type your own and press Enter' : ''}.` : `Click to open the list and pick one${custom ? ', or type your own' : ''}.`)}</p>}
    </div>
  );
}

/** Multi-select dropdown: search, tick several, or add your own. Selected items show as removable tags. */
export function MultiChips({ id, label, hint, options, value, onChange, max, addLabel = 'Add', placeholder, custom = true, locked, optionHint }: {
  id: string; label: string; hint?: string; options: readonly string[]; value: string[]; onChange: (v: string[]) => void; max?: number; addLabel?: string; placeholder?: string; custom?: boolean; locked?: readonly string[]; optionHint?: (o: string) => string | undefined;
}) {
  return <Combo multi id={id} label={label} hint={hint} options={options} value={value} onChange={onChange} max={max} addLabel={addLabel} placeholder={placeholder} custom={custom} locked={locked} optionHint={optionHint} />;
}

/** Single-choice searchable dropdown; with `custom`, a typed value that is not listed can be used. */
export function SingleSelect({ id, label, hint, options, value, onChange, custom = true, placeholder }: {
  id: string; label: string; hint?: string; options: readonly string[]; value: string; onChange: (v: string) => void; custom?: boolean; placeholder?: string;
}) {
  return <Combo multi={false} id={id} label={label} hint={hint} options={options} value={value ? [value] : []} onChange={(l) => onChange(l[0] ?? '')} custom={custom} placeholder={placeholder} addLabel="Use" />;
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
