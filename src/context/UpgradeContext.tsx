'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import UpgradeModal from '@/components/UpgradeModal';
import { FEATURE_LABELS, FeatureId } from '@/lib/features';

type UpgradeReason = 'ai_limit' | 'prospect_limit' | 'feature';

interface UpgradeContextValue {
  triggerUpgrade: (reason: UpgradeReason, featureName?: string) => void;
}

const UpgradeContext = createContext<UpgradeContextValue>({ triggerUpgrade: () => {} });

export function useUpgrade() {
  return useContext(UpgradeContext);
}

// Call this helper on any fetch response to auto-show the modal on 402
// Returns 'auth' on 401 so callers can show a preview-then-lock UX
export function useHandleAIResponse() {
  const { triggerUpgrade } = useUpgrade();
  return useCallback(
    (res: Response, json: { code?: string; error?: string; feature?: string }): boolean | 'auth' => {
      if (res.status === 401) return 'auth';
      if (json.code === 'FEATURE_LOCKED') {
        const name = json.feature ? FEATURE_LABELS[json.feature as FeatureId] : undefined;
        triggerUpgrade('feature', name);
        return true;
      }
      if (res.status === 402 || json.code === 'LIMIT_REACHED') {
        triggerUpgrade('ai_limit');
        return true;
      }
      return false;
    },
    [triggerUpgrade]
  );
}

export function UpgradeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ reason: UpgradeReason; featureName?: string } | null>(null);

  const triggerUpgrade = useCallback((reason: UpgradeReason, featureName?: string) => {
    setState({ reason, featureName });
  }, []);

  return (
    <UpgradeContext.Provider value={{ triggerUpgrade }}>
      {children}
      {state && (
        <UpgradeModal
          reason={state.reason}
          featureName={state.featureName}
          onClose={() => setState(null)}
        />
      )}
    </UpgradeContext.Provider>
  );
}
