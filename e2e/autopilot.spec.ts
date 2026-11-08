import { expect, test, type Page } from '@playwright/test';

// Signed in with a mocked session. The planner endpoint is unavailable, so the built-in planner builds the campaign
// in the browser, and saving is mocked: no account, no AI calls and no database.
const SHOTS = process.env.E2E_SHOTS;

async function signedIn(page: Page) {
  await page.addInitScript(() => { try { localStorage.setItem('runvax_welcome_seen', '1'); localStorage.setItem('pwa_dismissed_at', String(Date.now())); } catch { /* ignore */ } }); // no first-visit welcome video over the page
  await page.route('**/api/auth/session', (r) => r.fulfill({ json: { user: { name: 'Azeez Oladipo', email: 'azeez@example.com', plan: 'pro' }, expires: '2099-01-01T00:00:00.000Z' } }));
  await page.route('**/api/client-acquisition/**', (r) => r.fulfill({ status: 503, json: { error: 'offline in this test' } }));
  await page.route('**/api/outreach-campaigns', (r) => (r.request().method() === 'POST' ? r.fulfill({ status: 201, json: { id: 'c-test', added: null } }) : r.fulfill({ json: { campaigns: [] } })));
}

test('one prompt builds the whole campaign, with the workflow, playbook and a test run', async ({ page, isMobile }) => {
  await signedIn(page);
  await page.goto('/client-acquisition/automation');
  await expect(page.getByRole('tab', { name: 'Let AI build it' })).toHaveAttribute('aria-selected', 'true');
  if (SHOTS && !isMobile) await page.screenshot({ path: `${SHOTS}/1-prompt.png`, fullPage: true });

  await page.getByLabel('What do you want to sell, and to whom?').fill('I want to sell AI agents to dental clinic, visibility, receptionist, follow up and patient reactivation');
  await page.getByRole('button', { name: 'Build my campaign' }).click();
  await expect(page.getByText('Building your client acquisition engine…')).toBeVisible();
  await expect(page.getByText('Offer: AI Agents')).toBeVisible();
  if (SHOTS && !isMobile) { await page.waitForTimeout(2500); await page.screenshot({ path: `${SHOTS}/2-building.png`, fullPage: true }); }

  await expect(page.getByText(/All 7 build steps complete/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('link', { name: /Open campaign/ })).toHaveAttribute('href', '/client-acquisition/campaigns/c-test');
  await expect(page.getByRole('region', { name: 'Main sequence' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Email 2: Follow-up \(opened version\)/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Out-of-office reply/ })).toBeVisible();
  if (SHOTS && !isMobile) { await page.waitForTimeout(2000); await page.screenshot({ path: `${SHOTS}/3-workflow.png`, fullPage: true }); }

  await page.getByRole('tab', { name: 'Reply playbook' }).click();
  await expect(page.getByText(/what made it not a fit/)).toBeVisible();

  await page.getByRole('tab', { name: 'Test & preview' }).click();
  await page.getByRole('button', { name: 'Replies: interested', exact: true }).first().click();
  await page.getByRole('button', { name: 'Run test' }).click();
  await expect(page.getByText(/Follow-ups stop, you are alerted straight away/).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.acq-mail-preview pre').first()).toContainText('Bright Smile Dental');
  if (SHOTS && !isMobile) await page.screenshot({ path: `${SHOTS}/4-test.png`, fullPage: true });

  await page.getByRole('tab', { name: /Import leads/ }).click();
  await expect(page.getByRole('link', { name: 'Find prospects first' })).toBeVisible();

  // No horizontal page scroll on a phone: the canvas scrolls inside its own frame.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('manual building is still one click away', async ({ page }) => {
  await signedIn(page);
  await page.goto('/client-acquisition/automation');
  await page.getByRole('tab', { name: 'I will fill it in' }).click();
  await expect(page.getByRole('heading', { name: 'What are you offering?' })).toBeVisible();
});
