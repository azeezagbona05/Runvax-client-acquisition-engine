'use client';

import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import {
  DEFAULT_FILTERS, PRESETS, activeFilterCount, matchingPreset,
  type ResultFilters, type SortKey, type WebsiteFilter,
} from '@/lib/resultFilters';

interface Props {
  filters: ResultFilters;
  onChange: (f: ResultFilters) => void;
  /** Matches after filtering vs. total on the page, for the "N of M" line. */
  shown: number;
  total: number;
}

const chip = (on: boolean) =>
  `flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
    on ? 'bg-purple-600/25 text-purple-200 border-purple-500/40' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-gray-200'}`;
const selectCls = 'bg-gray-800/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500/60';
const labelCls = 'block text-[11px] font-semibold uppercase tracking-widest text-gray-500 mb-1.5';

const WEBSITE: { id: WebsiteFilter; label: string }[] = [
  { id: 'any', label: 'Any' }, { id: 'has', label: 'Has a website' }, { id: 'none', label: 'No website' }, { id: 'social', label: 'Social page only' },
];

export default function ResultFilterBar({ filters, onChange, shown, total }: Props) {
  const [open, setOpen] = useState(false);
  const active = activeFilterCount(filters);
  const preset = matchingPreset(filters);
  const set = (patch: Partial<ResultFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {PRESETS.map((p) => (
          <button key={p.id} title={p.hint} onClick={() => onChange(preset === p.id ? DEFAULT_FILTERS : p.filters)} className={chip(preset === p.id)}>
            {p.label}
          </button>
        ))}
        <button onClick={() => setOpen((v) => !v)} className={`${chip(open || (active > 0 && !preset))} flex items-center gap-1.5`} aria-expanded={open}>
          <SlidersHorizontal className="w-3.5 h-3.5" /> Filters{active > 0 ? ` (${active})` : ''}
        </button>
        {active > 0 && (
          <button onClick={() => onChange(DEFAULT_FILTERS)} className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 text-xs font-semibold text-gray-500 hover:text-white">
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {(active > 0 || filters.sort !== 'best') && (
        <p className="text-xs text-gray-500 mt-1.5">
          {shown} of {total} businesses match{preset ? ` · ${PRESETS.find((p) => p.id === preset)?.hint}` : ''}
        </p>
      )}

      {open && (
        <div className="mt-3 bg-gray-900 border border-white/10 rounded-2xl p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-3">
            <span className={labelCls}>Website</span>
            <div className="flex flex-wrap gap-2">
              {WEBSITE.map((w) => (
                <button key={w.id} onClick={() => set({ website: w.id })} className={chip(filters.website === w.id)}>{w.label}</button>
              ))}
            </div>
          </div>

          <div>
            <span className={labelCls}>Contact details on file</span>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => set({ phone: !filters.phone })} className={chip(filters.phone)}>Phone</button>
              <button onClick={() => set({ email: !filters.email })} className={chip(filters.email)}>Email</button>
              <button onClick={() => set({ namedOwner: !filters.namedOwner })} className={chip(filters.namedOwner)}>Named owner</button>
            </div>
          </div>

          <div>
            <span className={labelCls}>Quality</span>
            <div className="flex flex-wrap gap-2">
              <select aria-label="Minimum rating" className={selectCls} value={filters.minRating} onChange={(e) => set({ minRating: Number(e.target.value) })}>
                <option value={0}>Any rating</option><option value={4}>4.0+ stars</option><option value={4.5}>4.5+ stars</option>
              </select>
              <select aria-label="Minimum reviews" className={selectCls} value={filters.minReviews} onChange={(e) => set({ minReviews: Number(e.target.value) })}>
                <option value={0}>Any reviews</option><option value={10}>10+ reviews</option><option value={50}>50+ reviews</option><option value={100}>100+ reviews</option>
              </select>
            </div>
          </div>

          <div>
            <span className={labelCls}>AI system fit</span>
            <select aria-label="Minimum AI fit" className={selectCls} value={filters.aiFit} onChange={(e) => set({ aiFit: e.target.value as ResultFilters['aiFit'] })}>
              <option value="any">Any</option><option value="possible">Possible or better</option><option value="good">Good or better</option><option value="strong">Strong or better</option>
            </select>
          </div>

          <div>
            <span className={labelCls}>Also</span>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => set({ openOnly: !filters.openOnly })} className={chip(filters.openOnly)}>Still open</button>
              <button onClick={() => set({ slowSite: !filters.slowSite })} className={chip(filters.slowSite)}>Slow website</button>
            </div>
          </div>

          <div>
            <span className={labelCls}>Sort by</span>
            <select aria-label="Sort" className={selectCls} value={filters.sort} onChange={(e) => set({ sort: e.target.value as SortKey })}>
              <option value="best">Best lead score</option><option value="ai_fit">AI system fit</option><option value="rating">Rating</option><option value="reviews">Most reviews</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
