import { expect, test, type Page } from '@playwright/test';

// Signed in with a mocked session and offline APIs: no account and no database.
const SHOTS = process.env.E2E_SHOTS;
async function setup(page: Page) {
  await page.addInitScript(() => { try { localStorage.setItem('runvax_welcome_seen', '1'); localStorage.setItem('pwa_dismissed_at', String(Date.now())); localStorage.setItem('runvax_v2_popup_seen_at', String(Date.now())); } catch { /* ignore */ } });
  await page.route('**/api/auth/session', (r) => r.fulfill({ json: { user: { name: 'Azeez Oladipo', email: 'azeez@example.com', plan: 'pro', emailVerified: '2026-01-01T00:00:00.000Z' }, expires: '2099-01-01T00:00:00.000Z' } }));
  await page.route('**/api/client-acquisition/**', (r) => r.fulfill({ status: 503, json: { error: 'offline in this test' } }));
}
const cookie = (page: Page) => page.evaluate(() => document.cookie.split('; ').find((c) => c.startsWith('rv2=')) ?? '');

test('on the classic app the switch is big, animated and always on screen', async ({ page, isMobile }) => {
  test.setTimeout(240_000);
  await setup(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const banner = page.locator('.v2n-banner');
  await expect(banner).toBeVisible({ timeout: 120_000 });
  await page.waitForLoadState('networkidle').catch(() => {});

  // Big: a large headline and a large button.
  const cta = banner.getByRole('link', { name: /Switch to RUNVAX 2.0/ });
  const cb = (await cta.boundingBox())!;
  expect(cb.height).toBeGreaterThanOrEqual(48);
  expect(cb.width).toBeGreaterThanOrEqual(isMobile ? 200 : 260);
  expect(await banner.getByText('RUNVAX 2.0 is here.').evaluate((e) => parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(18);
  // Animated.
  expect(await cta.evaluate((e) => getComputedStyle(e).animationName)).not.toBe('none');

  // A floating button stays on screen, even after the banner is put away.
  const pill = page.locator('.v2n-pill');
  await expect(pill).toBeVisible();
  expect(await pill.evaluate((e) => getComputedStyle(e).animationName)).not.toBe('none');
  await banner.getByRole('button', { name: 'Not now' }).click();
  await expect(banner).toBeHidden();
  await expect(pill).toBeVisible();
  const pb = (await pill.boundingBox())!, vp = page.viewportSize()!;
  expect(pb.x).toBeGreaterThanOrEqual(0); expect(pb.x + pb.width).toBeLessThanOrEqual(vp.width + 1);
  expect(pb.y + pb.height).toBeLessThanOrEqual(vp.height);
  expect(pb.height).toBeGreaterThanOrEqual(48);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/v1-switch-${isMobile ? 'phone' : 'desktop'}.png` });
});

test('switching once makes 2.0 the home: the classic home page hands on, and the 2.0 menu has no way back button', async ({ page, isMobile }) => {
  test.setTimeout(240_000);
  await setup(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.v2n-pill')).toBeVisible({ timeout: 120_000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  expect(await cookie(page)).toBe('');

  // The button bobs, so a script cannot wait for it to be still; a person simply clicks it (it also holds still under the pointer).
  await page.locator('.v2n-pill').click({ force: true });
  await page.waitForURL('**/client-acquisition/find', { timeout: 90_000 });
  expect(await cookie(page)).toBe('rv2=1');

  // Back on the classic home page: straight on to 2.0 again.
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForURL('**/client-acquisition/find', { timeout: 90_000 });

  // The 2.0 menu has no "Classic RUNVAX" button any more: it is not in the sidebar, nor behind More on a phone.
  if (isMobile) await page.getByRole('button', { name: /More/ }).click();
  await expect(page.getByRole('button', { name: 'Classic RUNVAX' })).toHaveCount(0);
});

test('the floating button holds still under the pointer', async ({ page }) => {
  test.setTimeout(240_000);
  await setup(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const pill = page.locator('.v2n-pill');
  await expect(pill).toBeVisible({ timeout: 120_000 });
  await pill.hover({ force: true });
  expect(await pill.evaluate((e) => getComputedStyle(e).animationPlayState)).toContain('paused');
});

test('the floating button holds still for people who prefer reduced motion', async ({ page }) => {
  test.setTimeout(240_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const pill = page.locator('.v2n-pill');
  await expect(pill).toBeVisible({ timeout: 120_000 });
  expect(await pill.evaluate((e) => getComputedStyle(e).animationName)).toBe('none');
});
