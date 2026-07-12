'use client';

import { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, MessageCircle, Star, CheckSquare, Square, Bookmark } from 'lucide-react';
import { Business } from '@/types';
import { scoreProspect, scoreLabel } from '@/lib/scoring';
import { whatsappLink } from '@/lib/phone';
import { useWaPaceTimer } from '@/lib/waRateLimit';
import { useProspects } from '@/context/ProspectsContext';

type SortKey = 'name' | 'category' | 'website' | 'rating' | 'score';
type SortDir = 'asc' | 'desc';

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

function websiteLabel(b: Business): { text: string; className: string } {
  const rank = websiteRank(b);
  if (rank === 0) return { text: 'No website', className: 'text-orange-400 bg-orange-500/10 border-orange-500/25' };
  if (rank === 1) return { text: 'Social only', className: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/25' };
  return { text: 'Has website', className: 'text-gray-500 bg-white/5 border-white/10' };
}

interface Props {
  businesses: Business[];
  onSelect: (b: Business) => void;
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

export default function BusinessTable({ businesses, onSelect, selectMode, selectedIds, onToggleSelect }: Props) {
  const { isSaved, get } = useProspects();
  const { recordSend } = useWaPaceTimer();
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'name' || key === 'category' ? 'asc' : 'desc'); }
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
    <div className="overflow-x-auto rounded-2xl border border-white/8">
      <table className="w-full min-w-[880px] text-sm">
        <thead className="bg-white/[0.03] border-b border-white/8">
          <tr>
            {selectMode && <th className="w-10 px-3 py-2.5" />}
            <SortHeader label="Name" active={sortKey === 'name'} dir={sortDir} onClick={() => toggleSort('name')} />
            <SortHeader label="Category" active={sortKey === 'category'} dir={sortDir} onClick={() => toggleSort('category')} />
            <SortHeader label="Website" active={sortKey === 'website'} dir={sortDir} onClick={() => toggleSort('website')} />
            <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">Phone</th>
            <SortHeader label="Rating" active={sortKey === 'rating'} dir={sortDir} onClick={() => toggleSort('rating')} className="text-right" />
            <SortHeader label="Score" active={sortKey === 'score'} dir={sortDir} onClick={() => toggleSort('score')} className="text-right" />
            <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((b) => {
            const score = scoreProspect(b);
            const { color: scoreColor } = scoreLabel(score);
            const website = websiteLabel(b);
            const saved = isSaved(b.id);
            const stage = get(b.id)?.stage;
            const selected = selectedIds?.has(b.id) ?? false;
            const link = whatsappLink(b);

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
                <td className="px-3 py-2.5 text-gray-400 max-w-[160px] truncate">{b.category}</td>
                <td className="px-3 py-2.5">
                  <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap ${website.className}`}>
                    {website.text}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  {b.phone ? (
                    link ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => { e.stopPropagation(); recordSend(); }}
                        className="flex items-center gap-1.5 text-green-400 hover:text-green-300 transition-colors whitespace-nowrap"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> {b.phone}
                      </a>
                    ) : <span className="text-gray-500 whitespace-nowrap">{b.phone}</span>
                  ) : <span className="text-gray-700">—</span>}
                </td>
                <td className="px-3 py-2.5 text-right text-gray-400 whitespace-nowrap">
                  {b.rating ? (
                    <span className="inline-flex items-center gap-1 justify-end">
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" /> {b.rating} ({b.reviewCount ?? 0})
                    </span>
                  ) : '—'}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${scoreColor}`}>{score}/10</span>
                </td>
                <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">
                  {stage ? STAGE_LABEL[stage] : <span className="text-gray-700">New</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
