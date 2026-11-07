import { expect, test } from '@playwright/test';

// The server-side part of "switch once, land in RUNVAX 2.0": needs a real sign-in (E2E_EMAIL / E2E_PASSWORD, a test account on a
// disposable database), because the redirect checks the real session cookie. Run against a local server with E2E_BASE_URL.
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe('the classic home page and the RUNVAX 2.0 choice (server side)', () => {
  test.skip(!email || !password, 'set E2E_EMAIL and E2E_PASSWORD (a test account) to run these');

  test('signed in with the choice made, the server redirects before the classic page is sent; otherwise it does not', async ({ page, context, baseURL }) => {
    test.setTimeout(240_000);
    const host = new URL(baseURL!).hostname;
    // Signed out, even with the choice cookie: the classic home page is shown, not a redirect.
    await context.addCookies([{ name: 'rv2', value: '1', domain: host, path: '/' }]);
    const out = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(out!.request().redirectedFrom()).toBeNull();
    expect(new URL(page.url()).pathname).toBe('/');
    await context.clearCookies();

    // Sign in (no choice yet): the classic home page is not redirected.
    await page.goto('/auth/signin');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password', { exact: true }).fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL('**/client-acquisition/find', { timeout: 120_000 });
    await page.addInitScript(() => { try { localStorage.setItem('runvax_welcome_seen', '1'); localStorage.setItem('runvax_v2_popup_seen_at', String(Date.now())); } catch { /* ignore */ } });
    const plain = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(plain!.request().redirectedFrom()).toBeNull();
    expect(new URL(page.url()).pathname).toBe('/');

    // With the choice made: the server answers the request for "/" with a redirect to Find Prospects.
    await context.addCookies([{ name: 'rv2', value: '1', domain: host, path: '/' }]);
    const sent = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(sent!.request().redirectedFrom()?.url()).toMatch(/\/$/);
    expect(new URL(page.url()).pathname).toBe('/client-acquisition/find');

    // Other classic pages are left alone.
    await page.goto('/terms', { waitUntil: 'domcontentloaded' });
    expect(new URL(page.url()).pathname).toBe('/terms');
  });
});
