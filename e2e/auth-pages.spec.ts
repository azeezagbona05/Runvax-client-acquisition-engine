import { expect, test } from '@playwright/test';

test.describe('sign in and sign up (signed out)', () => {
  test('the sign-in page has the form and the way to sign up', async ({ page }) => {
    await page.goto('/auth/signin');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create one free' })).toHaveAttribute('href', '/auth/signup');
    await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible();
  });

  test('the password can be shown and hidden', async ({ page }) => {
    await page.goto('/auth/signin');
    const pw = page.getByLabel('Password', { exact: true });
    await expect(pw).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(pw).toHaveAttribute('type', 'text');
  });

  test('sign up asks for matching passwords and the terms before sending anything', async ({ page }) => {
    let registerCalls = 0;
    await page.route('**/api/auth/register', (r) => { registerCalls++; return r.abort(); });
    await page.goto('/auth/signup');
    await page.getByLabel('Full name').fill('Test Person');
    await page.getByLabel('Work email').fill('test.person@example.com');
    await page.getByLabel('Password', { exact: true }).fill('correct-horse-1');
    await page.getByLabel('Confirm password').fill('something-else-2');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Create free account' }).click();
    // Next also has an (empty) route-announcer alert, so pick ours by its text.
    await expect(page.locator('[role="alert"]').filter({ hasText: 'Passwords do not match' })).toBeVisible();
    expect(registerCalls).toBe(0);
  });

  test('no gradients on the brand panel or buttons', async ({ page, isMobile }) => {
    test.skip(!!isMobile, 'the brand panel is desktop only');
    await page.goto('/auth/signin');
    const imgs = await page.evaluate(() => Array.from(document.querySelectorAll('*')).map((e) => getComputedStyle(e).backgroundImage).filter((b) => b.includes('gradient')));
    expect(imgs).toEqual([]);
  });

  test('signed out: Find Prospects offers a free search with sign-in buttons, and the rest of the app asks to sign in', async ({ page }) => {
    await page.addInitScript(() => { try { localStorage.setItem('runvax_welcome_seen', '1'); } catch { /* ignore */ } }); // no first-visit welcome video over the page
    await page.goto('/client-acquisition/find');
    await expect(page.getByRole('heading', { name: 'Find Prospects', level: 1 })).toBeVisible();
    await expect(page.getByText(/Try a free search below, no account needed/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
    await page.goto('/client-acquisition/campaigns');
    await expect(page.getByText('Sign in to start winning clients')).toBeVisible();
  });
});
