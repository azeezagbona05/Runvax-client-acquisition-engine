import { expect, test, type Page } from '@playwright/test';

// Signed in with a mocked session and a mocked token API: no account, no database.
const TOKEN = 'rvx_cmw6yo1fd00006h0dm93zfj9r_AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-AbCd';
async function setup(page: Page, status: { connected: boolean; createdAt: string | null; lastUsedAt: string | null }) {
  await page.addInitScript(() => { try { localStorage.setItem('runvax_welcome_seen', '1'); localStorage.setItem('pwa_dismissed_at', String(Date.now())); localStorage.setItem('runvax_v2_popup_seen_at', String(Date.now())); localStorage.setItem('runvax_v2_banner_seen_at', String(Date.now())); } catch { /* ignore */ } });
  await page.route('**/api/auth/session', (r) => r.fulfill({ json: { user: { name: 'Azeez', email: 'a@example.com', plan: 'pro', emailVerified: '2026-01-01T00:00:00.000Z' }, expires: '2099-01-01T00:00:00.000Z' } }));
  await page.route('**/api/client-acquisition/mcp-token', (r) => (r.request().method() === 'POST' ? r.fulfill({ json: { token: TOKEN, endpoint: 'https://runvax.test/api/mcp' } }) : r.fulfill({ json: { ...status, endpoint: 'https://runvax.test/api/mcp' } })));
  await page.route('**/api/client-acquisition/**', (r) => (r.request().url().includes('/mcp-token') ? r.fallback() : r.fulfill({ status: 503, json: { error: 'offline in this test' } })));
}

test('the setup steps are always on the page, with a placeholder until a token is made, then the real token', async ({ page }) => {
  test.setTimeout(240_000);
  await setup(page, { connected: false, createdAt: null, lastUsedAt: null });
  await page.goto('/client-acquisition/integrations', { waitUntil: 'domcontentloaded' });
  const card = page.locator('.acq-card', { hasText: 'Claude (MCP)' });
  await expect(card.getByText('How to connect Claude to RUNVAX')).toBeVisible({ timeout: 120_000 });

  // Before a token exists: the three steps, the endpoint and a placeholder (never a made-up token).
  await expect(card.getByText('Make your token.')).toBeVisible(); await expect(card.getByText('Add RUNVAX to Claude.')).toBeVisible(); await expect(card.getByText('Ask Claude about your account.')).toBeVisible();
  const cmd = card.locator('pre').first();
  await expect(cmd).toContainText('claude mcp add --transport http --scope user runvax https://runvax.test/api/mcp'); await expect(cmd).toContainText('Bearer PASTE_YOUR_TOKEN_HERE');
  await expect(card.getByText(/claude mcp list/)).toBeVisible();
  await expect(card.getByText(/claude.ai website/)).toBeVisible();

  // Making a token fills it into the command; Claude Desktop shows its config.
  await card.getByRole('button', { name: 'Connect Claude' }).click();
  await expect(card.getByText('Copy your token now.')).toBeVisible();
  await expect(card.locator('pre').filter({ hasText: 'claude mcp add' })).toContainText(`Bearer ${TOKEN}`);
  await expect(card.locator('pre').filter({ hasText: 'claude mcp add' })).not.toContainText('PASTE_YOUR_TOKEN_HERE');
  await card.getByRole('tab', { name: 'Claude Desktop' }).click();
  const cfg = card.locator('pre').filter({ hasText: 'mcpServers' });
  await expect(cfg).toContainText('mcp-remote'); await expect(cfg).toContainText('https://runvax.test/api/mcp'); await expect(cfg).toContainText(`Bearer ${TOKEN}`);
  await expect(card.getByText(/Settings → Developer → Edit Config/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});

test('once Claude has been used the steps fold away but are one click from view', async ({ page }) => {
  test.setTimeout(240_000);
  await setup(page, { connected: true, createdAt: '2026-11-01T10:00:00.000Z', lastUsedAt: '2026-11-07T10:00:00.000Z' });
  await page.goto('/client-acquisition/integrations', { waitUntil: 'domcontentloaded' });
  const card = page.locator('.acq-card', { hasText: 'Claude (MCP)' });
  const summary = card.getByText('How to connect Claude to RUNVAX');
  await expect(summary).toBeVisible({ timeout: 120_000});
  await expect(card.getByText('Add RUNVAX to Claude.')).toBeHidden();
  await summary.click();
  await expect(card.getByText('Add RUNVAX to Claude.')).toBeVisible();
  await expect(card.locator('pre').first()).toContainText('Bearer PASTE_YOUR_TOKEN_HERE'); // the original token is never kept
  await expect(card.getByText(/placeholder until you make a new token/)).toBeVisible();
});
