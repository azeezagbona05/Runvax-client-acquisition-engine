'use client';

import { useEffect } from 'react';
import { Users, Sparkles, Flame, Clock } from 'lucide-react';
import { useSaturation } from '@/context/SaturationContext';
import {
  heatOf, saturationLabel, HEAT_COPY, isTrackableBusinessId, type Heat,
} from '@/lib/saturation';

const HEAT_STYLE: Record<Heat, string> = {
  untouched: 'text-green-400  bg-green-500/15  border-green-500/30',
  light:     'text-blue-400   bg-blue-500/15   border-blue-500/30',
  warm:      'text-amber-400  bg-amber-500/15  border-amber-500/30',
  saturated: 'text-red-400    bg-red-500/15    border-red-500/30',
  cooled:    'text-gray-400   bg-gray-500/15   border-gray-500/30',
};

const HEAT_ICON: Record<Heat, typeof Users> = {
  untouched: Sparkles,
  light:     Users,
  warm:      Users,
  saturated: Flame,
  cooled:    Clock,
};

interface Props {
  businessId: string;
  /** 'chip' is the compact card badge; 'full' adds the advisory line, for the
   *  outreach modal where the user is deciding whether to send at all. */
  variant?: 'chip' | 'full';
  className?: string;
}

export default function SaturationBadge({ businessId, variant = 'chip', className = '' }: Props) {
  const { get, ensure } = useSaturation();

  useEffect(() => { ensure([businessId]); }, [businessId, ensure]);

  if (!isTrackableBusinessId(businessId)) return null;

  const s = get(businessId);
  // Undefined means still loading — render nothing rather than flashing a
  // misleading "no one has messaged this yet".
  if (!s) return null;

  const heat = heatOf(s);
  const Icon = HEAT_ICON[heat];
  const copy = HEAT_COPY[heat];

  if (variant === 'chip') {
    return (
      <span
        title={`${copy.label} — ${copy.hint}`}
        className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${HEAT_STYLE[heat]} ${className}`}
      >
        <Icon className="w-2.5 h-2.5" />
        {s.otherCount === 0 && !s.youContacted ? 'Untouched' : saturationLabel(s)}
      </span>
    );
  }

  return (
    <div className={`rounded-xl border px-3 py-2.5 ${HEAT_STYLE[heat]} ${className}`}>
      <div className="flex items-center gap-1.5 text-xs font-bold">
        <Icon className="w-3.5 h-3.5" />
        {copy.label}
      </div>
      <p className="text-[11px] font-semibold mt-1 opacity-90">{saturationLabel(s)}</p>
      <p className="text-[11px] mt-1 leading-relaxed opacity-70">{copy.hint}</p>
    </div>
  );
}
