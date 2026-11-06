import { expect, test } from '@playwright/test';

// Signed out, no account and no database needed: the welcome video opens once on a first visit.
test('first visit shows the welcome video once, and skipping remembers it', async ({ page }) => {
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'Welcome to RUNVAX' });
  await expect(dialog).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Play the welcome video' }).click();
  const v = dialog.locator('video');
  await expect.poll(() => v.evaluate((el: HTMLVideoElement) => el.readyState), { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
  expect(await v.evaluate((el: HTMLVideoElement) => el.duration)).toBeGreaterThan(400);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.reload();
  await page.waitForTimeout(2500);
  await expect(dialog).toBeHidden();
});

test('marketing pages never open it', async ({ page }) => {
  await page.goto('/terms');
  await page.waitForTimeout(2500);
  await expect(page.getByRole('dialog', { name: 'Welcome to RUNVAX' })).toHaveCount(0);
});
