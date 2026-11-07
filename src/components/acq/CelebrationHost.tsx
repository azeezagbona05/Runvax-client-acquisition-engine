'use client';

import { useEffect, useState } from 'react';
import { PartyPopper, Rocket, Trophy } from 'lucide-react';
import { CELEBRATE_EVENT, type CelebrateDetail } from '@/lib/celebrate';

type Piece = { left: number; delay: number; dur: number; size: number; color: string; rot: number; drift: number; round: boolean };
const COLORS = ['#9333ea', '#a855f7', '#c084fc', '#7e22ce', '#e9d5ff', '#fbbf24', '#ffffff'];

const pieces = (n: number): Piece[] => Array.from({ length: n }, () => ({
  left: Math.random() * 100, delay: Math.random() * 0.45, dur: 1.9 + Math.random() * 1.3, size: 7 + Math.random() * 7,
  color: COLORS[Math.floor(Math.random() * COLORS.length)], rot: Math.random() * 720 - 360, drift: Math.random() * 160 - 80, round: Math.random() > 0.6,
}));

/** Confetti and a message card for the moments that matter: a win, a finished build. Flat brand colours, short, and still for people who ask for less motion. */
export default function CelebrationHost() {
  const [shown, setShown] = useState<(CelebrateDetail & { id: number; bits: Piece[] }) | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let id = 0;
    const on = (e: Event) => {
      const d = (e as CustomEvent<CelebrateDetail>).detail;
      if (!d?.title) return;
      clearTimeout(timer);
      setShown({ ...d, id: ++id, bits: pieces(d.kind === 'done' ? 36 : 90) });
      timer = setTimeout(() => setShown(null), d.kind === 'done' ? 4200 : 5200);
    };
    window.addEventListener(CELEBRATE_EVENT, on);
    return () => { window.removeEventListener(CELEBRATE_EVENT, on); clearTimeout(timer); };
  }, []);

  if (!shown) return null;
  const win = shown.kind !== 'done';
  const Icon = win ? Trophy : Rocket;
  return (
    <div className="acq-celebrate" key={shown.id} aria-hidden={false}>
      <div className="acq-confetti" aria-hidden="true">
        {shown.bits.map((p, i) => (
          <i key={i} style={{ left: `${p.left}%`, width: p.size, height: p.round ? p.size : p.size * 1.6, background: p.color, borderRadius: p.round ? 999 : 2, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, ['--rot' as string]: `${p.rot}deg`, ['--drift' as string]: `${p.drift}px` }} />
        ))}
      </div>
      <div role="status" aria-live="polite" className="acq-celebrate-card" onClick={() => setShown(null)}>
        <span className="acq-celebrate-icon"><Icon size={28} />{win && <PartyPopper size={16} className="acq-celebrate-spark" />}</span>
        <div>
          <b>{shown.title}</b>
          {shown.body ? <p>{shown.body}</p> : null}
        </div>
      </div>
    </div>
  );
}
