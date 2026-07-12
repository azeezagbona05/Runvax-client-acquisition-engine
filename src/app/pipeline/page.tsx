'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Phone, Star, MessageCircle, StickyNote, Bell, ChevronRight, ChevronLeft,
  Trash2, Download, Zap, CheckSquare, Square, X, Search, Check, Calendar,
  LayoutGrid, List,
} from 'lucide-react';
import { useProspects } from '@/context/ProspectsContext';
import { SavedProspect, ProspectStage, ReplyType } from '@/types';
import { scoreLabel, formatPrice } from '@/lib/scoring';
import { whatsappLink } from '@/lib/phone';
import { useWaPaceTimer } from '@/lib/waRateLimit';
import Link from 'next/link';
import ProspectDetailModal from '@/components/ProspectDetailModal';
import BulkOutreachModal from '@/components/BulkOutreachModal';
import FollowUpSequenceModal from '@/components/FollowUpSequenceModal';
import ProspectTable from '@/components/ProspectTable';

type ViewMode = 'board' | 'table';

type Stage = { id: ProspectStage; icon: string; label: string; headerColor: string; bg: string };

const STAGES: Stage[] = [
  { id: 'found',      icon: '🔵', label: 'Found',      headerColor: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20' },
  { id: 'contacted',  icon: '📱', label: 'Contacted',  headerColor: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  { id: 'interested', icon: '🤝', label: 'Interested', headerColor: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  { id: 'proposal',   icon: '📄', label: 'Proposal',   headerColor: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' },
  { id: 'won',        icon: '🏆', label: 'Won',        headerColor: 'text-green-400',  bg: 'bg-green-500/10 border-green-500/20' },
  { id: 'lost',       icon: '❌', label: 'Lost',       headerColor: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20' },
];

const CARDS_PER_COL = 8;

function stageIdx(id: ProspectStage) { return STAGES.findIndex((s) => s.id === id); }
function daysSince(iso: string) { return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); }
function todayStr() { return new Date().toISOString().split('T')[0]; }

function exportCSV(prospects: SavedProspect[]) {
  const headers = ['Name', 'Category', 'Phone', 'Email', 'Address', 'Score', 'Stage', 'Price Min (NGN)', 'Price Max (NGN)', 'Notes', 'Saved Date', 'Outreach Sent'];
  const rows = prospects.map((p) => [
    p.business.name, p.business.category, p.business.phone ?? '', p.business.email ?? '',
    p.business.address ?? '', p.score, p.stage,
    p.estimatedPrice?.min ?? '', p.estimatedPrice?.max ?? '',
    (p.notes ?? '').replace(/\n/g, ' '),
    new Date(p.savedAt).toLocaleDateString('en-GB'),
    p.outreachSentAt ? new Date(p.outreachSentAt).toLocaleDateString('en-GB') : '',
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `prospects-${todayStr()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function hasDueStepToday(prospect: SavedProspect) {
  if (!prospect.followUpSequence?.length) return false;
  return prospect.followUpSequence.some((s) => !s.sentAt && s.dueDate === todayStr());
}

const QUICK_REPLIES: { id: ReplyType; label: string; stageTarget?: ProspectStage }[] = [
  { id: 'interested',        label: '🤝 Interested',     stageTarget: 'interested' },
  { id: 'asked_price',       label: '💰 Asked price',    stageTarget: 'interested' },
  { id: 'said_send_info',    label: '📤 Send info',      stageTarget: 'interested' },
  { id: 'said_call_me',      label: '📞 Call me',        stageTarget: 'interested' },
  { id: 'said_okay_thanks',  label: '😊 Okay thanks' },
  { id: 'said_think_about_it', label: '🤔 Think about it' },
  { id: 'objection_expensive', label: '💸 Too expensive' },
  { id: 'not_interested',    label: '🚫 Not interested', stageTarget: 'lost' },
];

interface PipelineCardProps {
  prospect: SavedProspect;
  onOpen: () => void;
  onDragStart: (id: string) => void;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onOpenSequence: () => void;
}

function PipelineCard({ prospect, onOpen, onDragStart, selectMode, selected, onToggleSelect, onOpenSequence }: PipelineCardProps) {
  const { updateStage, remove, addConversationEntry, incrementToday } = useProspects();
  const { recordSend } = useWaPaceTimer();
  const { business, stage, score, estimatedPrice, notes, reminderDate, reminderNote, outreachSentAt, conversations } = prospect;
  const { color: scoreColor } = scoreLabel(score);
  const idx = stageIdx(stage);
  const [showLog, setShowLog] = useState(false);
  const [loggedId, setLoggedId] = useState<string | null>(null);

  // Follow-up nudge: compute days since last contact
  const contactDates = [
    outreachSentAt,
    ...(conversations ?? [])
      .filter((c) => c.framework !== 'proposal')
      .map((c) => c.timestamp),
  ].filter(Boolean) as string[];
  const lastContactDate = contactDates.length > 0
    ? contactDates.reduce((latest, d) => (d > latest ? d : latest))
    : null;
  const sinceContact = lastContactDate ? daysSince(lastContactDate) : null;
  const needsFollowUp = sinceContact !== null && sinceContact >= 3 && stage !== 'won' && stage !== 'lost';

  const logReply = async (opt: typeof QUICK_REPLIES[number]) => {
    setLoggedId(opt.id);
    void addConversationEntry(business.id, {
      type: 'received',
      channel: 'whatsapp',
      content: opt.label,
      replyType: opt.id,
    });
    if (opt.stageTarget) {
      const targetIdx = STAGES.findIndex((s) => s.id === opt.stageTarget);
      if (opt.stageTarget === 'lost' || targetIdx > idx) {
        void updateStage(business.id, opt.stageTarget);
      }
    }
    setTimeout(() => { setLoggedId(null); setShowLog(false); }, 1200);
  };

  const movePrev = (e: React.MouseEvent) => { e.stopPropagation(); if (idx > 0) updateStage(business.id, STAGES[idx - 1].id); };
  const moveNext = (e: React.MouseEvent) => { e.stopPropagation(); if (idx < STAGES.length - 1) updateStage(business.id, STAGES[idx + 1].id); };
  const isOverdue = reminderDate && new Date(reminderDate) < new Date() && stage !== 'won' && stage !== 'lost';
  const dueToday = hasDueStepToday(prospect);

  const handleClick = () => {
    if (selectMode) { onToggleSelect(business.id); return; }
    onOpen();
  };

  return (
    <div
      draggable={!selectMode}
      onDragStart={(e) => {
        if (selectMode) return;
        e.dataTransfer.setData('businessId', business.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(business.id);
      }}
      onClick={handleClick}
      className={`relative bg-gray-800/60 border rounded-xl p-3 space-y-2.5 transition-all ${
        selectMode
          ? selected
            ? 'border-green-500/50 bg-green-500/8 cursor-pointer ring-1 ring-green-500/30'
            : 'border-white/8 hover:border-white/20 cursor-pointer'
          : 'border-white/8 hover:border-white/20 cursor-grab active:cursor-grabbing'
      }`}
    >
      {/* Select checkbox */}
      {selectMode && (
        <div className="absolute top-2.5 right-2.5 pointer-events-none">
          {selected
            ? <CheckSquare className="w-4 h-4 text-green-400" />
            : <Square className="w-4 h-4 text-gray-600" />}
        </div>
      )}

      {dueToday && (
        <div className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full w-fit">
          <Zap className="w-2.5 h-2.5" /> Follow-up due today
        </div>
      )}

      {needsFollowUp && !dueToday && (
        <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full w-fit border ${
          sinceContact! >= 7
            ? 'text-red-400 bg-red-500/10 border-red-500/20'
            : 'text-orange-400 bg-orange-500/10 border-orange-500/20'
        }`}>
          ⏰ {sinceContact}d no follow-up
        </div>
      )}

      <div className="flex items-start gap-2 justify-between">
        <h4 className={`text-sm font-bold leading-snug line-clamp-2 flex-1 ${selectMode && !selected ? 'text-gray-300' : 'text-white'} ${selectMode ? 'pr-5' : ''}`}>{business.name}</h4>
        {!selectMode && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${scoreColor}`}>{score}/10</span>
        )}
      </div>

      <div className="text-[11px] text-purple-400 font-medium truncate">{business.category}</div>

      {business.phone && (
        <a href={whatsappLink(business) ?? '#'} target="_blank" rel="noopener noreferrer"
          onClick={(e) => { e.stopPropagation(); void incrementToday(); recordSend(); }}
          className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 transition-colors">
          <MessageCircle className="w-3 h-3" /> {business.phone}
        </a>
      )}

      {estimatedPrice && (
        <div className="text-xs text-gray-400">💰 {formatPrice(estimatedPrice.min)} – {formatPrice(estimatedPrice.max)}</div>
      )}

      {business.rating && (
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
          {business.rating} ({business.reviewCount})
        </div>
      )}

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
        {outreachSentAt && <span className="text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">✉ Sent</span>}
        <span className={`text-[10px] ml-auto ${needsFollowUp ? 'text-orange-400' : 'text-gray-600'}`}>
          {lastContactDate
            ? `${sinceContact}d since contact`
            : `${daysSince(prospect.savedAt)}d saved`}
        </span>
      </div>

      {reminderNote && (
        <div className={`text-[11px] px-2 py-1 rounded ${isOverdue ? 'text-red-300 bg-red-500/10' : 'text-gray-400 bg-white/5'}`}>
          {reminderNote}
        </div>
      )}

      {!selectMode && (
        <>
          <div className="flex items-center gap-1 pt-1 border-t border-white/5">
            <button onClick={(e) => { e.stopPropagation(); movePrev(e); }} disabled={idx === 0}
              className="flex items-center gap-0.5 text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/15 text-gray-400 disabled:opacity-30 transition-colors">
              <ChevronLeft className="w-3 h-3" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); moveNext(e); }} disabled={idx === STAGES.length - 1}
              className="flex items-center gap-0.5 text-[10px] px-2 py-1 rounded bg-white/5 hover:bg-white/15 text-gray-400 disabled:opacity-30 transition-colors">
              <ChevronRight className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setShowLog((v) => !v); }}
              className={`flex items-center gap-0.5 text-[10px] px-2 py-1 rounded border transition-colors ${
                showLog
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                  : 'bg-white/5 hover:bg-white/15 text-gray-400 border-white/10'
              }`}
            >
              📝 Log
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onOpenSequence(); }}
              className={`flex items-center gap-0.5 text-[10px] px-2 py-1 rounded border transition-colors ${
                dueToday
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : prospect.followUpSequence?.length
                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                    : 'bg-white/5 hover:bg-white/15 text-gray-400 border-white/10'
              }`}
              title="Follow-up sequence"
            >
              <Calendar className="w-3 h-3" />
              {prospect.followUpSequence?.length
                ? `${prospect.followUpSequence.filter((s) => s.status === 'sent').length}/${prospect.followUpSequence.length}`
                : 'Seq'}
            </button>
            <button onClick={(e) => { e.stopPropagation(); remove(business.id); }}
              className="ml-auto text-[10px] px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>

          {/* Quick reply log panel */}
          {showLog && (
            <div className="pt-1 border-t border-white/5" onClick={(e) => e.stopPropagation()}>
              <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-1.5">They replied…</p>
              <div className="grid grid-cols-2 gap-1">
                {QUICK_REPLIES.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={(e) => { e.stopPropagation(); void logReply(opt); }}
                    className={`text-[10px] font-semibold px-2 py-1.5 rounded-lg border text-left transition-all ${
                      loggedId === opt.id
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-gray-200'
                    }`}
                  >
                    {loggedId === opt.id
                      ? <span className="flex items-center gap-1"><Check className="w-2.5 h-2.5" /> Logged</span>
                      : opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function PipelinePage() {
  const { prospects, updateStage } = useProspects();
  const [search, setSearch] = useState('');
  const [activeStages, setActiveStages] = useState<ProspectStage[]>(STAGES.map((s) => s.id));
  const [detailProspect, setDetailProspect] = useState<SavedProspect | null>(null);
  const [sequenceProspect, setSequenceProspect] = useState<SavedProspect | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<ProspectStage | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulk, setShowBulk] = useState(false);
  const [colPages, setColPages] = useState<Record<string, number>>({});
  const [view, setView] = useState<ViewMode>('board');

  // Restore last-used view from localStorage, and persist changes to it.
  useEffect(() => {
    const stored = localStorage.getItem('pipelineView');
    if (stored === 'board' || stored === 'table') setView(stored);
  }, []);
  useEffect(() => { localStorage.setItem('pipelineView', view); }, [view]);

  // Reset column pages whenever search changes so results start from the top
  useEffect(() => { setColPages({}); }, [search]);

  const toggleStage = (id: ProspectStage) => {
    setActiveStages((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((s) => s !== id) : prev) : [...prev, id]
    );
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(prospects.filter((p) => p.business.phone).map((p) => p.business.id)));
  };

  const exitSelect = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleDrop = useCallback((stageId: ProspectStage) => (e: React.DragEvent) => {
    e.preventDefault();
    const businessId = e.dataTransfer.getData('businessId') || draggingId;
    if (businessId) void updateStage(businessId, stageId);
    setDraggingId(null);
    setDragOverStage(null);
  }, [draggingId, updateStage]);

  const matchesSearch = useCallback((p: SavedProspect) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.business.name.toLowerCase().includes(q) ||
      (p.business.category ?? '').toLowerCase().includes(q) ||
      (p.business.address ?? '').toLowerCase().includes(q) ||
      (p.business.phone ?? '').includes(q)
    );
  }, [search]);

  const selectedProspects = useMemo(
    () => prospects.filter((p) => selectedIds.has(p.business.id)),
    [prospects, selectedIds],
  );

  const totalValue = useMemo(
    () => prospects.filter((p) => p.stage !== 'lost').reduce((s, p) => s + (p.estimatedPrice?.min ?? 0), 0),
    [prospects],
  );
  const wonValue = useMemo(
    () => prospects.filter((p) => p.stage === 'won').reduce((s, p) => s + (p.estimatedPrice?.min ?? 0), 0),
    [prospects],
  );

  // Pre-compute per-stage filtered lists once per prospects/search change
  const prospectsByStage = useMemo(() => {
    const map = new Map<string, SavedProspect[]>();
    for (const stage of STAGES) {
      map.set(stage.id, prospects.filter((p) => p.stage === stage.id && matchesSearch(p)));
    }
    return map;
  }, [prospects, matchesSearch]);

  // Flat list respecting the active stage filters + search — feeds the table view
  const filteredProspects = useMemo(
    () => prospects.filter((p) => activeStages.includes(p.stage) && matchesSearch(p)),
    [prospects, activeStages, matchesSearch],
  );

  if (prospects.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 sm:py-24 text-center">
        <div className="text-6xl mb-4">📋</div>
        <h1 className="text-2xl font-black text-white mb-2">Pipeline Empty</h1>
        <p className="text-gray-400 mb-4">Save prospects from the search page to build your pipeline</p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link href="/" className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-3 rounded-xl transition-colors">
            Go to Search →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gray-950">
      {detailProspect && !selectMode && <ProspectDetailModal prospect={detailProspect} onClose={() => setDetailProspect(null)} />}
      {sequenceProspect && <FollowUpSequenceModal prospect={sequenceProspect} onClose={() => setSequenceProspect(null)} />}
      {showBulk && <BulkOutreachModal prospects={selectedProspects} onClose={() => setShowBulk(false)} />}

      {/* Sub-header */}
      <div className="bg-gray-900/50 border-b border-white/6 px-4 py-3">
        <div className="max-w-[1600px] mx-auto space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-black text-white text-sm sm:text-base">Sales Pipeline</h1>
              <p className="text-xs text-gray-500 truncate">
                {prospects.length} prospects · {formatPrice(totalValue)} pipeline · {formatPrice(wonValue)} won
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {!selectMode ? (
                <>
                  <div className="hidden sm:flex items-center gap-0.5 bg-white/5 border border-white/10 rounded-xl p-0.5">
                    <button
                      onClick={() => setView('board')}
                      title="Board view"
                      className={`p-1.5 rounded-lg transition-colors ${view === 'board' ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setView('table')}
                      title="Table view"
                      className={`p-1.5 rounded-lg transition-colors ${view === 'table' ? 'bg-white/15 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      <List className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => setSelectMode(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-xl text-sm font-bold transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">Bulk WhatsApp</span>
                  </button>
                  <button
                    onClick={() => exportCSV(prospects)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 rounded-xl text-sm font-bold transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Export CSV</span>
                  </button>
                </>
              ) : (
                <>
                  <button onClick={selectAll} className="text-xs font-semibold text-gray-400 hover:text-white px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 transition-colors">
                    Select all with phone
                  </button>
                  <button onClick={exitSelect} className="text-gray-500 hover:text-gray-300 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search prospects…"
              className="w-full bg-white/[0.04] border border-white/8 rounded-xl pl-8 pr-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/40 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Stage filters */}
          <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
            {STAGES.map((s) => {
              const count = prospectsByStage.get(s.id)?.length ?? 0;
              const active = activeStages.includes(s.id);
              return (
                <button key={s.id} onClick={() => toggleStage(s.id)}
                  className={`flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                    active ? 'bg-white/10 text-white border-white/20' : 'text-gray-600 border-white/5'
                  }`}>
                  {s.icon} {s.label} {count > 0 && <span className="text-gray-500">({count})</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Due follow-ups banner */}
      {(() => {
        const dueProspects = prospects.filter(hasDueStepToday); // eslint-disable-line react-hooks/exhaustive-deps
        if (!dueProspects.length) return null;
        return (
          <div className="px-4 pt-3 max-w-[1600px] mx-auto">
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="text-sm font-bold text-amber-300">
                  {dueProspects.length} follow-up{dueProspects.length > 1 ? 's' : ''} due today
                </span>
                <span className="text-xs text-amber-400/60 hidden sm:inline">
                  — {dueProspects.map((p) => p.business.name.split(' ')[0]).slice(0, 3).join(', ')}{dueProspects.length > 3 ? ` +${dueProspects.length - 3}` : ''}
                </span>
              </div>
              <button
                onClick={() => setSequenceProspect(dueProspects[0])}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
              >
                Start now →
              </button>
            </div>
          </div>
        );
      })()}

      {/* Table view (desktop) */}
      {view === 'table' && (
        <div className="hidden sm:block px-3 sm:px-4 py-4 max-w-[1600px] mx-auto">
          <ProspectTable
            prospects={filteredProspects}
            onOpen={setDetailProspect}
            onOpenSequence={setSequenceProspect}
            selectMode={selectMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />
        </div>
      )}

      {/* Kanban board — always the mobile view; desktop when view === 'board' */}
      <div className={`${view === 'table' ? 'sm:hidden' : ''} overflow-x-auto snap-x snap-mandatory sm:snap-none`} style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="flex gap-3 sm:gap-4 p-3 sm:p-4 min-w-max max-w-[1600px] mx-auto">
          {STAGES.filter((s) => activeStages.includes(s.id)).map((stage) => {
            const stageProspects = prospectsByStage.get(stage.id) ?? [];
            const stageValue = stageProspects.reduce((s, p) => s + (p.estimatedPrice?.min ?? 0), 0);
            const isDragTarget = !selectMode && dragOverStage === stage.id;
            const colPage = colPages[stage.id] ?? 1;
            const visible = stageProspects.slice(0, colPage * CARDS_PER_COL);
            const remaining = stageProspects.length - visible.length;

            return (
              <div
                key={stage.id}
                className={`w-[85vw] sm:w-64 flex-shrink-0 snap-center rounded-2xl border p-3 transition-all ${stage.bg} ${isDragTarget ? 'ring-2 ring-white/30 scale-[1.01]' : ''}`}
                onDragOver={(e) => { if (selectMode) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverStage(stage.id); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverStage(null); }}
                onDrop={handleDrop(stage.id)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className={`font-bold text-sm ${stage.headerColor}`}>{stage.icon} {stage.label}</div>
                    {stageValue > 0 && <div className="text-[11px] text-gray-600 mt-0.5">{formatPrice(stageValue)}</div>}
                  </div>
                  <span className="text-xs font-bold text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{stageProspects.length}</span>
                </div>

                {isDragTarget && (
                  <div className="mb-3 border-2 border-dashed border-white/20 rounded-xl py-3 text-center text-[11px] text-gray-500">
                    Drop here → {stage.label}
                  </div>
                )}

                <div className="space-y-3">
                  {stageProspects.length === 0 && !isDragTarget ? (
                    <div className="text-center py-8 text-gray-700 text-xs">Empty</div>
                  ) : (
                    visible.map((p) => (
                      <PipelineCard
                        key={p.business.id}
                        prospect={p}
                        onOpen={() => setDetailProspect(p)}
                        onDragStart={setDraggingId}
                        selectMode={selectMode}
                        selected={selectedIds.has(p.business.id)}
                        onToggleSelect={toggleSelect}
                        onOpenSequence={() => setSequenceProspect(p)}
                      />
                    ))
                  )}

                  {remaining > 0 && (
                    <button
                      onClick={() => setColPages((prev) => ({ ...prev, [stage.id]: (prev[stage.id] ?? 1) + 1 }))}
                      className="w-full py-2 text-[11px] font-semibold text-gray-500 hover:text-gray-300 bg-white/[0.03] hover:bg-white/[0.07] border border-white/8 rounded-xl transition-colors"
                    >
                      {remaining} more ↓
                    </button>
                  )}

                  {colPage > 1 && remaining === 0 && stageProspects.length > CARDS_PER_COL && (
                    <button
                      onClick={() => setColPages((prev) => ({ ...prev, [stage.id]: 1 }))}
                      className="w-full py-2 text-[11px] font-semibold text-gray-600 hover:text-gray-400 transition-colors"
                    >
                      ↑ Show less
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom action bar — visible in select mode */}
      {selectMode && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-gray-900/95 border-t border-white/10 px-4 py-3 backdrop-blur-sm">
          <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-3">
            <span className="text-sm text-gray-400">
              {selectedIds.size === 0
                ? 'Tap cards to select'
                : `${selectedIds.size} prospect${selectedIds.size > 1 ? 's' : ''} selected`}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={exitSelect} className="text-sm text-gray-500 hover:text-gray-300 px-4 py-2 rounded-xl transition-colors">
                Cancel
              </button>
              <button
                disabled={selectedIds.size === 0}
                onClick={() => setShowBulk(true)}
                className="flex items-center gap-2 bg-green-500 hover:bg-green-400 disabled:opacity-40 text-white font-black px-5 py-2.5 rounded-xl text-sm transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Send WhatsApp to {selectedIds.size > 0 ? selectedIds.size : '...'} selected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spacer for bottom bar */}
      {selectMode && <div className="h-20" />}
    </div>
  );
}
