'use client';

import { NO_AUTOFILL } from '@/lib/noAutofill';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react';

export interface SearchOption { value: string; label: string; group?: string }

type Common = {
  id?: string; options: SearchOption[]; placeholder?: string; searchPlaceholder?: string; disabled?: boolean; emptyText?: string;
};

/** One choice. Click or focus to open, type to filter, arrow keys to move, Enter to pick, Esc to close. */
export default function SearchSelect(p: Common & { value: string; onChange: (value: string) => void }) {
  return <Picker {...p} multi={false} values={p.value ? [p.value] : []} onPick={(v) => p.onChange(v)} />;
}

/**
 * Several choices shown as removable chips. The list stays open after each pick. With `allowCustom`, whatever is typed
 * can be added as its own value (for places not in the list). `max` caps how many can be chosen.
 */
export function MultiSearchSelect(p: Common & { values: string[]; onChange: (values: string[]) => void; allowCustom?: boolean; max?: number; customLabel?: (q: string) => string }) {
  const { values, onChange, max } = p;
  const toggle = (v: string) => {
    if (values.includes(v)) onChange(values.filter((x) => x !== v));
    else if (!max || values.length < max) onChange([...values, v]);
  };
  return <Picker {...p} multi values={values} onPick={toggle} onRemove={(v) => onChange(values.filter((x) => x !== v))} full={!!max && values.length >= max} />;
}

