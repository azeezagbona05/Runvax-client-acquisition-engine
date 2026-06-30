'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useProspects } from '@/context/ProspectsContext';
import { Target, Check, X, ChevronRight, Minus, Trophy } from 'lucide-react';

const CONFETTI_COLORS = ['#7c3aed', '#2563eb', '#f97316', '#22c55e', '#eab308', '#ec4899'];

function Confetti() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      {Array.from({ length: 40 }).map((_, i) => (
        <span key={i} className="confetti-piece" style={{
          left: `${Math.random() * 100}%`,
          background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          animationDuration: `${1.8 + Math.random() * 1.6}s`,
          animationDelay: `${Math.random() * 0.6}s`,
          transform: `rotate(${Math.random() * 360}deg)`,
          borderRadius: i % 2 ? '2px' : '50%',
        }} />
      ))}
    </div>
  );
}

export default function QuestTracker() {
  const { data: session } = useSession();
  const { prospects } = useProspects();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(true);   // assume hidden until localStorage checked
  const [celebrated, setCelebrated] = useState(false);

  useEffect(() => {
    try {
      const off = localStorage.getItem('aip_quests_hidden') === '1' || localStorage.getItem('aip_quests_done') === '1';
      setHidden(off);
    } catch { setHidden(false); }
  }, []);

  const quests = [
    { id: 'save',     label: 'Save your first prospect', done: prospects.length > 0,                                                  href: '/' },
    { id: 'contact',  label: 'Contact a prospect',        done: prospects.some((p) => p.stage !== 'found' || !!p.outreachSentAt),      href: '/pipeline' },
    { id: 'proposal', label: 'Move a deal to Proposal',   done: prospects.some((p) => ['proposal', 'won'].includes(p.stage)),         href: '/pipeline' },
    { id: 'won',      label: 'Win your first deal',       done: prospects.some((p) => p.stage === 'won'),                              href: '/pipeline' },
  ];
  const doneCount = quests.filter((q) => q.done).length;
  const total = quests.length;
  const allDone = doneCount === total;
  const pct = Math.round((doneCount / total) * 100);

  // Celebrate once when everything is complete, then retire the tracker.
  useEffect(() => {
    if (allDone && !hidden && !celebrated) {
      setCelebrated(true);
      setOpen(true);
      try { localStorage.setItem('aip_quests_done', '1'); } catch { /* */ }
      const t = setTimeout(() => setHidden(true), 7000);
      return () => clearTimeout(t);
    }
  }, [allDone, hidden, celebrated]);

  const offRoute = pathname.startsWith('/auth') || pathname.startsWith('/admin') || pathname.startsWith('/demo');
  if (!session?.user || hidden || offRoute) return null;

  const dismiss = () => { try { localStorage.setItem('aip_quests_hidden', '1'); } catch { /* */ } setHidden(true); };

  return (
    <div className="fixed right-4 bottom-20 sm:bottom-4 z-40">
      {celebrated && allDone && <Confetti />}

      {open ? (
        <div className="w-72 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8">
            <div className="w-7 h-7 rounded-lg bg-purple-600/15 text-purple-400 flex items-center justify-center flex-shrink-0">
              {allDone ? <Trophy className="w-4 h-4" /> : <Target className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white leading-tight">{allDone ? 'All done! 🎉' : 'Getting started'}</div>
              <div className="text-[11px] text-gray-500">{doneCount} of {total} complete</div>
            </div>
            <button onClick={() => setOpen(false)} title="Minimise" className="w-6 h-6 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/8 transition-colors">
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button onClick={dismiss} title="Dismiss" className="w-6 h-6 flex items-center justify-center rounded-md text-gray-500 hover:text-white hover:bg-white/8 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-white/5">
            <div className="h-full bg-gradient-to-r from-purple-500 to-orange-500 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>

          {/* Quests */}
          <div className="p-2">
            {allDone ? (
              <p className="text-sm text-gray-300 px-2 py-3 text-center leading-relaxed">
                You&apos;ve mastered the basics — found prospects, pitched, and closed. Now go win more. 🚀
              </p>
            ) : (
              quests.map((q) => (
                q.done ? (
                  <div key={q.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm">
                    <span className="w-5 h-5 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3" />
                    </span>
                    <span className="text-gray-500 line-through">{q.label}</span>
                  </div>
                ) : (
                  <Link key={q.id} href={q.href}
                    onClick={() => {
                      try { sessionStorage.setItem('aip_coach', q.id); } catch { /* */ }
                      window.dispatchEvent(new Event('aip-coach'));
                      setOpen(false);
                    }}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm hover:bg-white/5 transition-colors group">
                    <span className="w-5 h-5 rounded-full border border-white/15 flex-shrink-0" />
                    <span className="text-gray-300 flex-1">{q.label}</span>
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-purple-400 transition-colors" />
                  </Link>
                )
              ))
            )}
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold pl-3 pr-4 py-2.5 rounded-full shadow-lg shadow-purple-900/30 transition-colors">
          <span className="relative flex items-center justify-center">
            <Target className="w-4 h-4" />
          </span>
          <span className="text-sm">Getting started</span>
          <span className="text-xs font-black bg-white/20 rounded-full px-2 py-0.5">{doneCount}/{total}</span>
        </button>
      )}
    </div>
  );
}
