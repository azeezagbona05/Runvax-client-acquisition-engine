'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useProspects } from '@/context/ProspectsContext';
import { exportProspectsCSV } from '@/lib/export';
import { Search, Columns3, BarChart3, Download, Plus, Sun, Moon } from 'lucide-react';
import ManualProspectModal from './ManualProspectModal';
import { useTheme } from '@/context/ThemeContext';

export default function Nav() {
  const pathname = usePathname();
  const { prospects } = useProspects();
  const { theme, toggle } = useTheme();
  const [showManual, setShowManual] = useState(false);

  const wonCount = prospects.filter((p) => p.stage === 'won').length;
  const savedCount = prospects.length;

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
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/8 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
          )}

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
        </div>
      </header>

      {showManual && <ManualProspectModal onClose={() => setShowManual(false)} />}
    </>
  );
}
