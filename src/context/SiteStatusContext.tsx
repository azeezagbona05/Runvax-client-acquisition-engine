'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { SITE_DEFAULTS, type SiteSettings } from '@/lib/siteSettingsShared';
import { trialOfferOpen } from '@/lib/promo';

/**
 * What the admin's Site controls say right now (switches, banner, maintenance, trial length). Starts from the built-in
 * defaults, so nothing flashes or breaks if the request is slow or fails, then refreshes every minute and when the tab regains focus.
 * The server enforces every switch on its own: this only decides what to show.
 */
const Ctx = createContext<SiteSettings>(SITE_DEFAULTS);

export function SiteStatusProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<SiteSettings>(SITE_DEFAULTS);
  useEffect(() => {
    let live = true;
    const load = () => {
      fetch('/api/site-status', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: SiteSettings | null) => { if (live && j && typeof j === 'object' && 'signupsOpen' in j) setS(j); })
        .catch(() => { /* keep what we have */ });
    };
    load();
    const t = setInterval(load, 60_000);
    const onVis = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { live = false; clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, []);
  return <Ctx.Provider value={s}>{children}</Ctx.Provider>;
}

export const useSiteStatus = () => useContext(Ctx);

/** The free trial is on offer only if the admin switch is on AND the launch-offer window is still open. */
export function useTrialOffer(): { open: boolean; days: number } {
  const s = useSiteStatus();
  return { open: s.trialOpen && trialOfferOpen(), days: s.trialDays };
}
