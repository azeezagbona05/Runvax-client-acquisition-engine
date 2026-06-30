'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useProspects } from '@/context/ProspectsContext';
import { Target, X } from 'lucide-react';
import type { SavedProspect } from '@/types';

// Maps a quest id → the on-page instruction + a "done" check that auto-dismisses it.
const COACH: Record<string, { text: string; done: (p: SavedProspect[]) => boolean }> = {
  save: {
    text: 'Run a search below, then tap the 🔖 bookmark on any business to save your first prospect.',
    done: (p) => p.length > 0,
  },
  contact: {
    text: 'Open a saved prospect and hit the WhatsApp button — that marks it Contacted.',
    done: (p) => p.some((x) => x.stage !== 'found' || !!x.outreachSentAt),
  },
  proposal: {
    text: 'Drag a deal into the Proposal column (or set its stage to Proposal).',
    done: (p) => p.some((x) => ['proposal', 'won'].includes(x.stage)),
  },
  won: {
    text: 'Closed a deal? Move it to the Won column to log your first win. 🎉',
    done: (p) => p.some((x) => x.stage === 'won'),
  },
};

export default function CoachHint() {
  const pathname = usePathname();
  const { prospects } = useProspects();
  const [coachId, setCoachId] = useState<string | null>(null);

  // Pick up the coach id set by the quest tracker (on navigation or same-page click).
  useEffect(() => {
    const read = () => { try { setCoachId(sessionStorage.getItem('aip_coach')); } catch { /* */ } };
    read();
    window.addEventListener('aip-coach', read);
    return () => window.removeEventListener('aip-coach', read);
  }, [pathname]);

  const dismiss = () => { try { sessionStorage.removeItem('aip_coach'); } catch { /* */ } setCoachId(null); };

  // Auto-dismiss once the step is completed.
  const coach = coachId ? COACH[coachId] : undefined;
  useEffect(() => {
    if (coach && coach.done(prospects)) dismiss();
  }, [coach, prospects]);

  const offRoute = pathname.startsWith('/auth') || pathname.startsWith('/admin') || pathname.startsWith('/demo');
  if (!coach || offRoute) return null;

  return (
    <div className="relative z-30 bg-purple-600/15 border-b border-purple-500/25 px-4 py-2.5">
      <div className="max-w-5xl mx-auto flex items-center gap-3">
        <Target className="w-4 h-4 text-purple-400 flex-shrink-0" />
        <p className="text-sm text-purple-300 flex-1 leading-snug">
          <strong className="font-bold text-white">Next step:</strong> {coach.text}
        </p>
        <button onClick={dismiss} className="w-6 h-6 flex items-center justify-center rounded-md text-purple-300 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
