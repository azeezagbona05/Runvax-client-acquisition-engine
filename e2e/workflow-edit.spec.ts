import { expect, test, type Page } from '@playwright/test';

// Signed in with a mocked session; the built-in planner builds the campaign in the browser and saving is mocked.
const SHOTS = process.env.E2E_SHOTS;
async function signedIn(page: Page) {
  await page.addInitScript(() => { try { localStorage.setItem('runvax_welcome_seen', '1'); localStorage.setItem('pwa_dismissed_at', String(Date.now())); } catch { /* ignore */ } });
  await page.route('**/api/auth/session', (r) => r.fulfill({ json: { user: { name: 'Azeez Oladipo', email: 'azeez@example.com', plan: 'pro', emailVerified: '2026-01-01T00:00:00.000Z' }, expires: '2099-01-01T00:00:00.000Z' } }));
  await page.route('**/api/client-acquisition/**', (r) => r.fulfill({ status: 503, json: { error: 'offline in this test' } }));
  await page.route('**/api/outreach-campaigns/**', (r) => r.fulfill({ json: { ok: true } }));
  await page.route('**/api/outreach-campaigns', (r) => (r.request().method() === 'POST' ? r.fulfill({ status: 201, json: { id: 'c-test', added: null } }) : r.fulfill({ json: { campaigns: [] } })));
}

