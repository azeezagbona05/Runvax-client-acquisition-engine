import { expect, test, type Page } from '@playwright/test';

// Signed in with a mocked session; the built-in planner builds the campaign in the browser. No account, no AI calls, no database.
async function signedIn(page: Page) {
  await page.addInitScript(() => { try { localStorage.setItem('runvax_welcome_seen', '1'); localStorage.setItem('pwa_dismissed_at', String(Date.now())); } catch { /* ignore */ } });
  await page.route('**/api/auth/session', (r) => r.fulfill({ json: { user: { name: 'Azeez Oladipo', email: 'azeez@example.com', plan: 'pro', emailVerified: '2026-01-01T00:00:00.000Z' }, expires: '2099-01-01T00:00:00.000Z' } }));
  await page.route('**/api/client-acquisition/**', (r) => r.fulfill({ status: 503, json: { error: 'offline in this test' } }));
  await page.route('**/api/outreach-campaigns', (r) => (r.request().method() === 'POST' ? r.fulfill({ status: 201, json: { id: 'c-test', added: null } }) : r.fulfill({ json: { campaigns: [] } })));
}

const SHOTS = process.env.E2E_SHOTS;
test('big panels open full screen, close with Esc, and keep what is inside', async ({ page }) => {
  test.setTimeout(300_000);
  await signedIn(page);
  await page.goto('/client-acquisition/automation', { waitUntil: 'domcontentloaded' });
  const box = page.getByLabel('What do you want to sell, and to whom?');
  await expect(box).toBeVisible({ timeout: 120_000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  // Click again until the build starts: the page can show before its scripts have attached.
  await expect(async () => {
    await box.fill('I want to sell AI agents to dental clinics, visibility, receptionist, follow up and patient reactivation');
    await page.getByRole('button', { name: 'Build my campaign' }).click();
    await expect(page.getByText('Building your client acquisition engine…')).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 60_000, intervals: [500, 1000, 2000] });
  await expect(page.getByText(/All 7 build steps complete/)).toBeVisible({ timeout: 60_000 });

  // The sequence workflow fills the whole window.
  await page.getByRole('button', { name: 'Full screen: Sequence workflow' }).click();
  const dlg = page.getByRole('dialog', { name: 'Sequence workflow' });
  await expect(dlg).toBeVisible();
  const vp = page.viewportSize()!;
  const b = (await dlg.boundingBox())!;
  expect(Math.round(b.x)).toBe(0); expect(Math.round(b.y)).toBe(0);
  expect(Math.round(b.width)).toBe(vp.width); expect(Math.round(b.height)).toBe(vp.height);
  await expect(dlg.getByRole('region', { name: 'Main sequence' })).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/fullscreen-${vp.width > 800 ? 'desktop' : 'phone'}.png` });
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');

  // Esc closes it, the page scrolls again, and focus returns to the button.
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  await expect(page.getByRole('button', { name: 'Full screen: Sequence workflow' })).toBeFocused();

  // The other big panels have it too, and the button inside closes it.
  await page.getByRole('tab', { name: /Emails/ }).click();
  await page.getByRole('button', { name: 'Full screen: Emails' }).click();
  await expect(page.getByRole('dialog', { name: 'Emails' })).toBeVisible();
  await page.getByRole('button', { name: 'Exit full screen' }).click();
  await expect(page.getByRole('dialog', { name: 'Emails' })).toBeHidden();
  await page.getByRole('tab', { name: 'Reply playbook' }).click();
  await expect(page.getByRole('button', { name: 'Full screen: Reply playbook' })).toBeVisible();
  await page.getByRole('tab', { name: 'Test & preview' }).click();
  await expect(page.getByRole('button', { name: 'Full screen: Test and preview' })).toBeVisible();
});
