// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

// Where does a person land after signing in? (Home, unless a safe same-site "next" was asked for.)
const nav = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), search: new URLSearchParams() }));
const auth = vi.hoisted(() => ({ signIn: vi.fn(async () => ({ ok: true, error: null })) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: nav.push, refresh: nav.refresh, replace: vi.fn() }), useSearchParams: () => nav.search, usePathname: () => '/auth/signin' }));
vi.mock('next-auth/react', () => ({ signIn: auth.signIn, getProviders: vi.fn(async () => ({ google: { id: 'google', name: 'Google' } })), useSession: () => ({ status: 'unauthenticated', data: null }) }));

import SignInPage from '@/app/auth/signin/page';
import { DEFAULT_HOME, LANDING_HOME } from '@/lib/home';

beforeEach(() => { nav.push.mockClear(); nav.refresh.mockClear(); auth.signIn.mockClear(); nav.search = new URLSearchParams(); });
afterEach(() => cleanup());

async function logIn() {
  render(<SignInPage />);
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'ada@example.com' } });
  fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'secret-pass' } });
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
  await waitFor(() => expect(nav.push).toHaveBeenCalled());
  return nav.push.mock.calls[0][0] as string;
}

describe('where signing in lands', () => {
  it('the constants: Home is the landing, Find Prospects stays its own page', () => { expect(LANDING_HOME).toBe('/client-acquisition'); expect(DEFAULT_HOME).toBe('/client-acquisition/find'); });
  it('password sign-in with nothing asked for lands on Home', async () => { expect(await logIn()).toBe('/client-acquisition'); });
  it('a safe same-site "next" is still honoured (e.g. the free-trial link)', async () => { nav.search = new URLSearchParams({ next: '/claim-pro' }); expect(await logIn()).toBe('/claim-pro'); });
  it('an unsafe "next" (another site, or protocol-relative) is ignored: Home', async () => {
    nav.search = new URLSearchParams({ next: 'https://evil.example/phish' }); expect(await logIn()).toBe('/client-acquisition'); cleanup(); nav.push.mockClear();
    nav.search = new URLSearchParams({ next: '//evil.example' }); expect(await logIn()).toBe('/client-acquisition');
  });
  it('Google sign-in also returns to Home by default', async () => {
    render(<SignInPage />); fireEvent.click(await screen.findByRole('button', { name: /continue with google/i }));
    await waitFor(() => expect(auth.signIn).toHaveBeenCalledWith('google', { callbackUrl: '/client-acquisition' }));
  });
});
