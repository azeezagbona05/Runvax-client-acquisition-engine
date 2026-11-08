// Records the RUNVAX 2.0 showcase against a LOCAL server + throwaway database. Never point BASE at production.
// usage: node record-v2.mjs <workdir> [--fast]   env: BASE (default http://localhost:3200), COUNT (default 300), EMAIL, PASS
import { chromium } from '/Users/user/Documents/ai-prospect-tool/node_modules/playwright/index.mjs';
import fs from 'node:fs'; import path from 'node:path';

const work = process.argv[2]; const FAST = process.argv.includes('--fast');
const BASE = process.env.BASE ?? 'http://localhost:3200'; const COUNT = process.env.COUNT ?? '300';
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error('Refusing to record against a non-local server');
const EMAIL = process.env.EMAIL ?? 'chioma.eze@example.com', PASS = process.env.PASS ?? 'Demo-Pass-2026!';
const dur = JSON.parse(fs.readFileSync(path.join(work, 'audio/durations.json')));
fs.rmSync(path.join(work, 'video'), { recursive: true, force: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1536, height: 864 }, recordVideo: { dir: path.join(work, 'video'), size: { width: 1536, height: 864 } }, locale: 'en-NG', timezoneId: 'Africa/Lagos' });
await ctx.addInitScript(() => {
  try { localStorage.setItem('runvax_welcome_seen', '1'); localStorage.setItem('pwa_dismissed_at', String(Date.now())); } catch {}
  const mk = () => {
    if (document.getElementById('__cur')) return;
    const c = document.createElement('div'); c.id = '__cur';
    c.style.cssText = 'position:fixed;z-index:2147483647;width:22px;height:22px;border-radius:50%;background:rgba(147,51,234,.35);border:2px solid #9333ea;pointer-events:none;left:-50px;top:-50px;transform:translate(-50%,-50%);transition:left .05s,top .05s';
    const k = document.createElement('div'); k.id = '__cap';
    k.style.cssText = 'position:fixed;z-index:2147483646;left:50%;bottom:26px;transform:translateX(-50%);max-width:1100px;padding:12px 26px;border-radius:14px;background:rgba(15,23,42,.88);color:#fff;font:600 21px/1.35 Inter,system-ui,sans-serif;text-align:center;pointer-events:none;display:none;box-shadow:0 8px 30px rgba(0,0,0,.3)';
    document.documentElement.append(c, k);
    const cap = localStorage.getItem('__capText'); if (cap) { k.textContent = cap; k.style.display = 'block'; }
    const pos = JSON.parse(sessionStorage.getItem('__pos') || '[-50,-50]'); c.style.left = pos[0] + 'px'; c.style.top = pos[1] + 'px';
  };
  document.addEventListener('DOMContentLoaded', mk); if (document.readyState !== 'loading') mk();
  document.addEventListener('mousemove', (e) => { const c = document.getElementById('__cur'); if (c) { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; } try { sessionStorage.setItem('__pos', JSON.stringify([e.clientX, e.clientY])); } catch {} }, true);
  const st = document.createElement('style'); st.textContent = 'nextjs-portal{display:none!important}'; document.addEventListener('DOMContentLoaded', () => document.head.append(st));
  // Privacy: blur anything that looks like a phone number, so no real business number is published.
  setInterval(() => document.querySelectorAll('td,span,a,div').forEach((e) => { if (e.children.length === 0 && /^\+?[\d][\d\s()-]{8,}$/.test((e.textContent || '').trim())) e.style.filter = 'blur(6px)'; }), 400);
});
const page = await ctx.newPage(); page.setDefaultTimeout(30_000);
const t0 = Date.now(); const starts = {}; const cuts = [];
const sleep = (ms) => (FAST ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));
const now = () => (Date.now() - t0) / 1000;

