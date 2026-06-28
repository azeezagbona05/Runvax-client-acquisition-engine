'use client';

import {
  createContext, useCallback, useContext, useEffect, useState, ReactNode,
} from 'react';
import {
  Business, SavedProspect, ProspectStage, AppSettings, DailyLog,
  ConversationEntry, ConversationChannel,
} from '@/types';
import { scoreProspect, estimatePrice } from '@/lib/scoring';

const STORAGE_KEY = 'aip_prospects_v2';
const SETTINGS_KEY = 'aip_settings';
const DAILY_KEY = 'aip_daily_log';

interface Ctx {
  prospects: SavedProspect[];
  save: (business: Business) => void;
  remove: (id: string) => void;
  updateStage: (id: string, stage: ProspectStage) => void;
  updateNotes: (id: string, notes: string) => void;
  setReminder: (id: string, date: string, note: string) => void;
  clearReminder: (id: string) => void;
  markOutreachSent: (id: string, content: string, channel: ConversationChannel, framework?: string) => void;
  addConversationEntry: (id: string, entry: Omit<ConversationEntry, 'id' | 'timestamp'>) => void;
  isSaved: (id: string) => boolean;
  get: (id: string) => SavedProspect | undefined;
  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings>) => void;
  dailyLogs: DailyLog[];
  incrementToday: () => void;
  todayCount: number;
}

const ProspectsContext = createContext<Ctx | null>(null);

function today() { return new Date().toISOString().split('T')[0]; }

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveJSON(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

function makeEntry(partial: Omit<ConversationEntry, 'id' | 'timestamp'>): ConversationEntry {
  return {
    ...partial,
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
  };
}

export function ProspectsProvider({ children }: { children: ReactNode }) {
  const [prospects, setProspects] = useState<SavedProspect[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    dailyGoal: 10, avgDealValue: 300000, closeRatePct: 10,
  });
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);

  useEffect(() => {
    const raw = loadJSON<SavedProspect[]>(STORAGE_KEY, []);
    // migrate old records that don't have conversations array
    const migrated = raw.map((p) => ({ ...p, conversations: p.conversations ?? [] }));
    setProspects(migrated);
    setSettings((prev) => ({ ...prev, ...loadJSON<Partial<AppSettings>>(SETTINGS_KEY, {}) }));
    setDailyLogs(loadJSON<DailyLog[]>(DAILY_KEY, []));
  }, []);

  const mutate = (fn: (prev: SavedProspect[]) => SavedProspect[]) => {
    setProspects((prev) => {
      const updated = fn(prev);
      saveJSON(STORAGE_KEY, updated);
      return updated;
    });
  };

  const save = useCallback((business: Business) => {
    mutate((prev) => {
      if (prev.some((p) => p.business.id === business.id)) return prev;
      return [{
        business,
        stage: 'found',
        savedAt: new Date().toISOString(),
        notes: '',
        score: scoreProspect(business),
        estimatedPrice: estimatePrice(business.category, business.categoryTypes),
        conversations: [],
      }, ...prev];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = useCallback((id: string) => {
    mutate((prev) => prev.filter((p) => p.business.id !== id));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateStage = useCallback((id: string, stage: ProspectStage) => {
    mutate((prev) => prev.map((p) => p.business.id === id ? { ...p, stage } : p));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateNotes = useCallback((id: string, notes: string) => {
    mutate((prev) => prev.map((p) => p.business.id === id ? { ...p, notes } : p));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setReminder = useCallback((id: string, date: string, note: string) => {
    mutate((prev) => prev.map((p) =>
      p.business.id === id ? { ...p, reminderDate: date, reminderNote: note } : p
    ));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearReminder = useCallback((id: string) => {
    mutate((prev) => prev.map((p) =>
      p.business.id === id ? { ...p, reminderDate: undefined, reminderNote: undefined } : p
    ));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markOutreachSent = useCallback((
    id: string,
    content: string,
    channel: ConversationChannel,
    framework?: string,
  ) => {
    mutate((prev) => prev.map((p) => {
      if (p.business.id !== id) return p;
      const entry = makeEntry({ type: 'sent', channel, content, framework });
      return {
        ...p,
        outreachSentAt: new Date().toISOString(),
        stage: p.stage === 'found' ? 'contacted' : p.stage,
        conversations: [...(p.conversations ?? []), entry],
      };
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addConversationEntry = useCallback((
    id: string,
    partial: Omit<ConversationEntry, 'id' | 'timestamp'>,
  ) => {
    mutate((prev) => prev.map((p) => {
      if (p.business.id !== id) return p;
      const entry = makeEntry(partial);
      return { ...p, conversations: [...(p.conversations ?? []), entry] };
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSaved = useCallback(
    (id: string) => prospects.some((p) => p.business.id === id),
    [prospects],
  );

  const get = useCallback(
    (id: string) => prospects.find((p) => p.business.id === id),
    [prospects],
  );

  const updateSettings = useCallback((s: Partial<AppSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...s };
      saveJSON(SETTINGS_KEY, updated);
      return updated;
    });
  }, []);

  const incrementToday = useCallback(() => {
    setDailyLogs((prev) => {
      const date = today();
      const existing = prev.find((l) => l.date === date);
      const updated = existing
        ? prev.map((l) => (l.date === date ? { ...l, count: l.count + 1 } : l))
        : [...prev, { date, count: 1 }];
      saveJSON(DAILY_KEY, updated);
      return updated;
    });
  }, []);

  const todayCount = dailyLogs.find((l) => l.date === today())?.count ?? 0;

  return (
    <ProspectsContext.Provider value={{
      prospects, save, remove, updateStage, updateNotes,
      setReminder, clearReminder, markOutreachSent, addConversationEntry,
      isSaved, get, settings, updateSettings, dailyLogs, incrementToday, todayCount,
    }}>
      {children}
    </ProspectsContext.Provider>
  );
}

export function useProspects() {
  const ctx = useContext(ProspectsContext);
  if (!ctx) throw new Error('useProspects must be inside ProspectsProvider');
  return ctx;
}
