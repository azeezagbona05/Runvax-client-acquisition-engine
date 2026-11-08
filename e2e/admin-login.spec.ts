import { expect, test, type Page } from '@playwright/test';

// The admin sign-in page with its server calls mocked: no email is sent and no account is touched.
// The app's own service worker (for installing it on a phone) would answer page loads before the mocks can, so it is blocked here.
test.use({ serviceWorkers: 'block' });
async function setup(page: Page, opts: { remembered?: { email: string; bio: boolean } } = {}) {
  await page.addInitScript((r) => { try { localStorage.setItem('runvax_welcome_seen', '1'); if (r) localStorage.setItem('rv_admin', JSON.stringify(r)); } catch { /* ignore */ } }, opts.remembered ?? null);
  await page.route('**/api/auth/session', (r) => r.fulfill({ json: {} })); // signed out
}

test('no username or password: an email, then a 6-digit code', async ({ page }) => {
  test.setTimeout(240_000);
  await setup(page);
  const asked: string[] = []; const tried: string[] = [];
  await page.route('**/api/admin-auth/code', (r) => { asked.push(r.request().postData() ?? ''); return r.fulfill({ json: { ok: true } }); });
  await page.route('**/api/admin-auth/verify', (r) => { const code = JSON.parse(r.request().postData() ?? '{}').code; tried.push(code); return code === '123456' ? r.fulfill({ json: { ok: true, redirectTo: '/admin' } }) : r.fulfill({ status: 400, json: { error: 'That code is wrong or has expired.' } }); });
  await page.route('**/admin', (r) => (r.request().resourceType() === 'document' ? r.fulfill({ contentType: 'text/html', body: '<h1>ADMIN HOME</h1>' }) : r.fallback()));

  await page.goto('/admin/login', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Admin Access' })).toBeVisible({ timeout: 120_000 });
  // Nothing to type a password into, and no username box.
  await expect(page.locator('input[type=password]')).toHaveCount(0);
  await expect(page.getByLabel(/password/i)).toHaveCount(0);
  await expect(page.getByLabel('Admin email')).toBeVisible();

  await page.getByLabel('Admin email').fill('owner@runvax.com');
  await page.getByRole('button', { name: 'Email me a code' }).click();
  await expect(page.getByLabel('6-digit code')).toBeVisible();
  expect(JSON.parse(asked[0])).toEqual({ email: 'owner@runvax.com' });
  await expect(page.getByRole('status')).toContainText('a 6-digit code is on its way');
  await expect(page.getByRole('button', { name: /Send again in \d+s/ })).toBeDisabled(); // no flooding the inbox

  // A wrong code is refused with a plain message; the right one goes to the admin area.
  await page.getByLabel('6-digit code').fill('000000');
  await expect(page.getByRole('alert').filter({ hasText: 'wrong or has expired' })).toBeVisible();
  await page.getByLabel('6-digit code').fill('123456');
  await expect(page.getByRole('heading', { name: 'ADMIN HOME' })).toBeVisible({ timeout: 20_000 });
  expect(tried).toEqual(['000000', '123456']);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('rv_admin') || '{}'))).toEqual({ email: 'owner@runvax.com', bio: false }); // remembers the address only, never a code
});

test('a device with biometric opens on biometric, and the email code is one click away for a new device', async ({ page }) => {
  test.setTimeout(240_000);
  await setup(page, { remembered: { email: 'owner@runvax.com', bio: true } });
  let bioCalls = 0;
  await page.route('**/api/admin-auth/biometric**', (r) => { bioCalls++; return r.fulfill({ status: 404, json: { error: 'Biometric is not set up for this account on this device. Use an email code instead.' } }); });
  await page.goto('/admin/login', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('owner@runvax.com')).toBeVisible({ timeout: 120_000 });
  await expect(page.getByRole('button', { name: /Use biometric/ })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'Use an email code instead' })).toBeVisible(); // it tried straight away, and says what to do when it cannot
  expect(bioCalls).toBeGreaterThan(0);
  await expect(page.locator('input[type=password]')).toHaveCount(0);

  await page.getByRole('button', { name: /Use an email code instead/ }).click();
  await expect(page.getByLabel('Admin email')).toHaveValue('owner@runvax.com');
  await expect(page.getByRole('button', { name: 'Email me a code' })).toBeEnabled();
  await page.getByRole('button', { name: 'Use biometric instead' }).click();
  await expect(page.getByRole('button', { name: /Use biometric/ })).toBeVisible();
});

test('"Not you?" forgets the remembered address', async ({ page }) => {
  test.setTimeout(240_000);
  await setup(page, { remembered: { email: 'owner@runvax.com', bio: true } });
  await page.route('**/api/admin-auth/biometric**', (r) => r.fulfill({ status: 404, json: { error: 'No biometric here.' } }));
  await page.goto('/admin/login', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Not you?' }).click({ timeout: 120_000 });
  await expect(page.getByLabel('Admin email')).toHaveValue('');
  expect(await page.evaluate(() => localStorage.getItem('rv_admin'))).toBe('{}');
});
