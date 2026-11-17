'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, X } from 'lucide-react';

export interface IntroVideoProps { id: string; title: string; blurb: string; src: string; poster: string }
const eventOf = (id: string) => `runvax:open-intro:${id}`;
export const openIntro = (id: string) => window.dispatchEvent(new Event(eventOf(id)));

/** A video that opens once, the first time someone lands on a page (remembered per browser). Reopen it any time with `openIntro(id)`. */
export default function IntroVideo({ id, title, blurb, src, poster }: IntroVideoProps) {
  const key = `runvax_intro_seen_${id}`;
  const [open, setOpen] = useState(false); const [playing, setPlaying] = useState(false); const video = useRef<HTMLVideoElement>(null);
  const close = useCallback(() => { video.current?.pause(); setOpen(false); setPlaying(false); try { localStorage.setItem(key, '1'); } catch { /* may show again, harmless */ } }, [key]);
  useEffect(() => {
    let seen = false; try { seen = !!localStorage.getItem(key); } catch { /* ignore */ }
    if (seen) return; const t = setTimeout(() => setOpen(true), 800); return () => clearTimeout(t);
  }, [key]);
  useEffect(() => { const on = () => setOpen(true); window.addEventListener(eventOf(id), on); return () => window.removeEventListener(eventOf(id), on); }, [id]);
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [open, close]);
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
          <div><h2 className="text-lg font-bold text-slate-900">{title}</h2><p className="text-sm text-slate-500">{blurb}</p></div>
          <button type="button" onClick={close} aria-label="Close video" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-5 w-5" /></button>
        </div>
        <div className="relative bg-black">
          <video ref={video} src={src} poster={poster} controls={playing} playsInline preload="none" className="aspect-video w-full" onPlay={() => setPlaying(true)} onEnded={() => setPlaying(false)} />
          {!playing && <button type="button" onClick={() => { setPlaying(true); void video.current?.play(); }} aria-label="Play the video" className="absolute inset-0 flex items-center justify-center bg-slate-950/20 hover:bg-slate-950/10"><span className="flex h-20 w-20 items-center justify-center rounded-full bg-purple-600 text-white shadow-xl"><Play className="ml-1 h-9 w-9" fill="currentColor" /></span></button>}
        </div>
        <div className="flex items-center justify-between gap-3 px-5 py-3"><button type="button" onClick={close} className="text-sm font-medium text-slate-500 hover:text-slate-800">Skip for now</button><p className="text-xs text-slate-400">Watch it again any time from “Watch the demo” on this page.</p></div>
      </div>
    </div>
  );
}

export function WatchDemo({ id }: { id: string }) {
  return <button type="button" className="acq-btn acq-btn-sm" onClick={() => openIntro(id)}><Play size={13} /> Watch the demo</button>;
}
