'use client';

import { useState } from 'react';
import {
  X, Star, Phone, Globe, MapPin, MessageCircle,
  Trash2, FileText, Loader2, Copy, Check,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useProspects } from '@/context/ProspectsContext';
import { SavedProspect, ProspectStage, ReplyType } from '@/types';
import { scoreLabel, formatPrice } from '@/lib/scoring';
import { whatsappLink } from '@/lib/phone';

const STAGES: Array<{ id: ProspectStage; icon: string; label: string; color: string }> = [
  { id: 'found',      icon: '🔵', label: 'Found',      color: 'text-blue-400 border-blue-500/30 bg-blue-500/10' },
  { id: 'contacted',  icon: '📱', label: 'Contacted',  color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' },
  { id: 'interested', icon: '🤝', label: 'Interested', color: 'text-orange-400 border-orange-500/30 bg-orange-500/10' },
  { id: 'proposal',   icon: '📄', label: 'Proposal',   color: 'text-purple-400 border-purple-500/30 bg-purple-500/10' },
  { id: 'won',        icon: '🏆', label: 'Won',        color: 'text-green-400 border-green-500/30 bg-green-500/10' },
  { id: 'lost',       icon: '❌', label: 'Lost',       color: 'text-red-400 border-red-500/30 bg-red-500/10' },
];

const REPLY_OPTIONS: { id: ReplyType; label: string; active: string }[] = [
  { id: 'interested',          label: '🤝 Interested',       active: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
  { id: 'asked_price',         label: '💰 Asked price',      active: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
  { id: 'said_think_about_it', label: '🤔 Think about it',   active: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  { id: 'objection_instagram', label: '📱 Has Instagram',    active: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  { id: 'objection_expensive', label: '💸 Too expensive',    active: 'bg-red-500/20 text-red-300 border-red-500/40' },
  { id: 'objection_no_time',   label: '⏰ No time',          active: 'bg-gray-500/20 text-gray-300 border-gray-500/40' },
  { id: 'no_reply',            label: '🔕 No reply yet',     active: 'bg-gray-600/20 text-gray-400 border-gray-600/40' },
  { id: 'custom',              label: '✏️ Custom',           active: 'bg-white/10 text-white border-white/25' },
];

type Tab = 'reply' | 'proposal' | 'info';

interface Props {
  prospect: SavedProspect;
  onClose: () => void;
}

function timeAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (d < 1) return 'just now';
  if (d < 60) return `${d}m ago`;
  if (d < 1440) return `${Math.floor(d / 60)}h ago`;
  return `${Math.floor(d / 1440)}d ago`;
}

export default function ProspectDetailModal({ prospect, onClose }: Props) {
  const { updateStage, remove, addConversationEntry } = useProspects();
  const { business, stage, score, estimatedPrice, conversations = [], savedAt } = prospect;
  const { label: scoreText, color: scoreColor } = scoreLabel(score);
  const stageIdx = STAGES.findIndex((s) => s.id === stage);

  const [tab, setTab] = useState<Tab>('reply');

  // Reply tab
  const [theirMsg, setTheirMsg] = useState('');
  const [replyType, setReplyType] = useState<ReplyType | null>(null);
  const [aiReply, setAiReply] = useState('');
  const [generating, setGenerating] = useState(false);
  const [replyCopied, setReplyCopied] = useState(false);

  const generateReply = async () => {
    if (!replyType) return;
    setGenerating(true);
    setAiReply('');
    try {
      if (theirMsg.trim()) {
        await addConversationEntry(business.id, {
          type: 'received', channel: 'whatsapp', content: theirMsg.trim(), replyType,
        });
      }
      const res = await fetch('/api/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business, replyType, theirMessage: theirMsg, channel: 'whatsapp' }),
      });
      const json = await res.json();
      if (json.message) setAiReply(json.message);
    } catch { /* */ } finally {
      setGenerating(false);
    }
  };

  const copyAndMarkSent = async () => {
    if (!aiReply) return;
    navigator.clipboard.writeText(aiReply).catch(() => {});
    setReplyCopied(true);
    setTimeout(() => setReplyCopied(false), 2500);
    await addConversationEntry(business.id, { type: 'sent', channel: 'whatsapp', content: aiReply });
    if (replyType === 'interested' && stageIdx < 2) updateStage(business.id, 'interested');
    setTheirMsg('');
    setReplyType(null);
    setAiReply('');
  };

  // Proposal tab
  const [proposal, setProposal] = useState('');
  const [loadingProposal, setLoadingProposal] = useState(false);
  const [proposalCopied, setProposalCopied] = useState(false);

  const generateProposal = async () => {
    setLoadingProposal(true);
    try {
      const res = await fetch('/api/proposal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business }),
      });
      const json = await res.json();
      if (json.proposal) {
        setProposal(json.proposal);
        updateStage(business.id, 'proposal');
      }
    } catch { /* */ } finally {
      setLoadingProposal(false);
    }
  };

  const copyProposal = () => {
    navigator.clipboard.writeText(proposal).catch(() => {});
    setProposalCopied(true);
    setTimeout(() => setProposalCopied(false), 2500);
  };

  const handleDelete = async () => {
    if (!confirm(`Remove ${business.name} from pipeline?`)) return;
    await remove(business.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-2xl flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/8 flex-shrink-0">
          <div className="w-9 h-9 bg-gradient-to-br from-purple-600/40 to-orange-500/30 rounded-xl flex items-center justify-center text-sm font-black text-white flex-shrink-0">
            {business.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-black text-white text-sm leading-tight truncate">{business.name}</h2>
            <p className="text-[11px] text-purple-400 font-medium">{business.category}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${scoreColor}`}>
              {score}/10 · {scoreText}
            </span>
            <button onClick={onClose} className="text-gray-600 hover:text-gray-300 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/8 flex-shrink-0">
          {([
            { id: 'reply' as const,    label: '💬 Reply' },
            { id: 'proposal' as const, label: '📄 Proposal' },
            { id: 'info' as const,     label: 'ℹ️ Info' },
          ]).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-2.5 text-xs font-bold transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? 'text-white border-purple-500'
                  : 'text-gray-600 border-transparent hover:text-gray-400'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── REPLY TAB ── */}
          {tab === 'reply' && (
            <div className="p-4 space-y-4">

              {/* Conversation history */}
              {conversations.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-2">
                    Conversation ({conversations.length})
                  </p>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {[...conversations].reverse().map((c) => (
                      <div
                        key={c.id}
                        className={`flex ${c.type === 'sent' || c.type === 'ai_response' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`text-xs px-3 py-2 rounded-2xl max-w-[82%] leading-relaxed ${
                          c.type === 'sent' || c.type === 'ai_response'
                            ? 'bg-green-600/20 text-green-200 rounded-br-sm'
                            : c.type === 'received'
                            ? 'bg-white/8 text-gray-200 rounded-bl-sm'
                            : 'bg-white/5 text-gray-500 italic text-[11px] rounded-xl'
                        }`}>
                          {c.content}
                          <div className="text-[10px] opacity-40 mt-0.5 text-right">{timeAgo(c.timestamp)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Their reply */}
              <div>
                <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-2">
                  What did they say?
                </p>
                <textarea
                  value={theirMsg}
                  onChange={(e) => setTheirMsg(e.target.value)}
                  placeholder="Paste or type their reply… (optional if selecting a situation below)"
                  rows={2}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 resize-none transition-colors"
                />
              </div>

              {/* Situation buttons */}
              <div>
                <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-2">
                  What's the situation?
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {REPLY_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setReplyType(opt.id === replyType ? null : opt.id)}
                      className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-full border transition-all ${
                        replyType === opt.id
                          ? opt.active
                          : 'bg-white/5 text-gray-500 border-white/10 hover:text-gray-300 hover:border-white/20'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate */}
              <button
                onClick={generateReply}
                disabled={!replyType || generating}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-bold text-sm transition-colors"
              >
                {generating
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Writing reply…</>
                  : '✨ Generate Reply'}
              </button>

              {/* AI Reply */}
              {aiReply && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Send this</p>
                  <div className="bg-green-950/30 border border-green-500/20 rounded-xl p-3 text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                    {aiReply}
                  </div>
                  <button
                    onClick={copyAndMarkSent}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-colors ${
                      replyCopied
                        ? 'bg-green-600/20 text-green-400 border border-green-500/30'
                        : 'bg-green-600 hover:bg-green-500 text-white'
                    }`}
                  >
                    {replyCopied
                      ? <><Check className="w-4 h-4" /> Copied &amp; logged!</>
                      : <><Copy className="w-4 h-4" /> Copy &amp; mark sent</>}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── PROPOSAL TAB ── */}
          {tab === 'proposal' && (
            <div className="p-4 space-y-4">
              {!proposal ? (
                <div className="text-center py-10">
                  <div className="text-5xl mb-3">📄</div>
                  <p className="text-gray-200 font-bold mb-1">Generate a proposal</p>
                  <p className="text-gray-500 text-sm mb-6 max-w-xs mx-auto leading-relaxed">
                    AI writes a full web design proposal for {business.name} — with pricing, timeline and payment terms.
                  </p>
                  <button
                    onClick={generateProposal}
                    disabled={loadingProposal}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-gray-800 text-white font-bold text-sm transition-colors"
                  >
                    {loadingProposal
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                      : <><FileText className="w-4 h-4" /> Generate Proposal</>}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Proposal ready · Stage → Proposal</p>
                    <button
                      onClick={generateProposal}
                      disabled={loadingProposal}
                      className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {loadingProposal ? 'Regenerating…' : '↺ Redo'}
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={proposal}
                    rows={15}
                    className="w-full bg-white/[0.03] border border-white/8 rounded-xl px-3 py-3 text-xs text-gray-300 leading-relaxed font-mono resize-none focus:outline-none"
                  />
                  <button
                    onClick={copyProposal}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-colors ${
                      proposalCopied
                        ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                        : 'bg-purple-600 hover:bg-purple-500 text-white'
                    }`}
                  >
                    {proposalCopied
                      ? <><Check className="w-4 h-4" /> Copied!</>
                      : <><Copy className="w-4 h-4" /> Copy Proposal</>}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── INFO TAB ── */}
          {tab === 'info' && (
            <div className="p-4 space-y-4">

              {/* Stage */}
              <div>
                <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-2">Stage</p>
                <div className="flex gap-1.5 flex-wrap">
                  {STAGES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => updateStage(business.id, s.id)}
                      className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                        stage === s.id
                          ? s.color
                          : 'text-gray-600 border-white/8 hover:border-white/20 hover:text-gray-400'
                      }`}
                    >
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => stageIdx > 0 && updateStage(business.id, STAGES[stageIdx - 1].id)}
                    disabled={stageIdx === 0}
                    className="flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-3 h-3" /> Previous
                  </button>
                  <button
                    onClick={() => stageIdx < STAGES.length - 1 && updateStage(business.id, STAGES[stageIdx + 1].id)}
                    disabled={stageIdx === STAGES.length - 1}
                    className="flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 disabled:opacity-30 transition-colors"
                  >
                    Next <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Business details */}
              <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4 space-y-2.5">
                {business.address && (
                  <div className="flex items-start gap-2 text-sm text-gray-300">
                    <MapPin className="w-3.5 h-3.5 text-gray-600 flex-shrink-0 mt-0.5" />
                    {business.address}
                  </div>
                )}
                {business.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                    <span className="text-sm text-gray-300">{business.phone}</span>
                    <a
                      href={whatsappLink(business) ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full hover:bg-green-500/20 transition-colors flex items-center gap-1"
                    >
                      <MessageCircle className="w-3 h-3" /> WhatsApp
                    </a>
                  </div>
                )}
                {business.website ? (
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                    <a href={business.website} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-blue-400 hover:underline truncate">{business.website}</a>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 text-red-500/60 flex-shrink-0" />
                    <span className="text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full font-semibold">No website — prime prospect</span>
                  </div>
                )}
                {business.rating && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-400">
                    <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                    {business.rating} · {business.reviewCount} reviews
                  </div>
                )}
                {estimatedPrice && (
                  <div className="text-sm text-gray-300 font-semibold">
                    💰 Est. {formatPrice(estimatedPrice.min)} – {formatPrice(estimatedPrice.max)}
                  </div>
                )}
              </div>

              {/* Saved + delete */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-700">
                  Saved {new Date(savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 text-[11px] text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
