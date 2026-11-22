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
  const start = useRef<{ x: number; t: number; w: number } | null>(null); const timer = useRef<ReturnType<typeof setTimeout> | null>(null); const crossed = useRef(false); const [hint] = useState(() => { try { return !localStorage.getItem('swipe-hint-seen'); } catch { return false; } });
  const list = items.filter((i) => !gone.includes(keyOf(i)));
  const top = list[0] as T | undefined;
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { if (hint) { const t = setTimeout(() => { try { localStorage.setItem('swipe-hint-seen', '1'); } catch { /* optional */ } }, 2500); return () => clearTimeout(t); } }, [hint]);
  const buzz = (ms = 10) => { try { navigator.vibrate?.(ms); } catch { /* not supported */ } };

  async function decide(dir: SwipeDir) {
    if (!top || busy) return;
    if (dir === 'right' && rightBlocked) { setMsg(rightBlocked); setDrag(0); return; }
    setBusy(true); setMsg(''); setFly(dir);
    try {
      buzz(14); if (!reduced()) await new Promise((r) => setTimeout(r, 230));
      const res = await onDecide(top, dir);
      if (res.ok) { setGone((g) => [...g, keyOf(top)]); setLast({ item: top, dir }); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setLast(null), 8000); }
      else setMsg(res.error || 'That did not work. Try again.');
    } catch { setMsg('That did not work. Check your connection and try again.'); }   // a failed request must never leave the deck stuck with the card off screen
    finally { setFly(null); setDrag(0); setBusy(false); }
  }
  async function undo() {
    if (!last || !onUndo || busy) return; setBusy(true);
    try {
      const res = await onUndo(last.item, last.dir);
      if (res.ok) { setGone((g) => g.filter((k) => k !== keyOf(last.item))); setLast(null); setMsg(''); } else setMsg(res.error || 'Could not undo that.');
    } catch { setMsg('Could not undo that.'); } finally { setBusy(false); }
  }

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (busy || (e.target as HTMLElement).closest(INTERACTIVE)) return;
    start.current = { x: e.clientX, t: performance.now(), w: e.currentTarget.getBoundingClientRect().width || 320 };
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* the pointer already ended */ }
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!start.current) return; const dx = e.clientX - start.current.x; setDrag(dx);
    const past = Math.abs(dx) >= Math.max(90, start.current.w * 0.28); if (past !== crossed.current) { crossed.current = past; if (past) buzz(8); }   // a small tick when the card is far enough to count
  };
  const up = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = start.current; start.current = null; crossed.current = false; if (!s) return;
    const dx = e.clientX - s.x; const dir = swipeDecision(dx, performance.now() - s.t, s.w);
    if (dir) void decide(dir); else setDrag(0);
  };
  const cancel = () => { start.current = null; crossed.current = false; setDrag(0); };
  const key = (e: React.KeyboardEvent) => { if (e.key === 'ArrowRight') { e.preventDefault(); void decide('right'); } else if (e.key === 'ArrowLeft') { e.preventDefault(); void decide('left'); } };

  if (!top) return <div style={{ display: 'grid', gap: 8 }}>{empty}{last && onUndo && (undoable ? undoable(last.dir) : true) && <div><button type="button" className="acq-btn acq-btn-sm" disabled={busy} onClick={undo}><Undo2 size={14} /> Undo</button></div>}</div>;

  const x = fly ? (fly === 'right' ? 560 : -560) : drag; const w = 340; const dragging = !!start.current; const calm = reduced();
  const strength = intent(x, w); const pull = Math.min(1, Math.abs(x) / 160);
  const total = gone.length + list.length; const doneShare = total ? Math.round((gone.length / total) * 100) : 0;
  const badge = (side: SwipeDir, text: string, color: string) => <span aria-hidden="true" style={{ position: 'absolute', top: 16, [side === 'right' ? 'left' : 'right']: 16, zIndex: 2, border: `3px solid ${color}`, color, background: 'rgba(255,255,255,.9)', borderRadius: 12, padding: '3px 12px', fontWeight: 800, fontSize: 16, letterSpacing: 1, transform: `rotate(${side === 'right' ? -12 : 12}deg) scale(${0.85 + 0.25 * strength})`, opacity: x * (side === 'right' ? 1 : -1) > 12 ? Math.min(1, strength * 1.4) : 0, textTransform: 'uppercase', pointerEvents: 'none' }}>{text}</span>;
  const tint = x > 12 ? `rgba(22,163,74,${0.16 * strength})` : x < -12 ? `rgba(220,38,38,${0.14 * strength})` : 'transparent';
  const ease = calm ? 'none' : dragging ? 'none' : fly ? 'transform .26s cubic-bezier(.4,0,.9,.6), opacity .26s ease-in' : 'transform .4s cubic-bezier(.2,.9,.3,1.25)';   // flies off, or springs back when let go early

  return (
    <div role="group" aria-label={`Swipe deck. Right arrow: ${labels.right}. Left arrow: ${labels.left}.`} tabIndex={0} onKeyDown={key} style={{ display: 'grid', gap: 12, outline: 'none', maxWidth: 440 }}>
      <style>{`@keyframes sd-in{from{opacity:0;transform:translateY(14px) scale(.94)}to{opacity:1;transform:none}}@keyframes sd-nudge{0%,100%{transform:translateX(0)}25%{transform:translateX(26px) rotate(2deg)}75%{transform:translateX(-26px) rotate(-2deg)}}.sd-btn{transition:transform .12s ease,box-shadow .12s ease}.sd-btn:active:not(:disabled){transform:scale(.94)}@media (prefers-reduced-motion:reduce){.sd-enter,.sd-hint{animation:none!important}}`}</style>
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b' }}><span>{list.length} left</span><span>Swipe right to {labels.right.toLowerCase()}, left to {labels.left.toLowerCase()}</span></div>
        <div role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={doneShare} style={{ height: 4, borderRadius: 2, background: '#e2e8f0', overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', width: `${doneShare}%`, background: '#7e22ce', transition: calm ? 'none' : 'width .35s ease' }} /></div>
      </div>
      <div style={{ position: 'relative' }}>
        {list.length > 2 && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, transform: 'translateY(18px) scale(.9)', borderRadius: 18, background: '#f8fafc', border: '1px solid #e2e8f0' }} />}
        {list.length > 1 && <div aria-hidden="true" style={{ position: 'absolute', inset: 0, transform: `translateY(${10 - 10 * pull}px) scale(${0.95 + 0.05 * pull})`, transition: calm || dragging ? 'none' : 'transform .3s ease', borderRadius: 18, background: '#f1f5f9', border: '1px solid #e2e8f0', boxShadow: '0 6px 16px rgba(15,23,42,.06)' }} />}
        <div key={keyOf(top)} className="sd-enter" style={{ animation: calm ? 'none' : 'sd-in .28s ease-out' }}>
          <div className={hint && !dragging && !fly && gone.length === 0 ? 'sd-hint' : undefined} style={{ animation: hint && gone.length === 0 && !calm && !dragging && !fly ? 'sd-nudge 1.1s ease-in-out .5s 1' : 'none' }}>
            <div data-testid="swipe-card" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}
              style={{ position: 'relative', touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none', cursor: busy ? 'default' : dragging ? 'grabbing' : 'grab', border: '1px solid #e2e8f0', borderRadius: 18, backgroundColor: '#fff', backgroundImage: `linear-gradient(${tint}, ${tint})`, padding: 18, boxShadow: `0 ${8 + 10 * pull}px ${24 + 16 * pull}px rgba(15,23,42,${0.10 + 0.08 * pull})`, transform: `translateX(${x}px) rotate(${fly ? (fly === 'right' ? 18 : -18) : tilt(x)}deg)`, transition: ease, opacity: fly ? 0 : 1, maxHeight: 460, overflow: 'auto', willChange: 'transform' }}>
              {badge('right', labels.right, '#16a34a')}{badge('left', labels.left, '#dc2626')}
              {render(top)}
            </div>
          </div>
        </div>
      </div>
      {msg && <div role="alert" style={{ color: '#b91c1c', fontSize: 13.5 }}>{msg}</div>}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" className="acq-btn sd-btn" aria-label={labels.left} disabled={busy} onClick={() => decide('left')}><X size={16} /> {labels.left}</button>
        <button type="button" className="acq-btn acq-btn-primary sd-btn" aria-label={labels.right} disabled={busy || !!rightBlocked} title={rightBlocked} onClick={() => decide('right')}><Check size={16} /> {labels.right}</button>
        {last && onUndo && (undoable ? undoable(last.dir) : true) && <button type="button" className="acq-btn acq-btn-sm" disabled={busy} onClick={undo}><Undo2 size={14} /> Undo</button>}
      </div>
      {rightBlocked && <div style={{ fontSize: 12.5, color: '#92400e' }}>{rightBlocked}</div>}
    </div>
  );
}
