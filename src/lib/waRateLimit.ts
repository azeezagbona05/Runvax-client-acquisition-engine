import { useEffect, useState, useCallback } from 'react';

const KEY = 'wa_last_sent_ms';
export const PACE_SECS = 90;
export const WARN_AT = 70;
export const DANGER_AT = 90;
/** Absolute ceiling. The warm-up ramp keeps the effective cap well below this
 *  for most users — see dailyCapFor(). */
export const LIMIT = 100;

// ── Warm-up ramp ─────────────────────────────────────────────────────────────
//
// A brand-new WhatsApp number sending at full volume on day one is the single
// most recognisable spam pattern there is. Trust builds with consistent, modest
// activity over time, so the daily cap starts low and opens up as the user
// establishes a sending history.
//
// Keyed on days the user has ACTUALLY sent, not calendar age: someone who sent
// once two months ago and then went quiet has not warmed anything up, and the
// dormant-then-blast pattern is exactly what gets numbers banned.

export const WARMUP_STEPS: Array<{ throughDay: number; cap: number }> = [
  { throughDay: 3, cap: 5 },
  { throughDay: 7, cap: 10 },
  { throughDay: 14, cap: 20 },
  { throughDay: 30, cap: 30 },
  { throughDay: Infinity, cap: 50 },
];

/** Daily send cap for a user with this many active sending days behind them. */
export function dailyCapFor(activeDays: number): number {
  const step = WARMUP_STEPS.find((s) => activeDays <= s.throughDay) ?? WARMUP_STEPS[WARMUP_STEPS.length - 1];
  return Math.min(step.cap, LIMIT);
}

/** Days until the cap increases, and what it becomes. Null once fully warmed. */
export function nextWarmupStep(activeDays: number): { inDays: number; cap: number } | null {
  const idx = WARMUP_STEPS.findIndex((s) => activeDays <= s.throughDay);
  if (idx < 0 || idx >= WARMUP_STEPS.length - 1) return null;
  const current = WARMUP_STEPS[idx];
  return { inDays: Math.max(1, current.throughDay - activeDays + 1), cap: WARMUP_STEPS[idx + 1].cap };
}

/** Number of distinct days on which the user actually sent something. */
export function activeSendingDays(logs: Array<{ count: number }>): number {
  return logs.filter((l) => l.count > 0).length;
}

// ── Reply health ─────────────────────────────────────────────────────────────
//
// A collapsing reply rate is the earliest warning that messages are being
// ignored or reported — it shows up well before WhatsApp restricts a number.
//
// IMPORTANT: replies are logged BY HAND (a user pastes them into the prospect
// modal), so a zero here usually means "didn't bother logging", not "nobody
// replied". That is why this never blocks sending — it prompts, and a false
// alarm costs the user nothing but a glance.

export type ReplyLevel = 'unknown' | 'ok' | 'low';

/** Below this many sends there isn't enough signal to say anything useful. */
export const REPLY_MIN_SENDS = 20;
/** Reply rate under this (once there's enough volume) is worth flagging. */
export const REPLY_LOW_PCT = 5;

export function replyHealth(sent: number, received: number): {
  level: ReplyLevel;
  rate: number;
  message?: string;
} {
  const rate = sent > 0 ? (received / sent) * 100 : 0;
  if (sent < REPLY_MIN_SENDS) return { level: 'unknown', rate };
  if (received === 0) {
    return {
      level: 'low',
      rate,
      message: `${sent} sent, no replies logged. If people are replying, log them so Runvax can track what works — if they aren't, change your opener before sending more.`,
    };
  }
  if (rate < REPLY_LOW_PCT) {
    return {
      level: 'low',
      rate,
      message: `Reply rate is ${rate.toFixed(1)}%. Low replies often mean the opener isn't landing — worth changing your angle before increasing volume.`,
    };
  }
  return { level: 'ok', rate };
}

export function useWaPaceTimer() {
  const [waitSecs, setWaitSecs] = useState(0);

  const tick = useCallback(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) { setWaitSecs(0); return; }
      const elapsed = Math.floor((Date.now() - parseInt(raw, 10)) / 1000);
      setWaitSecs(Math.max(0, PACE_SECS - elapsed));
    } catch { setWaitSecs(0); }
  }, []);

  useEffect(() => {
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [tick]);

  const recordSend = useCallback(() => {
    try { localStorage.setItem(KEY, Date.now().toString()); } catch { /* ignore */ }
    setWaitSecs(PACE_SECS);
  }, []);

  return { waitSecs, recordSend };
}
