'use client';

import { useEffect, useRef, useState } from 'react';
import { Columns3, ListFilter, Loader2, Plus, Search, X } from 'lucide-react';
import type { SortingState, VisibilityState } from '@tanstack/react-table';
import {
  CONTACT_OPTIONS, FIELDS, OPS_BY_KIND, OP_LABEL, PRESETS, activeRuleCount, defaultOp, kindOf, needsValue, newRule, presetOn, togglePreset,
  type FieldId, type FilterGroup, type Op, type Rule,
} from '@/lib/prospectQuery';

export const SORT_OPTIONS: ReadonlyArray<{ id: string; label: string; sort: SortingState }> = [
  { id: 'found', label: 'Order found', sort: [] },
  { id: 'name', label: 'Name A to Z', sort: [{ id: 'name', desc: false }] },
  { id: 'rating-high', label: 'Highest rated', sort: [{ id: 'rating', desc: true }] },
  { id: 'rating-low', label: 'Lowest rated', sort: [{ id: 'rating', desc: false }] },
  { id: 'reviews-high', label: 'Most reviews', sort: [{ id: 'reviews', desc: true }] },
  { id: 'no-website-first', label: 'No website first', sort: [{ id: 'website', desc: false }] },
  { id: 'website-first', label: 'Has a website first', sort: [{ id: 'website', desc: true }] },
];
const sortId = (s: SortingState) => SORT_OPTIONS.find((o) => o.sort.length === s.length && o.sort.every((x, i) => x.id === s[i].id && x.desc === s[i].desc))?.id ?? 'custom';

const sel = { height: 38, width: 'auto' } as const;

