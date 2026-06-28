'use client';

import { useState } from 'react';
import {
  MessageCircle, Mail, Send, Copy, Check, Loader2,
  Phone, StickyNote, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react';
import { Business, ConversationEntry, ReplyType, ConversationChannel } from '@/types';
import { useProspects } from '@/context/ProspectsContext';
import { whatsappLink } from '@/lib/phone';

interface Props {
  business: Business;
}

const REPLY_TYPES: Array<{
  id: ReplyType;
  emoji: string;
  label: string;
  color: string;
  activeColor: string;
  stageHint?: string;
}> = [
  { id: 'interested',         emoji: '🔥', label: 'Interested!',         color: 'border-green-500/20 text-green-400',   activeColor: 'bg-green-500/20 border-green-500/40 text-green-300',  stageHint: 'interested' },
  { id: 'asked_price',        emoji: '💰', label: 'Asked Price',          color: 'border-yellow-500/20 text-yellow-400', activeColor: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300', stageHint: 'interested' },
  { id: 'asked_examples',     emoji: '📸', label: 'Wants Examples',       color: 'border-blue-500/20 text-blue-400',    activeColor: 'bg-blue-500/20 border-blue-500/40 text-blue-300',   stageHint: 'interested' },
  { id: 'said_think_about_it',emoji: '🤔', label: "Will Think About It",  color: 'border-orange-500/20 text-orange-400',activeColor: 'bg-orange-500/20 border-orange-500/40 text-orange-300' },
  { id: 'objection_instagram', emoji: '📱', label: 'Has Instagram/FB',    color: 'border-purple-500/20 text-purple-400',activeColor: 'bg-purple-500/20 border-purple-500/40 text-purple-300' },
  { id: 'objection_referrals', emoji: '👥', label: 'Uses Referrals',      color: 'border-purple-500/20 text-purple-400',activeColor: 'bg-purple-500/20 border-purple-500/40 text-purple-300' },
  { id: 'objection_expensive', emoji: '💸', label: 'Too Expensive',       color: 'border-red-500/20 text-red-400',      activeColor: 'bg-red-500/20 border-red-500/40 text-red-300' },
  { id: 'objection_no_time',   emoji: '⏰', label: 'No Time',             color: 'border-red-500/20 text-red-400',      activeColor: 'bg-red-500/20 border-red-500/40 text-red-300' },
  { id: 'not_interested',      emoji: '❌', label: 'Not Interested',       color: 'border-gray-500/20 text-gray-500',    activeColor: 'bg-gray-500/20 border-gray-500/40 text-gray-300',   stageHint: 'lost' },
  { id: 'no_reply',            emoji: '👻', label: 'No Reply',            color: 'border-gray-500/20 text-gray-500',    activeColor: 'bg-gray-500/20 border-gray-500/40 text-gray-300' },
  { id: 'custom',              emoji: '✍️', label: 'Custom Reply',        color: 'border-white/10 text-gray-400',       activeColor: 'bg-white/10 border-white/20 text-gray-200' },
];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function channelIcon(ch: ConversationChannel) {
  if (ch === 'whatsapp') return <MessageCircle className="w-3 h-3 text-green-400" />;
  if (ch === 'email') return <Mail className="w-3 h-3 text-blue-400" />;
  if (ch === 'call') return <Phone className="w-3 h-3 text-yellow-400" />;
  return <StickyNote className="w-3 h-3 text-gray-400" />;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const el = document.createElement('textarea');
      el.value = text; document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg transition-colors ${copied ? 'bg-green-600 text-white' : 'bg-white/10 hover:bg-white/20 text-gray-300'}`}>
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function Bubble({ entry }: { entry: ConversationEntry }) {
  const isUs = entry.type === 'sent';
  const isAI = entry.type === 'ai_response';
  const isNote = entry.type === 'note';
  const [expanded, setExpanded] = useState(true);
  const preview = entry.content.slice(0, 120);
  const long = entry.content.length > 120;

  return (
    <div className={`flex ${isUs || isAI ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[90%] rounded-2xl p-3 space-y-1.5 ${
        isUs   ? 'bg-purple-900/40 border border-purple-500/20' :
        isAI   ? 'bg-blue-900/30 border border-blue-500/20 border-dashed' :
        isNote ? 'bg-white/5 border border-white/10' :
                 'bg-green-900/30 border border-green-500/20'
      }`}>
        <div className="flex items-center gap-1.5 flex-wrap">
          {channelIcon(entry.channel)}
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
            {isUs ? 'You sent' : isAI ? '🤖 AI Draft' : isNote ? 'Note' : 'They said'}
            {entry.framework ? ` · ${entry.framework}` : ''}
          </span>
          <span className="text-[10px] text-gray-600 ml-auto">{timeAgo(entry.timestamp)}</span>
        </div>
        <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
          isUs ? 'text-purple-100' : isAI ? 'text-blue-100' : isNote ? 'text-gray-400 italic' : 'text-green-100'
        }`}>
          {expanded ? entry.content : preview + '…'}
        </p>
        <div className="flex items-center gap-2">
          {long && (
            <button onClick={() => setExpanded(!expanded)} className="text-[10px] text-gray-600 hover:text-gray-400 flex items-center gap-0.5 transition-colors">
              {expanded ? <><ChevronUp className="w-3 h-3" /> Less</> : <><ChevronDown className="w-3 h-3" /> More</>}
            </button>
          )}
          {(isUs || isAI) && <CopyBtn text={entry.content} />}
        </div>
      </div>
    </div>
  );
}

export default function ConversationPanel({ business }: Props) {
  const { get, addConversationEntry, updateStage, incrementToday } = useProspects();
  const prospect = get(business.id);
  const conversations = prospect?.conversations ?? [];

  const [showReplyForm, setShowReplyForm] = useState(false);
  const [selectedType, setSelectedType] = useState<ReplyType | null>(null);
  const [theirText, setTheirText] = useState('');
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [generating, setGenerating] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [followupNum, setFollowupNum] = useState(1);

  const lastSent = [...conversations].reverse().find((e) => e.type === 'sent');
  const lastSentDaysAgo = lastSent
    ? Math.floor((Date.now() - new Date(lastSent.timestamp).getTime()) / 86400000)
    : null;

  const generate = async (rt: ReplyType, fn?: number) => {
    setGenerating(true);
    setAiResponse('');
    try {
      const res = await fetch('/api/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business,
          replyType: rt,
          theirMessage: theirText.trim() || undefined,
          ourLastMessage: lastSent?.content,
          channel,
          followupNumber: fn,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setAiResponse(json.message);
    } catch (e: unknown) {
      setAiResponse(`Error: ${e instanceof Error ? e.message : 'Failed'}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleTypeSelect = (rt: ReplyType) => {
    setSelectedType(rt);
    setAiResponse('');
    if (rt !== 'custom') generate(rt);
  };

  const handleLogAndSave = () => {
    if (!selectedType) return;

    // Log their reply
    if (theirText.trim() || selectedType !== 'no_reply') {
      addConversationEntry(business.id, {
        type: 'received',
        channel,
        content: theirText.trim() || `[${REPLY_TYPES.find((r) => r.id === selectedType)?.label}]`,
        replyType: selectedType,
      });
    }

    // Log AI response if generated
    if (aiResponse) {
      addConversationEntry(business.id, {
        type: 'ai_response',
        channel,
        content: aiResponse,
      });
    }

    // Update stage
    const rt = REPLY_TYPES.find((r) => r.id === selectedType);
    if (rt?.stageHint) updateStage(business.id, rt.stageHint as 'interested' | 'lost');

    // Reset form
    setShowReplyForm(false);
    setSelectedType(null);
    setTheirText('');
    setAiResponse('');
  };

  const handleMarkSent = () => {
    if (!aiResponse) return;
    addConversationEntry(business.id, {
      type: 'sent',
      channel,
      content: aiResponse,
    });
    updateStage(business.id, 'contacted');
    incrementToday();
    setAiResponse('');
    setShowReplyForm(false);
    setSelectedType(null);
  };

  const whatsappUrl = business.phone && aiResponse
    ? whatsappLink(business, aiResponse)
    : null;

  return (
    <div className="space-y-4">

      {/* Empty state */}
      {conversations.length === 0 && !showReplyForm && (
        <div className="text-center py-8 border border-dashed border-white/10 rounded-2xl">
          <div className="text-3xl mb-2">💬</div>
          <p className="text-gray-500 text-sm">No conversation yet</p>
          <p className="text-gray-600 text-xs mt-1">Generate an outreach message to get started</p>
        </div>
      )}

      {/* Conversation thread */}
      {conversations.length > 0 && (
        <div className="space-y-3">
          {conversations.map((entry) => (
            <Bubble key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      {/* Log reply trigger */}
      {!showReplyForm && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setShowReplyForm(true); setSelectedType(null); setAiResponse(''); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600/15 hover:bg-green-600/25 text-green-400 border border-green-500/20 rounded-xl text-sm font-bold transition-colors"
          >
            <MessageCircle className="w-4 h-4" /> Log Their Reply
          </button>

          {/* Follow-up generator for non-responders */}
          {lastSentDaysAgo !== null && lastSentDaysAgo >= 3 && (
            <div className="flex items-center gap-2">
              <select
                value={followupNum}
                onChange={(e) => setFollowupNum(Number(e.target.value))}
                className="bg-gray-800 border border-white/10 text-gray-300 text-xs rounded-xl px-2 py-2 focus:outline-none"
              >
                <option value={1}>Day 3 follow-up</option>
                <option value={2}>Day 7 follow-up</option>
                <option value={3}>Day 14 final nudge</option>
              </select>
              <button
                onClick={() => { setShowReplyForm(true); setSelectedType('no_reply'); generate('no_reply', followupNum); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-orange-600/15 hover:bg-orange-600/25 text-orange-400 border border-orange-500/20 rounded-xl text-sm font-bold transition-colors"
              >
                <Send className="w-4 h-4" /> Generate Follow-up
              </button>
            </div>
          )}
        </div>
      )}

      {/* Reply form */}
      {showReplyForm && (
        <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 space-y-4">

          {/* Channel toggle */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-500 font-bold uppercase tracking-widest">Channel:</span>
            {(['whatsapp', 'email'] as const).map((ch) => (
              <button
                key={ch}
                onClick={() => setChannel(ch)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  channel === ch
                    ? ch === 'whatsapp' ? 'bg-green-600/20 text-green-300 border-green-500/30' : 'bg-blue-600/20 text-blue-300 border-blue-500/30'
                    : 'bg-white/5 text-gray-500 border-white/10 hover:text-gray-300'
                }`}
              >
                {ch === 'whatsapp' ? <MessageCircle className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                {ch === 'whatsapp' ? 'WhatsApp' : 'Email'}
              </button>
            ))}
          </div>

          {/* What did they say */}
          {selectedType !== 'no_reply' && (
            <>
              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">What did they say?</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {REPLY_TYPES.filter((r) => r.id !== 'no_reply').map((rt) => (
                    <button
                      key={rt.id}
                      onClick={() => handleTypeSelect(rt.id)}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold border transition-all text-left ${
                        selectedType === rt.id ? rt.activeColor : `bg-white/5 ${rt.color} hover:bg-white/10`
                      }`}
                    >
                      <span>{rt.emoji}</span>
                      <span className="leading-snug">{rt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                  Paste their exact message (optional but recommended)
                </p>
                <textarea
                  value={theirText}
                  onChange={(e) => setTheirText(e.target.value)}
                  placeholder="Paste what they said here — the AI uses this to write a more personalised response"
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 focus:border-green-500/40 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 resize-none focus:outline-none transition-colors"
                />
                {selectedType === 'custom' && (
                  <button
                    onClick={() => generate('custom')}
                    disabled={generating || !theirText.trim()}
                    className="mt-2 flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold rounded-xl transition-colors disabled:opacity-50"
                  >
                    {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                    Generate Response
                  </button>
                )}
              </div>
            </>
          )}

          {/* AI Response */}
          {(generating || aiResponse) && (
            <div className="bg-blue-950/40 border border-blue-500/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-400 uppercase tracking-widest">
                  🤖 AI Suggested Response
                </span>
                <button onClick={() => { setAiResponse(''); generate(selectedType || 'custom', followupNum); }} disabled={generating} className="text-gray-500 hover:text-gray-300">
                  <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
                </button>
              </div>
              {generating ? (
                <div className="flex items-center gap-2 text-blue-300 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Writing your response…
                </div>
              ) : (
                <>
                  <p className="text-blue-100 text-sm leading-relaxed whitespace-pre-wrap">{aiResponse}</p>
                  <div className="flex gap-2 flex-wrap">
                    <CopyBtn text={aiResponse} />
                    {whatsappUrl && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={handleMarkSent}
                        className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> Open in WhatsApp
                      </a>
                    )}
                    <button onClick={handleMarkSent} className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors">
                      <Send className="w-3.5 h-3.5" /> Mark Sent
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1 border-t border-white/8">
            <button
              onClick={handleLogAndSave}
              disabled={!selectedType}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-2 rounded-xl text-sm transition-colors disabled:opacity-40"
            >
              Save to Timeline
            </button>
            <button
              onClick={() => { setShowReplyForm(false); setSelectedType(null); setTheirText(''); setAiResponse(''); }}
              className="px-4 py-2 text-gray-500 hover:text-gray-300 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
