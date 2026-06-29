'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useProspects } from '@/context/ProspectsContext';
import { exportProspectsCSV } from '@/lib/export';
import {
  Search, Columns3, BarChart3, Download, Plus,
  Sun, Moon, LogOut, Zap, Settings, MailWarning,
} from 'lucide-react';
import ManualProspectModal from './ManualProspectModal';
import { useTheme } from '@/context/ThemeContext';

export default function Nav() {
  const pathname  = usePathname();
  const { prospects } = useProspects();
  const { theme, toggle } = useTheme();
  const { data: session } = useSession();
  const [showManual, setShowManual] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  const handleResend = useCallback(async () => {
    if (!session?.user?.email || resendStatus !== 'idle') return;
    setResendStatus('sending');
    try {
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: session.user.email }),
      });
    } finally {
      setResendStatus('sent');
    }
  }, [session?.user?.email, resendStatus]);

  const wonCount   = prospects.filter((p) => p.stage === 'won').length;
  const savedCount = prospects.length;

  const userPlan = (session?.user as { plan?: string })?.plan ?? 'free';
  const planBadge =
    userPlan === 'agency' ? { label: 'AGENCY', cls: 'bg-orange-500 text-white' }
    : userPlan === 'pro'  ? { label: 'PRO',    cls: 'bg-purple-600 text-white' }
    :                       { label: 'FREE',   cls: 'bg-gray-700 text-gray-300' };

  const tabs = [
    { href: '/',          icon: Search,   label: 'Search' },
    { href: '/pipeline',  icon: Columns3, label: 'Pipeline',  badge: savedCount },
    { href: '/dashboard', icon: BarChart3, label: 'Dashboard', badge: wonCount > 0 ? wonCount : undefined, badgeColor: 'bg-green-500' },
    { href: '/settings',  icon: Settings, label: 'Settings' },
  ];

  const emailVerified = (session?.user as { emailVerified?: Date | null })?.emailVerified;
  const showVerifyBanner = session?.user && !emailVerified && !pathname.startsWith('/auth');

  return (
    <>
      {/* ── Email verification banner ── */}
      {showVerifyBanner && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2 flex items-center justify-center gap-2 text-xs text-yellow-400 font-semibold flex-wrap z-50 relative">
          <MailWarning className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Please verify your email — check your inbox.</span>
          <button
            onClick={handleResend}
            disabled={resendStatus !== 'idle'}
            className="underline hover:text-yellow-300 disabled:no-underline disabled:opacity-70 transition-colors"
          >
            {resendStatus === 'sending' ? 'Sending…' : resendStatus === 'sent' ? '✓ Sent!' : 'Resend'}
          </button>
        </div>
      )}

      {/* ── Desktop header ── */}
      <header className="hidden sm:block sticky top-0 z-40 bg-gray-900/90 backdrop-blur border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <img src="/logo.svg" alt="ProspectAI" className="w-8 h-8 flex-shrink-0" />

          <nav className="flex items-center gap-1">
            {tabs.slice(0, 3).map(({ href, icon: Icon, label, badge, badgeColor = 'bg-purple-600' }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    active ? 'bg-purple-600/20 text-purple-300' : 'text-gray-400 hover:text-white hover:bg-white/8'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                  {badge != null && badge > 0 && (
                    <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] ${badgeColor} text-white text-[10px] font-black rounded-full flex items-center justify-center px-1`}>
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex-1" />

          <button
            onClick={() => setShowManual(true)}
            title="Add prospect manually"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold bg-purple-600/20 hover:bg-purple-600/35 text-purple-300 border border-purple-500/25 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add</span>
          </button>

          {savedCount > 0 && (
            <button
              onClick={() => exportProspectsCSV(prospects)}
              title="Export all prospects to CSV"
              className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/8 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          )}

          <Link
            href="/settings"
            title="Settings"
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all border border-white/10 ${
              pathname === '/settings' ? 'bg-purple-600/20 text-purple-300 border-purple-500/30' : 'text-gray-400 hover:text-white hover:bg-white/8'
            }`}
          >
            <Settings className="w-4 h-4" />
          </Link>

          <button
            onClick={toggle}
            title="Toggle theme"
            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-white hover:bg-white/8 transition-all border border-white/10"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-purple-400" />}
          </button>

          {session?.user && userPlan === 'free' && (
            <Link
              href="/pricing"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-purple-600/20 hover:bg-purple-600/35 text-purple-300 border border-purple-500/30 transition-colors"
            >
              <Zap className="w-3.5 h-3.5" /> Upgrade
            </Link>
          )}

          {session?.user && (
            <div className="flex items-center gap-2 pl-2 border-l border-white/10">
              <div className="flex flex-col items-end">
                <span className="text-xs text-white font-medium leading-none">{session.user.name}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 ${planBadge.cls}`}>{planBadge.label}</span>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                title="Sign out"
                className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all border border-white/10"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Mobile top bar ── */}
      <header
        className="sm:hidden sticky top-0 z-40 bg-gray-900/95 backdrop-blur-md border-b border-white/[0.06]"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between px-4 h-14">
          <img src="/logo.svg" alt="ProspectAI" className="w-8 h-8" />

          <div className="flex items-center gap-2">
            {session?.user && userPlan === 'free' && (
              <Link
                href="/pricing"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-purple-600/20 text-purple-300 border border-purple-500/30"
              >
                <Zap className="w-3 h-3" /> Upgrade
              </Link>
            )}
            <button
              onClick={toggle}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 border border-white/10"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-purple-400" />}
            </button>
            <button
              onClick={() => setShowManual(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-purple-600/20 text-purple-300 border border-purple-500/25"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Mobile bottom tab bar ── */}
      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-gray-900/95 backdrop-blur-md border-t border-white/[0.06]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex h-14">
          {tabs.map(({ href, icon: Icon, label, badge, badgeColor = 'bg-purple-600' }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active ? 'text-purple-400' : 'text-gray-500'
                }`}
              >
                {active && (
                  <span className="absolute top-0 inset-x-0 flex justify-center">
                    <span className="w-8 h-0.5 bg-purple-500 rounded-full" />
                  </span>
                )}
                <div className="relative">
                  <Icon className={`w-5 h-5 transition-all duration-150 ${active ? 'scale-110' : ''}`} />
                  {badge != null && badge > 0 && (
                    <span className={`absolute -top-1.5 -right-2 min-w-[16px] h-4 ${badgeColor} text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 leading-none`}>
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-semibold leading-none">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {showManual && <ManualProspectModal onClose={() => setShowManual(false)} />}
    </>
  );
}
