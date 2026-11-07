/** Lets any screen ask for a celebration without knowing how it is drawn. The host in the Client Acquisition shell listens for it. */
export const CELEBRATE_EVENT = 'runvax:celebrate';

export interface CelebrateDetail {
  title: string;
  body?: string;
  /** "win" is the full-screen burst for a real result; "done" is a smaller flourish for finishing a job. */
  kind?: 'win' | 'done';
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
