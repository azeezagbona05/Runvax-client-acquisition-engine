'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useProspects } from '@/context/ProspectsContext';
import { Search, Bell, ChevronRight } from 'lucide-react';
import type { SavedProspect } from '@/types';

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

// Steps due today or earlier that haven't been sent yet
function dueSteps(prospect: SavedProspect) {
  if (!prospect.followUpSequence?.length) return [];
  const today = todayStr();
  return prospect.followUpSequence.filter((s) => !s.sentAt && s.dueDate <= today);
}

interface Usage {
  plan: string;
  searchesLimit: number | null;
  searchesRemaining: number | null;
}

export default function TopBar() {
  const { data: session } = useSession();
  const { prospects } = useProspects();
  const pathname = usePathname();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Pull today's quota snapshot
  useEffect(() => {
    if (!session?.user) return;
    let active = true;
    fetch('/api/user/usage')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active && d) setUsage(d); })
      .catch(() => {});
    return () => { active = false; };
  }, [session?.user, pathname]);

  // Close notification dropdown on outside click
  useEffect(() => {
    if (!showNotif) return;
    const onClick = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotif(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [showNotif]);

  // Logged-out: show Sign in / Sign up
  if (!session?.user) {
    return (
      <header className="hidden lg:flex sticky top-0 z-30 h-16 -mb-16 items-center justify-end gap-3 px-8 pointer-events-none">
        <Link
          href="/auth/signin"
          className="pointer-events-auto px-4 py-2 rounded-xl text-xs font-bold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 backdrop-blur-md transition-colors"
        >
          Log in
        </Link>
        <Link
          href="/auth/signup"
          className="pointer-events-auto px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 transition-colors"
        >
          Sign up free
        </Link>
      </header>
    );
  }

  const dueProspects = prospects
    .map((p) => ({ p, steps: dueSteps(p) }))
    .filter((x) => x.steps.length > 0);
  const notifCount = dueProspects.length;

  const initials = session.user.name?.[0]?.toUpperCase() ?? session.user.email?.[0]?.toUpperCase() ?? '?';

  // Searches-left pill state
  const remaining = usage?.searchesRemaining;
  const unlimited = usage != null && usage.searchesLimit === null;
  const pillColor =
    unlimited                       ? 'text-purple-300 bg-purple-600/15 border-purple-500/25' :
    remaining == null               ? 'text-gray-400 bg-white/5 border-white/10' :
    remaining <= 1                  ? 'text-red-400 bg-red-500/10 border-red-500/20' :
    remaining <= 3                  ? 'text-orange-400 bg-orange-500/10 border-orange-500/20' :
                                      'text-green-400 bg-green-500/10 border-green-500/20';

  return (
    <header className="hidden lg:flex sticky top-0 z-30 h-16 -mb-16 items-center justify-end gap-3 px-8 pointer-events-none">
      {/* Searches left */}
      <Link
        href="/pricing"
        className={`pointer-events-auto flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border backdrop-blur-md transition-colors hover:opacity-90 ${pillColor}`}
        title="Daily search quota — upgrade for more"
      >
        <Search className="w-3.5 h-3.5" />
        {unlimited
          ? 'Unlimited searches'
          : remaining == null
          ? 'Searches'
          : <>{remaining} <span className="font-semibold opacity-80">searches left</span></>}
      </Link>

      {/* Notifications */}
      <div className="relative pointer-events-auto" ref={notifRef}>
        <button
          onClick={() => setShowNotif((v) => !v)}
          className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 backdrop-blur-md transition-colors"
          title="Follow-ups due"
        >
          <Bell className="w-4 h-4" />
          {notifCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 leading-none">
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
        </button>

        {showNotif && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50">
            <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
              <span className="text-sm font-bold text-white">Follow-ups due</span>
              <span className="text-[11px] text-gray-500">{notifCount} pending</span>
            </div>
            {notifCount === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-7 h-7 text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500">You&apos;re all caught up.</p>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                {dueProspects.slice(0, 6).map(({ p, steps }) => (
                  <Link
                    key={p.business.id}
                    href="/pipeline"
                    onClick={() => setShowNotif(false)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                  >
                    <div className="w-8 h-8 rounded-lg bg-orange-500/15 text-orange-400 flex items-center justify-center text-xs font-black flex-shrink-0">
                      {p.business.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-white truncate">{p.business.name}</p>
                      <p className="text-[11px] text-gray-500 truncate">{steps[0].label} · due</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            )}
            <Link
              href="/pipeline"
              onClick={() => setShowNotif(false)}
              className="block px-4 py-3 text-center text-xs font-bold text-purple-400 hover:bg-white/5 border-t border-white/8 transition-colors"
            >
              View pipeline →
            </Link>
          </div>
        )}
      </div>

      {/* Profile avatar → settings */}
      <Link
        href="/settings"
        title="Profile & settings"
        className="pointer-events-auto w-10 h-10 flex items-center justify-center rounded-xl bg-blue-600 text-white text-sm font-black backdrop-blur-md hover:opacity-90 transition-opacity"
      >
        {initials}
      </Link>
    </header>
  );
}
