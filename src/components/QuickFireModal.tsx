'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, MessageCircle, ChevronRight, Bookmark, MapPin, Star, Copy, Check, Zap } from 'lucide-react';
import { Business } from '@/types';
import { scoreLabel } from '@/lib/scoring';
import { useProspects } from '@/context/ProspectsContext';
import { whatsappLink } from '@/lib/phone';

interface Props {
  businesses: Business[];
  onClose: () => void;
}

function buildMessage(b: Business) {
  const reviewLine = b.reviewCount
    ? `You've earned ${b.reviewCount} Google reviews ⭐ — but when people search for you, there's no website to send them to.`
    : `People search for ${b.category} in your area every day.`;
  return `Hi! 👋 I came across ${b.name} on Google. ${reviewLine}\n\nI build digital front doors for ${b.category} businesses — not just a website, but the full experience customers get *before* visiting and *after* leaving. Found on Google, recommended by AI assistants, enquiries 24/7.\n\nOpen to a quick chat? 🌐`;
}

export default function QuickFireModal({ businesses, onClose }: Props) {
  const { isSaved, save, markOutreachSent, updateStage, incrementToday, get } = useProspects();
  const [index, setIndex] = useState(0);
  const [sent, setSent] = useState<Set<number>>(new Set());
  const [skipped, setSkipped] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);
  const [done, setDone] = useState(false);

  // Only no-website prospects (the real targets)
  const targets = businesses.filter((b) => !b.hasWebsite && b.phone);
  const current = targets[index];
  const prospect = current ? get(current.id) : undefined;
  const total = targets.length;
  const progress = ((sent.size + skipped.size) / Math.max(total, 1)) * 100;

  const goNext = useCallback(() => {
    const next = index + 1;
    if (next >= total) { setDone(true); return; }
    setIndex(next);
    setCopied(false);
  }, [index, total]);

  const handleSend = () => {
    if (!current?.phone) return;
    const msg = buildMessage(current);
    const link = whatsappLink(current, msg);
    if (!link) return;
    window.open(link, '_blank');
    if (!isSaved(current.id)) save(current);
    markOutreachSent(current.id, msg, 'whatsapp');
    updateStage(current.id, 'contacted');
    incrementToday();
    setSent((prev) => new Set(prev).add(index));
    setTimeout(goNext, 400);
  };

  const handleSkip = () => {
    setSkipped((prev) => new Set(prev).add(index));
    goNext();
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!current) return;
    if (!isSaved(current.id)) save(current);
    goNext();
  };

  const copyMsg = () => {
    if (!current) return;
    navigator.clipboard.writeText(buildMessage(current)).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter' && !done) handleSend();
      if (e.key === 'ArrowRight' && !done) handleSkip();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, done]);

  if (targets.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-3">🎯</div>
          <h2 className="font-black text-white text-lg mb-2">No Targets Found</h2>
          <p className="text-gray-400 text-sm mb-5">Quick-Fire mode needs businesses with no website AND a phone number. Search a different area or industry.</p>
          <button onClick={onClose} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition-colors">Got it</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[70] flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-400" />
          <span className="font-black text-white">Quick-Fire Mode</span>
          <span className="text-xs text-gray-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
            {index + 1} / {total}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="text-green-400 font-bold">✓ {sent.size} sent</span>
          <span>↷ {skipped.size} skipped</span>
          <button onClick={onClose} className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/5 flex-shrink-0">
        <div className="h-full bg-gradient-to-r from-purple-500 to-green-500 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-4">
        {done ? (
          <div className="text-center max-w-sm">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="font-black text-white text-2xl mb-2">Session Complete!</h2>
            <p className="text-gray-400 mb-2">You messaged <strong className="text-green-400">{sent.size}</strong> businesses</p>
            <p className="text-gray-600 text-sm mb-6">That&apos;s {sent.size} potential clients in your pipeline</p>
            <button onClick={onClose} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl transition-colors">
              Back to Results
            </button>
          </div>
        ) : current ? (
          <div className="w-full max-w-lg">

            {/* Prospect card */}
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 mb-5 shadow-2xl">

              {prospect?.stage && prospect.stage !== 'found' && (
                <div className="text-[11px] font-bold px-2.5 py-1 rounded-lg border mb-3 inline-flex items-center gap-1 text-yellow-400 bg-yellow-500/15 border-yellow-500/30">
                  📱 Already {prospect.stage}
                </div>
              )}

              {/* Score */}
              <div className="flex items-start justify-between mb-4">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${scoreLabel(0).color}`}>
                  {(() => { const s = scoreLabel(0); return `${s.label}`; })()}
                </span>
                <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/25">
                  🎯 No Website
                </span>
              </div>

              <h2 className="text-2xl font-black text-white mb-1 leading-tight">{current.name}</h2>
              <p className="text-purple-400 font-semibold text-sm mb-4">{current.category}</p>

              <div className="space-y-2 mb-5">
                {current.address && (
                  <div className="flex items-start gap-2 text-sm text-gray-400">
                    <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-600" />
                    <span>{current.address}</span>
                  </div>
                )}
                {current.rating && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="text-white font-semibold">{current.rating}</span>
                    {current.reviewCount && <span className="text-gray-600 text-xs">({current.reviewCount} reviews)</span>}
                  </div>
                )}
                {current.phone && (
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-lg">{current.phone}</span>
                    <button onClick={copyMsg} className={`text-[11px] font-bold px-2 py-1 rounded-lg transition-colors ${copied ? 'bg-green-500/20 text-green-400' : 'bg-white/8 text-gray-500 hover:text-white border border-white/10'}`}>
                      {copied ? <><Check className="w-3 h-3 inline mr-1" />Copied</> : <><Copy className="w-3 h-3 inline mr-1" />Copy msg</>}
                    </button>
                  </div>
                )}
              </div>

              {/* Message preview */}
              <div className="bg-green-950/30 border border-green-500/15 rounded-xl p-3 text-green-200/80 text-xs leading-relaxed whitespace-pre-wrap">
                {buildMessage(current)}
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={handleSkip}
                className="flex flex-col items-center gap-1.5 py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all group"
              >
                <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                <span className="text-xs font-bold">Skip</span>
                <span className="text-[10px] text-gray-600">→ key</span>
              </button>

              <button
                onClick={handleSend}
                className="flex flex-col items-center gap-1.5 py-4 rounded-2xl bg-green-600 hover:bg-green-500 text-white font-bold transition-all shadow-lg shadow-green-900/40 hover:scale-[1.02]"
              >
                <MessageCircle className="w-6 h-6" />
                <span className="text-sm font-black">Send WhatsApp</span>
                <span className="text-[10px] text-green-200/70">Enter key</span>
              </button>

              <button
                onClick={handleSave}
                className="flex flex-col items-center gap-1.5 py-4 rounded-2xl bg-white/5 hover:bg-purple-600/20 border border-white/10 hover:border-purple-500/30 text-gray-400 hover:text-purple-300 transition-all group"
              >
                <Bookmark className="w-5 h-5" />
                <span className="text-xs font-bold">Save</span>
                <span className="text-[10px] text-gray-600">for later</span>
              </button>
            </div>

            <p className="text-center text-[11px] text-gray-700 mt-4">
              Esc to exit &nbsp;·&nbsp; Enter to send &nbsp;·&nbsp; → to skip
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
