import { primeAudio } from './chime';

/** Lets any screen ask for a celebration without knowing how it is drawn. The host in the Client Acquisition shell listens for it. */
export const CELEBRATE_EVENT = 'runvax:celebrate';

export interface CelebrateDetail {
  title: string;
  body?: string;
  /** "win" is the full-screen burst for a real result; "done" is a smaller flourish for finishing a job; "welcome" drops flowers, with a chime. */
  kind?: 'win' | 'done' | 'welcome';
}

export function celebrate(detail: CelebrateDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<CelebrateDetail>(CELEBRATE_EVENT, { detail }));
}

const FIRST_KEY = 'runvax_first_win';
/** True the first time it is called in this browser, so the very first win gets a warmer message. */
export function isFirstWin(): boolean {
  try { if (localStorage.getItem(FIRST_KEY)) return false; localStorage.setItem(FIRST_KEY, '1'); return true; } catch { return false; }
}

// ── Switching to RUNVAX 2.0 ──────────────────────────────────────────────────
const JUST_SWITCHED = 'runvax_just_switched';
const WELCOMED_AT = 'runvax_v2_welcomed_at';
const WELCOME_EVERY_MS = 7 * 24 * 60 * 60 * 1000;

/** Call from the click that switches someone to RUNVAX 2.0: it wakes the audio and leaves a note for the new screen. */
export function markSwitched(): void {
  try { sessionStorage.setItem(JUST_SWITCHED, '1'); } catch { /* the celebration is skipped */ }
  primeAudio();
}

/** True once for each switch, and at most once a week, so going back and forth does not repeat the party. */
export function takeSwitchCelebration(): boolean {
  try {
    if (sessionStorage.getItem(JUST_SWITCHED) !== '1') return false;
    sessionStorage.removeItem(JUST_SWITCHED);
    if (Date.now() - Number(localStorage.getItem(WELCOMED_AT) ?? 0) < WELCOME_EVERY_MS) return false;
    localStorage.setItem(WELCOMED_AT, String(Date.now()));
    return true;
  } catch { return false; }
}
