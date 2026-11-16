'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Undo2, X } from 'lucide-react';
import { intent, swipeDecision, tilt, type SwipeDir } from '@/lib/career/swipe';

export interface Decision { ok: boolean; error?: string }
interface Props<T> {
  items: T[]; keyOf: (t: T) => string; render: (t: T) => ReactNode;
  /** Called after the card flies off. If it returns { ok: false } the card comes back with the message. */
  onDecide: (t: T, dir: SwipeDir) => Promise<Decision>;
  labels: { right: string; left: string };
  /** When set, swiping right is blocked and this explains why. */
  rightBlocked?: string;
  /** Provide to show an Undo button for the directions it supports. */
  onUndo?: (t: T, dir: SwipeDir) => Promise<Decision>;
  undoable?: (dir: SwipeDir) => boolean;
  empty: ReactNode;
}
const INTERACTIVE = 'a,button,textarea,input,select,summary,[data-noswipe]';
const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * One card at a time. Drag or flick right/left, or press the buttons, or use the arrow keys (so nobody needs a touch screen).
 * Every decision goes through onDecide; nothing is assumed to have worked until it says so.
 */
export default function SwipeDeck<T>({ items, keyOf, render, onDecide, labels, rightBlocked, onUndo, undoable, empty }: Props<T>) {
  const [gone, setGone] = useState<string[]>([]); const [drag, setDrag] = useState(0); const [fly, setFly] = useState<SwipeDir | null>(null);
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(''); const [last, setLast] = useState<{ item: T; dir: SwipeDir } | null>(null);
  const start = useRef<{ x: number; t: number; w: number } | null>(null); const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const list = items.filter((i) => !gone.includes(keyOf(i)));
  const top = list[0] as T | undefined;
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function decide(dir: SwipeDir) {
    if (!top || busy) return;
    if (dir === 'right' && rightBlocked) { setMsg(rightBlocked); setDrag(0); return; }
    setBusy(true); setMsg(''); setFly(dir);
    if (!reduced()) await new Promise((r) => setTimeout(r, 180));
    const res = await onDecide(top, dir);
    if (res.ok) { setGone((g) => [...g, keyOf(top)]); setLast({ item: top, dir }); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setLast(null), 8000); }
    else setMsg(res.error || 'That did not work. Try again.');
    setFly(null); setDrag(0); setBusy(false);
  }
  async function undo() {
    if (!last || !onUndo || busy) return; setBusy(true);
    const res = await onUndo(last.item, last.dir);
    if (res.ok) { setGone((g) => g.filter((k) => k !== keyOf(last.item))); setLast(null); setMsg(''); } else setMsg(res.error || 'Could not undo that.');
    setBusy(false);
  }

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (busy || (e.target as HTMLElement).closest(INTERACTIVE)) return;
    start.current = { x: e.clientX, t: performance.now(), w: e.currentTarget.getBoundingClientRect().width || 320 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => { if (start.current) setDrag(e.clientX - start.current.x); };
  const up = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = start.current; start.current = null; if (!s) return;
    const dx = e.clientX - s.x; const dir = swipeDecision(dx, performance.now() - s.t, s.w);
    if (dir) void decide(dir); else setDrag(0);
  };
  const cancel = () => { start.current = null; setDrag(0); };
  const key = (e: React.KeyboardEvent) => { if (e.key === 'ArrowRight') { e.preventDefault(); void decide('right'); } else if (e.key === 'ArrowLeft') { e.preventDefault(); void decide('left'); } };

  if (!top) return <div style={{ display: 'grid', gap: 8 }}>{empty}{last && onUndo && (undoable ? undoable(last.dir) : true) && <div><button type="button" className="acq-btn acq-btn-sm" disabled={busy} onClick={undo}><Undo2 size={14} /> Undo</button></div>}</div>;

  const x = fly ? (fly === 'right' ? 420 : -420) : drag; const w = 340;
  const strength = intent(x, w);
  const badge = (side: SwipeDir, text: string, color: string) => <span aria-hidden="true" style={{ position: 'absolute', top: 14, [side === 'right' ? 'left' : 'right']: 14, border: `3px solid ${color}`, color, borderRadius: 10, padding: '2px 10px', fontWeight: 800, fontSize: 15, letterSpacing: 1, transform: `rotate(${side === 'right' ? -12 : 12}deg)`, opacity: x * (side === 'right' ? 1 : -1) > 12 ? strength : 0, textTransform: 'uppercase', pointerEvents: 'none' }}>{text}</span>;

  return (
    <div role="group" aria-label={`Swipe deck. Right arrow: ${labels.right}. Left arrow: ${labels.left}.`} tabIndex={0} onKeyDown={key} style={{ display: 'grid', gap: 12, outline: 'none', maxWidth: 440 }}>
      <div style={{ fontSize: 13, color: '#64748b' }}>{list.length} left · swipe right to {labels.right.toLowerCase()}, left to {labels.left.toLowerCase()}</div>
      <div style={{ position: 'relative' }}>
        {list.length > 1 && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, transform: 'translateY(10px) scale(.95)', borderRadius: 18, background: '#f1f5f9', border: '1px solid #e2e8f0' }} />}
        <div data-testid="swipe-card" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}
          style={{ position: 'relative', touchAction: 'pan-y', userSelect: 'none', cursor: busy ? 'default' : 'grab', border: '1px solid #e2e8f0', borderRadius: 18, background: '#fff', padding: 18, boxShadow: '0 8px 24px rgba(15,23,42,.10)', transform: `translateX(${x}px) rotate(${tilt(x)}deg)`, transition: start.current ? 'none' : reduced() ? 'none' : 'transform .18s ease-out', opacity: fly ? 0.4 : 1, maxHeight: 460, overflow: 'auto' }}>
          {badge('right', labels.right, '#16a34a')}{badge('left', labels.left, '#dc2626')}
          {render(top)}
        </div>
      </div>
      {msg && <div role="alert" style={{ color: '#b91c1c', fontSize: 13.5 }}>{msg}</div>}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="acq-btn" aria-label={labels.left} disabled={busy} onClick={() => decide('left')}><X size={16} /> {labels.left}</button>
        <button type="button" className="acq-btn acq-btn-primary" aria-label={labels.right} disabled={busy || !!rightBlocked} title={rightBlocked} onClick={() => decide('right')}><Check size={16} /> {labels.right}</button>
        {last && onUndo && (undoable ? undoable(last.dir) : true) && <button type="button" className="acq-btn acq-btn-sm" disabled={busy} onClick={undo}><Undo2 size={14} /> Undo</button>}
      </div>
      {rightBlocked && <div style={{ fontSize: 12.5, color: '#92400e' }}>{rightBlocked}</div>}
    </div>
  );
}
