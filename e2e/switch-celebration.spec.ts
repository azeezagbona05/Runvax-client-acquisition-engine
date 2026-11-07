import { expect, test, type Page } from '@playwright/test';

// Signed in with a mocked session and offline APIs. A fake audio device records the chime, so nothing is really played.
const SHOTS = process.env.E2E_SHOTS;
async function setup(page: Page, o: { seeVideo?: boolean; popup?: boolean } = {}) {
  await page.addInitScript(({ seeVideo, popup }) => {
    // The 2.0 popup is snoozed unless a test wants it, so it does not cover the banner button.
    try { if (!seeVideo) localStorage.setItem('runvax_welcome_seen', '1'); localStorage.setItem('pwa_dismissed_at', String(Date.now())); if (!popup) localStorage.setItem('runvax_v2_popup_seen_at', String(Date.now())); } catch { /* ignore */ }
    const w = window as unknown as { __notes: number; __contexts: number; AudioContext: unknown };
    w.__notes = 0; w.__contexts = 0;
    w.AudioContext = class {
      state = 'running'; currentTime = 0; destination = {};
      constructor() { w.__contexts++; }
      resume() { return Promise.resolve(); }
      createGain() { return { gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
      createOscillator() { return { type: '', frequency: { value: 0 }, connect() {}, start() { w.__notes++; }, stop() {} }; }
    };
  }, { seeVideo: !!o.seeVideo, popup: !!o.popup });
  await page.route('**/api/auth/session', (r) => r.fulfill({ json: { user: { name: 'Azeez Oladipo', email: 'azeez@example.com', plan: 'pro', emailVerified: '2026-01-01T00:00:00.000Z' }, expires: '2099-01-01T00:00:00.000Z' } }));
  await page.route('**/api/client-acquisition/**', (r) => r.fulfill({ status: 503, json: { error: 'offline in this test' } }));
}
const notes = (page: Page) => page.evaluate(() => (window as unknown as { __notes: number }).__notes);

async function switchOver(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const cta = page.locator('.v2n-banner').getByRole('link', { name: /Switch to RUNVAX 2.0/ });
  await expect(cta).toBeVisible({ timeout: 90_000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await cta.click();
  await page.waitForURL('**/client-acquisition/find', { timeout: 90_000 });
}

test('switching to RUNVAX 2.0 congratulates with flowers and a chime, once, and the sound can be muted', async ({ page, isMobile }) => {
  test.setTimeout(240_000);
  await setup(page);
  await switchOver(page);

  const card = page.getByRole('status').filter({ hasText: 'Welcome to the new Experience Centre' });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card).toContainText('Congratulations');
  await expect(card).toContainText('RUNVAX 2.0');
  await expect(page.locator('.acq-flower').first()).toBeVisible();
  expect(await page.locator('.acq-flower').count()).toBeGreaterThanOrEqual(30);
  expect(await page.locator('.acq-flower svg').count()).toBeGreaterThanOrEqual(30);
  await expect.poll(() => notes(page)).toBeGreaterThanOrEqual(8); // the chime played
  expect(await page.evaluate(() => (window as unknown as { __contexts: number }).__contexts)).toBe(1);
  if (SHOTS) { await page.waitForTimeout(1800); await page.screenshot({ path: `${SHOTS}/flowers-${isMobile ? 'phone' : 'desktop'}.png` }); }

  // Mute: the choice is remembered, and the chime does not play for the next celebration.
  await card.getByRole('button', { name: 'Turn the sound off' }).click();
  await expect(card.getByRole('button', { name: 'Turn the sound on' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('runvax_sound'))).toBe('off');
  const before = await notes(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('runvax:celebrate', { detail: { kind: 'welcome', title: 'Again' } })));
  await expect(page.getByRole('status').filter({ hasText: 'Again' })).toBeVisible();
  expect(await notes(page)).toBe(before);

  // Tapping the card closes it.
  await page.getByRole('status').filter({ hasText: 'Again' }).click({ position: { x: 20, y: 20 } });
  await expect(page.getByRole('status').filter({ hasText: 'Again' })).toBeHidden();

  // With 2.0 as the home, the classic home page hands straight on.
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForURL('**/client-acquisition/find', { timeout: 90_000 });

  // Going back to the classic app and switching again within a week is not celebrated again.
  if (isMobile) await page.getByRole('button', { name: /More/ }).click(); // on a phone the menu is behind More
  await page.getByRole('button', { name: 'Classic RUNVAX' }).click();
  await page.waitForURL((u) => u.pathname === '/', { timeout: 90_000 });
  await page.locator('.v2n-banner').getByRole('link', { name: /Switch to RUNVAX 2.0/ }).click({ timeout: 90_000 });
  await page.waitForURL('**/client-acquisition/find');
  await page.waitForTimeout(2500);
  await expect(page.getByText('Welcome to the new Experience Centre')).toHaveCount(0);
});

test('arriving any other way does not celebrate, and the welcome video does not open over the celebration', async ({ page }) => {
  test.setTimeout(240_000);
  await setup(page, { seeVideo: true });
  await page.goto('/client-acquisition/find', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Find Prospects', exact: true })).toBeVisible({ timeout: 90_000 });
  await page.waitForTimeout(3000);
  await expect(page.getByText('Welcome to the new Experience Centre')).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Welcome to RUNVAX' })).toBeVisible(); // a first visit still gets its video

  const second = await page.context().newPage();
  await setup(second, { seeVideo: true });
  await second.addInitScript(() => { try { sessionStorage.setItem('runvax_just_switched', '1'); } catch { /* ignore */ } });
  await second.goto('/client-acquisition/find', { waitUntil: 'domcontentloaded' });
  await expect(second.getByRole('status').filter({ hasText: 'Welcome to the new Experience Centre' })).toBeVisible({ timeout: 90_000 });
  await second.waitForTimeout(2500);
  await expect(second.getByRole('dialog', { name: 'Welcome to RUNVAX' })).toHaveCount(0);
});

test('people who prefer reduced motion get the message and the chime but no falling flowers', async ({ page }) => {
  test.setTimeout(240_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page);
  await switchOver(page);
  await expect(page.getByRole('status').filter({ hasText: 'Welcome to the new Experience Centre' })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.acq-flowers')).toBeHidden();
});

test('the popup\'s own button celebrates too', async ({ page }) => {
  test.setTimeout(240_000);
  await setup(page, { popup: true });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const popup = page.getByRole('dialog', { name: /Meet RUNVAX 2.0/ });
  await expect(popup).toBeVisible({ timeout: 120_000 });
  await popup.getByRole('link', { name: /Switch to RUNVAX 2.0/ }).click();
  await page.waitForURL('**/client-acquisition/find', { timeout: 90_000 });
  await expect(page.getByRole('status').filter({ hasText: 'Welcome to the new Experience Centre' })).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => notes(page)).toBeGreaterThanOrEqual(8);
});
