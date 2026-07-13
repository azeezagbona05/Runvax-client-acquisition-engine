'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp, ArrowDown, ArrowUpDown, MessageCircle, PhoneCall, Copy, Check,
  Star, CheckSquare, Square, Bookmark, SlidersHorizontal, ExternalLink,
  FileText, AlertTriangle,
} from 'lucide-react';
import { Business } from '@/types';
import { scoreProspect, scoreLabel } from '@/lib/scoring';
import { whatsappLink } from '@/lib/phone';
import { useWaPaceTimer } from '@/lib/waRateLimit';
import { useProspects } from '@/context/ProspectsContext';
import { useToast } from './Toast';

type SortKey = 'name' | 'category' | 'website' | 'rating' | 'score';
type SortDir = 'asc' | 'desc';
type ColumnId = 'category' | 'website' | 'phone' | 'rating' | 'score' | 'address' | 'status' | 'actions';

const COLUMN_DEFS: { id: ColumnId; label: string; defaultOn: boolean }[] = [
  { id: 'category',   label: 'Category',    defaultOn: true },
  { id: 'website',    label: 'Website',     defaultOn: true },
  { id: 'phone',      label: 'Phone',       defaultOn: true },
  { id: 'rating',     label: 'Rating',      defaultOn: true },
  { id: 'score',      label: 'Score',       defaultOn: true },
  { id: 'address',    label: 'Address',     defaultOn: false },
  { id: 'status',     label: 'Status',      defaultOn: true },
  { id: 'actions',    label: 'Actions',     defaultOn: true },
];

const COLUMNS_STORAGE_KEY = 'aip_table_columns';

const STAGE_LABEL: Record<string, string> = {
  found: '🔵 Saved', contacted: '📱 Contacted', interested: '🤝 Interested',
  proposal: '📄 Proposal', won: '🏆 Won', lost: '❌ Lost',
};

function websiteRank(b: Business): number {
  if (!b.hasWebsite) return 0;
  const w = b.website ?? '';
  if (w.includes('instagram.com') || w.includes('facebook.com') || w.includes('tiktok.com')) return 1;
  return 2;
}

function websiteHost(website?: string): string {
  if (!website) return '';
  try { return new URL(website).hostname.replace(/^www\./, ''); } catch { return website; }
}

