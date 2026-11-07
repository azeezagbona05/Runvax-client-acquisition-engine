import { expect, test, type Page } from '@playwright/test';

// Signed in with a mocked session and offline APIs: no account and no database.
async function signedIn(page: Page) {
  await page.addInitScript(() => { try { localStorage.setItem('runvax_welcome_seen', '1'); localStorage.setItem('pwa_dismissed_at', String(Date.now())); localStorage.setItem('acq_rail', '1'); } catch { /* ignore */ } });
  await page.route('**/api/auth/session', (r) => r.fulfill({ json: { user: { name: 'Azeez Oladipo', email: 'azeez@example.com', plan: 'pro' }, expires: '2099-01-01T00:00:00.000Z' } }));
  await page.route('**/api/client-acquisition/**', (r) => r.fulfill({ status: 503, json: { error: 'offline in this test' } }));
  await page.route('**/api/outreach-campaigns**', (r) => r.fulfill({ json: { campaigns: [] } }));
}

test('phone: bottom tab bar, no sideways scroll, More opens the full menu', async ({ page, isMobile }) => {
  await signedIn(page);
  await page.goto('/client-acquisition/find');
  const tabs = page.getByRole('navigation', { name: 'Main' });
  if (!isMobile) { await expect(tabs).toBeHidden(); return; }
  await expect(tabs).toBeVisible();
  for (const name of ['Find', 'Leads', 'Campaigns', 'Inbox', 'More']) await expect(tabs.getByText(name, { exact: true })).toBeVisible();
  await expect(tabs.getByRole('link', { name: 'Find' })).toHaveAttribute('aria-current', 'page');
  // Every tab is a comfortable touch target.
  for (const b of await tabs.locator('a, button').all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

  await tabs.getByRole('button', { name: /More/ }).click();
  await expect(page.getByRole('navigation', { name: 'Client Acquisition navigation' }).or(page.getByLabel('Client Acquisition navigation')).getByText('Automation Builder')).toBeVisible();
});
