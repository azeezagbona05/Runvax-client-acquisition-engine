import { useEffect, useState, useCallback } from 'react';

const KEY = 'wa_last_sent_ms';
export const PACE_SECS = 90;
export const WARN_AT = 70;
export const DANGER_AT = 90;
export const LIMIT = 100;

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
