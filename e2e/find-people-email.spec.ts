import { expect, test, type Page } from '@playwright/test';

// Mocked session and fake search results: no account, no database, no searches used.
const BIZ = [{ id: 'b1', name: 'Acme Restaurant', address: 'Victoria Island, Lagos', phone: '0908 845 1909', website: 'https://acme.example', category: 'Restaurant', rating: 4.4, reviewCount: 442, location: { latitude: 6.43, longitude: 3.42 } }];

async function setup(page: Page) {
  await page.addInitScript(() => { try { localStorage.setItem('runvax_welcome_seen', '1'); localStorage.setItem('pwa_dismissed_at', String(Date.now())); localStorage.setItem('runvax_v2_popup_seen_at', String(Date.now())); } catch { /* ignore */ } });
  await page.route('**/api/auth/session', (r) => r.fulfill({ json: { user: { name: 'Azeez Oladipo', email: 'azeez@example.com', plan: 'pro', emailVerified: '2026-01-01T00:00:00.000Z' }, expires: '2099-01-01T00:00:00.000Z' } }));
  await page.route('**/api/client-acquisition/**', (r) => r.fulfill({ status: 503, json: { error: 'offline in this test' } }));
  await page.route('**/api/search', (r) => r.fulfill({ json: { businesses: BIZ } }));
  await page.route('**/api/client-acquisition/people', (r) => (r.request().method() === 'POST'
    ? r.fulfill({ json: { via: 'fallback', channels: [], people: [
      { name: 'Ada Okafor', title: 'CEO', email: 'ada.okafor@acme.example', emailState: 'unconfirmed', emailBasis: 'published', emailSource: 'https://acme.example/team', match: 'confirmed', linkedin: 'https://ng.linkedin.com/in/ada-okafor' },
      { name: 'Tunde Bello', title: 'Managing Director', email: 'tunde.bello@acme.example', emailState: 'unconfirmed', emailBasis: 'guess', match: 'confirmed' },
      { name: 'Chidi Eze', title: 'Director', match: 'likely' },
    ] } })
    : r.fulfill({ status: 503, json: {} })));
}

test('each email says how we know it: found online counts as ready, a guess does not, and a doubtful match has none', async ({ page }) => {
  test.setTimeout(240_000);
  await setup(page);
  await page.goto('/client-acquisition/find', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#pf-loc')).toBeVisible({ timeout: 120_000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await expect(async () => {
    await page.locator('#pf-loc').click(); await page.locator('#pf-loc').fill('victoria'); await page.getByRole('option').first().click(); await page.keyboard.press('Escape');
    await page.locator('#pf-ind').click(); await page.locator('#pf-ind').fill('restaur'); await page.getByRole('option').first().click(); await page.keyboard.press('Escape');
    await page.getByLabel('How many businesses').fill('1');
    await page.getByRole('button', { name: 'Find prospects' }).click();
    await expect(page.getByText('Acme Restaurant').first()).toBeVisible({ timeout: 5000 });
  }).toPass({ timeout: 90_000, intervals: [1000, 2000, 3000] });

  await page.getByLabel('Find people at Acme Restaurant').selectOption('3');
  const row = page.locator('tr', { hasText: 'Acme Restaurant' });
  await expect(row.getByText('ada.okafor@acme.example')).toBeVisible({ timeout: 30_000 });

  // Labels with the reason on hover.
  const online = row.getByText('Found online', { exact: true });
  const guess = row.getByText('Best guess', { exact: true });
  await expect(online).toBeVisible();
  await expect(guess).toBeVisible();
  await expect(online).toHaveAttribute('title', /appears on a public page.*Seen at https:\/\/acme\.example\/team/);
  await expect(guess).toHaveAttribute('title', /Nothing confirms it/);

  // A published address is shown as ready (green); a guess stays unverified (amber).
  const colour = (loc: ReturnType<typeof row.getByText>) => loc.evaluate((e) => getComputedStyle(e).color);
  expect(await colour(row.getByText('ada.okafor@acme.example'))).toBe('rgb(21, 128, 61)');
  expect(await colour(row.getByText('tunde.bello@acme.example'))).toBe('rgb(180, 83, 9)');

  // A doubtful match has no email at all, never an invented one.
  const doubtful = row.getByText('Chidi Eze').locator('xpath=ancestor::span[1]');
  await expect(doubtful).toContainText('no email yet');
  // The match label is still there.
  await expect(row.getByText('Confirmed').first()).toBeVisible();
});
