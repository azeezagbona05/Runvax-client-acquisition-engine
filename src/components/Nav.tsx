'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useProspects } from '@/context/ProspectsContext';
import {
  Search, Columns3, BarChart3, Plus, Sun, Moon, Zap, Settings, MailWarning,
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
