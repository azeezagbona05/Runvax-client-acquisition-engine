import { expect, test, type Page } from '@playwright/test';

// The Find Prospects results table: live search, advanced filters, sorting and columns.
// Needs a real sign-in (E2E_EMAIL / E2E_PASSWORD, a test account) but the Google search is faked, so no search credits are used.
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

const BIZ = [
  { id: 'b1', name: 'Sketch Restaurant', address: 'Victoria Island, Lagos', phone: '0908 845 1909', website: 'https://sketch.example', category: 'Restaurant', rating: 4.4, reviewCount: 442 },
  { id: 'b2', name: 'Slice Lagos', address: 'Victoria Island, Lagos', phone: '0906 135 4009', category: 'Pizza', rating: 4.1, reviewCount: 447 },
  { id: 'b3', name: 'Gras Lekki', address: 'Lekki Phase 1, Lagos', category: 'Restaurant', rating: 3.2, reviewCount: 12 },
  { id: 'b4', name: 'Oceans5', address: 'Victoria Island, Lagos', phone: '0905 549 3898', website: 'https://oceans5.example', category: 'Restaurant', rating: 4.3, reviewCount: 349 },
  { id: 'b5', name: 'Vanilla Moon', address: 'Victoria Island, Lagos', phone: '0903 000 9758', category: 'Restaurant', rating: 4.4, reviewCount: 759 },
  { id: 'b6', name: 'Mama Cass', address: 'Victoria Island, Lagos', phone: '0901 111 2222', category: 'Restaurant', rating: 2.8, reviewCount: 80 },
  { id: 'b7', name: 'New Cafe', address: 'Victoria Island, Lagos', category: 'Cafe' },
  { id: 'b8', name: 'Cilantro', address: 'Victoria Island, Lagos', phone: '0902 222 3333', website: 'https://cilantro.example', category: 'Restaurant', rating: 4.6, reviewCount: 900 },
].map((b) => ({ ...b, location: { latitude: 6.43, longitude: 3.42 } }));

async function findEight(page: Page) {
  await page.addInitScript(() => { try { localStorage.setItem('runvax_welcome_seen', '1'); localStorage.setItem('pwa_dismissed_at', String(Date.now())); } catch { /* ignore */ } });
  await page.route('**/api/search', (r) => r.fulfill({ json: { businesses: BIZ } }));
  await page.goto('/auth/signin');
  await page.getByLabel('Email address').fill(email!);
  await page.getByLabel('Password', { exact: true }).fill(password!);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/client-acquisition/find', { timeout: 120_000, waitUntil: 'commit' });
  await page.locator('#pf-loc').click(); await page.locator('#pf-loc').fill('victoria'); await page.getByRole('option').first().click(); await page.keyboard.press('Escape');
  await page.locator('#pf-ind').click(); await page.locator('#pf-ind').fill('restaur'); await page.getByRole('option').first().click(); await page.keyboard.press('Escape');
  await page.getByLabel('How many businesses').fill('8');
  await page.getByRole('button', { name: 'Find prospects' }).click();
  await expect(page.getByText('8 prospects')).toBeVisible({ timeout: 30_000 });
}
const names = (page: Page) => page.locator('table.acq-table tbody td[data-cell=biz] span[style*="font-weight: 600"]').allInnerTexts().then((a) => a.map((t) => t.trim()));

test.describe('Find Prospects table', () => {
  test.skip(!email || !password, 'set E2E_EMAIL and E2E_PASSWORD (a test account) to run these');

  test('live search, advanced filters, sorting and columns', async ({ page, isMobile }) => {
    await findEight(page);
    const search = page.getByRole('searchbox', { name: 'Search prospects' });

    // No browser or password-manager suggestions pop up over the form fields.
    for (const sel of ['#pf-country', '#pf-state', '#pf-loc', '#pf-ind']) await expect(page.locator(sel)).toHaveAttribute('autocomplete', 'nope');
    await expect(page.getByLabel('How many businesses')).toHaveAttribute('autocomplete', 'nope');
    await expect(search).toHaveAttribute('autocomplete', 'nope');
    await expect(page.locator('form').first()).toHaveAttribute('autocomplete', 'off');

    // Search narrows as you type (after a short pause), matches any word in any column, and clearing restores everything.
    await search.fill('lekki');
    await expect(page.getByText('1 of 8 prospects')).toBeVisible();
    expect(await names(page)).toEqual(['Gras Lekki']);
    await search.fill('0908');
    await expect(page.getByText('1 of 8 prospects')).toBeVisible();
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(page.getByText('8 prospects')).toBeVisible();

    // Advanced filter: quick filters are ordinary rules that combine with AND, and a custom rule can be added.
    await page.getByRole('button', { name: /^Filters/ }).click();
    await page.getByRole('button', { name: 'No website', exact: true }).click();
    await expect(page.getByText('5 of 8 prospects').first()).toBeVisible();
    await page.getByRole('button', { name: 'Rated 4.0+' }).click();
    await expect(page.getByText('2 of 8 prospects').first()).toBeVisible();
    await page.getByRole('button', { name: 'Add rule' }).click();
    await page.getByLabel('Rule 3 field').selectOption('reviews');
    await page.getByLabel('Rule 3 value').fill('500');
    await expect(page.getByText('1 of 8 prospects').first()).toBeVisible();
    expect(await names(page)).toEqual(['Vanilla Moon']);
    await page.getByLabel('Match all or any rule').selectOption('any');
    await expect(page.getByText('8 of 8 prospects').or(page.getByText('8 prospects')).first()).toBeVisible();
    await page.getByRole('button', { name: 'Clear rules' }).click();
    await expect(page.getByText('8 prospects').first()).toBeVisible();

    // Sorting: highest rated first, and a business with no rating always goes last.
    await page.getByLabel('Sort prospects').selectOption('rating-high');
    expect((await names(page))[0]).toBe('Cilantro');
    expect((await names(page)).at(-1)).toBe('New Cafe');
    await page.getByLabel('Sort prospects').selectOption('rating-low');
    expect((await names(page)).at(-1)).toBe('New Cafe');

    // Columns can be hidden (headers are not shown on a phone, where each row is a card).
    if (!isMobile) {
      await expect(page.getByRole('columnheader', { name: /Phone/ })).toBeVisible();
      await page.getByRole('button', { name: 'Columns' }).click();
      await page.getByRole('menu', { name: 'Show or hide columns' }).getByLabel('Phone').uncheck();
      await expect(page.getByRole('columnheader', { name: /Phone/ })).toHaveCount(0);
    }
  });
});
