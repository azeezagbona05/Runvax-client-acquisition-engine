'use client';

import {
  createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode,
} from 'react';
import { fetchSaturation, OUTREACH_SENT_EVENT } from '@/lib/saturationClient';
import { isTrackableBusinessId, type Saturation } from '@/lib/saturation';

interface Ctx {
  /** Cached saturation for a business, or undefined while it is still loading. */
  get: (businessId: string) => Saturation | undefined;
  /** Queue ids for lookup. Safe to call on every render — already-known and
   *  in-flight ids are skipped, and the rest are coalesced into one request. */
  ensure: (businessIds: string[]) => void;
}

const SaturationContext = createContext<Ctx | null>(null);

export function SaturationProvider({ children }: { children: ReactNode }) {
  const [cache, setCache] = useState<Record<string, Saturation>>({});

  // Ids already fetched or currently in flight — tracked in a ref so `ensure`
  // keeps a stable identity and never retriggers the effects that call it.
  const known = useRef<Set<string>>(new Set());
  const pending = useRef<Set<string>>(new Set());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    flushTimer.current = null;
    const ids = Array.from(pending.current);
    pending.current.clear();
    if (ids.length === 0) return;

    const result = await fetchSaturation(ids);
    // Mark every requested id as known, not just the ones that came back — a
    // business with no signal yet returns a zeroed row, and an outright failure
    // shouldn't spin forever re-requesting.
    for (const id of ids) known.current.add(id);
    setCache((prev) => ({ ...prev, ...result }));
  }, []);

  const ensure = useCallback((businessIds: string[]) => {
    let queued = false;
    for (const id of businessIds) {
      if (!isTrackableBusinessId(id)) continue;
      if (known.current.has(id) || pending.current.has(id)) continue;
      pending.current.add(id);
      queued = true;
    }
    if (!queued || flushTimer.current) return;
    // One tick of coalescing turns a grid of 60 mounting cards into 1 request.
    flushTimer.current = setTimeout(() => { void flush(); }, 50);
  }, [flush]);

  // When this user sends a message, patch their own row optimistically so the
  // badge flips to "You + N others" without waiting for a refetch.
  useEffect(() => {
    function onSent(e: Event) {
      const businessId = (e as CustomEvent<{ businessId: string }>).detail?.businessId;
      if (!businessId) return;
      setCache((prev) => {
        const row = prev[businessId];
        if (!row || row.youContacted) return prev;
        const now = new Date().toISOString();
        return {
          ...prev,
          [businessId]: {
            ...row,
            youContacted: true,
            userCount: row.userCount + 1,
            yourLastSentAt: now,
            lastSentAt: now,
          },
        };
      });
    }
    window.addEventListener(OUTREACH_SENT_EVENT, onSent);
    return () => window.removeEventListener(OUTREACH_SENT_EVENT, onSent);
  }, []);

  useEffect(() => () => {
    if (flushTimer.current) clearTimeout(flushTimer.current);
  }, []);

  const get = useCallback((businessId: string) => cache[businessId], [cache]);

  return (
    <SaturationContext.Provider value={{ get, ensure }}>
      {children}
    </SaturationContext.Provider>
  );
}

export function useSaturation(): Ctx {
  const ctx = useContext(SaturationContext);
  // Degrade to a no-op rather than throwing — the badge is additive, and a
  // component rendered outside the provider should simply show nothing.
  return ctx ?? { get: () => undefined, ensure: () => {} };
}
