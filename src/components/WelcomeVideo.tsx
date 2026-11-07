'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Play, X } from 'lucide-react';

const KEY = 'runvax_welcome_seen';
export const OPEN_WELCOME_EVENT = 'runvax:open-welcome';

/** Pages where a first-time visitor lands on the product itself. Marketing, blog and comparison pages are left alone. */
const isEntry = (p: string) => p === '/' || p.startsWith('/client-acquisition');

/** Opens a short welcome video once, the first time someone visits. Anyone can reopen it with `openWelcomeVideo()`. */
export default function WelcomeVideo() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  const close = useCallback(() => {
    video.current?.pause();
    setOpen(false); setPlaying(false);
    try { localStorage.setItem(KEY, '1'); } catch { /* private mode: it may show again, which is harmless */ }
  }, []);

  useEffect(() => {
    if (!isEntry(pathname)) return;
    let seen = false;
    try { seen = !!localStorage.getItem(KEY); } catch { /* ignore */ }
    if (seen) return;
    // Not on top of the switch celebration: they will see the video another time.
    const t = setTimeout(() => {
      let switching = false;
      try { switching = !!sessionStorage.getItem('runvax_just_switched'); } catch { /* ignore */ }
      if (switching || document.querySelector('.acq-celebrate')) return;
      setOpen(true);
    }, 1500);
    return () => clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener(OPEN_WELCOME_EVENT, on);
    return () => window.removeEventListener(OPEN_WELCOME_EVENT, on);
  }, []);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open, close]);

  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Welcome to RUNVAX" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Welcome to RUNVAX</h2>
            <p className="text-sm text-slate-500">The AI-powered B2B client acquisition engine. A 7 minute tour: find businesses in any country, reach the decision-maker, launch a campaign.</p>
          </div>
          <button type="button" onClick={close} aria-label="Close welcome video" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>
        <div className="relative bg-black">
          <video ref={video} src="/welcome/runvax-welcome.mp4" poster="/welcome/poster.jpg" controls={playing} playsInline preload="none" className="aspect-video w-full" onPlay={() => setPlaying(true)} onEnded={() => setPlaying(false)} />
          {!playing && (
            <button type="button" onClick={() => { setPlaying(true); void video.current?.play(); }} aria-label="Play the welcome video" className="absolute inset-0 flex items-center justify-center bg-slate-950/20 hover:bg-slate-950/10">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-purple-600 text-white shadow-xl"><Play className="ml-1 h-9 w-9" fill="currentColor" /></span>
            </button>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <button type="button" onClick={close} className="text-sm font-medium text-slate-500 hover:text-slate-800">Skip for now</button>
          <p className="text-xs text-slate-400">You can watch it again any time from “Watch intro video” in the menu.</p>
        </div>
      </div>
    </div>
  );
}

/** Reopens the welcome video from anywhere (a menu item, a button). */
export function openWelcomeVideo() {
  window.dispatchEvent(new Event(OPEN_WELCOME_EVENT));
}