async function caption(text) { await page.evaluate((t) => { try { localStorage.setItem('__capText', t); } catch {} const k = document.getElementById('__cap'); if (k) { k.textContent = t; k.style.display = t ? 'block' : 'none'; } }, text).catch(() => {}); }
async function move(box) { await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: FAST ? 1 : 22 }); }
async function click(loc, opts = {}) { await loc.scrollIntoViewIfNeeded(); const b = await loc.boundingBox(); if (b) await move(b); await sleep(250); await loc.click({ force: true, ...opts }); await sleep(350); }
async function type(loc, text, delay = 55) { await click(loc); await loc.pressSequentially(text, { delay: FAST ? 0 : delay }); await sleep(250); }
async function typeSure(loc, text, delay = 70) { for (let k = 0; k < 6; k++) { await loc.fill(''); await click(loc); await loc.pressSequentially(text, { delay: FAST ? 0 : delay }); await sleep(500); if ((await loc.inputValue()) === text) return; await page.waitForTimeout(1500); } throw new Error('typing did not stick'); }
async function hover(loc, ms = 1400) { const b = await loc.boundingBox().catch(() => null); if (b) await move(b); await sleep(ms); }
async function scene(id, cap, fn, { pad = true } = {}) {
  console.log('▶', id); starts[id] = now(); const s = Date.now();
  await caption(cap);
  try { await fn(); } catch (e) { await page.screenshot({ path: path.join(work, `fail-${id}.png`) }).catch(() => {}); throw e; }
  if (FAST) { fs.mkdirSync(path.join(work, 'snaps'), { recursive: true }); await page.screenshot({ path: path.join(work, 'snaps', id + '.png') }).catch(() => {}); }
  const left = (dur[id] + 0.8) * 1000 - (Date.now() - s); if (pad && !FAST && left > 0) await new Promise((r) => setTimeout(r, left));
}
async function smoothScroll(by, steps = 6) { for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, by / steps); await sleep(500); } }
const go = async (u) => { await page.goto(BASE + u, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(1200); };
const card = (id, sub, extra = '') => page.evaluate(([id, sub, extra, base]) => { const d = document.createElement('div'); d.id = id; d.style.cssText = 'position:fixed;inset:0;z-index:2147483645;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif;text-align:center'; d.innerHTML = `<img src="${base}/logo-horizontal.png" style="width:min(820px,80vw)"><div style="font-size:34px;font-weight:700;margin-top:30px;color:#4c1d95">${sub}</div><div style="font-size:23px;margin-top:20px;color:#475569">${extra}</div>`; document.body.append(d); }, [id, sub, extra, BASE]);

await go('/'); await page.waitForTimeout(1200);

await scene('intro', 'RUNVAX 2.0 · The AI-powered B2B client acquisition engine', async () => {
  await card('__title', 'RUNVAX 2.0', 'Find businesses · Reach decision-makers · Win clients · Any country, any industry'); await sleep(1000);
});

await scene('login', 'Existing user: log in to classic RUNVAX', async () => {
  await page.evaluate(() => document.getElementById('__title')?.remove()); await sleep(2500);
  await page.goto(BASE + '/auth/signin?next=/', { waitUntil: 'domcontentloaded' }); await page.locator('#signin-email').waitFor({ timeout: 90_000 }); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(2500);
  await typeSure(page.locator('#signin-email'), EMAIL); await typeSure(page.locator('#signin-password'), PASS); await sleep(600);
  await click(page.locator('form button[type=submit]'));
  await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 90_000 }); await page.waitForLoadState('networkidle').catch(() => {});
});

