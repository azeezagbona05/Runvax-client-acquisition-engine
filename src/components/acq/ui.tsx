'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { ActivityPill, EngagementStatus } from '@/lib/acqOverview';

export function Card({ title, right, children, className = '', pad = true }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`acq-card ${pad ? 'acq-card-pad' : ''} ${className}`}>
      {(title || right) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          {title ? <h2 className="acq-title">{title}</h2> : <span />}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

const PILL: Record<string, string> = {
  Running: 'acq-pill-green', Active: 'acq-pill-green', Interested: 'acq-pill-green', Replied: 'acq-pill-green', Delivered: 'acq-pill-green',
  Clicked: 'acq-pill-blue', Opened: 'acq-pill-blue', Sent: 'acq-pill-sent', Finished: 'acq-pill-blue', Scheduled: 'acq-pill-blue',
  Imported: 'acq-pill-purple', Enriched: 'acq-pill-purple',
  Paused: 'acq-pill-amber', 'Needs follow-up': 'acq-pill-amber',
  Idle: 'acq-pill-gray', Queued: 'acq-pill-gray', 'Not started': 'acq-pill-gray', Skipped: 'acq-pill-gray',
  Failed: 'acq-pill-red', Unsubscribed: 'acq-pill-red', 'Not interested': 'acq-pill-gray',
};

export function Pill({ label, tone }: { label: string; tone?: string }) {
  return <span className={`acq-pill ${tone ?? PILL[label] ?? 'acq-pill-gray'}`}>{label}</span>;
}

export type { ActivityPill, EngagementStatus };

export const CAMPAIGN_STATUS_LABEL: Record<string, string> = { running: 'Running', paused: 'Paused', draft: 'Not started', completed: 'Finished', scheduled: 'Scheduled' };

/** A "…" button with a small menu. Closes on outside click. */
export function Kebab({ items, label = 'More actions' }: { items: Array<{ label: string; onClick?: () => void; href?: string; danger?: boolean }>; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div ref={ref} style={{ position: 'relative', flex: 'none' }}>
      <button className="acq-icon-btn" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="acq-dropdown" role="menu" style={{ top: 34, right: 0, minWidth: 170, padding: 6 }}>
          {items.map((it) => {
            const style = { height: 36, width: '100%', border: 0, background: 'transparent', textAlign: 'left' as const, fontSize: 13.5, color: it.danger ? '#b91c1c' : undefined };
            return it.href
              ? <a key={it.label} href={it.href} role="menuitem" className="acq-nav-item" style={style}>{it.label}</a>
              : <button key={it.label} role="menuitem" className="acq-nav-item" style={style} onClick={() => { setOpen(false); it.onClick?.(); }}>{it.label}</button>;
          })}
        </div>
      )}
    </div>
  );
}

const LOGO_COLORS = ['#9333ea', '#9333ea', '#db2777', '#ea580c', '#0891b2', '#16a34a', '#a855f7', '#b45309'];
const hash = (s: string) => Array.from(s).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function hostOf(url?: string | null): string {
  if (!url) return '';
  try { return new URL(/^https?:\/\//.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, ''); } catch { return ''; }
}

/** A business's favicon when we know its website, otherwise a coloured initial. */
export function BizLogo({ name, website }: { name: string; website?: string | null }) {
  const host = hostOf(website);
  const [broken, setBroken] = useState(false);
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  return (
    <span className="acq-biz-logo" style={{ background: LOGO_COLORS[hash(name) % LOGO_COLORS.length] }} aria-hidden>
      {host && !broken
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={`https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(host)}`} alt="" onError={() => setBroken(true)} />
        : initial}
    </span>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div style={{ textAlign: 'center', padding: '28px 12px' }}>
      <p style={{ fontWeight: 600, color: '#334155' }}>{title}</p>
      {body && <p className="acq-sub" style={{ fontSize: 13, margin: '4px auto 0', maxWidth: 380 }}>{body}</p>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

export function Skeleton({ h = 16, w = '100%', r = 8 }: { h?: number; w?: number | string; r?: number }) {
  return <span style={{ display: 'block', height: h, width: w, borderRadius: r, background: 'linear-gradient(90deg,#eef2f8,#f6f8fc,#eef2f8)' }} />;
}

export const fmtNum = (n: number) => n.toLocaleString('en-US');
export const fmtDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
