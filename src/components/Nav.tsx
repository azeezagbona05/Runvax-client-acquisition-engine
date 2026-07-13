'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useProspects } from '@/context/ProspectsContext';
import {
  Search, Columns3, Sun, Moon, Zap, Settings, MailWarning, Sparkles, LogOut, UserCircle,
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

export default function Nav() {
  const pathname  = usePathname();
  const { prospects } = useProspects();
  const { theme, toggle } = useTheme();
  const { data: session } = useSession();
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showUserMenu) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showUserMenu]);

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

  const savedCount = prospects.length;

  const userPlan = (session?.user as { plan?: string })?.plan ?? 'free';

  const tabs: { href: string; icon: React.ElementType; label: string; badge?: number; badgeColor?: string; authOnly?: boolean }[] = [
    { href: '/',             icon: Search,    label: 'Find' },
    { href: '/pipeline',     icon: Columns3,  label: 'Pipeline', badge: savedCount, authOnly: true },
    { href: '/market-brief', icon: Sparkles,  label: 'Insights', authOnly: true },
    { href: '/settings',     icon: Settings,  label: 'Settings', authOnly: true },
  ].filter((t) => !t.authOnly || session?.user);

  const emailVerified = (session?.user as { emailVerified?: Date | null })?.emailVerified;
  const showVerifyBanner = session?.user && !emailVerified && !pathname.startsWith('/auth');

  // Hide all nav chrome on auth pages — sign-in/signup fill the whole screen
  if (pathname.startsWith('/auth')) return null;

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
          <img src="/logo.svg" alt="Runvax" className="w-8 h-8" />

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

            {/* Sign in button for guests on mobile */}
            {!session?.user && (
              <Link
                href="/auth/signin"
                className="px-3 py-1.5 rounded-lg text-[12px] font-bold bg-purple-600 hover:bg-purple-500 text-white transition-colors"
              >
                Login
              </Link>
            )}

          {/* User avatar + logout menu */}
            {session?.user && (
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu((v) => !v)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-purple-600 text-white text-sm font-black"
                  aria-label="Account menu"
                >
                  {session.user.name?.[0]?.toUpperCase() ?? session.user.email?.[0]?.toUpperCase() ?? '?'}
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
                    {/* User info */}
                    <div className="px-4 py-3 border-b border-white/8">
                      <p className="text-xs font-bold text-white truncate">{session.user.name ?? 'Account'}</p>
                      <p className="text-[11px] text-gray-500 truncate">{session.user.email}</p>
                    </div>

                    {/* Settings link */}
                    <Link
                      href="/settings"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:bg-white/5 transition-colors border-b border-white/8"
                    >
                      <UserCircle className="w-4 h-4 text-gray-400" />
                      Settings &amp; Profile
                    </Link>

                    {/* Log out */}
                    <button
                      onClick={() => signOut({ callbackUrl: '/' })}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Log out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Mobile bottom tab bar ── */}
      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-gray-900/95 backdrop-blur-md border-t border-white/[0.06]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex h-16">
          {tabs.map(({ href, icon: Icon, label, badge, badgeColor = 'bg-purple-600' }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors"
              >
                {/* Active pill capsule */}
                <div className={`relative flex items-center justify-center rounded-2xl transition-all duration-200 mb-0.5 ${
                  active ? 'bg-purple-600/20 px-6 py-1.5' : 'px-5 py-1'
                }`}>
                  <Icon className={`transition-all duration-200 ${
                    active ? 'w-6 h-6 text-purple-400' : 'w-5 h-5 text-gray-500'
                  }`} />
                  {badge != null && badge > 0 && (
                    <span className={`absolute -top-1 -right-1 min-w-[16px] h-4 ${badgeColor} text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 leading-none`}>
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] leading-none transition-all duration-200 ${
                  active ? 'text-purple-400 font-bold' : 'text-gray-600 font-medium'
                }`}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

    </>
  );
}
