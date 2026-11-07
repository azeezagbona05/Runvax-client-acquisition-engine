import { expect, test, type Page } from '@playwright/test';

// Signed in with a mocked session and offline APIs: no account and no database.
const SHOTS = process.env.E2E_SHOTS;
async function signedIn(page: Page) {
  await page.addInitScript(() => { try { localStorage.setItem('runvax_welcome_seen', '1'); localStorage.setItem('pwa_dismissed_at', String(Date.now())); } catch { /* ignore */ } });
  await page.route('**/api/auth/session', (r) => r.fulfill({ json: { user: { name: 'Azeez Oladipo', email: 'azeez@example.com', plan: 'pro', emailVerified: '2026-01-01T00:00:00.000Z' }, expires: '2099-01-01T00:00:00.000Z' } }));
  await page.route('**/api/client-acquisition/templates', (r) => r.fulfill({ json: { mine: [], ready: true } }));
  await page.route('**/api/client-acquisition/**', (r) => r.fulfill({ status: 503, json: { error: 'offline in this test' } }));
}

test('New campaign: pick an industry, pick a campaign, with a short guide behind a button', async ({ page, isMobile }) => {
  test.setTimeout(240_000);
  const name = isMobile ? 'phone' : 'desktop';
  await signedIn(page);
  await page.goto('/client-acquisition/templates', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'What do you sell?' })).toBeVisible({ timeout: 120_000 });
  await page.waitForLoadState('networkidle').catch(() => {});

  // Step 1: just the industries. Plain tiles, no long text.
  const tiles = page.getByRole('group', { name: 'Industries' }).getByRole('button');
  await expect(tiles).toHaveCount(17);
  await expect(tiles.first()).toHaveAccessibleName(/Real Estate|Healthcare/); // the popular ones first
  await expect(page.getByText(/campaign template/)).toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/wizard-${name}-1.png` });

  // The search narrows the tiles.
  await page.getByLabel('Search industries').fill('solar');
  await expect(tiles).toHaveCount(1);
  await page.getByLabel('Search industries').fill('');

  // Step 2: the campaigns for that industry, each one line and one button.
  await page.getByRole('button', { name: 'Solar & Energy' }).click();
  await expect(page.getByRole('heading', { name: 'Solar & Energy' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sales CRM & Quotation Automation' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dental AI Hub – Clinic Outreach' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Use this/ })).toHaveCount(2);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/wizard-${name}-2.png` });

  // The guide: five short pages with Next and Back, not one long scroll.
  await page.getByRole('button', { name: 'Industry guide' }).click();
  const guide = page.getByRole('region', { name: 'Solar & Energy guide' });
  await expect(guide.getByRole('heading', { name: 'Who we contact' })).toBeVisible();
  await expect(guide.getByText('1 of 5')).toBeVisible();
  await guide.getByLabel('Country for job titles').selectOption('US');
  await guide.getByRole('button', { name: 'Next' }).click();
  await expect(guide.getByRole('heading', { name: 'What we look for' })).toBeVisible();
  await guide.getByRole('button', { name: 'Next' }).click();
  await expect(guide.getByRole('heading', { name: 'How we write' })).toBeVisible();
  await guide.getByRole('button', { name: 'Next' }).click();
  await expect(guide.getByRole('heading', { name: 'Messages to copy' })).toBeVisible();
  await guide.getByRole('button', { name: 'WhatsApp introduction' }).click();
  await expect(guide.getByText(/Reply STOP/)).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/wizard-${name}-3.png` });
  await guide.getByRole('button', { name: 'Next' }).click();
  await expect(guide.getByRole('heading', { name: 'How leads are scored' })).toBeVisible();
  await expect(guide.getByText('5 of 5')).toBeVisible();
  await guide.getByRole('button', { name: 'Back' }).click();
  await expect(guide.getByRole('heading', { name: 'Messages to copy' })).toBeVisible();
  await guide.getByRole('button', { name: 'Next' }).click();
  await guide.getByRole('button', { name: 'Choose a campaign' }).click();
  await expect(page.getByRole('heading', { name: 'Sales CRM & Quotation Automation' })).toBeVisible();

  // The preview leads with the emails; everything else is one tap away.
  await page.getByRole('button', { name: 'See the emails' }).first().click();
  const preview = page.getByRole('dialog', { name: /preview/ });
  await expect(preview.getByText('The emails (you can edit them)')).toBeVisible();
  await expect(preview.getByText('Ideal customer')).toBeHidden();
  await preview.getByText('More details').click();
  await expect(preview.getByText('Ideal customer')).toBeVisible();
  await preview.getByRole('button', { name: 'Close', exact: true }).click();

  // Healthcare shows its safeguard up front, and Back returns to all industries.
  await page.getByRole('button', { name: 'All industries' }).click();
  await page.getByRole('button', { name: 'Healthcare & Dental' }).click();
  await expect(page.getByRole('note')).toContainText('patient health information');
  await page.getByRole('button', { name: 'All industries' }).click();

  // The last industry is remembered, so coming back is one tap.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /Continue with Healthcare & Dental/ })).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Solar & Energy' }).click();
  await page.getByRole('button', { name: /Use this/ }).first().click();
  await page.waitForURL(/\/client-acquisition\/automation\?template=solar-/, { timeout: 90_000 });
});
