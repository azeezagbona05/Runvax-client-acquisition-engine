import Link from 'next/link';
import { CheckCircle2, Search, Send, Trophy } from 'lucide-react';

/** The RUNVAX mark in flat brand purple (no gradient). `light` = white, for the purple panel. */
export function Mark({ size = 36, light = false }: { size?: number; light?: boolean }) {
  const fill = light ? '#ffffff' : '#9333ea';
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <path d="M4 5.5h13.2c4.7 0 7.6 2.5 7.6 6.3 0 2.9-1.7 4.9-4.4 5.8l5.4 9.9h-5.3l-4.7-9.1h-4.6V27H4V5.5Zm4.2 3.9v5.5h8.6c2.2 0 3.6-1 3.6-2.8 0-1.8-1.4-2.7-3.6-2.7H8.2Z" fill={fill} />
      <path d="M17.5 27 28 5.5h-4.6L15 22.6 17.5 27Z" fill={fill} opacity=".8" />
    </svg>
  );
}

// Shared control styles, so sign in, sign up and the Google button always match.
export const authLabel = 'block text-[13px] font-semibold text-slate-700 mb-1.5';
export const authInput = 'w-full h-11 rounded-lg border border-slate-300 bg-white px-3.5 text-[15px] text-slate-900 placeholder-slate-400 outline-none transition focus:border-purple-600 focus:ring-4 focus:ring-purple-100';
export const authPrimary = 'w-full h-11 rounded-lg bg-purple-600 hover:bg-purple-700 active:bg-purple-800 disabled:opacity-60 text-white text-[15px] font-semibold transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-purple-200';
export const authSecondary = 'w-full h-11 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-800 text-[14px] font-semibold transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-4 focus-visible:ring-purple-100';

const POINTS = [
  { icon: Search, title: 'Find businesses that need you', body: 'Search by location and category, then see who owns the business and how to reach them.' },
  { icon: Send, title: 'An AI workforce does the outreach', body: 'Personal first emails, follow-ups and reply handling, sent from your own mailbox.' },
  { icon: Trophy, title: 'Track every lead to a won client', body: 'One pipeline from first contact to signed customer, nothing falling through.' },
];

/**
 * Two-column sign-in/sign-up layout: a flat brand-purple panel on the left (desktop), the form on the right.
 * On a phone the panel collapses to a slim brand bar above the form.
 */
export default function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-slate-50 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Brand panel (desktop) */}
      <aside className="hidden lg:flex flex-col justify-between bg-purple-600 text-white px-12 py-12 xl:px-16">
        <Link href="/" className="inline-flex items-center gap-3 w-fit" aria-label="Runvax home">
          <Mark size={38} light />
          <span className="text-[22px] font-extrabold tracking-tight">RUNVAX</span>
        </Link>

        <div className="max-w-md">
          <h2 className="text-[34px] leading-[1.15] font-bold tracking-tight">Find your next customers. Let an AI workforce win them.</h2>
          <p className="mt-4 text-[15px] leading-relaxed text-[#f3e8ff]">Runvax finds the businesses that need what you sell, reaches the decision-maker and keeps every conversation moving.</p>
          <ul className="mt-9 space-y-6">
            {POINTS.map(({ icon: Icon, title: t, body }) => (
              <li key={t} className="flex gap-4">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-white/15"><Icon className="h-5 w-5" aria-hidden /></span>
                <span><span className="block text-[15px] font-semibold">{t}</span><span className="block text-[14px] leading-relaxed text-[#f3e8ff]">{body}</span></span>
              </li>
            ))}
          </ul>
        </div>

        <p className="flex items-center gap-2 text-[13px] text-[#f3e8ff]"><CheckCircle2 className="h-4 w-4" aria-hidden /> Free to start. No card needed.</p>
      </aside>

      {/* Form side */}
      <main className="flex flex-col items-center justify-center px-5 py-8 sm:px-8 lg:py-12">
        <Link href="/" className="lg:hidden mb-8 inline-flex items-center gap-2.5" aria-label="Runvax home">
          <Mark size={32} />
          <span className="text-[20px] font-extrabold tracking-tight text-purple-700">RUNVAX</span>
        </Link>

        <div className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">
          <h1 className="text-[24px] font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1.5 text-[14px] text-slate-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-6 text-center text-[14px] text-slate-600">{footer}</div>}
        <p className="mt-8 text-center text-[12px] text-slate-400">
          <Link href="/terms" className="hover:text-slate-600">Terms</Link> · <Link href="/privacy" className="hover:text-slate-600">Privacy</Link>
        </p>
      </main>
    </div>
  );
}

/** A success or error notice in the light theme. */
export function Notice({ tone, children }: { tone: 'success' | 'error'; children: React.ReactNode }) {
  const cls = tone === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-700';
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`mb-4 flex items-start gap-2 rounded-lg border px-3.5 py-3 text-[14px] ${cls}`}>{children}</div>;
}
