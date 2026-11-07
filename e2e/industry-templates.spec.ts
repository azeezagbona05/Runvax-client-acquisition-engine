import { expect, test, type Page } from '@playwright/test';

// Signed in with a mocked session and offline APIs: no account and no database.
const SHOTS = process.env.E2E_SHOTS;
async function signedIn(page: Page) {
  await page.addInitScript(() => { try { localStorage.setItem('runvax_welcome_seen', '1'); localStorage.setItem('pwa_dismissed_at', String(Date.now())); } catch { /* ignore */ } });
  await page.route('**/api/auth/session', (r) => r.fulfill({ json: { user: { name: 'Azeez Oladipo', email: 'azeez@example.com', plan: 'pro', emailVerified: '2026-01-01T00:00:00.000Z' }, expires: '2099-01-01T00:00:00.000Z' } }));
  await page.route('**/api/client-acquisition/templates', (r) => r.fulfill({ json: { mine: [], ready: true } }));
  await page.route('**/api/client-acquisition/**', (r) => r.fulfill({ status: 503, json: { error: 'offline in this test' } }));
}

test('"What do you sell?": 17 industries, an intelligence panel, drafts, and a template to start from', async ({ page, isMobile }) => {
  test.setTimeout(180_000);
  await signedIn(page);
  await page.goto('/client-acquisition/templates', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'What do you sell?' })).toBeVisible({ timeout: 90_000 });
  await page.waitForLoadState('networkidle').catch(() => {});

  // All 17 industries, in four groups, with their template counts.
  const picks = page.locator('button[aria-pressed]').filter({ hasText: /campaign template/ });
  await expect(picks).toHaveCount(17);
  await expect(page.getByRole('group', { name: 'Professional services' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Real Estate/ }).filter({ hasText: 'High priority' })).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/templates-${isMobile ? 'phone' : 'desktop'}-1.png`, fullPage: false });

  // Choosing one filters the templates and opens that industry's intelligence.
  await page.getByRole('button', { name: /Solar & Energy/ }).click();
  const panel = page.getByRole('region', { name: 'Solar & Energy intelligence' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText('Installation company discovery')).toBeVisible();
  await expect(panel.getByText('Planned').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sales CRM & Quotation Automation' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dental AI Hub – Clinic Outreach' })).toHaveCount(0);

  // Decision-makers, with the local names for the chosen country.
  await panel.getByRole('tab', { name: 'Who to approach' }).click();
  await expect(panel.getByText('Sales Director')).toBeVisible();
  await panel.getByLabel('Country for job titles').selectOption('US');
  await expect(panel.getByText('Also look for in this country')).toBeVisible();

  // Offers, approach and compliance.
  await panel.getByRole('tab', { name: 'Offers and approach' }).click();
  await expect(panel.getByText('Quotation automation')).toBeVisible();
  await expect(panel.getByText(/not legal advice/)).toBeVisible();

  // The six outreach drafts, each with an opt-out where it contacts someone.
  await panel.getByRole('tab', { name: 'Outreach drafts' }).click();
  for (const c of ['Cold email', 'LinkedIn connection', 'LinkedIn follow-up', 'WhatsApp introduction', 'Follow-up email', 'Meeting invitation']) await expect(panel.getByText(new RegExp(`^${c}`)).first()).toBeVisible();
  await expect(panel.getByText(/of 300 characters/)).toBeVisible();

  // How leads are scored.
  await panel.getByRole('tab', { name: 'How leads are scored' }).click();
  await expect(panel.getByText('Identified business opportunity')).toBeVisible();
  await expect(panel.getByText(/Priority A: high potential/)).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/templates-${isMobile ? 'phone' : 'desktop'}-2.png`, fullPage: false });

  // Healthcare shows its patient-information safeguard up front.
  await page.getByRole('button', { name: /Healthcare & Dental/ }).click();
  await expect(page.getByRole('region', { name: 'Healthcare & Dental intelligence' }).getByRole('note')).toContainText('patient health information');

  // Using a template starts a campaign from it.
  await page.getByRole('button', { name: /Solar & Energy/ }).click();
  await page.getByRole('button', { name: 'Use Template' }).first().click();
  await page.waitForURL(/\/client-acquisition\/automation\?template=solar-/, { timeout: 60_000 });
});
