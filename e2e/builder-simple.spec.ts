import { expect, test, type Page } from '@playwright/test';

// Signed in with a mocked session and offline APIs (the built-in planner answers): no account and no database.
const SHOTS = process.env.E2E_SHOTS;
async function signedIn(page: Page) {
  await page.addInitScript(() => { try { localStorage.setItem('runvax_welcome_seen', '1'); localStorage.setItem('pwa_dismissed_at', String(Date.now())); } catch { /* ignore */ } });
  await page.route('**/api/auth/session', (r) => r.fulfill({ json: { user: { name: 'Azeez Oladipo', email: 'azeez@example.com', plan: 'pro', emailVerified: '2026-01-01T00:00:00.000Z' }, expires: '2099-01-01T00:00:00.000Z' } }));
  await page.route('**/api/client-acquisition/**', (r) => r.fulfill({ status: 503, json: { error: 'offline in this test' } }));
  await page.route('**/api/outreach-campaigns**', (r) => r.fulfill({ json: { campaigns: [] } }));
}

test('the campaign builder is calm: a few questions, one next step, AI help only when asked', async ({ page, isMobile }) => {
  test.setTimeout(240_000);
  const name = isMobile ? 'phone' : 'desktop';
  await signedIn(page);
  await page.goto('/client-acquisition/automation?template=real-estate-website', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Build a campaign' })).toBeVisible({ timeout: 120_000 });
  await page.waitForLoadState('networkidle').catch(() => {});

  // One short title, one step indicator, four questions, one button.
  await expect(page.getByText('Step 1 of 4')).toBeVisible();
  const setup = page.getByRole('region', { name: 'Guided campaign setup' });
  await expect(setup.locator('input:visible, textarea:visible')).toHaveCount(4);
  await expect(setup.getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/builder-${name}-1.png` });

  // Nothing that was crowding the page is there until asked for.
  await expect(page.getByText('Campaign Setup Agent')).toHaveCount(0);
  await expect(page.getByText('Campaign Summary')).toHaveCount(0);
  await expect(page.getByText('Let AI set it up for you')).toHaveCount(0);

  // The rest is one tap away.
  await expect(page.getByLabel('Desired conversion action')).toBeHidden();
  await setup.getByText('More options').click();
  await expect(page.getByLabel('Desired conversion action')).toBeVisible();

  // AI help on request.
  await page.getByRole('button', { name: 'Ask AI for help' }).click();
  await expect(page.getByText('Campaign Setup Agent')).toBeVisible();
  await page.getByRole('button', { name: 'Hide AI help' }).click();
  await expect(page.getByText('Campaign Setup Agent')).toHaveCount(0);

  // Next builds the campaign and moves on to step 2.
  await page.getByLabel('Product or service name').or(page.locator('#gs-offer')).fill('Harzo Property Sites');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Step 2 of 4')).toBeVisible({ timeout: 60_000 });
});

test('without a template it asks three things', async ({ page }) => {
  test.setTimeout(240_000);
  await signedIn(page);
  await page.goto('/client-acquisition/automation', { waitUntil: 'domcontentloaded' });
  const setup = page.getByRole('region', { name: 'Campaign setup', exact: true });
  // The tab can be clicked before the page's scripts have attached, so click again until the form is up.
  await expect(async () => {
    await page.getByRole('tab', { name: 'I will fill it in' }).click();
    await expect(setup.getByRole('heading', { name: 'What are you offering?' })).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 60_000, intervals: [500, 1000, 2000] });
  await expect(setup.locator('input:visible, textarea:visible, select:visible')).toHaveCount(3);
  await setup.getByText('More options').click();
  await expect(setup.getByLabel('Main objective')).toBeVisible();
});
