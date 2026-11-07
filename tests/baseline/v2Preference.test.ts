import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { homeRedirect, prefersV2, setPrefersV2 } from '@/lib/v2Preference';
import { markSwitched } from '@/lib/celebrate';

/** A tiny cookie jar that behaves like document.cookie for the parts the code uses. */
function jar() {
  const store = new Map<string, string>();
  return {
    get cookie() { return Array.from(store).map(([k, v]) => `${k}=${v}`).join('; '); },
    set cookie(line: string) {
      const [pair, ...attrs] = line.split(';').map((x) => x.trim());
      const [k, v = ''] = pair.split('=');
      const age = attrs.find((a) => a.startsWith('max-age='));
      if (age && Number(age.split('=')[1]) <= 0) store.delete(k); else store.set(k, v);
      last = line;
    },
  };
}
let last = '';
beforeEach(() => { last = ''; vi.stubGlobal('document', jar()); vi.stubGlobal('location', { protocol: 'https:' }); vi.stubGlobal('sessionStorage', { getItem: () => null, setItem() {}, removeItem() {} }); vi.stubGlobal('localStorage', { getItem: () => null, setItem() {}, removeItem() {} }); vi.stubGlobal('window', {}); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('remembering that someone chose RUNVAX 2.0', () => {
  it('starts off, turns on for a year, and turns off again', () => {
    expect(prefersV2()).toBe(false);
    setPrefersV2(true);
    expect(prefersV2()).toBe(true);
    expect(last).toMatch(/rv2=1; path=\/; max-age=31536000; SameSite=Lax; Secure/);
    setPrefersV2(false);
    expect(prefersV2()).toBe(false);
  });
  it('switching through the button is what turns it on', () => {
    expect(prefersV2()).toBe(false);
    markSwitched();
    expect(prefersV2()).toBe(true);
  });
  it('does not mark the cookie Secure on plain http (local development)', () => {
    vi.stubGlobal('location', { protocol: 'http:' });
    setPrefersV2(true);
    expect(last).not.toMatch(/Secure/);
  });
});

describe('where the classic home page sends someone', () => {
  it('a signed-in person who chose 2.0 goes to Find Prospects', () => {
    expect(homeRedirect({ pathname: '/', cookie: '1', signedIn: true })).toBe('/client-acquisition/find');
  });
  it('nobody else is moved: not signed out, not without the choice, not on other pages', () => {
    expect(homeRedirect({ pathname: '/', cookie: '1', signedIn: false })).toBeNull();
    expect(homeRedirect({ pathname: '/', cookie: null, signedIn: true })).toBeNull();
    expect(homeRedirect({ pathname: '/', cookie: '', signedIn: true })).toBeNull();
    expect(homeRedirect({ pathname: '/pricing', cookie: '1', signedIn: true })).toBeNull();
    expect(homeRedirect({ pathname: '/dashboard', cookie: '1', signedIn: true })).toBeNull();
  });
});
