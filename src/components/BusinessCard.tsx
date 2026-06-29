'use client';

import { useState } from 'react';
import { MapPin, Phone, Star, Globe, Bookmark, Copy, Check, MessageCircle } from 'lucide-react';
import { Business } from '@/types';
import { scoreProspect, scoreLabel } from '@/lib/scoring';
import { useProspects } from '@/context/ProspectsContext';
import { getBestTimeStatus } from '@/lib/searchHistory';
import { whatsappLink } from '@/lib/phone';

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

  const quickWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!business.phone) return;
    // PAS — Problem → Agitate → Solution with WhatsApp formatting (*bold*, _italic_)
    const name = `*${business.name}*`;
    const niche = business.category.toLowerCase();
    const problem = business.reviewCount && business.reviewCount > 0
      ? `Hi! 👋 I came across ${name} on Google.\n\nYou have *${business.reviewCount} Google reviews* ⭐ — _that's real trust people have given you._ But when a new customer searches for ${niche} online right now, there's *no website to land on.*`
      : `Hi! 👋 I came across ${name} on Google.\n\nPeople are searching for *${niche} businesses* in your area every day — but _without a website, you're invisible_ to all of them.`;
    const agitate = `Every day, potential customers find your competitors instead — _not because they're better,_ but because *they show up online and you don't.*`;
    const solution = `I build *digital front doors* for ${niche} businesses — mobile-first, found on Google *and* recommended by AI tools like ChatGPT. 🌐\n\n_Would you be open to a quick chat?_`;
    const msg = `${problem}\n\n${agitate}\n\n${solution}`;
    const link = whatsappLink(business, msg);
    if (!link) return;
    window.open(link, '_blank');
    if (!saved) save(business);
    markOutreachSent(business.id, msg, 'whatsapp');
    updateStage(business.id, 'contacted');
    incrementToday();
  };

  return (
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
              title="Send WhatsApp message"
              className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-xl bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-green-500/25 transition-colors"
            >
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
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
  );
}