await scene('switch', 'Classic RUNVAX → switch to RUNVAX 2.0', async () => {
  if (!/client-acquisition/.test(page.url())) { await sleep(2500); }
  if (!(await page.locator('.v2n-cta, .v2n-pill').first().isVisible().catch(() => false))) { await go('/'); await sleep(2500); }
  await sleep(1500);
  await hover(page.locator('.v2n-cta').first(), 2500);
  const cta = page.locator('.v2n-cta').first();
  for (let k = 0; k < 4 && !/client-acquisition/.test(page.url()); k++) {
    await click(cta, { force: false, timeout: 8000 }).catch(() => cta.dispatchEvent('click').catch(() => {}));
    await page.waitForURL('**/client-acquisition/find', { timeout: 20_000 }).catch(() => {});
  }
  await page.waitForURL('**/client-acquisition/find', { timeout: 120_000 }); starts._chime = now(); await page.waitForLoadState('networkidle').catch(() => {}); await sleep(5000);
});

await scene('tour', 'RUNVAX 2.0 · Client Acquisition', async () => {
  for (const l of ['Lead Lists', 'Campaigns', 'Automation Builder', 'Email Activity', 'Inbox & Opportunities', 'AI Agents']) {
    const a = page.getByRole('link', { name: l }).first(); const b = await a.boundingBox().catch(() => null); if (b) await move(b); await sleep(1900);
  }
});

const country = page.locator('#pf-country');
await scene('countries', 'Built for any country in the world', async () => {
  await sleep(800);
  for (const c of ['gha', 'ken', 'united k']) { await click(country); await country.fill(c); await page.getByRole('option').first().waitFor(); await sleep(1100); await click(page.getByRole('option').first()); await sleep(900); }
});

await scene('search', `Nigeria · Victoria Island, Lekki, Ikoyi · Restaurants · ${COUNT} leads`, async () => {
  await click(country); await country.fill('niger'); await page.getByRole('option', { name: 'Nigeria', exact: true }).click(); await sleep(900);
  const loc = page.locator('#pf-loc');
  for (const [q, re] of [['victoria', /Victoria Island/], ['lekki', /Lekki/], ['ikoyi', /Ikoyi/]]) { await click(loc); await loc.fill(q); await sleep(800); await click(page.getByRole('option', { name: re }).first()); await sleep(500); }
  await page.keyboard.press('Escape');
  const ind = page.locator('#pf-ind'); await click(ind); await ind.fill('restaur'); await sleep(900); await click(page.getByRole('option', { name: /Restaurants/ }).first()); await page.keyboard.press('Escape');
  await page.getByLabel('How many businesses').fill(COUNT); await sleep(1200);
  await click(page.getByRole('button', { name: 'Find prospects' }));
});

await scene('searching', 'Searching live across the map…', async () => {
  const s = Date.now();
  await page.getByText('Searching for prospects…').waitFor({ timeout: 60_000 }).catch(() => {});
  const narrated = (dur.searching + 0.8) * 1000;
  const left = narrated - (Date.now() - s); if (!FAST && left > 0) await new Promise((r) => setTimeout(r, left));
  const from = now();
  await page.getByText('Searching for prospects…').waitFor({ state: 'hidden', timeout: 900_000 });
  const to = now(); if (to - from > 6) cuts.push({ from: from + 3, to, factor: 12 }); // the rest of the wait is sped up
  await sleep(1500);
}, { pad: false });

await scene('results', `${COUNT} businesses found · search and filter`, async () => {
  await page.getByRole('searchbox', { name: 'Search prospects' }).scrollIntoViewIfNeeded(); await sleep(2500);
  await type(page.getByRole('searchbox', { name: 'Search prospects' }), 'lekki'); await sleep(1800);
  await click(page.getByRole('button', { name: 'Clear search' })); await sleep(800);
  await click(page.getByRole('button', { name: /^Filters/ })); await sleep(1000);
  for (const f of ['No website', 'Rated 4.0+', '20+ reviews', 'Has a phone']) { await click(page.getByRole('button', { name: f, exact: true })); await sleep(1600); }
  await smoothScroll(400, 3);
});

