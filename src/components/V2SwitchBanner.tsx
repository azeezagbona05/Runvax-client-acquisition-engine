'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowRight, Globe2, Sparkles, Target, Users, X } from 'lucide-react';
import { DEFAULT_HOME } from '@/lib/home';

const BANNER_KEY = 'runvax_v2_switch_dismissed_at';
const POPUP_KEY = 'runvax_v2_popup_seen_at';
const BANNER_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
const POPUP_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;
const POPUP_DELAY_MS = 4000;

const recent = (key: string, ms: number) => { try { const at = Number(localStorage.getItem(key) ?? 0); return !!at && Date.now() - at < ms; } catch { return false; } };
const stamp = (key: string) => { try { localStorage.setItem(key, String(Date.now())); } catch { /* private mode: it may show again, which is harmless */ } };

/**
 * Invites signed-in users on the classic pages to RUNVAX 2.0, two ways: an animated banner along the top, and a one-time popup a few
 * seconds in. "Not now" hides the banner for 7 days; "Maybe later" hides the popup for 3 days. Motion stops for people who ask for less of it.
 */
export default function V2SwitchBanner() {
  const { status } = useSession();
  const [banner, setBanner] = useState(false);
  const [popup, setPopup] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated') return;
    setBanner(!recent(BANNER_KEY, BANNER_SNOOZE_MS));
    if (recent(POPUP_KEY, POPUP_SNOOZE_MS)) return;
    const t = setTimeout(() => {
      // Never stack on top of another dialog (for example the welcome video).
      if (!document.querySelector('[role="dialog"]')) setPopup(true);
    }, POPUP_DELAY_MS);
    return () => clearTimeout(t);
  }, [status]);

  const closePopup = useCallback(() => { stamp(POPUP_KEY); setPopup(false); }, []);
  useEffect(() => {
    if (!popup) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') closePopup(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [popup, closePopup]);

  return (
    <>
      <style>{`
        @keyframes v2n-slide { from { transform: translateY(-100%); opacity: 0; } to { transform: none; opacity: 1; } }
        @keyframes v2n-pop { from { transform: translateY(18px) scale(.94); opacity: 0; } to { transform: none; opacity: 1; } }
        @keyframes v2n-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes v2n-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(168, 85, 247, .55); } 50% { box-shadow: 0 0 0 9px rgba(168, 85, 247, 0); } }
        @keyframes v2n-shine { 0% { transform: translateX(-140%) skewX(-20deg); } 55%, 100% { transform: translateX(260%) skewX(-20deg); } }
        @keyframes v2n-twinkle { 0%, 100% { transform: scale(1) rotate(0); } 50% { transform: scale(1.25) rotate(18deg); } }
        @keyframes v2n-arrow { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(4px); } }
        .v2n-banner { animation: v2n-slide .5s cubic-bezier(.2, .8, .2, 1) both; }
        .v2n-new { animation: v2n-pulse 2s ease-in-out infinite; }
        .v2n-cta { position: relative; overflow: hidden; animation: v2n-pulse 2.4s ease-in-out infinite; }
        .v2n-cta::after { content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 38%; background: rgba(255, 255, 255, .45); animation: v2n-shine 3.2s ease-in-out infinite; }
        .v2n-spark { animation: v2n-twinkle 2.2s ease-in-out infinite; }
        .v2n-arrow { animation: v2n-arrow 1.2s ease-in-out infinite; }
        .v2n-scrim { animation: v2n-fade .25s ease-out both; }
        .v2n-card { animation: v2n-pop .4s cubic-bezier(.2, .9, .25, 1.1) both; }
        @media (prefers-reduced-motion: reduce) { .v2n-banner, .v2n-new, .v2n-cta, .v2n-cta::after, .v2n-spark, .v2n-arrow, .v2n-scrim, .v2n-card { animation: none !important; } }
      `}</style>

      {banner && (
        <div className="v2n-banner flex items-center gap-3 bg-purple-600 px-4 py-2.5 text-sm text-white lg:pr-[22rem]">
          <span className="v2n-new flex-shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-purple-700">New</span>
          <p className="min-w-0 flex-1 leading-snug">
            <Sparkles className="v2n-spark mr-1.5 inline h-4 w-4 -mt-0.5 text-yellow-300" />
            <strong>RUNVAX 2.0 is here.</strong>{' '}
            <span className="hidden sm:inline">Find businesses in any country, reach the decision-maker, and let your AI team win clients.</span>
            <span className="sm:hidden">Win clients with your AI team.</span>
          </p>
          <Link href={DEFAULT_HOME} className="v2n-cta flex-shrink-0 rounded-lg bg-white px-3.5 py-1.5 text-xs font-extrabold text-purple-700 whitespace-nowrap">
            <span className="relative z-10 inline-flex items-center gap-1">Try RUNVAX 2.0 <ArrowRight className="v2n-arrow h-3.5 w-3.5" /></span>
          </Link>
          <button onClick={() => { stamp(BANNER_KEY); setBanner(false); }} aria-label="Not now" className="flex-shrink-0 rounded p-1 text-purple-200 hover:bg-purple-500 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
      )}

      {popup && (
        <div className="v2n-scrim fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) closePopup(); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="v2n-title" className="v2n-card w-full max-w-md overflow-hidden rounded-3xl bg-white text-slate-900 shadow-2xl">
            <div className="relative bg-purple-600 px-6 pb-6 pt-7 text-white">
              <button onClick={closePopup} aria-label="Close" className="absolute right-3 top-3 rounded-lg p-1.5 text-purple-200 hover:bg-purple-500 hover:text-white"><X className="h-5 w-5" /></button>
              <span className="v2n-new inline-block rounded-full bg-white px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-purple-700">New</span>
              <h2 id="v2n-title" className="mt-3 text-2xl font-extrabold leading-tight">
                Meet RUNVAX 2.0 <Sparkles className="v2n-spark ml-1 inline h-6 w-6 -mt-1 text-yellow-300" />
              </h2>
              <p className="mt-1.5 text-sm text-purple-100">The AI-powered B2B client acquisition engine.</p>
            </div>
            <ul className="space-y-3.5 px-6 py-5 text-sm">
              {[
                { icon: Globe2, t: 'Find businesses in any country', d: 'Search all 249 countries by area and category.' },
                { icon: Target, t: 'Reach the person who decides', d: 'Owners and directors, not the front desk.' },
                { icon: Users, t: 'An AI team that follows up', d: 'Campaigns, replies and pipeline in one place.' },
              ].map(({ icon: Icon, t, d }) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700"><Icon className="h-5 w-5" /></span>
                  <span><b className="block text-slate-900">{t}</b><span className="text-slate-500">{d}</span></span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 px-6 pb-6">
              <Link href={DEFAULT_HOME} onClick={() => stamp(POPUP_KEY)} className="v2n-cta flex items-center justify-center rounded-xl bg-purple-600 px-4 py-3 text-base font-extrabold text-white">
                <span className="relative z-10 inline-flex items-center gap-2">Switch to RUNVAX 2.0 <ArrowRight className="v2n-arrow h-5 w-5" /></span>
              </Link>
              <button onClick={closePopup} className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800">Maybe later</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
