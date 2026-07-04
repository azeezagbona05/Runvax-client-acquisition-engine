'use client';

import { useState } from 'react';
import { Loader2, Sparkles, Copy, Check, ArrowRight, AlertTriangle } from 'lucide-react';
import type { Business, ProspectStage } from '@/types';
import type { ReplyAnalysis } from '@/app/api/reply-intelligence/route';
import { useProspects } from '@/context/ProspectsContext';

interface Props {
  business: Business;
  currentStage?: ProspectStage;
  onStageChange?: (stage: ProspectStage) => void;
}

const STAGE_META: Record<ProspectStage, { icon: string; label: string; color: string; bg: string }> = {
  found:      { icon: '🔵', label: 'Found',      color: 'text-blue-300',   bg: 'bg-blue-500/20 border-blue-500/30' },
  contacted:  { icon: '📱', label: 'Contacted',  color: 'text-yellow-300', bg: 'bg-yellow-500/20 border-yellow-500/30' },
  interested: { icon: '🤝', label: 'Interested', color: 'text-orange-300', bg: 'bg-orange-500/20 border-orange-500/30' },
  proposal:   { icon: '📄', label: 'Proposal',   color: 'text-purple-300', bg: 'bg-purple-500/20 border-purple-500/30' },
  won:        { icon: '🏆', label: 'Won',         color: 'text-green-300',  bg: 'bg-green-500/20 border-green-500/30' },
  lost:       { icon: '❌', label: 'Lost',        color: 'text-red-300',   bg: 'bg-red-500/20 border-red-500/30' },
};

const INTENT_LABEL: Record<ReplyAnalysis['intent'], string> = {
  interested:     '🤝 Interested',
  price_check:    '💰 Asking about price',
  needs_info:     '❓ Wants more info',
  wants_demo:     '👀 Wants to see your work',
  not_interested: '🚫 Not interested',
  ghost:          '👻 Vague / ghosting',
  won:            '🏆 Ready to proceed!',
};

const URGENCY_CONFIG: Record<ReplyAnalysis['urgency'], { label: string; cls: string }> = {
  high:   { label: '🔥 Reply now', cls: 'bg-red-500/20 text-red-300 border-red-500/30' },
  medium: { label: '⚡ Reply today', cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  low:    { label: '🕐 Reply when ready', cls: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
};

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); } catch { /* */ }
        setCopied(true); setTimeout(() => setCopied(false), 2000);
      }}
      className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
        copied ? 'bg-green-600 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-300'
      }`}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export default function ReplyPanel({ business, currentStage, onStageChange }: Props) {
  const { updateStage, save, isSaved } = useProspects();
  const [replyText, setReplyText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReplyAnalysis | null>(null);
  const [error, setError] = useState('');
  const [stageApplied, setStageApplied] = useState(false);

  const analyse = async () => {
    if (!replyText.trim()) return;
    setLoading(true); setError(''); setResult(null); setStageApplied(false);
    try {
      const res = await fetch('/api/reply-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          replyText,
          businessName: business.name,
          businessCategory: business.category,
          currentStage,
        }),
      });
      let json: { result?: ReplyAnalysis; error?: string } = {};
      try { json = await res.json(); } catch { /* */ }
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
      setResult(json.result ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to analyse reply');
    } finally {
      setLoading(false);
    }
  };

  const applyStage = async () => {
    if (!result) return;
    if (!isSaved(business.id)) await save(business);
    await updateStage(business.id, result.suggestedStage);
    setStageApplied(true);
    onStageChange?.(result.suggestedStage);
  };

  const stageChanged = result && result.suggestedStage !== currentStage;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
          Paste their reply
        </p>
        <textarea
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder={"Paste the WhatsApp or email reply here...\n\ne.g. \"Okay, how much do you charge?\""}
          rows={5}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-purple-500/50 transition-colors font-sans leading-relaxed"
        />
      </div>

      <button
        onClick={analyse}
        disabled={loading || !replyText.trim()}
        className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors"
      >
        {loading
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysing…</>
          : <><Sparkles className="w-4 h-4" /> Analyse Reply</>}
      </button>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400 bg-red-950/30 border border-red-500/20 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4 border-t border-white/8 pt-4">

          {/* Intent + Urgency */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white">{INTENT_LABEL[result.intent]}</span>
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${URGENCY_CONFIG[result.urgency].cls}`}>
              {URGENCY_CONFIG[result.urgency].label}
            </span>
          </div>

          {/* Summary */}
          <div className="bg-white/5 border border-white/8 rounded-xl px-4 py-3">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">What they said</p>
            <p className="text-sm text-gray-200 leading-relaxed">{result.summary}</p>
          </div>

          {/* Stage recommendation */}
          <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4 space-y-3">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Recommended Kanban stage</p>
            <div className="flex items-center gap-3">
              {currentStage && (
                <>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${STAGE_META[currentStage].bg} ${STAGE_META[currentStage].color}`}>
                    {STAGE_META[currentStage].icon} {STAGE_META[currentStage].label}
                  </span>
                  {stageChanged && <ArrowRight className="w-4 h-4 text-gray-600 flex-shrink-0" />}
                </>
              )}
              <span className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${STAGE_META[result.suggestedStage].bg} ${STAGE_META[result.suggestedStage].color}`}>
                {STAGE_META[result.suggestedStage].icon} {STAGE_META[result.suggestedStage].label}
              </span>
            </div>
            <p className="text-xs text-gray-500">{result.stageReason}</p>
            {!stageApplied ? (
              <button
                onClick={applyStage}
                className={`w-full py-2.5 text-sm font-bold rounded-xl transition-colors ${
                  stageChanged
                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
                    : 'bg-white/5 text-gray-600 cursor-default'
                }`}
                disabled={!stageChanged}
              >
                {stageChanged ? `Move to ${STAGE_META[result.suggestedStage].label}` : 'Stage is already correct'}
              </button>
            ) : (
              <div className="flex items-center gap-2 justify-center py-2 text-sm text-green-400 font-bold">
                <Check className="w-4 h-4" /> Moved to {STAGE_META[result.suggestedStage].label}
              </div>
            )}
          </div>

          {/* Follow-up message */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Suggested follow-up</p>
            <div className="bg-green-950/20 border border-green-500/15 rounded-xl px-4 py-3">
              <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-line">{result.followUp}</p>
            </div>
            <CopyBtn text={result.followUp} />
          </div>
        </div>
      )}
    </div>
  );
}
