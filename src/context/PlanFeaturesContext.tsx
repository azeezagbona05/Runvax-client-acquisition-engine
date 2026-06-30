'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { FeatureId, planHasFeature } from '@/lib/features';

interface PlanFeaturesValue {
  features: FeatureId[] | null; // null until the live config has loaded
  hasFeature: (feature: FeatureId) => boolean;
  refresh: () => void;
}

const PlanFeaturesContext = createContext<PlanFeaturesValue>({
  features: null,
  hasFeature: () => false,
  refresh: () => {},
});

export function usePlanFeatures() {
  return useContext(PlanFeaturesContext);
}

// Convenience hook for the common single-feature check.
export function useFeature(feature: FeatureId): boolean {
  return usePlanFeatures().hasFeature(feature);
}

/**
 * Loads the signed-in user's effective plan features from /api/user/plan (which
 * resolves them from the admin-editable DB config). Until the fetch resolves, it
 * falls back to the static per-plan defaults so paid users never see a flash of
 * locked features.
 */
export function PlanFeaturesProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const plan = (session?.user as { plan?: string })?.plan ?? 'free';
  const [features, setFeatures] = useState<FeatureId[] | null>(null);

  const refresh = useCallback(async () => {
    if (status !== 'authenticated') { setFeatures(null); return; }
    try {
      const res = await fetch('/api/user/plan');
      if (!res.ok) return;
      const data = await res.json() as { features?: FeatureId[] };
      if (Array.isArray(data.features)) setFeatures(data.features);
    } catch { /* keep static fallback */ }
  }, [status]);

  useEffect(() => { refresh(); }, [refresh]);

  const hasFeature = useCallback(
    (feature: FeatureId) => (features ? features.includes(feature) : planHasFeature(plan, feature)),
    [features, plan]
  );

  return (
    <PlanFeaturesContext.Provider value={{ features, hasFeature, refresh }}>
      {children}
    </PlanFeaturesContext.Provider>
  );
}
