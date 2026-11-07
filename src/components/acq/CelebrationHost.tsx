'use client';

import { useEffect, useState } from 'react';
import { Flower2, PartyPopper, Rocket, Trophy, Volume2, VolumeX } from 'lucide-react';
import { CELEBRATE_EVENT, type CelebrateDetail } from '@/lib/celebrate';
import { playChime, setSoundEnabled, soundEnabled } from '@/lib/chime';

type Piece = { left: number; delay: number; dur: number; size: number; color: string; rot: number; drift: number; round: boolean; sway: number };
const PETALS = ['#f472b6', '#c084fc', '#a855f7', '#fbbf24', '#f9a8d4', '#ffffff', '#fb7185'];

/** Flowers for the welcome: bigger, slower, swaying as they fall. */
const flowers = (n: number): Piece[] => Array.from({ length: n }, () => ({
  left: Math.random() * 100, delay: Math.random() * 1.6, dur: 4.2 + Math.random() * 3, size: 22 + Math.random() * 22,
  color: PETALS[Math.floor(Math.random() * PETALS.length)], rot: Math.random() * 540 - 270, drift: Math.random() * 120 - 60, round: true, sway: 14 + Math.random() * 26,
}));
const COLORS = ['#9333ea', '#a855f7', '#c084fc', '#7e22ce', '#e9d5ff', '#fbbf24', '#ffffff'];

const pieces = (n: number): Piece[] => Array.from({ length: n }, () => ({
  left: Math.random() * 100, delay: Math.random() * 0.45, dur: 1.9 + Math.random() * 1.3, size: 7 + Math.random() * 7,
  color: COLORS[Math.floor(Math.random() * COLORS.length)], rot: Math.random() * 720 - 360, drift: Math.random() * 160 - 80, round: Math.random() > 0.6, sway: 0,
}));

/** One five-petal flower, drawn in SVG so it looks the same on every device. */
function Flower({ color, size }: { color: string; size: number }) {
  const centre = color === '#fbbf24' ? '#9333ea' : '#fbbf24';
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <g transform="translate(20 20)">
        {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="0" cy="-10" rx="6.5" ry="10" fill={color} stroke={color === '#ffffff' ? '#e9d5ff' : 'none'} strokeWidth="1" transform={`rotate(${a})`} />)}
        <circle r="5" fill={centre} />
      </g>
    </svg>
  );
}

/** Confetti, falling flowers and a message card for the moments that matter: a win, a finished build. Flat brand colours, short, and still for people who ask for less motion. */
export default function CelebrationHost() {
  const [shown, setShown] = useState<(CelebrateDetail & { id: number; bits: Piece[] }) | null>(null);
  const [sound, setSound] = useState(true);
  useEffect(() => { setSound(soundEnabled()); }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let id = 0;
    const on = (e: Event) => {
      const d = (e as CustomEvent<CelebrateDetail>).detail;
      if (!d?.title) return;
      clearTimeout(timer);
      const welcome = d.kind === 'welcome';
      setShown({ ...d, id: ++id, bits: welcome ? flowers(46) : pieces(d.kind === 'done' ? 36 : 90) });
      if (welcome) void playChime();
      timer = setTimeout(() => setShown(null), welcome ? 9000 : d.kind === 'done' ? 4200 : 5200);
    };
    window.addEventListener(CELEBRATE_EVENT, on);
    return () => { window.removeEventListener(CELEBRATE_EVENT, on); clearTimeout(timer); };
  }, []);

  if (!shown) return null;
  const welcome = shown.kind === 'welcome';
  const win = shown.kind !== 'done';
  const Icon = welcome ? Flower2 : win ? Trophy : Rocket;
  return (
    <div className="acq-celebrate" key={shown.id} aria-hidden={false}>
      {welcome
        ? (
          <div className="acq-flowers" aria-hidden="true">
            {shown.bits.map((p, i) => (
              <span key={i} className="acq-flower" style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, ['--sway' as string]: `${p.sway}px`, ['--rot' as string]: `${p.rot}deg`, ['--drift' as string]: `${p.drift}px` }}>
                <Flower color={p.color} size={p.size} />
              </span>
            ))}
          </div>
        )
        : (
          <div className="acq-confetti" aria-hidden="true">
            {shown.bits.map((p, i) => (
              <i key={i} style={{ left: `${p.left}%`, width: p.size, height: p.round ? p.size : p.size * 1.6, background: p.color, borderRadius: p.round ? 999 : 2, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, ['--rot' as string]: `${p.rot}deg`, ['--drift' as string]: `${p.drift}px` }} />
            ))}
          </div>
        )}
      <div role="status" aria-live="polite" className="acq-celebrate-card" onClick={() => setShown(null)}>
        <span className="acq-celebrate-icon"><Icon size={28} />{win && <PartyPopper size={16} className="acq-celebrate-spark" />}</span>
        <div>
          <b>{shown.title}</b>
          {shown.body ? <p>{shown.body}</p> : null}
        </div>
        {welcome && (
          <button type="button" className="acq-icon-btn" aria-label={sound ? 'Turn the sound off' : 'Turn the sound on'} style={{ flex: 'none' }}
            onClick={(e) => { e.stopPropagation(); const next = !sound; setSound(next); setSoundEnabled(next); if (next) void playChime(); }}>
            {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        )}
      </div>
    </div>
  );
}
