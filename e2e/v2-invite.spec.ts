import { expect, test, type Page } from '@playwright/test';

// Signed in with a mocked session: no account and no database.
async function signedIn(page: Page) {
  await page.addInitScript(() => { try { localStorage.setItem('runvax_welcome_seen', '1'); localStorage.setItem('pwa_dismissed_at', String(Date.now())); } catch { /* ignore */ } });
  await page.route('**/api/auth/session', (r) => r.fulfill({ json: { user: { name: 'Azeez Oladipo', email: 'azeez@example.com', plan: 'pro', emailVerified: '2026-01-01T00:00:00.000Z' }, expires: '2099-01-01T00:00:00.000Z' } }));
}

test('the RUNVAX 2.0 invite: animated banner, then a popup that can be snoozed', async ({ page }) => {
  test.setTimeout(150_000);
  await signedIn(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const banner = page.getByText('RUNVAX 2.0 is here.');
  await expect(banner).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.v2n-banner').getByRole('link', { name: /Switch to RUNVAX 2.0/ })).toBeVisible();
  // The banner really animates.
  expect(await page.locator('.v2n-cta').first().evaluate((el) => getComputedStyle(el).animationName)).not.toBe('none');

  const popup = page.getByRole('dialog', { name: /Meet RUNVAX 2.0/ });
  await expect(popup).toBeVisible({ timeout: 15_000 });
  // Everything that sits on purple is white: the headline, the subtitle, the badge, the icons and the button.
  const notWhite = await popup.evaluate((root) => {
    const rgb = (c: string) => { const m = c.match(/rgba?\(([^)]+)\)/); return m ? m[1].split(',').map((x) => Number(x.trim())) : null; };
    const solid = (c: string) => { const v = rgb(c); return !!v && (v.length < 4 || v[3] > 0.95); };
    const purple = (c: string) => { const v = rgb(c); return !!v && v[0] >= 100 && v[0] <= 170 && v[1] <= 80 && v[2] >= 190; };
    const bgOf = (el: Element) => { for (let e: Element | null = el; e; e = e.parentElement) { const bg = getComputedStyle(e).backgroundColor; if (solid(bg)) return bg; } return ''; };
    const out: string[] = [];
    root.querySelectorAll('*').forEach((el) => {
      const text = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim());
      if (!text && el.tagName.toLowerCase() !== 'svg') return;
      const colour = getComputedStyle(el).color;
      if (purple(bgOf(el)) && colour !== 'rgb(255, 255, 255)') out.push(`${el.tagName} ${(el.textContent ?? '').trim().slice(0, 30)} ${colour}`);
    });
    return out;
  });
  expect(notWhite).toEqual([]);
  await popup.getByRole('button', { name: 'Maybe later' }).click();
  await expect(popup).toBeHidden();
  await expect(banner).toBeVisible();

  // Snoozed: it does not come back on reload, but the banner stays.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(banner).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(6000);
  await expect(popup).toBeHidden();

  await page.locator('.v2n-banner').getByRole('link', { name: /Switch to RUNVAX 2.0/ }).click();
  await page.waitForURL('**/client-acquisition/find');
});

test('motion stops for people who prefer reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await signedIn(page);
  await page.goto('/');
  await expect(page.getByText('RUNVAX 2.0 is here.')).toBeVisible({ timeout: 20_000 });
  expect(await page.locator('.v2n-cta').first().evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
});
