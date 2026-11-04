'use client';

import { useMemo, useState } from 'react';
import type { SeriesPoint } from '@/lib/acqOverview';
import { Card } from './ui';

const W = 760, H = 300, L = 44, R = 14, T = 12, B = 30;
const SERIES = [
  { key: 'sent', label: 'Sent', color: '#9333ea' },
  { key: 'opened', label: 'Opened', color: '#16a34a' },
  { key: 'replied', label: 'Replied', color: '#ec4899' },
] as const;

/** A round upper bound and tick step so the grid reads 0, 50, 100… */
export function niceScale(max: number): { top: number; step: number } {
  if (max <= 4) return { top: 4, step: 1 };
  const raw = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  return { top: step * 4, step };
}

const label = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export default function PerformanceChart({ series, days, onDays }: { series: SeriesPoint[] | null; days: number; onDays: (d: number) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const pts = series ?? [];
  const max = Math.max(0, ...pts.flatMap((p) => [p.sent, p.opened, p.replied]));
  const { top, step } = niceScale(max);
  const empty = pts.length > 0 && max === 0;

  const geo = useMemo(() => {
    const n = Math.max(1, pts.length - 1);
    const x = (i: number) => L + (i / n) * (W - L - R);
    const y = (v: number) => T + (1 - v / top) * (H - T - B);
    const line = (k: 'sent' | 'opened' | 'replied') => pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(' ');
    const area = pts.length ? `${line('sent')} L${x(pts.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : '';
    return { x, y, line, area };
  }, [pts, top]);

  const every = Math.max(1, Math.ceil(pts.length / 8));
  const ticks = Array.from({ length: 5 }, (_, i) => i * step);
  const hp = hover !== null ? pts[hover] : null;

  return (
    <Card
      title="Campaign Performance"
      right={
        <select className="acq-select" aria-label="Date range" value={days} onChange={(e) => onDays(Number(e.target.value))} style={{ width: 150, height: 38 }}>
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
        </select>
      }
    >
      <div style={{ display: 'flex', gap: 22, margin: '-2px 0 6px 14px', fontSize: 13, color: '#334155' }}>
        {SERIES.map((s) => <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><i style={{ width: 9, height: 9, borderRadius: 999, background: s.color }} />{s.label}</span>)}
      </div>
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Emails sent, opened and replied per day" style={{ display: 'block', overflow: 'visible' }}
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            if (!pts.length) return;
            const r = e.currentTarget.getBoundingClientRect();
            const vx = ((e.clientX - r.left) / r.width) * W;
            setHover(Math.max(0, Math.min(pts.length - 1, Math.round(((vx - L) / (W - L - R)) * (pts.length - 1)))));
          }}>
          <defs>
            <linearGradient id="acqArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9333ea" stopOpacity=".22" /><stop offset="1" stopColor="#9333ea" stopOpacity="0" /></linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={geo.y(t)} y2={geo.y(t)} stroke="#e9eef6" strokeWidth="1" />
              <text x={L - 10} y={geo.y(t) + 4} textAnchor="end" fontSize="11.5" fill="#64748b">{t}</text>
            </g>
          ))}
          {pts.map((p, i) => i % every === 0 ? (
            <text key={p.date} x={geo.x(i)} y={H - 6} textAnchor="middle" fontSize="11.5" fill="#64748b">{label(p.date)}</text>
          ) : null)}
          {geo.area && <path d={geo.area} fill="url(#acqArea)" />}
          {SERIES.slice().reverse().map((s) => (
            <g key={s.key}>
              <path d={geo.line(s.key)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {pts.length <= 31 && pts.map((p, i) => <circle key={p.date} cx={geo.x(i)} cy={geo.y(p[s.key])} r={hover === i ? 5 : 3.2} fill="#fff" stroke={s.color} strokeWidth="2" />)}
            </g>
          ))}
          {hover !== null && <line x1={geo.x(hover)} x2={geo.x(hover)} y1={T} y2={H - B} stroke="#cbd5e1" strokeDasharray="3 3" />}
        </svg>
        {hp && hover !== null && (
          <div style={{ position: 'absolute', top: 6, left: `${(geo.x(hover) / W) * 100}%`, transform: `translateX(${hover > pts.length / 2 ? '-110%' : '10%'})`, background: '#fff', border: '1px solid #e6ebf3', borderRadius: 10, boxShadow: '0 8px 24px rgba(15,23,42,.12)', padding: '8px 12px', fontSize: 12.5, pointerEvents: 'none', minWidth: 112 }}>
            <p style={{ fontWeight: 700, marginBottom: 4 }}>{label(hp.date)}</p>
            {SERIES.map((s) => <p key={s.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, color: '#334155' }}><span style={{ color: s.color, fontWeight: 600 }}>{s.label}</span>{hp[s.key]}</p>)}
          </div>
        )}
        {empty && <p className="acq-sub" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13.5, pointerEvents: 'none', paddingBottom: 24 }}>Nothing sent in this period yet. Run a campaign and the lines fill in.</p>}
      </div>
    </Card>
  );
}
