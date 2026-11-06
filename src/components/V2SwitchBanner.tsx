'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Sparkles, X } from 'lucide-react';
import { DEFAULT_HOME } from '@/lib/home';

const KEY = 'runvax_v2_switch_dismissed_at';
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

/** Shown on the classic pages to signed-in users: invites them to the new Client Acquisition experience. "Not now" hides it for 7 days. */
export default function V2SwitchBanner() {
  const { status } = useSession();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated') return;
    try {
      const at = Number(localStorage.getItem(KEY) ?? 0);
      setShow(!at || Date.now() - at > SNOOZE_MS);
    } catch { setShow(true); }
  }, [status]);

  if (!show) return null;
  const dismiss = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* ignore */ } setShow(false); };

  return (
    <div className="flex items-center gap-3 bg-purple-600/15 border-b border-purple-500/30 px-4 py-2.5 text-sm">
      <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0" />
      <p className="text-gray-200 flex-1">
        <strong className="text-white">The new RUNVAX is here.</strong> Find prospects, run campaigns and track replies in one place.
      </p>
      <Link href={DEFAULT_HOME} className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg whitespace-nowrap">
        Switch to the new experience
      </Link>
      <button onClick={dismiss} aria-label="Not now" className="text-gray-500 hover:text-gray-300"><X className="w-4 h-4" /></button>
    </div>
  );
}
