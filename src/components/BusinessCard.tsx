'use client';

import { useState } from 'react';
import {
  MapPin, Phone, Star, Globe, Bookmark, Copy, Check,
  MessageCircle, Loader2, X, ExternalLink, CheckCircle, XCircle,
} from 'lucide-react';
import { Business } from '@/types';
import { scoreProspect, scoreLabel } from '@/lib/scoring';
import { useProspects } from '@/context/ProspectsContext';
import { getBestTimeStatus } from '@/lib/searchHistory';
import { whatsappLink } from '@/lib/phone';
import { buildQuickWAMessage } from '@/lib/waMessage';

interface Props {
  business: Business;
  onClick: () => void;
}

function isSocialOnly(b: Business): boolean {
  if (!b.hasWebsite || !b.website) return false;
  return b.website.includes('instagram.com') || b.website.includes('facebook.com') ||
         b.website.includes('twitter.com') || b.website.includes('tiktok.com');
}

const STAGE_META: Record<string, { label: string; color: string }> = {
  found:      { label: '🔵 Saved',      color: 'text-blue-400 bg-blue-500/15 border-blue-500/30' },
  contacted:  { label: '📱 Contacted',  color: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30' },
  interested: { label: '🤝 Interested', color: 'text-orange-400 bg-orange-500/15 border-orange-500/30' },
  proposal:   { label: '📄 Proposal',   color: 'text-purple-400 bg-purple-500/15 border-purple-500/30' },
  won:        { label: '🏆 Won',        color: 'text-green-400 bg-green-500/15 border-green-500/30' },
  lost:       { label: '❌ Lost',       color: 'text-red-400 bg-red-500/15 border-red-500/30' },
};

type WaStep = 'preview' | 'confirm';
interface WaState { step: WaStep; msg: string; link: string }

export default function BusinessCard({ business, onClick }: Props) {
  const { isSaved, save, remove, get, markOutreachSent, updateStage, incrementToday } = useProspects();
  const saved = isSaved(business.id);
  const prospect = get(business.id);
  const score = scoreProspect(business);
  const { label: scoreText, color: scoreColor } = scoreLabel(score);
  const stageMeta = prospect ? STAGE_META[prospect.stage] : null;
  const socialOnly = isSocialOnly(business);
  const timeStatus = getBestTimeStatus();

  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copying, setCopying] = useState(false);
  const [msgCopied, setMsgCopied] = useState(false);
  const [waState, setWaState] = useState<WaState | null>(null);
  const [editedMsg, setEditedMsg] = useState('');

  const copyPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!business.phone) return;
    navigator.clipboard.writeText(business.phone).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    saved ? remove(business.id) : save(business);
  };

  const quickWhatsApp = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!business.phone || generating) return;

    setGenerating(true);
    let msg: string;
    try {
      const res = await fetch('/api/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business, competitors: business.competitors }),
      });
      const json = await res.json();
      msg = (res.ok && json.whatsapp) ? json.whatsapp : buildQuickWAMessage(business);
    } catch {
      msg = buildQuickWAMessage(business);
    } finally {
      setGenerating(false);
    }

    const link = whatsappLink(business, msg);
    if (!link) return;
    setEditedMsg(msg);
    setWaState({ step: 'preview', msg, link });
  };

  const openWhatsApp = () => {
    if (!waState) return;
    // Rebuild link with the (possibly edited) message
    const finalMsg = editedMsg || waState.msg;
    const finalLink = whatsappLink(business, finalMsg) ?? waState.link;
    window.open(finalLink, '_blank');
    setWaState({ step: 'confirm', msg: finalMsg, link: finalLink });
  };

  const confirmDelivery = (delivered: boolean) => {
    if (!waState) return;
    if (delivered) {
      if (!saved) save(business);
      markOutreachSent(business.id, waState.msg, 'whatsapp');
      updateStage(business.id, 'contacted');
      incrementToday();
    }
    setWaState(null);
  };

  const closeWa = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setWaState(null);
  };

  const copyWAMessage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!business.phone || copying || generating) return;
    setCopying(true);
    let msg: string;
    try {
      const res = await fetch('/api/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business, competitors: business.competitors }),
      });
      const json = await res.json();
      msg = (res.ok && json.whatsapp) ? json.whatsapp : buildQuickWAMessage(business);
    } catch {
      msg = buildQuickWAMessage(business);
    } finally {
      setCopying(false);
    }
    navigator.clipboard.writeText(msg).catch(() => {});
    setMsgCopied(true);
    setTimeout(() => setMsgCopied(false), 2500);
  };

  return (
    <>
      <div
        onClick={onClick}
        className={`relative bg-gray-900 border rounded-2xl p-4 cursor-pointer hover:bg-gray-800/60 transition-all group flex flex-col gap-3 ${
          saved
            ? 'border-blue-500/30 opacity-85 hover:opacity-100 hover:border-blue-400/50'
            : 'border-white/10 hover:border-purple-500/40'
        }`}
      >
        {/* Stage banner */}
        {stageMeta && (
          <div className={`text-[10px] font-bold px-2 py-1 rounded-lg border inline-flex items-center gap-1 w-fit ${stageMeta.color}`}>
            {stageMeta.label}
          </div>
        )}

        {/* Top row: category badge + website status */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/20 truncate max-w-[55%]">
            {business.category}
          </span>
          {socialOnly ? (
            <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20 flex items-center gap-1 flex-shrink-0">
              📱 Social Only
            </span>
          ) : business.hasWebsite ? (
            <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/15 flex items-center gap-1 flex-shrink-0">
              <Globe className="w-3 h-3" /> Has Site
            </span>
          ) : (
            <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/25 flex-shrink-0">
              🎯 No Website
            </span>
          )}
        </div>

        {/* Name */}
        <h3 className="font-bold text-white text-[15px] leading-snug line-clamp-2 group-hover:text-purple-300 transition-colors -mt-1">
          {business.name}
        </h3>

        {/* Address */}
        {business.address && (
          <div className="flex items-start gap-2 text-gray-500 text-xs">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span className="line-clamp-1">{business.address}</span>
          </div>
        )}

        {/* Phone + copy */}
        {business.phone ? (
          <div className="flex items-center gap-2 text-xs">
            <Phone className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
            <span className="text-gray-400 flex-1">{business.phone}</span>
            <button
              onClick={copyPhone}
              title="Copy number"
              className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all ${
                copied ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-gray-600 hover:text-gray-300 hover:bg-white/10'
              }`}
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <Phone className="w-3.5 h-3.5" /> No phone listed
          </div>
        )}

        {/* Rating + last review */}
        {business.rating ? (
          <div className="flex items-center gap-1.5 text-xs">
            <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
            <span className="text-white font-semibold">{business.rating}</span>
            {business.reviewCount && <span className="text-gray-600">({business.reviewCount} reviews)</span>}
            {business.lastReviewDate && (
              <span className="text-gray-600 ml-1">· last {business.lastReviewDate}</span>
            )}
          </div>
        ) : null}

        {/* Data quality signals */}
        {(business.hoursComplete === false || !business.phone) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {business.hoursComplete === false && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                ⏰ No hours listed
              </span>
            )}
          </div>
        )}

        {/* Bottom: score + actions */}
        <div className="mt-auto pt-3 border-t border-white/5 flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${scoreColor}`}>
            {scoreText} {score}/10
          </span>

          <div className="flex items-center gap-1 ml-auto">
            {/* WhatsApp quick-send */}
            {business.phone && (
              <button
                onClick={quickWhatsApp}
                disabled={generating || copying}
                title={generating ? 'Writing message…' : 'Preview & send WhatsApp'}
                className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-green-500/25 transition-colors disabled:opacity-60 disabled:cursor-wait"
              >
                {generating
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Writing…</>
                  : <><MessageCircle className="w-3.5 h-3.5" /> WhatsApp</>
                }
              </button>
            )}

            {/* Copy cover message */}
            {business.phone && (
              <button
                onClick={copyWAMessage}
                disabled={copying || generating}
                title={msgCopied ? 'Copied!' : 'Copy outreach message to clipboard'}
                className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-xl border transition-colors disabled:opacity-60 disabled:cursor-wait ${
                  msgCopied
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : 'bg-white/5 text-gray-500 border-white/10 hover:text-gray-300 hover:border-white/20'
                }`}
              >
                {copying
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : msgCopied
                  ? <><Check className="w-3.5 h-3.5" /> Copied!</>
                  : <><Copy className="w-3.5 h-3.5" /> Copy msg</>
                }
              </button>
            )}

            {/* Save/Remove */}
            {!saved ? (
              <button
                onClick={toggleSave}
                title="Save to pipeline"
                className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl border bg-white/5 text-gray-500 border-white/10 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Bookmark className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={toggleSave}
                title="Remove from pipeline"
                className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
              >
                <Bookmark className="w-3.5 h-3.5 fill-red-400" />
              </button>
            )}
          </div>
        </div>

        {/* Best time dot — only on no-website prospects */}
        {!business.hasWebsite && (
          <div className="absolute top-3 right-3 hidden group-hover:flex items-center gap-1.5 bg-gray-900/90 border border-white/10 rounded-full px-2 py-0.5 text-[10px] pointer-events-none">
            <span className={`w-1.5 h-1.5 rounded-full ${timeStatus.dot}`} />
            <span className={timeStatus.color}>{timeStatus.label}</span>
          </div>
        )}
      </div>

      {/* ── WhatsApp Preview + Delivery Confirmation Modal ── */}
      {waState && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm"
          onClick={() => closeWa()}
        >
          <div
            className="w-full max-w-2xl bg-gray-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {waState.step === 'preview' ? (
              <>
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-3">
                  <div>
                    <h3 className="font-bold text-white text-base">WhatsApp Message</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{business.name} · {business.phone}</p>
                  </div>
                  <button onClick={() => closeWa()} className="text-gray-500 hover:text-white transition-colors p-1">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Editable message */}
                <div className="px-6 pb-2">
                  <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-2">
                    Preview &amp; edit before sending
                  </p>
                  <textarea
                    value={editedMsg}
                    onChange={(e) => setEditedMsg(e.target.value)}
                    rows={12}
                    className="w-full bg-green-950/30 border border-green-500/20 rounded-xl px-4 py-4 text-base text-gray-100 leading-7 resize-none focus:outline-none focus:border-green-500/40 font-[inherit]"
                  />
                </div>

                {/* Action */}
                <div className="px-6 pb-6 pt-2">
                  <button
                    onClick={openWhatsApp}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-base transition-colors"
                  >
                    <MessageCircle className="w-5 h-5" /> Open WhatsApp
                    <ExternalLink className="w-4 h-4 opacity-70" />
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Delivery confirmation */}
                <div className="px-5 pt-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto mb-3">
                    <MessageCircle className="w-5 h-5 text-green-400" />
                  </div>
                  <p className="text-white font-bold">Was it delivered?</p>
                  <p className="text-gray-500 text-xs mt-1">
                    If the number isn&apos;t on WhatsApp, we won&apos;t mark it as contacted
                  </p>
                </div>

                <div className="flex gap-3 px-5 pb-5">
                  <button
                    onClick={() => confirmDelivery(true)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600/20 border border-green-500/30 text-green-400 font-bold text-sm hover:bg-green-600/30 transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" /> Yes, sent!
                  </button>
                  <button
                    onClick={() => confirmDelivery(false)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-sm hover:bg-red-500/20 transition-colors"
                  >
                    <XCircle className="w-4 h-4" /> Not on WA
                  </button>
                </div>

                <button
                  onClick={openWhatsApp}
                  className="text-xs text-gray-600 hover:text-gray-400 transition-colors text-center pb-4"
                >
                  Reopen WhatsApp ↗
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