interface Props {
  businesses: Business[];
  onSelect: (b: Business, action?: 'outreach' | 'proposal' | 'weakness') => void;
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

function SortHeader({ label, active, dir, onClick, className = '' }: {
  label: string; active: boolean; dir: SortDir; onClick: () => void; className?: string;
}) {
  return (
    <th className={`text-left px-3 py-2.5 select-none ${className}`}>
      <button
        onClick={onClick}
        className={`flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
          active ? 'text-white' : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        {label}
        {active
          ? (dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
          : <ArrowUpDown className="w-3 h-3 opacity-40" />}
      </button>
    </th>
  );
}

function ColumnPicker({ visible, setVisible }: { visible: Set<ColumnId>; setVisible: (fn: (v: Set<ColumnId>) => Set<ColumnId>) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (id: ColumnId) => setVisible((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/8 text-gray-400 border border-white/10 hover:bg-white/15 hover:text-gray-200 transition-colors"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" /> Columns
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-30 p-1.5">
          {COLUMN_DEFS.map((col) => (
            <label key={col.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl hover:bg-white/5 cursor-pointer text-sm text-gray-200">
              <span>{col.label}</span>
              <input
                type="checkbox"
                checked={visible.has(col.id)}
                onChange={() => toggle(col.id)}
                className="accent-purple-600 w-4 h-4"
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BusinessTable({ businesses, onSelect, selectMode, selectedIds, onToggleSelect }: Props) {
  const { isSaved, get } = useProspects();
  const { recordSend } = useWaPaceTimer();
  const { toast } = useToast();
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [visibleCols, setVisibleCols] = useState<Set<ColumnId>>(
    new Set(COLUMN_DEFS.filter((c) => c.defaultOn).map((c) => c.id)),
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLUMNS_STORAGE_KEY);
      if (raw) setVisibleCols(new Set(JSON.parse(raw) as ColumnId[]));
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(Array.from(visibleCols))); } catch { /* ignore */ }
  }, [visibleCols]);

  const col = (id: ColumnId) => visibleCols.has(id);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'name' || key === 'category' ? 'asc' : 'desc'); }
  };

  const copyPhone = (e: React.MouseEvent, b: Business) => {
    e.stopPropagation();
    if (!b.phone) return;
    navigator.clipboard.writeText(b.phone).catch(() => {});
    setCopiedId(b.id);
    toast('Phone number copied');
    setTimeout(() => setCopiedId((cur) => (cur === b.id ? null : cur)), 2000);
  };

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...businesses].sort((a, b) => {
      switch (sortKey) {
        case 'name': return dir * a.name.localeCompare(b.name);
        case 'category': return dir * (a.category ?? '').localeCompare(b.category ?? '');
        case 'website': return dir * (websiteRank(a) - websiteRank(b));
        case 'rating': return dir * ((a.rating ?? 0) - (b.rating ?? 0));
        case 'score': return dir * (scoreProspect(a) - scoreProspect(b));
        default: return 0;
      }
    });
  }, [businesses, sortKey, sortDir]);

  if (businesses.length === 0) {
    return <div className="text-center py-16 text-gray-600 text-sm">No results match your filters</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-end mb-2">
        <ColumnPicker visible={visibleCols} setVisible={setVisibleCols} />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/8">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-gray-900 border-b border-white/8 sticky top-14 sm:top-0 z-10">
            <tr>
              {selectMode && <th className="w-10 px-3 py-2.5" />}
              <SortHeader label="Name" active={sortKey === 'name'} dir={sortDir} onClick={() => toggleSort('name')} />
              {col('category') && <SortHeader label="Category" active={sortKey === 'category'} dir={sortDir} onClick={() => toggleSort('category')} />}
              {col('website') && <SortHeader label="Website" active={sortKey === 'website'} dir={sortDir} onClick={() => toggleSort('website')} />}
              {col('phone') && <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">Phone</th>}
              {col('rating') && <SortHeader label="Rating" active={sortKey === 'rating'} dir={sortDir} onClick={() => toggleSort('rating')} className="text-right" />}
              {col('score') && <SortHeader label="Score" active={sortKey === 'score'} dir={sortDir} onClick={() => toggleSort('score')} className="text-right" />}
              {col('address') && <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">Address</th>}
              {col('status') && <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">Status</th>}
              {col('actions') && <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((b) => {
              const score = scoreProspect(b);
              const { color: scoreColor } = scoreLabel(score);
              const rank = websiteRank(b);
              const host = websiteHost(b.website);
              const saved = isSaved(b.id);
              const stage = get(b.id)?.stage;
              const selected = selectedIds?.has(b.id) ?? false;
              const link = whatsappLink(b);
              const justCopied = copiedId === b.id;

              return (
                <tr
                  key={b.id}
                  onClick={() => (selectMode ? onToggleSelect?.(b.id) : onSelect(b))}
                  className={`border-b border-white/5 last:border-0 cursor-pointer transition-colors ${
                    selected ? 'bg-green-500/8' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  {selectMode && (
                    <td className="px-3 py-2.5">
                      {selected ? <CheckSquare className="w-4 h-4 text-green-400" /> : <Square className="w-4 h-4 text-gray-600" />}
                    </td>
                  )}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {saved && <Bookmark className="w-3 h-3 text-purple-400 fill-purple-400 flex-shrink-0" />}
                      <span className="font-semibold text-white leading-snug max-w-[220px] truncate">{b.name}</span>
                    </div>
                  </td>
                  {col('category') && <td className="px-3 py-2.5 text-gray-400 max-w-[160px] truncate">{b.category}</td>}
                  {col('website') && (
                    <td className="px-3 py-2.5">
                      {rank === 0 ? (
                        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap text-orange-400 bg-orange-500/10 border-orange-500/25">
                          No website
                        </span>
                      ) : (
                        <a
                          href={b.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title={rank === 1 ? 'Social page only' : undefined}
                          className={`flex items-center gap-1 text-[12px] font-semibold transition-colors max-w-[180px] truncate ${
                            rank === 1 ? 'text-yellow-400 hover:text-yellow-300' : 'text-blue-400 hover:text-blue-300'
                          }`}
                        >
                          <ExternalLink className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{host}</span>
                        </a>
                      )}
                    </td>
                  )}
                  {col('phone') && (
                    <td className="px-3 py-2.5">
                      {b.phone ? (
                        <div className="flex items-center gap-1">
                          <a
                            href={`tel:${b.phone.replace(/\s/g, '')}`}
                            onClick={(e) => e.stopPropagation()}
                            title="Call"
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 text-gray-400 hover:bg-blue-500/15 hover:text-blue-400 transition-colors"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                          </a>
                          {link && (
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => { e.stopPropagation(); recordSend(); }}
                              title="WhatsApp"
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 text-gray-400 hover:bg-green-500/15 hover:text-green-400 transition-colors"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            onClick={(e) => copyPhone(e, b)}
                            title="Copy number"
                            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                              justCopied ? 'bg-green-500/15 text-green-400' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                            }`}
                          >
                            {justCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      ) : <span className="text-gray-700">—</span>}
                    </td>
                  )}
                  {col('rating') && (
                    <td className="px-3 py-2.5 text-right text-gray-400 whitespace-nowrap">
                      {b.rating ? (
                        <span className="inline-flex items-center gap-1 justify-end">
                          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" /> {b.rating} ({b.reviewCount ?? 0})
                        </span>
                      ) : '—'}
                    </td>
                  )}
                  {col('score') && (
                    <td className="px-3 py-2.5 text-right">
                      <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${scoreColor}`}>{score}/10</span>
                    </td>
                  )}
                  {col('address') && (
                    <td className="px-3 py-2.5 text-gray-400 max-w-[220px] truncate">{b.address || '—'}</td>
                  )}
                  {col('status') && (
                    <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">
                      {stage ? STAGE_LABEL[stage] : <span className="text-gray-700">New</span>}
                    </td>
                  )}
                  {col('actions') && (
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); onSelect(b, 'outreach'); }}
                          title="Outreach message"
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 text-gray-400 hover:bg-green-500/15 hover:text-green-400 transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onSelect(b, 'proposal'); }}
                          title="Generate proposal"
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 text-gray-400 hover:bg-purple-500/15 hover:text-purple-400 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        {b.hasWebsite && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onSelect(b, 'weakness'); }}
                            title="Analyse website"
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 text-gray-400 hover:bg-yellow-500/15 hover:text-yellow-400 transition-colors"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
