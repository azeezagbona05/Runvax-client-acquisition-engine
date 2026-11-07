'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowRight, Globe2, Sparkles, Target, Users, X } from 'lucide-react';
import { DEFAULT_HOME } from '@/lib/home';
import { markSwitched } from '@/lib/celebrate';
import { prefersV2 } from '@/lib/v2Preference';

const BANNER_KEY = 'runvax_v2_switch_dismissed_at';
const POPUP_KEY = 'runvax_v2_popup_seen_at';
const BANNER_SNOOZE_MS = 24 * 60 * 60 * 1000;
const POPUP_SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;
const POPUP_DELAY_MS = 4000;

const recent = (key: string, ms: number) => { try { const at = Number(localStorage.getItem(key) ?? 0); return !!at && Date.now() - at < ms; } catch { return false; } };
const stamp = (key: string) => { try { localStorage.setItem(key, String(Date.now())); } catch { /* private mode: it may show again, which is harmless */ } };

/**
 * Invites signed-in users on the classic pages to RUNVAX 2.0, two ways: an animated banner along the top, and a one-time popup a few
 * seconds in, plus a floating button that stays on every classic page. "Not now" hides the banner for a day; "Maybe later" hides the popup for 3 days. Someone who has already switched is sent straight to 2.0 from the classic home page. Motion stops for people who ask for less of it.
 */
