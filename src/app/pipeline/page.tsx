'use client';

import { useState } from 'react';
import { Phone, Star, MessageCircle, StickyNote, Bell, ChevronRight, ChevronLeft, Trash2, Plus } from 'lucide-react';
import { useProspects } from '@/context/ProspectsContext';
import { SavedProspect, ProspectStage } from '@/types';
import { scoreLabel, formatPrice } from '@/lib/scoring';
import { whatsappLink } from '@/lib/phone';
import Link from 'next/link';
import ManualProspectModal from '@/components/ManualProspectModal';
import ProspectDetailModal from '@/components/ProspectDetailModal';

type Stage = { id: ProspectStage; icon: string; label: string; headerColor: string; bg: string };

const STAGES: Stage[] = [
  { id: 'found',      icon: '🔵', label: 'Found',      headerColor: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
  { id: 'contacted',  icon: '📱', label: 'Contacted',  headerColor: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  { id: 'interested', icon: '🤝', label: 'Interested', headerColor: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  { id: 'proposal',   icon: '📄', label: 'Proposal',   headerColor: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  { id: 'won',        icon: '🏆', label: 'Won',        headerColor: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20' },
  { id: 'lost',       icon: '❌', label: 'Lost',       headerColor: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20' },
];

function stageIdx(id: ProspectStage) {
  return STAGES.findIndex((s) => s.id === id);
}

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function PipelineCard({ prospect, onOpen }: { prospect: SavedProspect; onOpen: () => void }) {
  const { updateStage, remove } = useProspects();
  const { business, stage, score, estimatedPrice, notes, reminderDate, reminderNote, outreachSentAt } = prospect;
  const { label: scoreText, color: scoreColor } = scoreLabel(score);
  const idx = stageIdx(stage);

  const movePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (idx > 0) updateStage(business.id, STAGES[idx - 1].id);
  };
  const moveNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (idx < STAGES.length - 1) updateStage(business.id, STAGES[idx + 1].id);
  };

  const isOverdue = reminderDate && new Date(reminderDate) < new Date() && stage !== 'won' && stage !== 'lost';

  return (
    <div className="bg-gray-800/60 border border-white/8 rounded-xl p-3 space-y-2.5 hover:border-white/20 transition-colors cursor-pointer" onClick={onOpen}>
      {/* Name + score */}
      <div className="flex items-start gap-2 justify-between">
        <h4 className="text-sm font-bold text-white leading-snug line-clamp-2 flex-1">{business.name}</h4>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${scoreColor}`}>
          {score}/10
        </span>
      </div>

      {/* Category */}
      <div className="text-[11px] text-purple-400 font-medium truncate">{business.category}</div>

      {/* Phone */}
      {business.phone && (
        <a
          href={whatsappLink(business) ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 transition-colors"
        >
          <MessageCircle className="w-3 h-3" /> {business.phone}
        </a>
      )}

      {/* Price */}
      {estimatedPrice && (
        <div className="text-xs text-gray-400">
          💰 {formatPrice(estimatedPrice.min)} – {formatPrice(estimatedPrice.max)}
        </div>
      )}

      {/* Rating */}
      {business.rating && (
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
          {business.rating} ({business.reviewCount})
        </div>
      )}

      {/* Indicators row */}
      <div className="flex items-center gap-2 flex-wrap">
        {notes && (
          <span className="flex items-center gap-1 text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
            <StickyNote className="w-2.5 h-2.5" /> Note
          </span>
        )}
        {reminderDate && (
          <span className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${isOverdue ? 'text-red-400 bg-red-500/10' : 'text-orange-400 bg-orange-500/10'}`}>
            <Bell className="w-2.5 h-2.5" /> {isOverdue ? 'Overdue' : reminderDate}
          </span>
        )}
        {outreachSentAt && (
          <span className="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">✉ Sent</span>
        )}
        <span className="text-[10px] text-gray-600 ml-auto">{daysSince(prospect.savedAt)}d ago</span>
      </div>

      {/* Reminder note */}
      {reminderNote && (
        <div className={`text-[11px] px-2 py-1 rounded ${isOverdue ? 'text-red-300 bg-red-500/10' : 'text-gray-400 bg-white/5'}`}>
          {reminderNote}
        </div>
      )}

      {/* Move + Delete */}
      <div className="flex items-center gap-1 pt-1 border-t border-white/5">
        <button onClick={(e) => { e.stopPropagation(); movePrev(e); }} disabled={idx === 0} className="flex items-center gap-0.5 text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/15 text-gray-400 disabled:opacity-30 transition-colors">
          <ChevronLeft className="w-3 h-3" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); moveNext(e); }} disabled={idx === STAGES.length - 1} className="flex items-center gap-0.5 text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/15 text-gray-400 disabled:opacity-30 transition-colors">
          <ChevronRight className="w-3 h-3" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); remove(business.id); }}
          className="ml-auto text-[10px] px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const { prospects } = useProspects();
  const [activeStages, setActiveStages] = useState<ProspectStage[]>(STAGES.map((s) => s.id));
  const [showManual, setShowManual] = useState(false);
  const [detailProspect, setDetailProspect] = useState<SavedProspect | null>(null);

  const toggleStage = (id: ProspectStage) => {
    setActiveStages((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((s) => s !== id) : prev) : [...prev, id]
    );
  };

  if (prospects.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 sm:py-24 text-center">
        <div className="text-6xl mb-4">📋</div>
        <h1 className="text-2xl font-black text-white mb-2">Pipeline Empty</h1>
        <p className="text-gray-400 mb-4">Save prospects from the search page, or add them manually</p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link href="/" className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-3 rounded-xl transition-colors">
            Go to Search →
          </Link>
          <button onClick={() => setShowManual(true)} className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-3 rounded-xl transition-colors border border-white/15">
            <Plus className="w-4 h-4" /> Add Manually
          </button>
        </div>
        {showManual && <ManualProspectModal onClose={() => setShowManual(false)} />}
      </div>
    );
  }

  const totalValue = prospects
    .filter((p) => p.stage !== 'lost')
    .reduce((sum, p) => sum + (p.estimatedPrice?.min ?? 0), 0);

  const wonValue = prospects
    .filter((p) => p.stage === 'won')
    .reduce((sum, p) => sum + (p.estimatedPrice?.min ?? 0), 0);

  return (
    <div className="min-h-dvh bg-gray-950">
      {showManual && <ManualProspectModal onClose={() => setShowManual(false)} />}
      {detailProspect && <ProspectDetailModal prospect={detailProspect} onClose={() => setDetailProspect(null)} />}

      {/* Sub-header */}
      <div className="bg-gray-900/50 border-b border-white/6 px-4 py-3">
        <div className="max-w-[1600px] mx-auto space-y-2">
          {/* Top row: title + add button */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-black text-white text-sm sm:text-base">Sales Pipeline</h1>
              <p className="text-xs text-gray-500 truncate">{prospects.length} prospects · {formatPrice(totalValue)} pipeline · {formatPrice(wonValue)} won</p>
            </div>
            <button
              onClick={() => setShowManual(true)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-purple-600/20 hover:bg-purple-600/35 text-purple-300 border border-purple-500/30 rounded-xl text-sm font-bold transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Prospect</span>
            </button>
          </div>
          {/* Stage filters — horizontally scrollable on mobile */}
          <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            {STAGES.map((s) => {
              const count = prospects.filter((p) => p.stage === s.id).length;
              const active = activeStages.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => toggleStage(s.id)}
                  className={`flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                    active ? 'bg-white/10 text-white border-white/20' : 'text-gray-600 border-white/5'
                  }`}
                >
                  {s.icon} {s.label} {count > 0 && <span className="text-gray-500">({count})</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Kanban board */}
      <div className="overflow-x-auto snap-x snap-mandatory sm:snap-none" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="flex gap-3 sm:gap-4 p-3 sm:p-4 min-w-max max-w-[1600px] mx-auto">
          {STAGES.filter((s) => activeStages.includes(s.id)).map((stage) => {
            const stageProspects = prospects.filter((p) => p.stage === stage.id);
            const stageValue = stageProspects.reduce((sum, p) => sum + (p.estimatedPrice?.min ?? 0), 0);

            return (
              <div key={stage.id} className={`w-[85vw] sm:w-64 flex-shrink-0 snap-center rounded-2xl border p-3 ${stage.bg}`}>
                {/* Column header */}
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className={`font-bold text-sm ${stage.headerColor}`}>
                      {stage.icon} {stage.label}
                    </div>
                    {stageValue > 0 && (
                      <div className="text-[11px] text-gray-600 mt-0.5">{formatPrice(stageValue)}</div>
                    )}
                  </div>
                  <span className="text-xs font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                    {stageProspects.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="space-y-3">
                  {stageProspects.length === 0 ? (
                    <div className="text-center py-8 text-gray-700 text-xs">Empty</div>
                  ) : (
                    stageProspects.map((p) => <PipelineCard key={p.business.id} prospect={p} onOpen={() => setDetailProspect(p)} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
