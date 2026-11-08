import { expect, test, type Page } from '@playwright/test';

// Signed in with a mocked session and mocked numbers: no account, no database, no AI.
const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const overview = { cards: { totalLeads: 300, leadsThisWeek: 52, leadsGrowthPct: 24, emailsSent: 410, sentGrowthPct: 18, sentOfLeads: 280, delivered: 400, deliveredRate: 97, opened: 180, openRate: 45, clicked: 40, clickRate: 10, replies: 31, replyRate: 8, interested: 24 }, series: [], campaigns: [], topLeads: [], activity: [
  { id: 'e1', type: 'imported', at: ago(3), text: '300 new leads imported', email: 'x@y.co', campaignId: 'c1', campaignName: 'Dental Clinics, Lagos', pill: 'Imported' },
  { id: 'e2', type: 'sent', at: ago(2), text: 'Introduction email sent', email: 'a@b.co', campaignId: 'c1', campaignName: 'Dental Clinic Outreach', pill: 'Sent' }], sending: { today: 12, limit: 200 }, inboxCount: 3, runningCampaigns: 6, mailboxReady: true };
const summary = (days: number) => ({ days, conversations: days === 30 ? 400 : 128, previous: 98, changePct: 31, leads: 9, activeAgents: 2, agents: 3, events: [{ id: 'c1', kind: 'lead', title: 'New lead from a chat', detail: 'Tunde · Kola Foods', at: ago(1) }, { id: 'a1', kind: 'agent', title: 'Sales Assistant created', detail: 'Bright Smile Dental Assistant', at: ago(5) }] });

async function setup(page: Page, summaryCalls: string[] = []) {
  await page.addInitScript(() => { try { localStorage.setItem('runvax_welcome_seen', '1'); localStorage.setItem('pwa_dismissed_at', String(Date.now())); localStorage.setItem('runvax_v2_popup_seen_at', String(Date.now())); localStorage.setItem('runvax_v2_banner_seen_at', String(Date.now())); } catch { /* ignore */ } });
  await page.route('**/api/auth/session', (r) => r.fulfill({ json: { user: { name: 'Azeez Agbona', email: 'a@example.com', plan: 'pro', emailVerified: '2026-01-01T00:00:00.000Z' }, expires: '2099-01-01T00:00:00.000Z' } }));
  await page.route('**/api/client-acquisition/**', (r) => {
    const u = r.request().url();
    if (u.includes('/agents/summary')) { summaryCalls.push(u); return r.fulfill({ json: summary(Number(new URL(u).searchParams.get('days'))) }); }
    if (u.includes('/overview')) return r.fulfill({ json: overview });
    return r.fulfill({ status: 503, json: { error: 'offline in this test' } });
  });
}

test('Home: two modules, the numbers, recent activity and quick actions', async ({ page }) => {
  test.setTimeout(240_000);
  const calls: string[] = []; await setup(page, calls);
  await page.goto('/client-acquisition', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /Welcome back, Azeez/ })).toBeVisible({ timeout: 120_000 });
  await page.waitForLoadState('networkidle').catch(() => {});

  // The two modules open their own area.
  await expect(page.getByRole('region', { name: 'Prospecting & Campaigns' }).getByRole('link', { name: /Open Module/ })).toHaveAttribute('href', '/client-acquisition/find');
  await expect(page.getByRole('region', { name: 'AI Agent Studio' }).getByRole('link', { name: /Open Module/ })).toHaveAttribute('href', '/client-acquisition/agents');

  // Real numbers, with the change where there is one.
  const perf = page.getByRole('region', { name: 'Performance overview' });
  await expect(perf.getByText('Leads Generated')).toBeVisible();
  await expect(perf.locator('.acq-home-kpi').nth(0)).toContainText('300'); await expect(perf.locator('.acq-home-kpi').nth(0)).toContainText('24%');
  await expect(perf.locator('.acq-home-kpi').nth(1)).toContainText('6');
  await expect(perf.locator('.acq-home-kpi').nth(2)).toContainText('128'); await expect(perf.locator('.acq-home-kpi').nth(2)).toContainText('31%');
  await expect(perf.locator('.acq-home-kpi').nth(3)).toContainText('24');
  await expect(perf.getByRole('link', { name: /Full report/ })).toHaveAttribute('href', '/client-acquisition/overview');

  // The date range changes the agent numbers.
  await expect(perf.getByRole('button', { name: 'Last 7 days' })).toHaveAttribute('aria-pressed', 'true');
  await perf.getByRole('button', { name: 'Last 30 days' }).click();
  await expect(perf.locator('.acq-home-kpi').nth(2)).toContainText('400');
  expect(calls.some((u) => u.includes('days=30'))).toBe(true);

  // Campaign and agent events, newest first.
  const act = page.getByRole('region', { name: 'Recent activity' });
  await expect(act.getByText('New lead from a chat')).toBeVisible(); await expect(act.getByText('Introduction email sent')).toBeVisible(); await expect(act.getByText('Sales Assistant created')).toBeVisible();

  // Quick actions go where they say.
  const qa = page.getByRole('region', { name: 'Quick actions' });
  await expect(qa.getByRole('link', { name: /Find Leads/ })).toHaveAttribute('href', '/client-acquisition/find');
  await expect(qa.getByRole('link', { name: /Create Campaign/ })).toHaveAttribute('href', '/client-acquisition/automation');
  await expect(qa.getByRole('link', { name: /Build an AI Agent/ })).toHaveAttribute('href', '/client-acquisition/agents/new');
  await expect(qa.getByRole('link', { name: /Deploy on Website/ })).toHaveAttribute('href', '/client-acquisition/agents');

  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});

test('the menu is grouped by module, and the bottom-left and top-right are as before', async ({ page, isMobile }) => {
  test.skip(!!isMobile, 'the sidebar is desktop only; phones use the bottom bar and More');
  test.setTimeout(240_000);
  await setup(page);
  await page.goto('/client-acquisition', { waitUntil: 'domcontentloaded' });
  const side = page.getByRole('complementary', { name: 'Client Acquisition navigation' });
  await expect(side.getByRole('link', { name: 'Home' })).toHaveClass(/active/, { timeout: 120_000 });
  for (const h of ['Prospecting & Campaigns', 'AI Agent Studio', 'Workspace']) await expect(side.getByText(h, { exact: true })).toBeVisible();
  for (const l of ['Find Prospects', 'Lead Lists', 'Campaigns', 'Automation Builder', 'Email Activity', 'Inbox & Opportunities', 'Templates', 'AI Agents', 'Integrations', 'Settings']) await expect(side.getByRole('link', { name: l, exact: true })).toBeVisible();
  // Bottom-left: unchanged.
  for (const l of ['Upgrade plan', 'Watch intro video', 'Help & support', 'Sign out']) await expect(side.getByText(l, { exact: true })).toBeVisible();
  await expect(side.getByText(/Sending today/)).toBeVisible();
  // Top-right: status, bell, account menu: unchanged.
  const top = page.locator('header.acq-topbar');
  await expect(top.getByText(/Campaigns Running|Nothing Running/)).toBeVisible();
  await expect(top.getByRole('link', { name: /replies waiting|Inbox/ })).toBeVisible();
  await expect(top.getByText('Azeez Agbona')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Classic RUNVAX' })).toHaveCount(0);
});

test('the old campaign overview is still there, one click from Home', async ({ page }) => {
  test.setTimeout(240_000);
  await setup(page);
  await page.goto('/client-acquisition/overview', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Client Acquisition' })).toBeVisible({ timeout: 120_000 });
});