function RuleRow({ rule, index, onChange, onRemove }: { rule: Rule; index: number; onChange: (r: Rule) => void; onRemove: () => void }) {
  const kind = kindOf(rule.field);
  const n = index + 1;
  return (
    <div role="group" aria-label={`Rule ${n}`} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <select className="acq-select" style={sel} aria-label={`Rule ${n} field`} value={rule.field}
        onChange={(e) => { const field = e.target.value as FieldId; onChange({ ...rule, field, op: defaultOp(field), value: '', value2: '' }); }}>
        {FIELDS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
      </select>
      <select className="acq-select" style={sel} aria-label={`Rule ${n} condition`} value={rule.op} onChange={(e) => onChange({ ...rule, op: e.target.value as Op })}>
        {OPS_BY_KIND[kind].map((o) => <option key={o} value={o}>{OP_LABEL[o]}</option>)}
      </select>
      {needsValue(rule.op) && (kind === 'enum'
        ? <select className="acq-select" style={sel} aria-label={`Rule ${n} value`} value={rule.value} onChange={(e) => onChange({ ...rule, value: e.target.value })}>
            <option value="">Choose…</option>{CONTACT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        : <>
            <input className="acq-input" style={{ width: 150, height: 38 }} aria-label={`Rule ${n} value`} inputMode={kind === 'number' ? 'decimal' : undefined} placeholder={kind === 'number' ? 'Number' : 'Text'}
              value={rule.value} onChange={(e) => onChange({ ...rule, value: e.target.value })} />
            {rule.op === 'between' && <><span className="acq-sub" style={{ fontSize: 13 }}>and</span>
              <input className="acq-input" style={{ width: 110, height: 38 }} aria-label={`Rule ${n} upper value`} inputMode="decimal" placeholder="Number" value={rule.value2 ?? ''} onChange={(e) => onChange({ ...rule, value2: e.target.value })} /></>}
          </>)}
      <button type="button" className="acq-icon-btn" aria-label={`Remove rule ${n}`} onClick={onRemove}><X size={16} /></button>
    </div>
  );
}

/** Search box, advanced filter, sort and column picker for the prospects table. */
export default function ProspectToolbar(props: {
  query: string; onQuery: (q: string) => void; searching: boolean;
  group: FilterGroup; onGroup: (g: FilterGroup) => void;
  sorting: SortingState; onSorting: (s: SortingState) => void;
  columns: Array<{ id: string; label: string }>; visibility: VisibilityState; onVisibility: (v: VisibilityState) => void;
  shown: number; total: number;
}) {
  const { query, onQuery, searching, group, onGroup, sorting, onSorting, columns, visibility, onVisibility, shown, total } = props;
  const [open, setOpen] = useState(false);
  const [colsOpen, setColsOpen] = useState(false);
  const colsRef = useRef<HTMLDivElement>(null);
  const active = activeRuleCount(group);
  useEffect(() => {
    if (!colsOpen) return;
    const on = (e: MouseEvent) => { if (colsRef.current && !colsRef.current.contains(e.target as Node)) setColsOpen(false); };
    window.addEventListener('mousedown', on);
    return () => window.removeEventListener('mousedown', on);
  }, [colsOpen]);
  const setRule = (r: Rule) => onGroup({ ...group, rules: group.rules.map((x) => (x.id === r.id ? r : x)) });
  const dirty = query.trim() !== '' || active > 0 || sorting.length > 0;

  return (
    <div style={{ display: 'grid', gap: 10, margin: '4px 0 10px' }} role="search" aria-label="Search and filter the prospects">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 280px', minWidth: 0 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
          <input className="acq-input" style={{ paddingLeft: 36, paddingRight: 36, height: 40 }} type="search" aria-label="Search prospects" placeholder="Search name, area, phone, website, email or owner…"
            value={query} onChange={(e) => onQuery(e.target.value)} />
          {searching ? <Loader2 size={16} className="animate-spin" aria-label="Searching" style={{ position: 'absolute', right: 12, top: 12, color: '#9333ea' }} />
            : query ? <button type="button" aria-label="Clear search" className="acq-icon-btn" style={{ position: 'absolute', right: 2, top: 2, width: 36, height: 36 }} onClick={() => onQuery('')}><X size={15} /></button> : null}
        </div>
        <button type="button" className={`acq-btn${open || active ? ' acq-btn-primary' : ''}`} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <ListFilter size={16} /> Filters{active ? ` (${active})` : ''}
        </button>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
          <span className="acq-sub">Sort</span>
          <select className="acq-select" style={{ height: 40, width: 'auto' }} aria-label="Sort prospects" value={sortId(sorting)} onChange={(e) => onSorting(SORT_OPTIONS.find((o) => o.id === e.target.value)?.sort ?? [])}>
            {sortId(sorting) === 'custom' && <option value="custom">Custom</option>}
            {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
        <div ref={colsRef} style={{ position: 'relative' }}>
          <button type="button" className="acq-btn" aria-expanded={colsOpen} onClick={() => setColsOpen((v) => !v)}><Columns3 size={16} /> Columns</button>
          {colsOpen && (
            <div role="menu" aria-label="Show or hide columns" style={{ position: 'absolute', right: 0, top: 46, zIndex: 20, minWidth: 190, padding: 8, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 12px 32px rgba(15,23,42,.14)' }}>
              {columns.map((c) => (
                <label key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', fontSize: 14, cursor: 'pointer' }}>
                  <input type="checkbox" style={{ accentColor: '#9333ea' }} checked={visibility[c.id] !== false} onChange={(e) => onVisibility({ ...visibility, [c.id]: e.target.checked })} /> {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
        {dirty && <button type="button" className="acq-btn acq-btn-sm" onClick={() => { onQuery(''); onGroup({ ...group, rules: [] }); onSorting([]); }}>Reset</button>}
      </div>

      {open && (
        <div role="region" aria-label="Advanced filters" style={{ display: 'grid', gap: 12, padding: 14, border: '1px solid #e9d5ff', background: '#faf5ff', borderRadius: 14 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="acq-sub" style={{ fontSize: 12.5, fontWeight: 600 }}>Quick filters</span>
            {PRESETS.map((p) => {
              const on = presetOn(group, p.id);
              return <button key={p.id} type="button" aria-pressed={on} className={`acq-tab${on ? ' active' : ''}`} onClick={() => onGroup(togglePreset(group, p.id))}>{p.label}</button>;
            })}
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {group.rules.length === 0 && <p className="acq-sub" style={{ fontSize: 13 }}>No rules yet. Pick a quick filter, or add your own rule: any column, any condition.</p>}
            {group.rules.length > 1 && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>Show prospects that match
                <select className="acq-select" style={sel} aria-label="Match all or any rule" value={group.match} onChange={(e) => onGroup({ ...group, match: e.target.value as 'all' | 'any' })}>
                  <option value="all">all of these rules</option><option value="any">any of these rules</option>
                </select>
              </label>
            )}
            {group.rules.map((r, i) => <RuleRow key={r.id} rule={r} index={i} onChange={setRule} onRemove={() => onGroup({ ...group, rules: group.rules.filter((x) => x.id !== r.id) })} />)}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" className="acq-btn acq-btn-sm" onClick={() => onGroup({ ...group, rules: [...group.rules, newRule()] })}><Plus size={14} /> Add rule</button>
            {group.rules.length > 0 && <button type="button" className="acq-btn acq-btn-sm" onClick={() => onGroup({ ...group, rules: [] })}>Clear rules</button>}
            <span className="acq-sub" style={{ fontSize: 12.5, marginLeft: 'auto' }} role="status">{shown.toLocaleString('en-US')} of {total.toLocaleString('en-US')} prospects match</span>
          </div>
        </div>
      )}
    </div>
  );
}
