/**
 * "Take me to RUNVAX 2.0 by default": remembered after someone switches once. It is a cookie, so the server can send a
 * signed-in person from the classic home page straight to the new experience, before the classic page is even drawn.
 * It is per browser. Going back to the classic app clears it.
 */
import { DEFAULT_HOME } from './home';

export const V2_COOKIE = 'rv2';
const YEAR = 365 * 24 * 60 * 60;

export function prefersV2(): boolean {
  try { return document.cookie.split('; ').some((c) => c === `${V2_COOKIE}=1`); } catch { return false; }
}

export function setPrefersV2(on: boolean): void {
  try {
    const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${V2_COOKIE}=${on ? '1' : ''}; path=/; max-age=${on ? YEAR : 0}; SameSite=Lax${secure}`;
  } catch { /* the choice is not remembered */ }
}

/** Where the classic home page should send a visitor, or null to show it. Only a signed-in person who chose 2.0 is sent. */
export function homeRedirect(o: { pathname: string; cookie?: string | null; signedIn: boolean }): string | null {
  return o.pathname === '/' && o.cookie === '1' && o.signedIn ? DEFAULT_HOME : null;
}
