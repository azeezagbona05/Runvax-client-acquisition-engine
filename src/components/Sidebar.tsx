'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useProspects } from '@/context/ProspectsContext';
import { useSidebar } from '@/context/SidebarContext';
import { useTheme } from '@/context/ThemeContext';
import { formatPrice } from '@/lib/scoring';
import {
  Search, Columns3, BarChart3, Settings, ChevronLeft, ChevronRight,
  LogOut, LogIn, Zap, Sun, Moon, Plus, TrendingUp, Target, Users,
} from 'lucide-react';
import ManualProspectModal from './ManualProspectModal';

export default function Sidebar() {
  const { collapsed, toggle } = useSidebar();
  const pathname = usePathname();
  const { prospects } = useProspects();
  const { data: session } = useSession();
  const { theme, toggle: toggleTheme } = useTheme();
  const [showManual, setShowManual] = useState(false);

  const savedCount  = prospects.length;
  const wonCount    = prospects.filter((p) => p.stage === 'won').length;
  const pipelineValue = prospects
    .filter((p) => p.stage !== 'lost')
    .reduce((sum, p) => sum + (p.estimatedPrice?.min ?? 0), 0);

  const userPlan  = (session?.user as { plan?: string })?.plan ?? 'free';
  const planBadge =
    userPlan === 'agency' ? { label: 'AGENCY', cls: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' }
    : userPlan === 'pro'  ? { label: 'PRO',    cls: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' }
    :                       { label: 'FREE',   cls: 'bg-white/5 text-gray-500 border border-white/10' };

  const tabs = [
    { href: '/',          icon: Search,    label: 'Search',    badge: undefined,                              badgeColor: 'bg-purple-600' },
    { href: '/pipeline',  icon: Columns3,  label: 'Pipeline',  badge: savedCount > 0 ? savedCount : undefined, badgeColor: 'bg-purple-600' },
    { href: '/dashboard', icon: BarChart3, label: 'Dashboard', badge: wonCount > 0 ? wonCount : undefined,     badgeColor: 'bg-green-500' },
    { href: '/settings',  icon: Settings,  label: 'Settings',  badge: undefined,                              badgeColor: 'bg-purple-600' },
  ];

  return (
    <>
      {/* Desktop sidebar — hidden below lg */}
      <aside
        className={`sidebar-dark hidden lg:flex flex-col fixed left-0 top-0 h-screen z-40 border-r border-white/[0.06] transition-all duration-300 ease-in-out overflow-hidden ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        {/* Logo row */}
        <div className={`flex items-center gap-3 px-4 h-16 border-b border-white/[0.06] flex-shrink-0 ${collapsed ? 'justify-center' : ''}`}>
          <img src="/logo.svg" alt="" className="w-8 h-8 flex-shrink-0" />
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-black text-white leading-tight">ProspectAI</div>
              <div className="text-[10px] text-gray-600 leading-tight">Find · Pitch · Win</div>
            </div>
          )}
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {tabs.map(({ href, icon: Icon, label, badge, badgeColor }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group whitespace-nowrap ${
                  active
                    ? 'bg-purple-600/20 text-purple-300'
                    : 'text-gray-400 hover:text-white hover:bg-white/8'
                }`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-150 ${active ? 'scale-110' : 'group-hover:scale-105'}`} />
                {!collapsed && <span>{label}</span>}

                {badge != null && badge > 0 && (
                  <span className={`${
                    collapsed ? 'absolute top-0.5 right-0.5' : 'ml-auto'
                  } min-w-[18px] h-[18px] ${badgeColor} text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 leading-none`}>
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}

                {/* Tooltip when collapsed */}
                {collapsed && (
                  <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-800 border border-white/10 text-white text-xs font-semibold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity duration-150 shadow-xl z-50">
                    {label}
                  </span>
                )}
              </Link>
            );
          })}

          {/* Add Prospect */}
          <button
            onClick={() => setShowManual(true)}
            title={collapsed ? 'Add Prospect' : undefined}
            className="relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/8 transition-all group whitespace-nowrap"
          >
            <Plus className="w-5 h-5 flex-shrink-0 group-hover:scale-105 transition-transform duration-150" />
            {!collapsed && <span>Add Prospect</span>}
            {collapsed && (
              <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-800 border border-white/10 text-white text-xs font-semibold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity duration-150 shadow-xl z-50">
                Add Prospect
              </span>
            )}
          </button>
        </nav>

        {/* Pipeline stats widget — expanded only */}
        {!collapsed && (savedCount > 0 || pipelineValue > 0) && (
          <div className="mx-3 mb-3 bg-white/[0.03] border border-white/8 rounded-xl p-3 space-y-2 flex-shrink-0">
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" /> Pipeline
            </p>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <Users className="w-3 h-3" /> Prospects
              </span>
              <span className="text-xs font-bold text-white">{savedCount}</span>
            </div>
            {pipelineValue > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Active value</span>
                <span className="text-xs font-bold text-purple-400">{formatPrice(pipelineValue)}</span>
              </div>
            )}
            {wonCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Target className="w-3 h-3" /> Won
                </span>
                <span className="text-xs font-bold text-green-400">{wonCount} deal{wonCount > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        )}

        {/* Bottom section */}
        <div className="border-t border-white/[0.06] p-2 space-y-1 flex-shrink-0">

          {/* Upgrade (free plan) */}
          {session?.user && userPlan === 'free' && (
            <Link
              href="/pricing"
              title={collapsed ? 'Upgrade to Pro' : undefined}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold bg-purple-600/15 hover:bg-purple-600/25 text-purple-400 border border-purple-500/20 transition-colors whitespace-nowrap ${
                collapsed ? 'justify-center' : ''
              }`}
            >
              <Zap className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span>Upgrade to Pro</span>}
              {collapsed && (
                <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-800 border border-white/10 text-white text-xs font-semibold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap shadow-xl z-50">
                  Upgrade to Pro
                </span>
              )}
            </Link>
          )}

          {/* User row — signed in only */}
          {session?.user && (
            <div className={`flex items-center gap-2 px-1 py-1 ${collapsed ? 'flex-col' : ''}`}>
              {/* Avatar / initials */}
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600/60 to-orange-500/40 flex items-center justify-center text-[11px] font-black text-white flex-shrink-0">
                {session.user.name?.[0]?.toUpperCase() ?? '?'}
              </div>

              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white truncate leading-tight">{session.user.name}</div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md inline-block mt-0.5 ${planBadge.cls}`}>
                    {planBadge.label}
                  </span>
                </div>
              )}

              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                title="Sign out"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Sign-in block — logged out only */}
          {!session?.user && (
            <div className="space-y-1.5">
              <Link
                href="/auth/signin"
                title={collapsed ? 'Log in' : undefined}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-colors whitespace-nowrap ${
                  collapsed ? 'justify-center' : ''
                }`}
              >
                <LogIn className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span>Log in</span>}
              </Link>
              {!collapsed && (
                <Link
                  href="/auth/signup"
                  className="block text-center text-[11px] text-gray-500 hover:text-gray-300 transition-colors py-1"
                >
                  Create free account
                </Link>
              )}
            </div>
          )}

          {/* Theme toggle — always visible (signed in or not) */}
          <button
            onClick={toggleTheme}
            title={collapsed ? 'Toggle theme' : undefined}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/8 transition-colors whitespace-nowrap ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            {theme === 'dark'
              ? <Sun className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              : <Moon className="w-4 h-4 text-purple-400 flex-shrink-0" />}
            {!collapsed && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
          </button>

          {/* Collapse toggle */}
          <button
            onClick={toggle}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] text-gray-600 hover:text-gray-300 hover:bg-white/5 transition-colors border border-white/[0.06]"
          >
            {collapsed
              ? <ChevronRight className="w-3.5 h-3.5" />
              : <><ChevronLeft className="w-3.5 h-3.5" /><span>Collapse</span></>}
          </button>
        </div>
      </aside>

      {showManual && <ManualProspectModal onClose={() => setShowManual(false)} />}
    </>
  );
}