function Picker({ id, options: allOptions, placeholder = 'Select…', searchPlaceholder = 'Type to search…', disabled, emptyText = 'No match', multi, values, onPick, onRemove, allowCustom, customLabel, full }: Common & {
  multi: boolean; values: string[]; onPick: (v: string) => void; onRemove?: (v: string) => void; allowCustom?: boolean; customLabel?: (q: string) => string; full?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const options = allOptions;
  const labelOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const single = !multi ? options.find((o) => o.value === values[0]) : undefined;

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    const seenV = new Set<string>();
    const options = allOptions.filter((o) => (seenV.has(o.value) ? false : (seenV.add(o.value), true)));
    const base: SearchOption[] = t ? [
      ...options.filter((o) => o.label.toLowerCase().startsWith(t)),
      ...options.filter((o) => !o.label.toLowerCase().startsWith(t) && (o.label.toLowerCase().includes(t) || o.value.toLowerCase() === t)),
    ] : options;
    const exact = options.some((o) => o.label.toLowerCase() === t) || values.some((v) => v.toLowerCase() === t);
    return allowCustom && t && !exact ? [{ value: q.trim(), label: customLabel ? customLabel(q.trim()) : `Add "${q.trim()}"`, group: '__custom' }, ...base] : base;
  }, [allOptions, q, allowCustom, customLabel, values]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) { setOpen(false); setQ(''); } };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  const scrollTo = (n: number) => requestAnimationFrame(() => list.current?.querySelector<HTMLElement>(`[data-ix="${n}"]`)?.scrollIntoView({ block: 'nearest' }));
  const openList = () => {
    if (disabled || open) return;
    setOpen(true);
    const ix = multi ? 0 : Math.max(0, options.findIndex((o) => o.value === values[0]));
    setActive(ix); scrollTo(ix);
  };
  const type = (v: string) => { setQ(v); setActive(0); if (!open) setOpen(true); };

  const pick = (o: SearchOption) => {
    onPick(o.value);
    setQ('');
    if (multi) { setActive(0); input.current?.focus(); } else setOpen(false);
  };
  const move = (d: number) => {
    if (!shown.length) return;
    const n = (active + d + shown.length) % shown.length;
    setActive(n); scrollTo(n);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) openList(); else move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (!open) openList(); else move(-1); }
    else if (e.key === 'Enter') { if (open) { e.preventDefault(); const o = shown[active]; if (o) pick(o); } }
    else if (e.key === 'Escape') { if (open) { e.preventDefault(); setOpen(false); setQ(''); } }
    else if (e.key === 'Tab') { setOpen(false); setQ(''); }
    else if (e.key === 'Backspace' && multi && !q && values.length) onRemove?.(values[values.length - 1]);
  };

  const inputPlaceholder = multi
    ? (values.length ? (open ? searchPlaceholder : 'Add more…') : placeholder)
    : open ? (single ? `${single.label} · ${searchPlaceholder.toLowerCase()}` : searchPlaceholder) : placeholder;

  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <div
        className="acq-input" onClick={() => { openList(); input.current?.focus(); }}
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, minHeight: 40, padding: multi && values.length ? '5px 32px 5px 6px' : '0 32px 0 12px', position: 'relative', cursor: disabled ? 'not-allowed' : 'text', opacity: disabled ? 0.6 : 1, background: disabled ? '#f8fafc' : undefined }}
      >
        {multi && values.map((v) => (
          <span key={v} className="acq-pill acq-pill-purple" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%', height: 26, padding: '0 4px 0 9px', fontSize: 12.5 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{labelOf(v)}</span>
            <button type="button" aria-label={`Remove ${labelOf(v)}`} onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); onRemove?.(v); }} style={{ display: 'inline-flex', border: 0, background: 'transparent', padding: 2, borderRadius: 999, color: 'inherit', cursor: 'pointer' }}><X size={12} /></button>
          </span>
        ))}
        {open && (!multi || !values.length) && <Search size={15} aria-hidden style={{ color: 'var(--sub)', flex: 'none', marginLeft: multi ? 6 : 0 }} />}
        <input
          ref={input} id={id} disabled={disabled} {...NO_AUTOFILL} name={`${id}-search`}
          role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={open && shown[active] ? `${listId}-${active}` : undefined}
          value={open || multi ? q : single?.label ?? ''}
          placeholder={inputPlaceholder}
          onChange={(e) => type(e.target.value)} onFocus={openList} onKeyDown={onKey}
          style={{ flex: '1 1 80px', minWidth: 80, border: 0, outline: 'none', background: 'transparent', font: 'inherit', fontSize: 14, color: 'var(--ink)', height: 28, padding: multi && values.length ? '0 4px' : 0, cursor: disabled ? 'not-allowed' : 'pointer' }}
        />
        <ChevronDown size={15} aria-hidden style={{ position: 'absolute', right: 10, top: '50%', transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`, color: 'var(--sub)', pointerEvents: 'none', transition: 'transform .15s' }} />
      </div>
      {open && !disabled && (
        <ul ref={list} id={listId} role="listbox" aria-multiselectable={multi || undefined} className="acq-dropdown" style={{ top: 'calc(100% + 4px)', left: 0, right: 0, maxHeight: 280, overflowY: 'auto', margin: 0, padding: 4, listStyle: 'none' }}>
          {full && <li style={{ padding: '6px 10px', color: 'var(--sub)', fontSize: 12 }}>Limit reached. Remove one to add another.</li>}
          {shown.length === 0 && <li style={{ padding: '10px 12px', color: 'var(--sub)', fontSize: 13 }}>{emptyText}</li>}
          {shown.map((o, i) => {
            const custom = o.group === '__custom';
            const heading = !q.trim() && o.group && o.group !== shown[i - 1]?.group ? o.group : null;
            const on = values.includes(o.value);
            const blocked = !!full && !on;
            return (
              <li key={`${custom ? 'c:' : ''}${o.value}:${i}`} role="presentation">
                {heading && <div aria-hidden style={{ padding: '8px 10px 4px', fontSize: 11, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--sub)' }}>{heading}</div>}
                <div
                  id={`${listId}-${i}`} data-ix={i} role="option" aria-selected={on} aria-disabled={blocked || undefined}
                  onMouseDown={(e) => { e.preventDefault(); if (!blocked) pick(o); }} onMouseEnter={() => setActive(i)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, fontSize: 14, cursor: blocked ? 'not-allowed' : 'pointer', opacity: blocked ? 0.5 : 1, background: i === active ? 'var(--brand-soft, #f3e8ff)' : 'transparent', color: on || custom ? 'var(--brand-ink, #6b21a8)' : 'var(--ink)', fontWeight: on || custom ? 600 : 400 }}
                >
                  {multi && !custom && <span aria-hidden style={{ width: 16, height: 16, flex: 'none', borderRadius: 4, border: `1.5px solid ${on ? 'var(--brand, #9333ea)' : 'var(--line)'}`, background: on ? 'var(--brand, #9333ea)' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>{on && <Check size={11} strokeWidth={3} />}</span>}
                  {custom && <Plus size={14} aria-hidden />}
                  <span style={{ flex: 1 }}>{o.label}</span>
                  {!multi && on && <Check size={14} aria-hidden />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
