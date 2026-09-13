'use client';

import { memo, useMemo } from 'react';
import {
  Star, Phone, Mail, ShieldCheck, ChevronRight, MapPin, Sparkles,
} from 'lucide-react';
import type { Business } from '@/types';
import type { Opportunity } from '@/lib/opportunity/types';
import { formatPrice } from '@/lib/scoring';

/**
 * The opportunity card — RUNVAX's actual unit of value.
 *
 * A business card answers "what is this business?". This answers the five
 * questions a builder has to resolve before they will send anything:
 *
 *   what could I build · why would they care · who do I approach ·
 *   can I reach them · what is it worth
 *
 * Everything shown here is deterministic, out of detect.ts. Nothing on this card
 * is model-written, so every line survives the question "why do you think that?".
 */

const BAND_META: Record<Opportunity['band'], { label: string; cls: string }> = {
  high:     { label: 'High opportunity',     cls: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' },
  strong:   { label: 'Strong opportunity',   cls: 'text-green-400 bg-green-500/15 border-green-500/25' },
  good:     { label: 'Good opportunity',     cls: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/25' },
  possible: { label: 'Possible opportunity', cls: 'text-blue-400 bg-blue-500/15 border-blue-500/25' },
  low:      { label: 'Low opportunity',      cls: 'text-gray-400 bg-white/5 border-white/10' },
};

/**
 * Contactability is a trust claim, so it is stated at the strength we can actually
 * defend — a found address is never shown as a verified one.
 */
function contactStatus(b: Business): { label: string; cls: string; icon: typeof Mail } {
  if (b.email && b.emailVerified === 'valid') {
    return { label: 'Verified email', cls: 'text-green-400', icon: ShieldCheck };
  }
  if (b.email) return { label: 'Email found', cls: 'text-gray-300', icon: Mail };
  if (b.phone) return { label: 'Phone only', cls: 'text-gray-400', icon: Phone };
  return { label: 'No contact route yet', cls: 'text-gray-500', icon: Mail };
}

interface Props {
  business: Business;
  opportunity: Opportunity;
  rank: number;
  onOpen: () => void;
  onContact: () => void;
}

function OpportunityCard({ business, opportunity, rank, onOpen, onContact }: Props) {
  const band = BAND_META[opportunity.band];
  const contact = useMemo(() => contactStatus(business), [business]);
  const ContactIcon = contact.icon;

  const value = opportunity.value;
  const priceLine = value.monthly
    ? `${formatPrice(value.setupMin)}–${formatPrice(value.setupMax)} setup · ${formatPrice(value.monthly)}/mo`
    : `${formatPrice(value.setupMin)}–${formatPrice(value.setupMax)}`;

  return (
    <div
      onClick={onOpen}
      className="group cursor-pointer rounded-xl border border-white/10 bg-white/5 p-4 transition
                 hover:border-white/20 hover:bg-white/[0.07]"
    >
      {/* ── Header: rank, name, band ── */}
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 font-mono text-xs text-gray-500">
          {String(rank).padStart(2, '0')}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate font-semibold text-white">{business.name}</h3>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${band.cls}`}>
              {band.label}
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-400">
            {business.rating != null && (
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                {business.rating}
                {business.reviewCount != null && ` · ${business.reviewCount} reviews`}
              </span>
            )}
            {business.address && (
              <span className="flex min-w-0 items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{business.address.split(',')[0]}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── What you could build ── */}
      <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-gray-500">
          <Sparkles className="h-3 w-3" />
          Opportunity
        </div>
        <p className="mt-1 font-medium text-white">{opportunity.title}</p>

        {/* The build, as a chain rather than a feature list — it reads as a system. */}
        <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-gray-400">
          {opportunity.pattern.components.map((c, i) => (
            <span key={c} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 text-gray-600" />}
              <span className="rounded bg-white/5 px-1.5 py-0.5">{c}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Why they might care ── */}
      <div className="mt-3">
        <p className="text-[11px] uppercase tracking-wide text-gray-500">Why this business</p>
        <p className="mt-0.5 text-sm leading-relaxed text-gray-300">{opportunity.reason}</p>
      </div>

      {/* Evidence is what makes the reason answerable rather than assertive. */}
      {opportunity.evidence.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {opportunity.evidence.slice(0, 3).map((e) => (
            <li key={e} className="flex gap-1.5 text-xs text-gray-400">
              <span className="text-gray-600">•</span>
              <span>{e}</span>
            </li>
          ))}
        </ul>
      )}

      {/* ── Who to approach, and whether we can ── */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 pt-3 text-xs">
        <span className="text-gray-400">
          <span className="text-gray-500">Approach: </span>
          {opportunity.buyer}
        </span>
        <span className={`flex items-center gap-1 ${contact.cls}`}>
          <ContactIcon className="h-3 w-3" />
          {contact.label}
        </span>
        <span className="ml-auto font-medium text-gray-300">{priceLine}</span>
      </div>

      {/* ── Actions ── */}
      <div className="mt-3 flex gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onContact(); }}
          className="flex-1 rounded-lg bg-white px-3 py-2 text-sm font-medium text-black transition hover:bg-gray-200"
        >
          Contact prospect
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          className="rounded-lg border border-white/15 px-3 py-2 text-sm text-gray-300 transition hover:bg-white/5"
        >
          View
        </button>
      </div>

      {/* Confidence is stated plainly rather than dressed up — a category-only case
          should look weaker on the card than an observed one. */}
      {opportunity.confidence === 'low' && (
        <p className="mt-2 text-[11px] text-gray-500">
          Based on how this trade normally operates, not on signals from this business.
        </p>
      )}
    </div>
  );
}

export default memo(OpportunityCard);
