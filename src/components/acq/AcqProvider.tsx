'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import type { Overview } from '@/lib/acqOverview';

export type AcqGate = 'signin' | 'locked' | 'unverified' | 'setup' | null;
export type AcqOverviewData = Overview & { mailboxReady: boolean };

interface Ctx {
  /** The real numbers for this account. */
  data: AcqOverviewData | null;
  gate: AcqGate;
  error: string;
  days: number;
  setDays: (d: number) => void;
  /** Re-fetch the numbers (after sending, importing, marking a reply…). */
  reload: () => Promise<void>;
  loading: boolean;
}

const AcqContext = createContext<Ctx | null>(null);

export function useAcq(): Ctx {
  const c = useContext(AcqContext);
  if (!c) throw new Error('useAcq must be used inside <AcqProvider>');
  return c;
}

/** One shared copy of the overview numbers: the sidebar badge, the status pill and the pages all read from it. */
export default function AcqProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [data, setData] = useState<AcqOverviewData | null>(null);
  const [gate, setGate] = useState<AcqGate>(null);
  const [error, setError] = useState('');
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/client-acquisition/overview?days=${days}&tz=${new Date().getTimezoneOffset()}`);
      const json = await res.json() as AcqOverviewData & { code?: string; error?: string };
      if (res.status === 401) { setGate('signin'); setData(null); return; }
      if (json.code === 'FEATURE_LOCKED') { setGate('locked'); setData(null); return; }
      if (json.code === 'EMAIL_UNVERIFIED') { setGate('unverified'); setData(null); return; }
      if (json.code === 'V2_NOT_INSTALLED') { setGate('setup'); setData(null); return; }
      if (!res.ok) { setError(json.error ?? 'Could not load your dashboard.'); return; }
      setGate(null); setError('');
      setData(json);
    } catch {
      setError('Could not load your dashboard. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { if (status !== 'loading') void reload(); }, [status, reload]);

  // Keep the numbers fresh while the tab is open: opens and clicks arrive on their own.
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') void reload(); }, 60_000);
    return () => clearInterval(t);
  }, [reload]);

  const value = useMemo<Ctx>(() => ({ data, gate, error, days, setDays, reload, loading }), [data, gate, error, days, reload, loading]);
  return <AcqContext.Provider value={value}>{children}</AcqContext.Provider>;
}
