'use client';

import {
  createContext, useCallback, useContext, useEffect, useState, useMemo, useRef, ReactNode,
} from 'react';
import {
  Business, SavedProspect, ProspectStage, AppSettings, DailyLog,
  ConversationEntry, ConversationChannel, FollowUpStep,
} from '@/types';

interface Ctx {
  prospects: SavedProspect[];
  loading: boolean;
  save: (business: Business) => Promise<{ error?: string; code?: string }>;
  remove: (businessId: string) => Promise<void>;
  updateStage: (businessId: string, stage: ProspectStage) => Promise<void>;
  updateNotes: (businessId: string, notes: string) => Promise<void>;
  setReminder: (businessId: string, date: string, note: string) => Promise<void>;
  clearReminder: (businessId: string) => Promise<void>;
  setFollowUpSequence: (businessId: string, steps: FollowUpStep[]) => Promise<void>;
  generateSequence: (businessId: string) => Promise<{ error?: string }>;
  updateSequenceStep: (businessId: string, stepId: string, status: 'sent' | 'skipped') => Promise<void>;
  markOutreachSent: (businessId: string, content: string, channel: ConversationChannel, framework?: string) => Promise<void>;
  addConversationEntry: (businessId: string, entry: Omit<ConversationEntry, 'id' | 'timestamp'>) => Promise<void>;
  isSaved: (businessId: string) => boolean;
  get: (businessId: string) => SavedProspect | undefined;
  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings>) => Promise<void>;
  dailyLogs: DailyLog[];
  incrementToday: () => Promise<void>;
  todayCount: number;
}

const ProspectsContext = createContext<Ctx | null>(null);

function todayStr() { return new Date().toISOString().split('T')[0]; }

// Find a prospect's DB id by its Google Places businessId
function dbId(prospect: SavedProspect): string {
  return (prospect as SavedProspect & { _dbId?: string })._dbId ?? '';
}