test('the build counts up in percent, and the workflow can be edited, reordered and extended', async ({ page, isMobile }) => {
  test.setTimeout(300_000);
  const name = isMobile ? 'phone' : 'desktop';
  await signedIn(page);
  await page.goto('/client-acquisition/automation', { waitUntil: 'domcontentloaded' });
  const box = page.getByLabel('What do you want to sell, and to whom?');
  await expect(box).toBeVisible({ timeout: 120_000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  await expect(async () => {
    await box.fill('I want to sell AI agents to dental clinics, visibility, receptionist, follow up and patient reactivation');
    await page.getByRole('button', { name: 'Build my campaign' }).click();
    await expect(page.getByText('Building your client acquisition engine…')).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 60_000, intervals: [500, 1000, 2000] });

  // A visible percentage that counts up through the build, never going backwards.
  const seen: number[] = [];
  for (let k = 0; k < 400; k++) {
    const t = await page.locator('.acq-build-pct').first().textContent({ timeout: 500 }).catch(() => null);
    if (t === null) break;
    const n = parseInt(t, 10);
    if (!Number.isNaN(n) && seen[seen.length - 1] !== n) seen.push(n);
    await page.waitForTimeout(120);
  }
  expect(seen.length).toBeGreaterThanOrEqual(5);
  expect(seen[0]).toBeLessThan(25);
  expect(seen.every((n, i) => i === 0 || n >= seen[i - 1])).toBe(true);
  expect(seen.at(-1)!).toBe(100);
  expect(Math.max(...seen)).toBeLessThanOrEqual(100);
  await expect(page.getByText(/All 7 build steps complete/)).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Full screen: Sequence workflow' }).waitFor();

  // Click a step to edit it: the change shows on the chart and is saved.
  await page.getByRole('button', { name: /^Email 1: Introduction/ }).click();
  const editor = page.getByRole('dialog', { name: 'Edit: Email 1: Introduction' });
  await expect(editor).toBeVisible();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/edit-${name}-1.png` });
  await editor.getByLabel('Subject', { exact: true }).fill('A quick hello for {{business}}');
  await editor.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: /^Email 1: Introduction.*A quick hello/ })).toBeVisible();
  await expect(page.getByText('Saved ✓')).toBeVisible({ timeout: 10_000 });

  // A wait step: change the days, and the chart's day numbers follow.
  await page.getByRole('button', { name: /^Wait \d+ days?/ }).first().click();
  await page.getByRole('dialog', { name: /Edit: Wait before email 2/ }).getByLabel(/How long to wait/).selectOption('9');
  await page.getByRole('dialog', { name: /Edit: Wait before email 2/ }).getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: /^Wait 9 days/ })).toBeVisible();

  // The sequence may already be at its limit of five emails, in which case there is no Add button. Trim it to three first.
  const emailNodes = page.getByRole('button', { name: /^Email \d+: (Introduction|Follow-up|Final follow-up): / });
  while ((await emailNodes.count()) > 3) {
    await page.getByRole('button', { name: /Final follow-up: / }).first().click();
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('dialog', { name: /Edit: Email \d/ }).getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByRole('dialog', { name: /Edit: Email \d/ })).toBeHidden();
  }
  await expect(emailNodes).toHaveCount(3);

  // Add an email, edit it, and take it out again.
  await page.getByRole('button', { name: 'Add an email' }).click();
  const added = page.getByRole('dialog', { name: /Edit: Email 4/ });
  await expect(added).toBeVisible();
  await added.getByLabel('Subject', { exact: true }).fill('ZZZ new step');
  await added.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: /Email 4: Final follow-up: ZZZ new step/ })).toBeVisible();
  await page.getByRole('button', { name: /Email 4: Final follow-up: ZZZ/ }).click();
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('dialog', { name: /Edit: Email 4/ }).getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByRole('button', { name: /ZZZ new step/ })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: /Edit:/ })).toBeHidden();

  // Esc closes the editor.
  await page.getByRole('button', { name: /^Email 1: Introduction/ }).click();
  await expect(page.getByRole('dialog', { name: 'Edit: Email 1: Introduction' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: /Edit:/ })).toBeHidden();

  // Editing works in full screen too, with the editor above the panel.
  await page.getByRole('button', { name: 'Full screen: Sequence workflow' }).click();
  await page.getByRole('dialog', { name: 'Sequence workflow' }).getByRole('button', { name: /^Email 1: Introduction/ }).click();
  const fsEditor = page.getByRole('dialog', { name: 'Edit: Email 1: Introduction' });
  await expect(fsEditor).toBeVisible();
  const eb = (await fsEditor.boundingBox())!, vp = page.viewportSize()!;
  expect(eb.x).toBeGreaterThanOrEqual(0); expect(eb.x + eb.width).toBeLessThanOrEqual(vp.width + 1);
  await fsEditor.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Exit full screen' }).click();

  // Drag one email onto another to reorder (mouse only: phones use the Earlier and Later buttons).
  if (!isMobile) {
    await page.getByRole('button', { name: /^Email 2: Follow-up: / }).click();
    const e2 = page.getByRole('dialog', { name: /Edit: Email 2/ });
    await e2.getByLabel('Subject', { exact: true }).fill('AAA second');
    await e2.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: /^Email 3: Final follow-up: / }).click();
    const e3 = page.getByRole('dialog', { name: /Edit: Email 3/ });
    await e3.getByLabel('Subject', { exact: true }).fill('BBB third');
    await e3.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: /^Email 2: Follow-up: AAA second/ }).dragTo(page.getByRole('button', { name: /^Email 3: Final follow-up: BBB third/ }));
    await expect(page.getByRole('button', { name: /^Email 2: Follow-up: BBB third/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Email 3: Final follow-up: AAA second/ })).toBeVisible();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/edit-${name}-2.png` });
  } else {
    await page.getByRole('button', { name: /^Email 2: Follow-up: / }).click();
    const e2 = page.getByRole('dialog', { name: /Edit: Email 2/ });
    await e2.getByLabel('Subject', { exact: true }).fill('AAA second');
    await e2.getByRole('button', { name: 'Later' }).click();
    await expect(page.getByRole('dialog', { name: /Edit: Email 3/ })).toBeVisible();
    await page.getByRole('dialog', { name: /Edit: Email 3/ }).getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('button', { name: /^Email 3: Final follow-up: AAA second/ })).toBeVisible();
  }
});
