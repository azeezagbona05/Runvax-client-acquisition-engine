import { expect, test, type Page } from '@playwright/test';

// Signed in with a mocked session and offline APIs: no account and no database.
async function signedIn(page: Page) {
  await page.addInitScript(() => { try { localStorage.setItem('runvax_welcome_seen', '1'); localStorage.setItem('pwa_dismissed_at', String(Date.now())); } catch { /* ignore */ } });
  await page.route('**/api/auth/session', (r) => r.fulfill({ json: { user: { name: 'Azeez Oladipo', email: 'azeez@example.com', plan: 'pro', emailVerified: '2026-01-01T00:00:00.000Z' }, expires: '2099-01-01T00:00:00.000Z' } }));
  await page.route('**/api/client-acquisition/**', (r) => r.fulfill({ status: 503, json: { error: 'offline in this test' } }));
}
const fire = (page: Page, detail: object) => page.evaluate((d) => window.dispatchEvent(new CustomEvent('runvax:celebrate', { detail: d })), detail);
// The page can show its heading before its scripts have attached (nothing is listening yet), so fire again until the card is up.
async function fireUntil(page: Page, detail: object, shown: () => Promise<void>) {
  await expect(async () => { await fire(page, detail); await shown(); }).toPass({ timeout: 30_000, intervals: [500, 1000, 2000] });
}
async function ready(page: Page) {
  await signedIn(page);
  await page.goto('/client-acquisition/find', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Find Prospects', exact: true })).toBeVisible({ timeout: 60_000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
}

test('a win shows the message card with confetti, and a tap dismisses it', async ({ page }) => {
  test.setTimeout(120_000);
  await ready(page);
  const card = page.getByRole('status').filter({ hasText: 'You just won a client!' });
  await fireUntil(page, { title: 'You just won a client!', body: 'Bright Smile Dental is now a customer. Well done.' }, () => expect(card).toBeVisible({ timeout: 1500 }));
  await expect(card).toContainText('Bright Smile Dental');
  expect(await page.locator('.acq-confetti i').count()).toBeGreaterThan(50);
  await card.click();
  await expect(card).toBeHidden();
});

test('a finished job gets a smaller burst, and nothing shows for an empty title', async ({ page }) => {
  test.setTimeout(120_000);
  await ready(page);
  await fire(page, { title: '' });
  await expect(page.locator('.acq-celebrate')).toHaveCount(0);
  const done = page.getByRole('status').filter({ hasText: 'engine is ready' });
  await fireUntil(page, { kind: 'done', title: 'Your acquisition engine is ready' }, () => expect(done).toBeVisible({ timeout: 1500 }));
  const n = await page.locator('.acq-confetti i').count();
  expect(n).toBeGreaterThan(10); expect(n).toBeLessThan(60);
});

test('people who prefer reduced motion get the message but no confetti', async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  const card = page.getByRole('status').filter({ hasText: 'won a client' });
  await fireUntil(page, { title: 'You just won a client!' }, () => expect(card).toBeVisible({ timeout: 1500 }));
  await expect(page.locator('.acq-confetti')).toBeHidden();
});
