import { expect, test } from '@playwright/test';

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe('Find Prospects (signed in)', () => {
  test.skip(!email || !password, 'set E2E_EMAIL and E2E_PASSWORD (a test account) to run these');

  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/signin');
    await page.getByLabel('Email address').fill(email!);
    await page.getByLabel('Password', { exact: true }).fill(password!);
    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL('**/client-acquisition/find', { timeout: 30_000 });
  });

  test('signing in lands on Find Prospects, first in the menu', async ({ page, isMobile }) => {
    await expect(page.getByRole('heading', { name: 'Find Prospects' })).toBeVisible();
    if (!isMobile) await expect(page.getByRole('link', { name: 'Find Prospects' }).first()).toHaveAttribute('aria-current', 'page');
  });

  test('every country is listed and picking one fills the regions', async ({ page }) => {
    const country = page.getByLabel('1 · Country');
    await expect(country.locator('option')).not.toHaveCount(14, { timeout: 15_000 });
    expect(await country.locator('option').count()).toBeGreaterThan(240);
    await country.selectOption('CA');
    const region = page.getByLabel('2 · State or region');
    await expect(region.locator('option', { hasText: 'Ontario' })).toHaveCount(1);
    await country.selectOption('NG');
    await expect(region.locator('option', { hasText: 'Lagos' })).toHaveCount(1);
  });

  test('the number of businesses is not capped at 100', async ({ page }) => {
    const n = page.getByLabel('How many businesses');
    await n.fill('2500');
    await n.blur();
    await expect(n).toHaveValue('2500');
  });

  test('the Snov tab opens', async ({ page }) => {
    await page.getByRole('tab', { name: 'Discover with Snov' }).click();
    await expect(page.getByRole('heading', { name: 'Discover with Snov' })).toBeVisible();
  });
});