export function ProspectsProvider({ children }: { children: ReactNode }) {
  const [prospects, setProspects] = useState<SavedProspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings>({
    dailyGoal: 10, avgDealValue: 300000, closeRatePct: 10,
  });
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);

  // Load all data from the DB on mount
  useEffect(() => {
    async function load() {
      try {
        const [pRes, sRes, dRes] = await Promise.all([
          fetch('/api/prospects'),
          fetch('/api/user/settings'),
          fetch('/api/user/daily-log'),
        ]);

        if (pRes.ok) {
          const data = await pRes.json() as (SavedProspect & { _dbId: string })[];
          setProspects(data);
        }
        if (sRes.ok) {
          const s = await sRes.json() as Partial<AppSettings>;
          setSettings((prev) => ({ ...prev, ...s }));
        }
        if (dRes.ok) {
          setDailyLogs(await dRes.json() as DailyLog[]);
        }
      } catch { /* network error — keep empty state */ }
      finally { setLoading(false); }
    }
    void load();
  }, []);

  // Ref always points to latest prospects — lets write callbacks be stable without stale closures
  const prospectsRef = useRef(prospects);
  useEffect(() => { prospectsRef.current = prospects; }, [prospects]);

  // Stable helpers that never change reference
  const dbIdByBizId = useCallback((bizId: string): string => {
    const p = prospectsRef.current.find((pr) => pr.business.id === bizId);
    return p ? dbId(p) : '';
  }, []);

  const save = useCallback(async (business: Business): Promise<{ error?: string; code?: string }> => {
    if (prospectsRef.current.some((p) => p.business.id === business.id)) return {};

    const res = await fetch('/api/prospects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business }),
    });

    const data = await res.json() as SavedProspect & { _dbId?: string; error?: string; code?: string };

    if (!res.ok) return { error: data.error, code: data.code };

    setProspects((prev) => [data, ...prev]);
    return {};
  }, []);

  const remove = useCallback(async (businessId: string) => {
    const id = dbIdByBizId(businessId);
    if (!id) return;
    setProspects((prev) => prev.filter((p) => p.business.id !== businessId));
    await fetch(`/api/prospects/${id}`, { method: 'DELETE' });
  }, [dbIdByBizId]);

  const patch = useCallback(async (businessId: string, body: Record<string, unknown>) => {
    const id = dbIdByBizId(businessId);
    if (!id) return;
    await fetch(`/api/prospects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }, [dbIdByBizId]);

  const updateStage = useCallback(async (businessId: string, stage: ProspectStage) => {
    setProspects((prev) => prev.map((p) => p.business.id === businessId ? { ...p, stage } : p));
    await patch(businessId, { stage });
  }, [patch]);

  const updateNotes = useCallback(async (businessId: string, notes: string) => {
    setProspects((prev) => prev.map((p) => p.business.id === businessId ? { ...p, notes } : p));
    await patch(businessId, { notes });
  }, [patch]);

  const setReminder = useCallback(async (businessId: string, date: string, note: string) => {
    setProspects((prev) => prev.map((p) =>
      p.business.id === businessId ? { ...p, reminderDate: date, reminderNote: note } : p
    ));
    await patch(businessId, { reminderDate: date, reminderNote: note });
  }, [patch]);

  const clearReminder = useCallback(async (businessId: string) => {
    setProspects((prev) => prev.map((p) =>
      p.business.id === businessId ? { ...p, reminderDate: undefined, reminderNote: undefined } : p
    ));
    await patch(businessId, { reminderDate: null, reminderNote: null });
  }, [patch]);

  const setFollowUpSequence = useCallback(async (businessId: string, steps: FollowUpStep[]) => {
    setProspects((prev) => prev.map((p) =>
      p.business.id === businessId ? { ...p, followUpSequence: steps } : p
    ));
    await patch(businessId, { followUpSequence: steps });
  }, [patch]);

  const generateSequence = useCallback(async (businessId: string): Promise<{ error?: string }> => {
    const id = dbIdByBizId(businessId);
    if (!id) return { error: 'Prospect not found' };
    const res = await fetch(`/api/prospects/${id}/sequence`, { method: 'POST' });
    const data = await res.json() as { steps?: FollowUpStep[]; error?: string };
    if (!res.ok) return { error: data.error ?? 'Failed to generate' };
    setProspects((prev) => prev.map((p) =>
      p.business.id === businessId ? { ...p, followUpSequence: data.steps } : p
    ));
    return {};
  }, [dbIdByBizId]);

  const updateSequenceStep = useCallback(async (businessId: string, stepId: string, status: 'sent' | 'skipped') => {
    const id = dbIdByBizId(businessId);
    if (!id) return;
    const res = await fetch(`/api/prospects/${id}/sequence`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepId, status }),
    });
    const data = await res.json() as { steps?: FollowUpStep[] };
    if (res.ok && data.steps) {
      setProspects((prev) => prev.map((p) =>
        p.business.id === businessId ? { ...p, followUpSequence: data.steps } : p
      ));
    }
  }, [dbIdByBizId]);

  const addConversationEntry = useCallback(async (
    businessId: string,
    entry: Omit<ConversationEntry, 'id' | 'timestamp'>,
  ) => {
    const id = dbIdByBizId(businessId);
    if (!id) return;
    const res = await fetch(`/api/prospects/${id}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
    if (res.ok) {
      const full = await res.json() as ConversationEntry;
      setProspects((prev) => prev.map((p) =>
        p.business.id === businessId
          ? { ...p, conversations: [...(p.conversations ?? []), full] }
          : p
      ));
    }
  }, [dbIdByBizId]);

  const markOutreachSent = useCallback(async (
    businessId: string,
    content: string,
    channel: ConversationChannel,
    framework?: string,
  ) => {
    const outreachSentAt = new Date().toISOString();
    // Read current stage from ref to avoid stale closure
    const currentStage = prospectsRef.current.find((p) => p.business.id === businessId)?.stage;
    setProspects((prev) => prev.map((p) => {
      if (p.business.id !== businessId) return p;
      return { ...p, outreachSentAt, stage: p.stage === 'found' ? 'contacted' : p.stage };
    }));
    await Promise.all([
      patch(businessId, {
        outreachSentAt,
        stage: currentStage === 'found' ? 'contacted' : undefined,
      }),
      addConversationEntry(businessId, { type: 'sent', channel, content, framework }),
    ]);
  }, [patch, addConversationEntry]);

  const isSaved = useCallback(
    (id: string) => prospects.some((p) => p.business.id === id),
    [prospects],
  );

  const get = useCallback(
    (id: string) => prospects.find((p) => p.business.id === id),
    [prospects],
  );

  const updateSettings = useCallback(async (s: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...s }));
    await fetch('/api/user/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s),
    });
  }, []);

  const incrementToday = useCallback(async () => {
    const date = todayStr();
    setDailyLogs((prev) => {
      const existing = prev.find((l) => l.date === date);
      return existing
        ? prev.map((l) => l.date === date ? { ...l, count: l.count + 1 } : l)
        : [...prev, { date, count: 1 }];
    });
    await fetch('/api/user/daily-log', { method: 'POST' });
  }, []);

  const todayCount = dailyLogs.find((l) => l.date === todayStr())?.count ?? 0;

  const ctxValue = useMemo(() => ({
    prospects, loading, save, remove, updateStage, updateNotes,
    setReminder, clearReminder, setFollowUpSequence, generateSequence, updateSequenceStep,
    markOutreachSent, addConversationEntry,
    isSaved, get, settings, updateSettings, dailyLogs, incrementToday, todayCount,
  }), [
    prospects, loading, isSaved, get, settings, dailyLogs, todayCount,
    save, remove, updateStage, updateNotes, setReminder, clearReminder,
    setFollowUpSequence, generateSequence, updateSequenceStep,
    markOutreachSent, addConversationEntry, updateSettings, incrementToday,
  ]);

  return (
    <ProspectsContext.Provider value={ctxValue}>
      {children}
    </ProspectsContext.Provider>
  );
}

export function useProspects() {
  const ctx = useContext(ProspectsContext);
  if (!ctx) throw new Error('useProspects must be inside ProspectsProvider');
  return ctx;
}
