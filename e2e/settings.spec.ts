import { expect, test, type Page } from '@playwright/test';

// Signed in with a mocked session and settings, so these need no account and touch no database.
const settings = {
  dailyGoal: 10, avgDealValue: 300000, closeRatePct: 10, senderName: 'Azeez Oladipo', businessName: 'Harzot Digital', whatsapp: '08031234567',
  replyEmail: 'hello@harzot.com', city: 'Lagos', tagline: '', jobTitle: '', website: '', smtpHost: 'smtp.gmail.com', smtpPort: 587, smtpUser: 'hello@harzot.com',
  smtpPass: '••••••••', smtpFrom: '', bankName: 'GTBank', bankAccount: '0123456789', bankAcctName: 'Harzot Digital', paymentLink: '',
  waPhoneNumberId: '', waAccessToken: '', waTemplateName: '', wabaId: '', waDisplayPhone: '', waTemplateStatus: '', portfolio: [],
};

async function signedIn(page: Page) {
  await page.route('**/api/auth/session', (r) => r.fulfill({ json: { user: { name: 'Azeez Oladipo', email: 'azeez@example.com', plan: 'pro' }, expires: '2099-01-01T00:00:00.000Z' } }));
  await page.route('**/api/user/settings', (r) => r.fulfill({ json: settings }));
  await page.route('**/api/auth/webauthn/credentials', (r) => r.fulfill({ json: [] }));
  await page.route('**/api/client-acquisition/**', (r) => r.fulfill({ status: 403, json: { error: 'locked' } }));
}

test.describe('Settings inside Client Acquisition (mocked sign-in)', () => {
  test('opens on Profile, shows saved values, and is not behind the campaigns gate', async ({ page }) => {
    await signedIn(page);
    await page.goto('/client-acquisition/settings');
    await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
    await expect(page.getByText('Your Identity', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('e.g. Azeez Oladipo')).toHaveValue('Azeez Oladipo');
  });

  test('sections open from the link, and the address follows', async ({ page }) => {
    await signedIn(page);
    await page.goto('/client-acquisition/settings?tab=email');
    await expect(page.getByText('Custom Email Server')).toBeVisible();
    await expect(page).toHaveURL(/tab=email/);
  });

  test('every section can be reached', async ({ page, isMobile }) => {
    await signedIn(page);
    await page.goto('/client-acquisition/settings');
    const scope = isMobile ? page.getByRole('tablist', { name: 'Settings sections' }) : page.getByRole('navigation', { name: 'Settings sections' });
    for (const [name, text] of [['Email & SMTP', 'Custom Email Server'], ['Rate Card', 'Default Currency'], ['Security', 'Biometric Login'], ['Profile', 'Your Identity']] as const) {
      await (isMobile ? scope.getByRole('tab', { name }) : scope.getByRole('button', { name: new RegExp(`^${name}`) })).click();
      await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
    }
  });

  test('uses the light brand look: no dark panels', async ({ page }) => {
    await signedIn(page);
    await page.goto('/client-acquisition/settings');
    await expect(page.getByText('Your Identity', { exact: true })).toBeVisible();
    const dark = await page.evaluate(() => Array.from(document.querySelectorAll('main *')).filter((e) => {
      const m = getComputedStyle(e).backgroundColor.match(/\d+/g)?.map(Number) ?? [];
      return m.length >= 3 && (m[3] === undefined || m[3] > 0.5) && m[0] < 60 && m[1] < 60 && m[2] < 70;
    }).length);
    expect(dark).toBe(0);
  });

  test('the menu points Settings at this page', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'the sidebar is behind the menu button on a phone');
    await signedIn(page);
    await page.goto('/client-acquisition/settings');
    await expect(page.getByRole('link', { name: 'Settings', exact: true }).first()).toHaveAttribute('href', '/client-acquisition/settings');
  });
});
