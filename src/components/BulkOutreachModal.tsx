'use client';

import { useState, useMemo } from 'react';
import { X, MessageCircle, Check, ChevronRight, ExternalLink, Users } from 'lucide-react';
import { SavedProspect } from '@/types';
import { buildQuickWAMessage, buildWALink } from '@/lib/waMessage';
import { useProspects } from '@/context/ProspectsContext';

interface Props {
  prospects: SavedProspect[];
  onClose: () => void;
}

function renderWA(text: string) {
  return text.split('\n').map((line, li) => {
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;
    while (remaining.length > 0) {
      const bold = remaining.indexOf('*');
      const italic = remaining.indexOf('_');
      const first = [bold, italic].filter((i) => i >= 0).sort((a, b) => a - b)[0];
      if (first === undefined) { parts.push(remaining); break; }
      if (first > 0) parts.push(remaining.slice(0, first));
      const marker = remaining[first];
      const closeIdx = remaining.indexOf(marker, first + 1);
      if (closeIdx < 0) { parts.push(remaining); break; }
      const inner = remaining.slice(first + 1, closeIdx);
      if (marker === '*') parts.push(<strong key={key++}>{inner}</strong>);
      if (marker === '_') parts.push(<em key={key++}>{inner}</em>);
      remaining = remaining.slice(closeIdx + 1);
    }
    return <p key={li} className={line === '' ? 'mt-2' : 'leading-relaxed'}>{parts}</p>;
  });
}