await scene('goal', 'Type your goal. That is all.', async () => {
  await go('/client-acquisition/automation'); await sleep(1500);
  await type(page.getByLabel('What do you want to sell, and to whom?'), 'I run a web design agency. I want to sell online ordering websites and AI chatbots to restaurants in Victoria Island, Lagos', 30);
  await sleep(1000); await click(page.getByRole('button', { name: 'Build my campaign' }));
});
await scene('building', 'The agent builds your client acquisition engine…', async () => {
  await page.getByText(/All 7 build steps complete/).waitFor({ timeout: 240_000 }); await sleep(1000);
});

await scene('wf1', 'The workflow sequence diagram', async () => {
  await sleep(2500);
  await click(page.getByRole('button', { name: 'Full screen: Sequence workflow' })); await sleep(2000);
  const main = page.getByRole('region', { name: 'Main sequence' }).getByRole('button');
  const n = Math.min(await main.count(), 9);
  for (let i = 0; i < n; i++) await hover(main.nth(i), 1500);
});
await scene('wf2', 'Reply handling: every reply has its own path', async () => {
  const lane = page.getByRole('region', { name: 'Reply handling' }); await lane.scrollIntoViewIfNeeded().catch(() => {}); await sleep(1500);
  const rep = lane.getByRole('button'); const n = Math.min(await rep.count(), 6);
  for (let i = 0; i < n; i++) await hover(rep.nth(i), 1600);
});
await scene('wf3', 'Fully editable: click, change, saved', async () => {
  await click(page.getByRole('button', { name: /^Email 1/ }).first()); await sleep(1500);
  const ed = page.getByRole('dialog', { name: /^Edit:/ }); await sleep(1500);
  const subj = ed.getByLabel('Subject', { exact: true }); if (await subj.count()) { const v = await subj.inputValue(); await type(subj, ' ', 80); await subj.fill(v); }
  await sleep(1500); await click(ed.getByRole('button', { name: 'Done' })); await sleep(1500);
  await click(page.getByRole('button', { name: /^Wait \d+ days?/ }).first()); await sleep(1500);
  const w = page.getByRole('dialog', { name: /^Edit:/ }); await w.getByRole('button', { name: 'Done' }).click({ force: true }); await sleep(1200);
  await click(page.getByRole('button', { name: 'Exit full screen' })); await sleep(1000);
});

await scene('emails', 'Emails · Reply playbook · Test & preview', async () => {
  await click(page.getByRole('tab', { name: /^Emails/ })); await sleep(3500);
  await click(page.getByRole('tab', { name: 'Reply playbook' })); await sleep(3500);
  await click(page.getByRole('tab', { name: 'Test & preview' })); await sleep(1500);
  const run = page.getByRole('button', { name: 'Run test' }); if (await run.count()) { await click(page.getByRole('button', { name: 'Replies: interested', exact: true }).first()); await click(run); await sleep(2500); }
});

await scene('leads', 'Leads + a goal = your engine, for any industry', async () => {
  const t = page.getByRole('tab', { name: /^(Leads|Add leads|Import)/ }).first();
  if (await t.count()) { await click(t); await sleep(2500); await smoothScroll(300, 3); }
});

await scene('templates', 'Industry templates: a ready-made head start', async () => {
  await go('/client-acquisition/templates'); await sleep(2500);
  await click(page.getByRole('button', { name: /Real Estate/ }).first()); await sleep(3000);
  const guide = page.getByRole('button', { name: 'Industry guide' }); if (await guide.count()) { await click(guide); await sleep(2500); await click(page.getByRole('button', { name: 'Next' }).first()); await sleep(2500); }
});

await scene('outro', 'RUNVAX 2.0 · runvax.com', async () => {
  await card('__end', 'Find the businesses. Build the engine. Win the clients.', 'Any country · Any industry · Start free at runvax.com'); await sleep(1000);
});

await page.waitForTimeout(1500);
await ctx.close(); await browser.close();
fs.writeFileSync(path.join(work, 'starts.json'), JSON.stringify(starts, null, 2));
fs.writeFileSync(path.join(work, 'cuts.json'), JSON.stringify(cuts, null, 2));
console.log('recorded', starts, cuts);
