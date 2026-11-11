'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2, Zap } from 'lucide-react';
import { useTrialOffer } from '@/context/SiteStatusContext';

type Variant = 'primary' | 'pill' | 'menu';

const STYLE: Record<Variant, string> = {
  primary: 'w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-sm transition-colors',
  pill: 'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-purple-600/20 text-purple-300 border border-purple-500/30 disabled:opacity-60',
  menu: 'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-200 hover:bg-white/5 transition-colors disabled:opacity-60 text-left',
};

/**
 * "Try Pro free for 7 days — $0, no card." Starts the trial, refreshes the session so the new
 * plan applies immediately, then reloads. Renders nothing for paid accounts, signed-out
 * visitors, or once the offer window has closed.
 */
export default function StartTrialButton({ variant = 'primary', onDone }: { variant?: Variant; onDone?: () => void }) {
  const trial = useTrialOffer();
  const { data: session, update } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const plan = (session?.user as { plan?: string } | undefined)?.plan;
  if (!session?.user || plan !== 'free' || !trial.open) return null;

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/trial/start', { method: 'POST' });
      const json = await res.json() as { error?: string };
      if (!res.ok) { setError(json.error ?? 'Could not start the trial'); setBusy(false); return; }
      await update();
      onDone?.();
      window.location.reload();
    } catch {
      setError('Could not start the trial — try again.');
      setBusy(false);
    }
  };

  const label = variant === 'pill' ? 'Free Pro' : `Try Pro free for ${trial.days} days · $0`;
  return (
    <>
      <button onClick={() => void start()} disabled={busy} className={STYLE[variant]}>
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className={variant === 'menu' ? 'w-4 h-4 text-purple-400 flex-shrink-0' : 'w-3.5 h-3.5'} />}
        {busy ? 'Starting…' : label}
      </button>
      {error && <span role="alert" className="block text-xs text-red-400 mt-1 px-4">{error}</span>}
    </>
  );
}