export default function BulkOutreachModal({ prospects, onClose }: Props) {
  const { markOutreachSent, updateStage } = useProspects();

  const items = useMemo(
    () =>
      prospects
        .filter((p) => p.business.phone)
        .map((p) => ({
          prospect: p,
          message: buildQuickWAMessage(p.business),
          link: buildWALink(p.business),
        })),
    [prospects],
  );

  const noPhone = prospects.filter((p) => !p.business.phone);

  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [currentIdx, setCurrentIdx] = useState(0);
  const [view, setView] = useState<'overview' | 'queue'>('overview');
  const [preview, setPreview] = useState<number | null>(null);

  const markSent = async (bizId: string, msg: string) => {
    setSentIds((prev) => { const n = new Set(prev); n.add(bizId); return n; });
    await markOutreachSent(bizId, msg, 'whatsapp');
    await updateStage(bizId, 'contacted');
  };

  const openAll = () => {
    items.forEach((item, i) => {
      if (!sentIds.has(item.prospect.business.id) && item.link) {
        window.open(item.link, `_wa_bulk_${i}`);
      }
    });
  };

  const currentItem = items[currentIdx];
  const sentCount = sentIds.size;
  const totalWithPhone = items.length;

  if (view === 'queue' && currentItem) {
    const bizId = currentItem.prospect.business.id;
    const isSent = sentIds.has(bizId);

    const goNext = () => {
      const next = items.findIndex((it, i) => i > currentIdx && !sentIds.has(it.prospect.business.id));
      if (next >= 0) {
        setCurrentIdx(next);
      } else {
        const firstUnsent = items.findIndex((it) => !sentIds.has(it.prospect.business.id));
        if (firstUnsent < 0) setView('overview');
        else setCurrentIdx(firstUnsent);
      }
    };

    const openAndMarkSent = async () => {
      if (currentItem.link) window.open(currentItem.link, '_blank');
      await markSent(bizId, currentItem.message);
      setTimeout(goNext, 600);
    };

    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
        <div
          className="bg-gray-900 border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl flex flex-col max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/8 flex-shrink-0">
            <div>
              <div className="font-black text-white text-sm">Queue Mode</div>
              <div className="text-xs text-gray-500">{sentCount}/{totalWithPhone} sent · {currentIdx + 1} of {totalWithPhone}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setView('overview')} className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
                Overview
              </button>
              <button onClick={onClose} className="text-gray-600 hover:text-gray-300"><X className="w-5 h-5" /></button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-white/5 flex-shrink-0">
            <div
              className="h-full bg-green-500 transition-all"
              style={{ width: `${totalWithPhone > 0 ? (sentCount / totalWithPhone) * 100 : 0}%` }}
            />
          </div>

          <div className="p-5 flex-1 overflow-y-auto space-y-4">
            {/* Prospect info */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-600/30 to-emerald-500/20 flex items-center justify-center text-lg font-black text-white flex-shrink-0">
                {currentItem.prospect.business.name[0]}
              </div>
              <div>
                <div className="font-bold text-white text-sm leading-tight">{currentItem.prospect.business.name}</div>
                <div className="text-xs text-gray-500">{currentItem.prospect.business.phone}</div>
              </div>
              {isSent && (
                <span className="ml-auto text-xs font-bold text-green-400 bg-green-500/10 border border-green-500/20 px-2 py-1 rounded-lg flex items-center gap-1">
                  <Check className="w-3 h-3" /> Sent
                </span>
              )}
            </div>

            {/* Message preview */}
            <div className="bg-green-500/5 border border-green-500/15 rounded-xl p-4 text-sm text-gray-300 space-y-1">
              {renderWA(currentItem.message)}
            </div>

            {/* Actions */}
            {!isSent ? (
              <button
                onClick={openAndMarkSent}
                className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-white font-black py-3.5 rounded-2xl text-base transition-colors"
              >
                <MessageCircle className="w-5 h-5" /> Open WhatsApp & Mark Sent
              </button>
            ) : (
              <button
                onClick={goNext}
                className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white font-bold py-3.5 rounded-2xl text-sm transition-colors border border-white/10"
              >
                Next prospect <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {/* Skip */}
            <button onClick={goNext} className="w-full text-center text-xs text-gray-600 hover:text-gray-400 transition-colors py-1">
              Skip this one
            </button>
          </div>

          {/* Mini list */}
          <div className="border-t border-white/8 px-4 py-3 flex gap-1.5 overflow-x-auto flex-shrink-0 scrollbar-none">
            {items.map((it, i) => {
              const sent = sentIds.has(it.prospect.business.id);
              const isActive = i === currentIdx;
              return (
                <button
                  key={it.prospect.business.id}
                  onClick={() => setCurrentIdx(i)}
                  className={`flex-shrink-0 w-8 h-8 rounded-full text-[10px] font-black border transition-all flex items-center justify-center ${
                    sent
                      ? 'bg-green-500/20 border-green-500/30 text-green-400'
                      : isActive
                      ? 'bg-white/20 border-white/30 text-white scale-110'
                      : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/20'
                  }`}
                >
                  {sent ? '✓' : i + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Overview mode
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/8 flex-shrink-0">
          <div>
            <div className="font-black text-white text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-green-400" /> Bulk WhatsApp Outreach
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {totalWithPhone} with phone · {sentCount} sent
              {noPhone.length > 0 && ` · ${noPhone.length} skipped (no phone)`}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300"><X className="w-5 h-5" /></button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-white/5 flex-shrink-0">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${totalWithPhone > 0 ? (sentCount / totalWithPhone) * 100 : 0}%` }}
          />
        </div>

        {/* Action buttons */}
        <div className="p-4 border-b border-white/6 flex gap-2 flex-shrink-0">
          <button
            onClick={() => { setCurrentIdx(0); setView('queue'); }}
            className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-400 text-white font-black py-2.5 rounded-xl text-sm transition-colors"
          >
            <MessageCircle className="w-4 h-4" /> Start Queue (one at a time)
          </button>
          <button
            onClick={openAll}
            title="Opens all in new tabs — allow popups when prompted"
            className="flex items-center gap-1.5 px-3 py-2.5 bg-white/8 hover:bg-white/12 text-gray-300 border border-white/10 rounded-xl text-xs font-bold transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open all tabs
          </button>
        </div>

        {/* Prospect list */}
        <div className="overflow-y-auto flex-1">
          {items.map((item, i) => {
            const bizId = item.prospect.business.id;
            const sent = sentIds.has(bizId);
            const showPreview = preview === i;

            return (
              <div key={bizId} className="border-b border-white/5 last:border-0">
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Status dot */}
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    sent ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-gray-600'
                  }`}>
                    {sent ? <Check className="w-3 h-3" /> : <span className="text-[10px] font-bold">{i + 1}</span>}
                  </div>

                  {/* Name + phone */}
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold truncate ${sent ? 'text-gray-500 line-through' : 'text-white'}`}>
                      {item.prospect.business.name}
                    </div>
                    <div className="text-[11px] text-gray-600">{item.prospect.business.phone}</div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setPreview(showPreview ? null : i)}
                      className="text-[10px] px-2 py-1 rounded-lg bg-white/5 text-gray-500 hover:text-gray-300 border border-white/8 transition-colors"
                    >
                      {showPreview ? 'Hide' : 'Preview'}
                    </button>
                    {!sent ? (
                      <a
                        href={item.link ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => markSent(bizId, item.message)}
                        className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-green-500/25 transition-colors"
                      >
                        <MessageCircle className="w-3 h-3" /> Send
                      </a>
                    ) : (
                      <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-1 rounded-lg">Sent ✓</span>
                    )}
                  </div>
                </div>

                {/* Message preview */}
                {showPreview && (
                  <div className="px-4 pb-3">
                    <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-3 text-xs text-gray-400 space-y-1">
                      {renderWA(item.message)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* No-phone list */}
          {noPhone.length > 0 && (
            <div className="px-4 py-3 border-t border-white/5">
              <p className="text-[11px] text-gray-700 mb-1.5">Skipped — no phone number:</p>
              {noPhone.map((p) => (
                <div key={p.business.id} className="text-[11px] text-gray-600 py-0.5">{p.business.name}</div>
              ))}
            </div>
          )}
        </div>

        {/* Done footer */}
        {sentCount === totalWithPhone && totalWithPhone > 0 && (
          <div className="border-t border-green-500/20 bg-green-500/10 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <span className="text-sm font-bold text-green-400">All {sentCount} messages sent!</span>
            <button onClick={onClose} className="text-xs text-green-400 hover:text-green-300 font-semibold">Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
