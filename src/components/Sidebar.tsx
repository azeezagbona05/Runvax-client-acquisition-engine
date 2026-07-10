'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useProspects } from '@/context/ProspectsContext';
import { useSidebar } from '@/context/SidebarContext';
import { useTheme } from '@/context/ThemeContext';
import {
  Search, Columns3, BarChart3, Settings, PanelLeftClose, PanelLeftOpen,
  LogOut, LogIn, Zap, Sun, Moon, SlidersHorizontal, UserCircle, LifeBuoy, ChevronRight, Sparkles,
} from 'lucide-react';

export default function Sidebar() {
  const { collapsed, toggle } = useSidebar();
  const pathname = usePathname();
  const { prospects } = useProspects();
  const { data: session } = useSession();
  const { theme, toggle: toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  // `collapsed` is the pinned state (set by the toggle). When collapsed, the
  // sidebar still expands on hover (peek) and re-collapses on mouse leave.
  // `rail` = the visually-collapsed (narrow) state.
  const rail = collapsed && !hovered && !menuOpen;

  const savedCount  = prospects.length;
  const wonCount    = prospects.filter((p) => p.stage === 'won').length;

  const userPlan  = (session?.user as { plan?: string })?.plan ?? 'free';
  const planBadge =
    userPlan === 'agency' ? { label: 'AGENCY', cls: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' }
    : userPlan === 'pro'  ? { label: 'PRO',    cls: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' }
    :                       { label: 'FREE',   cls: 'bg-white/5 text-gray-500 border border-white/10' };

  const initials = session?.user?.name?.[0]?.toUpperCase() ?? session?.user?.email?.[0]?.toUpperCase() ?? '?';

  const tabs = [
    { href: '/market-brief', icon: Sparkles,    label: 'Market Brief',  badge: undefined,                              badgeColor: 'bg-purple-600' },
    { href: '/',             icon: Search,      label: 'Find Prospects', badge: undefined,                            badgeColor: 'bg-purple-600' },
    { href: '/pipeline',     icon: Columns3,    label: 'Pipeline',  badge: savedCount > 0 ? savedCount : undefined,  badgeColor: 'bg-purple-600' },
    { href: '/dashboard',    icon: BarChart3,   label: 'Analytics', badge: wonCount > 0 ? wonCount : undefined,      badgeColor: 'bg-green-500' },
    { href: '/settings',     icon: Settings,    label: 'Settings',  badge: undefined,                                badgeColor: 'bg-purple-600' },
  ];

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      {/* Desktop sidebar — hidden below lg */}
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`sidebar-dark hidden lg:flex flex-col fixed left-0 top-0 h-screen z-40 border-r border-white/[0.06] transition-all duration-300 ease-in-out overflow-hidden ${
          rail ? 'w-16' : 'w-60'
        } ${collapsed && !rail ? 'shadow-2xl shadow-black/40' : ''}`}
      >
        {/* Top: logo + sidebar toggle */}
        <div className={`flex items-center h-16 px-3 border-b border-white/[0.06] flex-shrink-0 ${rail ? 'justify-center' : 'justify-between'}`}>
          {!rail && (
            <div className="flex items-center gap-2.5 min-w-0 pl-1">
              <img src="/logo.svg" alt="" className="w-8 h-8 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-black text-white leading-tight">Runvax</div>
                <div className="text-[10px] text-gray-600 leading-tight">Find · Pitch · Win</div>
              </div>
            </div>
          )}
          <button
            onClick={toggle}
            title={collapsed ? 'Open sidebar' : 'Collapse sidebar'}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-white/8 transition-colors flex-shrink-0"
          >
            {collapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {tabs.map(({ href, icon: Icon, label, badge, badgeColor }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                title={rail ? label : undefined}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group whitespace-nowrap ${
                  active
                    ? 'bg-purple-600/20 text-purple-300'
                    : 'text-gray-400 hover:text-white hover:bg-white/8'
                } ${rail ? 'justify-center' : ''}`}
              >
                <Icon className={`w-5 h-5 flex-shrink-0 transition-transform duration-150 ${active ? 'scale-110' : 'group-hover:scale-105'}`} />
                {!rail && <span>{label}</span>}

                {badge != null && badge > 0 && (
                  <span className={`${
                    rail ? 'absolute top-0.5 right-0.5' : 'ml-auto'
                  } min-w-[18px] h-[18px] ${badgeColor} text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 leading-none`}>
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}

                {/* Tooltip when collapsed */}
                {rail && (
                  <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-gray-800 border border-white/10 text-white text-xs font-semibold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity duration-150 shadow-xl z-50">
                    {label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-white/[0.06] p-2 flex-shrink-0">

          {/* Signed in — avatar button that opens the account menu */}
          {session?.user && (
            <button
              onClick={() => setMenuOpen((v) => !v)}
              title={rail ? session.user.name ?? 'Account' : undefined}
              className={`w-full flex items-center gap-2.5 px-1.5 py-1.5 rounded-xl hover:bg-white/8 transition-colors ${rail ? 'justify-center' : ''}`}
            >
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-[11px] font-black text-white flex-shrink-0">
                {initials}
              </div>
              {!rail && (
                <>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-xs font-semibold text-white truncate leading-tight">{session.user.name}</div>
                    <div className="text-[10px] text-gray-500 leading-tight">{planBadge.label === 'FREE' ? 'Free plan' : `${planBadge.label} plan`}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                </>
              )}
            </button>
          )}

          {/* Logged out — login block + theme toggle */}
          {!session?.user && (
            <div className="space-y-1.5">
              <Link
                href="/auth/signin"
                title={rail ? 'Log in' : undefined}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition-colors whitespace-nowrap ${
                  rail ? 'justify-center' : ''
                }`}
              >
                <LogIn className="w-4 h-4 flex-shrink-0" />
                {!rail && <span>Log in</span>}
              </Link>
              {!rail && (
                <Link
                  href="/auth/signup"
                  className="block text-center text-[11px] text-gray-500 hover:text-gray-300 transition-colors py-1"
                >
                  Create free account
                </Link>
              )}
              <button
                onClick={toggleTheme}
                title={rail ? 'Toggle theme' : undefined}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/8 transition-colors whitespace-nowrap ${
                  rail ? 'justify-center' : ''
                }`}
              >
                {theme === 'dark'
                  ? <Sun className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  : <Moon className="w-4 h-4 text-purple-400 flex-shrink-0" />}
                {!rail && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Account menu popup (rendered outside the dark sidebar so it follows the theme) */}
      {menuOpen && session?.user && (
        <>
          <div className="hidden lg:block fixed inset-0 z-[55]" onClick={closeMenu} />
          <div className="hidden lg:block fixed bottom-16 left-3 w-64 z-[60] bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <Link href="/settings" onClick={closeMenu} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/8">
              <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-xs font-black text-white flex-shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate">{session.user.name}</div>
                <div className="text-[11px] text-gray-500">{planBadge.label === 'FREE' ? 'Free plan' : `${planBadge.label} plan`}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
            </Link>

            {/* Primary items */}
            <div className="py-1.5">
              {userPlan === 'free' && (
                <Link href="/pricing" onClick={closeMenu} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-white/5 transition-colors">
                  <Zap className="w-4 h-4 text-purple-400 flex-shrink-0" /> Upgrade plan
                </Link>
              )}
              <Link href="/settings" onClick={closeMenu} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-white/5 transition-colors">
                <SlidersHorizontal className="w-4 h-4 text-gray-400 flex-shrink-0" /> Personalization
              </Link>
              <Link href="/settings" onClick={closeMenu} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-white/5 transition-colors">
                <UserCircle className="w-4 h-4 text-gray-400 flex-shrink-0" /> Profile
              </Link>
              <Link href="/settings" onClick={closeMenu} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-white/5 transition-colors">
                <Settings className="w-4 h-4 text-gray-400 flex-shrink-0" /> Settings
              </Link>
            </div>

            {/* Theme toggle */}
            <div className="py-1.5 border-t border-white/8">
              <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-white/5 transition-colors">
                {theme === 'dark'
                  ? <><Sun className="w-4 h-4 text-yellow-400 flex-shrink-0" /> Light mode</>
                  : <><Moon className="w-4 h-4 text-purple-400 flex-shrink-0" /> Dark mode</>}
              </button>
            </div>

            {/* Secondary items */}
            <div className="py-1.5 border-t border-white/8">
              <a href="mailto:info@runvax.com?subject=Runvax%20Support" onClick={closeMenu} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-white/5 transition-colors">
                <LifeBuoy className="w-4 h-4 text-gray-400 flex-shrink-0" /> Help
              </a>
              <button onClick={() => { closeMenu(); signOut({ callbackUrl: '/' }); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-white/5 transition-colors">
                <LogOut className="w-4 h-4 text-gray-400 flex-shrink-0" /> Log out
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
