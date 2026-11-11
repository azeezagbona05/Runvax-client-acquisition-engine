'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2, Sparkles } from 'lucide-react';
import { useTrialOffer } from '@/context/SiteStatusContext';

const USED_KEY = 'runvax_trial_used';

/** For accounts on Free that have not used their free Professional period: one clear way to switch it on. */
export default function TrialBanner() {
  const trial = useTrialOffer();
  const { data: session, update } = useSession();
  const [hidden, setHidden] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const plan = (session?.user as { plan?: string } | undefined)?.plan;

  useEffect(() => {
    try { setHidden(localStorage.getItem(USED_KEY) === '1'); } catch { setHidden(false); }
  }, []);

  if (!session?.user || plan !== 'free' || !trial.open || hidden) return null;

  const start = async () => {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/trial/start', { method: 'POST' });
      const json = await res.json().catch(() => ({})) as { error?: string; code?: string };
      if (res.ok) { await update(); window.location.reload(); return; }
      if (json.code === 'TRIAL_USED') { try { localStorage.setItem(USED_KEY, '1'); } catch { /* ignore */ } setHidden(true); return; }
      setError(json.error ?? 'Could not activate it. Try again.');
    } catch { setError('Could not activate it. Check your connection.'); }
    setBusy(false);
  };

  return (
    <div className="acq-notice" role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
      <Sparkles size={18} style={{ color: '#9333ea', flex: 'none' }} />
      <span style={{ flex: 1, minWidth: 220 }}>
        <b>Try RUNVAX Professional free for {trial.days} days.</b> Email outreach, follow-up automation and everything else, no card needed. Your work stays when it ends.
        {error && <span className="acq-warn" style={{ display: 'block', marginTop: 4 }}>{error}</span>}
      </span>
      <button className="acq-btn acq-btn-primary acq-btn-sm" onClick={() => void start()} disabled={busy}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : null} Activate {trial.days} free days
      </button>
    </div>
  );
}
