'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useProspects } from '@/context/ProspectsContext';
import { exportProspectsCSV } from '@/lib/export';
import { Search, Columns3, BarChart3, Download, Plus, Sun, Moon, LogOut, Zap, Settings } from 'lucide-react';
import ManualProspectModal from './ManualProspectModal';
import { useTheme } from '@/context/ThemeContext';

export default function Nav() {
  const pathname = usePathname();
  const { prospects } = useProspects();
  const { theme, toggle } = useTheme();
  const { data: session } = useSession();
  const [showManual, setShowManual] = useState(false);

  const wonCount = prospects.filter((p) => p.stage === 'won').length;
  const savedCount = prospects.length;

  const userPlan = (session?.user as { plan?: string })?.plan ?? 'free';
  const planBadge = userPlan === 'agency' ? { label: 'AGENCY', cls: 'bg-orange-500 text-white' }
    : userPlan === 'pro' ? { label: 'PRO', cls: 'bg-purple-600 text-white' }
    : { label: 'FREE', cls: 'bg-gray-700 text-gray-300' };

  const links = [
    { href: '/', icon: Search, label: 'Search' },
    { href: '/pipeline', icon: Columns3, label: 'Pipeline', badge: savedCount },
    { href: '/dashboard', icon: BarChart3, label: 'Dashboard', badge: wonCount > 0 ? wonCount : undefined, badgeColor: 'bg-green-500' },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-gray-900/90 backdrop-blur border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-orange-500 rounded-lg flex items-center justify-center text-sm font-black shadow-lg flex-shrink-0">
            A
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-black text-white text-sm leading-none">AI Prospect Finder</div>
            <div className="text-[11px] text-gray-500 leading-none mt-0.5 hidden sm:block">
              Find · Pitch · Close
            </div>
          </div>

          <nav className="flex items-center gap-1">
            {links.map(({ href, icon: Icon, label, badge, badgeColor = 'bg-purple-600' }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    active
                      ? 'bg-purple-600/20 text-purple-300'
                      : 'text-gray-400 hover:text-white hover:bg-white/8'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{label}</span>
                  {badge != null && badge > 0 && (
                    <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] ${badgeColor} text-white text-[10px] font-black rounded-full flex items-center justify-center px-1`}>
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Quick add prospect */}
          <button
            onClick={() => setShowManual(true)}
            title="Add prospect manually"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold bg-purple-600/20 hover:bg-purple-600/35 text-purple-300 border border-purple-500/25 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add</span>
          </button>

          {savedCount > 0 && (
            <button
              onClick={() => exportProspectsCSV(prospects)}
              title="Export all prospects to CSV"
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/8 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="hidden md:inline">Export</span>
            </button>
          )}

          {/* Settings link */}
          <Link
            href="/settings"
            title="Settings"
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all border border-white/10 ${
              pathname === '/settings'
                ? 'bg-purple-600/20 text-purple-300 border-purple-500/30'
                : 'text-gray-400 hover:text-white hover:bg-white/8'
            }`}
          >
            <Settings className="w-4 h-4" />
          </Link>

          {/* Theme toggle */}
          <button
            onClick={toggle}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-white hover:bg-white/8 transition-all border border-white/10"
          >
            {theme === 'dark'
              ? <Sun className="w-4 h-4 text-yellow-400" />
              : <Moon className="w-4 h-4 text-purple-400" />}
          </button>

          {/* Upgrade CTA for free users */}
          {session?.user && userPlan === 'free' && (
            <Link
              href="/pricing"
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-purple-600/20 hover:bg-purple-600/35 text-purple-300 border border-purple-500/30 transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              Upgrade
            </Link>
          )}

          {/* User + sign out */}
          {session?.user && (
            <div className="flex items-center gap-2 pl-2 border-l border-white/10">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs text-white font-medium leading-none">{session.user.name}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded mt-0.5 ${planBadge.cls}`}>
                  {planBadge.label}
                </span>
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

      {showManual && <ManualProspectModal onClose={() => setShowManual(false)} />}
    </>
  );
}
