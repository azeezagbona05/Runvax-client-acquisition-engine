import { expect, test, type Page } from '@playwright/test';

// Signed in with a mocked session, and Google Maps search mocked: no account, no searches used and no database.
const SHOTS = process.env.E2E_SHOTS;

async function signedIn(page: Page, queries: string[]) {
  await page.route('**/api/auth/session', (r) => r.fulfill({ json: { user: { name: 'Azeez Oladipo', email: 'azeez@example.com', plan: 'pro' }, expires: '2099-01-01T00:00:00.000Z' } }));
  await page.route('**/api/client-acquisition/**', (r) => r.fulfill({ status: 503, json: { error: 'offline in this test' } }));
  await page.route('**/api/outreach-campaigns**', (r) => r.fulfill({ json: { campaigns: [] } }));
  await page.route('**/api/search', async (r) => {
    const body = r.request().postDataJSON() as { query: string };
    queries.push(body.query);
    const n = queries.length;
    await r.fulfill({ json: { businesses: [{ id: `b${n}`, name: `${body.query} business`, address: 'Somewhere', location: { latitude: 6.45, longitude: 3.47 } }] } });
  });
}

test('country, region, locations and categories are search selects; several of each search every pair', async ({ page }) => {
  const queries: string[] = [];
  await signedIn(page, queries);
  await page.goto('/client-acquisition/find');

  // Country: type to filter all countries, pick one.
  const country = page.getByRole('combobox', { name: '1 · Country' });
  await country.click();
  await expect(page.getByRole('option')).not.toHaveCount(12, { timeout: 15_000 });
  expect(await page.getByRole('option').count()).toBeGreaterThan(240);
  await country.fill('cana');
  await page.getByRole('option', { name: 'Canada' }).click();
  await expect(country).toHaveValue('Canada');

  const region = page.getByRole('combobox', { name: '2 · State or region' });
  await expect(region).toBeEnabled();
  await region.fill('onta');
  await page.getByRole('option', { name: 'Ontario' }).click();
  await expect(region).toHaveValue('Ontario');

  // Back to Nigeria for the multi-select checks.
  await country.click(); await country.fill('niger');
  await page.getByRole('option', { name: 'Nigeria', exact: true }).click();

  const loc = page.getByRole('combobox', { name: '3 · Locations' });
  await loc.click(); await loc.fill('lekki');
  await page.getByRole('option', { name: 'Lekki Phase 1', exact: true }).click();
  await loc.fill('My Own Street');
  await page.getByRole('option', { name: 'Add "My Own Street" as a location' }).click();

  const ind = page.getByRole('combobox', { name: '4 · Business categories' });
  await ind.click(); await ind.fill('dent');
  await page.getByRole('option', { name: 'Dental Clinics' }).click();
  await ind.fill('law');
  await page.getByRole('option', { name: 'Law Firms' }).click();
  await page.keyboard.press('Escape');

  await expect(page.getByRole('button', { name: 'Remove Dental Clinics' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove My Own Street' })).toBeVisible();
  await expect(page.getByText(/2 categories × 2 locations/)).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/find-form-${test.info().project.name}.png`, fullPage: false });

  await page.getByLabel('How many businesses').fill('4');
  await page.getByRole('button', { name: 'Find prospects' }).click();
  await expect.poll(() => queries.length, { timeout: 15_000 }).toBeGreaterThanOrEqual(4);
  expect(queries.slice(0, 4)).toEqual(['Dental Clinics in Lekki Phase 1', 'Law Firms in Lekki Phase 1', 'Dental Clinics in My Own Street', 'Law Firms in My Own Street']);
  await expect(page.getByText('Law Firms in My Own Street business')).toBeVisible();

  // Removing a chip works.
  await page.getByRole('button', { name: 'Remove Law Firms' }).click();
  await expect(page.getByRole('button', { name: 'Remove Law Firms' })).toHaveCount(0);
  const w = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(w[0]).toBeLessThanOrEqual(w[1] + 1);
});
