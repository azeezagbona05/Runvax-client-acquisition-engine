'use client';

import { useRef, useState, type ReactNode } from 'react';
import { ChevronDown, X } from 'lucide-react';

const PURPLE = '#7e22ce';

/** A heading + one line of help, then the control. Keeps every question looking the same. */
export function Block({ title, help, children, actions }: { title: string; help?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}><div><div style={{ fontSize: 15, fontWeight: 650, color: '#0f172a' }}>{title}</div>{help && <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{help}</div>}</div>{actions}</div>
      {children}
    </div>
  );
}

/** Optional things live behind one quiet line, so the page shows only what matters. */
export function More({ summary, children, open }: { summary: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff' }}>
      <summary style={{ cursor: 'pointer', padding: '11px 14px', fontSize: 13.5, fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: 6, listStyle: 'none' }}>
        <ChevronDown size={15} aria-hidden="true" /> {summary}
      </summary>
      <div style={{ padding: '4px 14px 14px', display: 'grid', gap: 14 }}>{children}</div>
    </details>
  );
}

/** Type and press Enter (or comma) to add; click the x to remove. Replaces "one per line" boxes. */
export function TagInput({ value, onChange, placeholder, label, max = 10 }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; label: string; max?: number }) {
  const [text, setText] = useState(''); const ref = useRef<HTMLInputElement>(null);
  const add = (raw: string) => {
    const parts = raw.split(/[,\n]/).map((s) => s.trim()).filter(Boolean); if (!parts.length) return;
    const next = [...value]; for (const p of parts) if (next.length < max && !next.some((x) => x.toLowerCase() === p.toLowerCase())) next.push(p);
    if (next.length !== value.length) onChange(next);                       // a duplicate or a full list is not a change
    setText('');
  };
  return (
    <div className="acq-input" onClick={() => ref.current?.focus()} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', padding: 6, height: 'auto', minHeight: 44, cursor: 'text' }}>
      {value.map((v) => (
        <span key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f3e8ff', color: '#6b21a8', borderRadius: 999, padding: '3px 6px 3px 10px', fontSize: 13.5, fontWeight: 600 }}>
          {v}<button type="button" aria-label={`Remove ${v}`} onClick={(e) => { e.stopPropagation(); onChange(value.filter((x) => x !== v)); }} style={{ border: 0, background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 2, color: '#6b21a8' }}><X size={13} /></button>
        </span>
      ))}
      <input ref={ref} aria-label={label} value={text} placeholder={value.length ? '' : placeholder} onChange={(e) => setText(e.target.value)} onBlur={() => add(text)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(text); } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1)); }}
        style={{ border: 0, outline: 0, flex: 1, minWidth: 140, background: 'transparent', fontSize: 14.5, padding: '4px 6px' }} />
    </div>
  );
}

const pill = (on: boolean) => ({ padding: '8px 14px', borderRadius: 999, border: '1px solid ' + (on ? PURPLE : '#e2e8f0'), background: on ? '#f3e8ff' : '#fff', color: on ? '#6b21a8' : '#334155', fontSize: 14, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' } as const);

/** Pick one. */
export function Pills({ options, value, onChange, label }: { options: ReadonlyArray<{ id: string; label?: string }>; value: string; onChange: (v: string) => void; label: string }) {
  return <div role="radiogroup" aria-label={label} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{options.map((o) => <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)} style={pill(value === o.id)}>{o.label ?? o.id}</button>)}</div>;
}

/** Pick any number. */
export function MultiPills({ options, value, onChange, label }: { options: ReadonlyArray<{ id: string; label?: string }>; value: string[]; onChange: (v: string[]) => void; label: string }) {
  return <div role="group" aria-label={label} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{options.map((o) => { const on = value.includes(o.id); return <button key={o.id} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])} style={pill(on)}>{o.label ?? o.id}</button>; })}</div>;
}

/** A choice with a title and one sentence, used for permissions and sources. */
export function ChoiceCard({ checked, onChange, type, title, note, name }: { checked: boolean; onChange: () => void; type: 'radio' | 'checkbox'; title: string; note: string; name?: string }) {
  return (
    <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer', border: '1px solid ' + (checked ? PURPLE : '#e2e8f0'), background: checked ? '#faf5ff' : '#fff', borderRadius: 12, padding: '12px 14px' }}>
      <input type={type} name={name} checked={checked} onChange={onChange} style={{ marginTop: 3 }} />
      <span><b style={{ fontSize: 14.5 }}>{title}</b><span style={{ display: 'block', fontSize: 13, color: '#64748b', marginTop: 2 }}>{note}</span></span>
    </label>
  );
}

/** Where you are: a bar and the name of the current step, instead of five wrapping buttons. */
export function Progress({ step, steps, onGo }: { step: number; steps: string[]; onGo: (n: number) => void }) {
  return (
    <div aria-label="Setup progress">
      <div style={{ display: 'flex', gap: 6 }}>
        {steps.map((s, i) => <button key={s} type="button" aria-label={`Step ${i + 1}: ${s}`} aria-current={step === i + 1 ? 'step' : undefined} onClick={() => i + 1 < step && onGo(i + 1)} style={{ flex: 1, height: 6, border: 0, borderRadius: 3, background: i + 1 <= step ? PURPLE : '#e2e8f0', cursor: i + 1 < step ? 'pointer' : 'default', padding: 0 }} />)}
      </div>
      <div style={{ marginTop: 8, fontSize: 13, color: '#64748b' }}>Step {step} of {steps.length} · <b style={{ color: '#0f172a' }}>{steps[step - 1]}</b></div>
    </div>
  );
}

/** A small text button that sits next to a field (e.g. "Back to my CV suggestion"). */
export function Mini({ children, onClick, disabled, tone = '#475569' }: { children: ReactNode; onClick: () => void; disabled?: boolean; tone?: string }) {
  return <button type="button" disabled={disabled} onClick={onClick} style={{ border: 0, background: 'transparent', cursor: disabled ? 'default' : 'pointer', fontSize: 12.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 4px', color: tone, opacity: disabled ? 0.5 : 1 }}>{children}</button>;
}