export default function V2SwitchBanner() {
  const { status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const [banner, setBanner] = useState(false);
  const [popup, setPopup] = useState(false);

  // Already switched once: the classic home page hands them on (the server does this too; this covers signing in on the page itself).
  useEffect(() => {
    if (status === 'authenticated' && pathname === '/' && prefersV2()) router.replace(DEFAULT_HOME);
  }, [status, pathname, router]);

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
        @keyframes v2n-bob { 0%, 100% { transform: translate(-50%, 0); } 50% { transform: translate(-50%, -7px); } }
        @keyframes v2n-ring { 0% { box-shadow: 0 0 0 0 rgba(147, 51, 234, .55), 0 10px 30px rgba(76, 29, 149, .35); } 100% { box-shadow: 0 0 0 22px rgba(147, 51, 234, 0), 0 10px 30px rgba(76, 29, 149, .35); } }
        .v2n-pill { position: fixed; left: 50%; bottom: 1.25rem; z-index: 45; transform: translateX(-50%); overflow: hidden; animation: v2n-bob 2.6s ease-in-out infinite, v2n-ring 2s ease-out infinite; }
        .v2n-pill:hover, .v2n-pill:focus-visible { animation-play-state: paused; }
        .v2n-pill::after { content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 38%; background: rgba(255, 255, 255, .35); animation: v2n-shine 3.2s ease-in-out infinite; }
        @media (max-width: 1023px) { .v2n-pill { bottom: calc(env(safe-area-inset-bottom) + 4.75rem); } }
        .v2n-banner { animation: v2n-slide .5s cubic-bezier(.2, .8, .2, 1) both; }
        .v2n-new { animation: v2n-pulse 2s ease-in-out infinite; }
        .v2n-cta { position: relative; overflow: hidden; animation: v2n-pulse 2.4s ease-in-out infinite; }
        .v2n-cta::after { content: ''; position: absolute; top: 0; bottom: 0; left: 0; width: 38%; background: rgba(255, 255, 255, .45); animation: v2n-shine 3.2s ease-in-out infinite; }
        .v2n-spark { animation: v2n-twinkle 2.2s ease-in-out infinite; }
        .v2n-arrow { animation: v2n-arrow 1.2s ease-in-out infinite; }
        .v2n-scrim { animation: v2n-fade .25s ease-out both; }
        .v2n-card { animation: v2n-pop .4s cubic-bezier(.2, .9, .25, 1.1) both; }
        @media (prefers-reduced-motion: reduce) { .v2n-pill, .v2n-pill::after { animation: none !important; } .v2n-banner, .v2n-new, .v2n-cta, .v2n-cta::after, .v2n-spark, .v2n-arrow, .v2n-scrim, .v2n-card { animation: none !important; } }
      `}</style>

      {banner && (
        <div className="v2n-banner flex flex-wrap items-center gap-x-5 gap-y-3 bg-purple-600 px-5 py-4 text-white sm:py-5 lg:pr-[22rem]">
          <span className="v2n-new flex-shrink-0 rounded-full bg-white px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-purple-700">New</span>
          <div className="min-w-0 flex-1 basis-64">
            <p className="text-lg font-extrabold leading-snug sm:text-xl">
              <Sparkles className="v2n-spark mr-2 inline h-5 w-5 -mt-1 text-white" />
              RUNVAX 2.0 is here.
            </p>
            <p className="mt-0.5 text-sm leading-snug text-white sm:text-base">Find businesses in any country, reach the decision-maker, and let your AI team win clients.</p>
          </div>
          <Link href={DEFAULT_HOME} onClick={markSwitched} className="v2n-cta flex-shrink-0 rounded-xl bg-white px-6 py-3.5 text-base font-extrabold text-purple-700 whitespace-nowrap shadow-lg sm:px-8 sm:text-lg">
            <span className="relative z-10 inline-flex items-center gap-2">Switch to RUNVAX 2.0 <ArrowRight className="v2n-arrow h-5 w-5" /></span>
          </Link>
          <button onClick={() => { stamp(BANNER_KEY); setBanner(false); }} aria-label="Not now" className="flex-shrink-0 rounded p-1.5 text-white hover:bg-purple-500"><X className="h-5 w-5" /></button>
        </div>
      )}

      {status === 'authenticated' && !popup && (
        <Link href={DEFAULT_HOME} onClick={markSwitched} className="v2n-pill inline-flex items-center gap-2.5 rounded-full bg-purple-600 px-6 py-3.5 text-base font-extrabold text-white shadow-2xl">
          <span className="relative z-10 inline-flex items-center gap-2.5"><Sparkles className="v2n-spark h-5 w-5" /> Switch to RUNVAX 2.0 <ArrowRight className="v2n-arrow h-5 w-5" /></span>
        </Link>
      )}

      {popup && (
        <div className="v2n-scrim fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) closePopup(); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="v2n-title" className="v2n-card w-full max-w-md overflow-hidden rounded-3xl bg-white text-slate-900 shadow-2xl">
            <div className="relative bg-purple-600 px-6 pb-6 pt-7 text-white">
              <button onClick={closePopup} aria-label="Close" className="absolute right-3 top-3 rounded-lg p-1.5 text-white hover:bg-purple-500"><X className="h-5 w-5" /></button>
              <span className="v2n-new inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-white ring-1 ring-white/50">New</span>
              <h2 id="v2n-title" className="mt-3 text-2xl font-extrabold leading-tight">
                Meet RUNVAX 2.0 <Sparkles className="v2n-spark ml-1 inline h-6 w-6 -mt-1 text-white" />
              </h2>
              <p className="mt-1.5 text-sm text-white">The AI-powered B2B client acquisition engine.</p>
            </div>
            <ul className="space-y-3.5 px-6 py-5 text-sm">
              {[
                { icon: Globe2, t: 'Find businesses in any country', d: 'Search all 249 countries by area and category.' },
                { icon: Target, t: 'Reach the person who decides', d: 'Owners and directors, not the front desk.' },
                { icon: Users, t: 'An AI team that follows up', d: 'Campaigns, replies and pipeline in one place.' },
              ].map(({ icon: Icon, t, d }) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-purple-600 text-white"><Icon className="h-5 w-5" /></span>
                  <span><b className="block text-slate-900">{t}</b><span className="text-slate-500">{d}</span></span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 px-6 pb-6">
              <Link href={DEFAULT_HOME} onClick={() => { stamp(POPUP_KEY); markSwitched(); }} className="v2n-cta flex items-center justify-center rounded-xl bg-purple-600 px-4 py-3 text-base font-extrabold text-white">
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
