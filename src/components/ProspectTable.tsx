'use client';

import { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, MessageCircle, Calendar, Trash2, CheckSquare, Square, StickyNote, Bell } from 'lucide-react';
import { useProspects } from '@/context/ProspectsContext';
import { SavedProspect, ProspectStage } from '@/types';
import { scoreLabel, formatPrice } from '@/lib/scoring';
import { whatsappLink } from '@/lib/phone';
import { useWaPaceTimer } from '@/lib/waRateLimit';

type Stage = { id: ProspectStage; icon: string; label: string };

const STAGES: Stage[] = [
  { id: 'found',      icon: '🔵', label: 'Found' },
  { id: 'contacted',  icon: '📱', label: 'Contacted' },
  { id: 'interested', icon: '🤝', label: 'Interested' },
  { id: 'proposal',   icon: '📄', label: 'Proposal' },
  { id: 'won',        icon: '🏆', label: 'Won' },
  { id: 'lost',       icon: '❌', label: 'Lost' },
];

type SortKey = 'name' | 'category' | 'stage' | 'score' | 'value' | 'lastContact' | 'saved';
type SortDir = 'asc' | 'desc';

function daysSince(iso: string) { return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); }

function lastContactDate(p: SavedProspect): string | null {
  const dates = [
    p.outreachSentAt,
    ...(p.conversations ?? []).filter((c) => c.framework !== 'proposal').map((c) => c.timestamp),
  ].filter(Boolean) as string[];
  return dates.length > 0 ? dates.reduce((latest, d) => (d > latest ? d : latest)) : null;
}

interface Props {
  prospects: SavedProspect[];
  onOpen: (p: SavedProspect) => void;
  onOpenSequence: (p: SavedProspect) => void;
  selectMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
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

export default function ProspectTable({ prospects, onOpen, onOpenSequence, selectMode, selectedIds, onToggleSelect }: Props) {
  const { updateStage, remove, incrementToday } = useProspects();
  const { recordSend } = useWaPaceTimer();
  const [sortKey, setSortKey] = useState<SortKey>('saved');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'name' || key === 'category' ? 'asc' : 'desc'); }
  };

  const sorted = useMemo(() => {
    const withMeta = prospects.map((p) => ({
      p,
      lastContact: lastContactDate(p),
      value: p.estimatedPrice?.min ?? 0,
    }));
    const dir = sortDir === 'asc' ? 1 : -1;
    withMeta.sort((a, b) => {
      switch (sortKey) {
        case 'name': return dir * a.p.business.name.localeCompare(b.p.business.name);
        case 'category': return dir * (a.p.business.category ?? '').localeCompare(b.p.business.category ?? '');
        case 'stage': return dir * (STAGES.findIndex((s) => s.id === a.p.stage) - STAGES.findIndex((s) => s.id === b.p.stage));
        case 'score': return dir * (a.p.score - b.p.score);
        case 'value': return dir * (a.value - b.value);
        case 'lastContact': return dir * ((a.lastContact ?? '').localeCompare(b.lastContact ?? ''));
        case 'saved': return dir * (a.p.savedAt.localeCompare(b.p.savedAt));
        default: return 0;
      }
    });
    return withMeta.map((m) => m.p);
  }, [prospects, sortKey, sortDir]);

  if (prospects.length === 0) {
    return <div className="text-center py-16 text-gray-600 text-sm">No prospects match your filters</div>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/8">
      <table className="w-full min-w-[880px] text-sm">
        <thead className="bg-white/[0.03] border-b border-white/8">
          <tr>
            {selectMode && <th className="w-10 px-3 py-2.5" />}
            <SortHeader label="Name" active={sortKey === 'name'} dir={sortDir} onClick={() => toggleSort('name')} />
            <SortHeader label="Category" active={sortKey === 'category'} dir={sortDir} onClick={() => toggleSort('category')} />
            <SortHeader label="Stage" active={sortKey === 'stage'} dir={sortDir} onClick={() => toggleSort('stage')} />
            <SortHeader label="Score" active={sortKey === 'score'} dir={sortDir} onClick={() => toggleSort('score')} className="text-right" />
            <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">Phone</th>
            <SortHeader label="Value" active={sortKey === 'value'} dir={sortDir} onClick={() => toggleSort('value')} />
            <SortHeader label="Last contact" active={sortKey === 'lastContact'} dir={sortDir} onClick={() => toggleSort('lastContact')} />
            <SortHeader label="Saved" active={sortKey === 'saved'} dir={sortDir} onClick={() => toggleSort('saved')} />
            {!selectMode && <th className="px-3 py-2.5 w-24" />}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => {
            const { business, stage, score, estimatedPrice, notes, reminderDate } = p;
            const { color: scoreColor } = scoreLabel(score);
            const contact = lastContactDate(p);
            const isOverdue = reminderDate && new Date(reminderDate) < new Date() && stage !== 'won' && stage !== 'lost';
            const selected = selectedIds.has(business.id);
            const link = whatsappLink(business);

            return (
              <tr
                key={business.id}
                onClick={() => (selectMode ? onToggleSelect(business.id) : onOpen(p))}
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
                  <div className="font-semibold text-white leading-snug max-w-[220px] truncate">{business.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {notes && <StickyNote className="w-3 h-3 text-blue-400" />}
                    {reminderDate && <Bell className={`w-3 h-3 ${isOverdue ? 'text-red-400' : 'text-orange-400'}`} />}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-gray-400 max-w-[160px] truncate">{business.category}</td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={stage}
                    disabled={selectMode}
                    onChange={(e) => void updateStage(business.id, e.target.value as ProspectStage)}
                    className="bg-white/5 border border-white/10 rounded-lg text-xs font-semibold text-gray-200 px-2 py-1 disabled:opacity-50 focus:outline-none focus:border-purple-500/40"
                  >
                    {STAGES.map((s) => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded border ${scoreColor}`}>{score}/10</span>
                </td>
                <td className="px-3 py-2.5">
                  {business.phone ? (
                    link ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => { e.stopPropagation(); void incrementToday(); recordSend(); }}
                        className="flex items-center gap-1.5 text-green-400 hover:text-green-300 transition-colors whitespace-nowrap"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> {business.phone}
                      </a>
                    ) : <span className="text-gray-500 whitespace-nowrap">{business.phone}</span>
                  ) : <span className="text-gray-700">—</span>}
                </td>
                <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">
                  {estimatedPrice ? `${formatPrice(estimatedPrice.min)}–${formatPrice(estimatedPrice.max)}` : '—'}
                </td>
                <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                  {contact ? `${daysSince(contact)}d ago` : '—'}
                </td>
                <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{daysSince(p.savedAt)}d ago</td>
                {!selectMode && (
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => onOpenSequence(p)}
                        title="Follow-up sequence"
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-gray-400 transition-colors"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => remove(business.id)}
                        title="Delete"
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
