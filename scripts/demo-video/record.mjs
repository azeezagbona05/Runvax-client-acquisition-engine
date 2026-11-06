// Records the RUNVAX demo against a LOCAL server + throwaway database. Never point BASE at production.
// usage: node record.mjs <workdir> [--fast]   env: BASE (default http://localhost:3200), COUNT (businesses, default 200), DB_CMD (shell cmd that upgrades the demo user)
import { chromium } from '/Users/user/Documents/ai-prospect-tool/node_modules/playwright/index.mjs';
import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process';

const work = process.argv[2]; const FAST = process.argv.includes('--fast');
const BASE = process.env.BASE ?? 'http://localhost:3200'; const COUNT = process.env.COUNT ?? '200';
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error('Refusing to record against a non-local server');
const dur = JSON.parse(fs.readFileSync(path.join(work, 'audio/durations.json')));
const EMAIL = `tunde.bakare.${Date.now() % 100000}@example.com`, PASS = 'Demo-Pass-2026!', NAME = 'Tunde Bakare';
fs.rmSync(path.join(work, 'video'), { recursive: true, force: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1536, height: 864 }, recordVideo: { dir: path.join(work, 'video'), size: { width: 1536, height: 864 } }, locale: 'en-NG', timezoneId: 'Africa/Lagos' });
await ctx.addInitScript(() => {
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
});
const page = await ctx.newPage();
page.setDefaultTimeout(30_000);
const t0 = Date.now(); const starts = {};
const sleep = (ms) => (FAST ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));

async function caption(text) { await page.evaluate((t) => { try { localStorage.setItem('__capText', t); } catch {} const k = document.getElementById('__cap'); if (k) { k.textContent = t; k.style.display = t ? 'block' : 'none'; } }, text).catch(() => {}); }
async function move(box) { await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: FAST ? 1 : 22 }); }
async function click(loc, opts = {}) { await loc.scrollIntoViewIfNeeded(); const b = await loc.boundingBox(); if (b) await move(b); await sleep(250); await loc.click(opts); await sleep(350); }
async function type(loc, text, delay = 55) { await click(loc); await loc.pressSequentially(text, { delay: FAST ? 0 : delay }); await sleep(250); }
async function scene(id, cap, fn) {
  console.log('▶', id); starts[id] = (Date.now() - t0) / 1000; const s = Date.now();
  await caption(cap);
  try { await fn(); } catch (e) { console.log(await page.evaluate(() => [...document.querySelectorAll('input,select,[role=option]')].map((e) => e.tagName + '#' + e.id + '[' + e.getAttribute('role') + ']').join(' ')).catch(() => '')); await page.screenshot({ path: path.join(work, `fail-${id}.png`) }).catch(() => {}); throw e; }
  if (FAST) { fs.mkdirSync(path.join(work, 'snaps'), { recursive: true }); await page.screenshot({ path: path.join(work, 'snaps', id + '.png') }).catch(() => {}); }
  const left = (dur[id] + 0.8) * 1000 - (Date.now() - s); if (!FAST && left > 0) await new Promise((r) => setTimeout(r, left));
}
async function smoothScroll(by, steps = 6) { for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, by / steps); await sleep(500); } }
const go = async (u) => { await page.goto(BASE + u, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(1200); };

await go('/'); await page.waitForTimeout(1500);

await scene('intro', 'RUNVAX · The AI-powered B2B client acquisition engine', async () => {
  await page.evaluate(() => { const d = document.createElement('div'); d.id = '__title'; d.style.cssText = 'position:fixed;inset:0;z-index:2147483645;background:#9333ea;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif;text-align:center'; d.innerHTML = '<div style="font-size:92px;font-weight:800;letter-spacing:-2px">RUNVAX</div><div style="font-size:34px;font-weight:600;margin-top:14px">The AI-powered B2B client acquisition engine</div><div style="font-size:24px;margin-top:30px;opacity:.9">Find businesses · Reach decision-makers · Win clients</div><div style="font-size:22px;margin-top:46px;opacity:.85">Built for Nigeria. Built for any country in the world.</div>'; document.body.append(d); });
  await sleep(1000);
});
await scene('home', 'Before registration: search in any of 249 countries', async () => {
  await page.evaluate(() => document.getElementById('__title')?.remove());
  await sleep(2500);
  for (const c of ['Ghana', 'Kenya', 'United Kingdom', 'Canada', 'Nigeria']) { await click(page.getByRole('button', { name: new RegExp(c) }).first()); await sleep(1200); }
  const search = page.getByText(/search all 249 countries/); if (await search.count()) { await click(search.first()); await sleep(2500); await page.keyboard.press('Escape'); }
});

await scene('signup', 'Create a free account. No card needed.', async () => {
  await click(page.getByRole('link', { name: 'Sign up free' }).first());
  await page.waitForURL('**/auth/signup'); await sleep(800);
  await type(page.locator('#signup-name'), NAME); await type(page.locator('#signup-email'), EMAIL);
  await type(page.locator('#signup-password'), PASS); await type(page.locator('#signup-confirm'), PASS);
  await click(page.getByRole('button', { name: /Show passwords/ })); await sleep(1500);
  await click(page.getByRole('checkbox'));
  await click(page.locator('form button[type=submit]'));
  await page.waitForURL('**/client-acquisition/**', { timeout: 60_000 });
});
// Demo-only: the local throwaway database gets a Pro, verified user so every feature can be shown. Never run on production.
execSync(`mysql -uroot -h127.0.0.1 -P3399 demo -e "UPDATE User SET plan='pro', emailVerified=NOW() WHERE email='${EMAIL}'"`);

const cdp = await ctx.newCDPSession(page);
await cdp.send('WebAuthn.enable');
await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });

await scene('security', 'Settings → Security: switch on biometric login', async () => {
  await go('/client-acquisition/settings?tab=security'); await sleep(2500);
  await click(page.getByRole('button', { name: /Enable on this device/ })); await page.getByText(/Biometric login enabled/).waitFor({ timeout: 20_000 }); await sleep(3000);
});

await scene('login', 'Log in with Google, email, or Face ID / Touch ID', async () => {
  await go('/client-acquisition/settings'); await click(page.getByRole('button', { name: /Sign out/ }).last());
  await page.waitForURL(BASE + '/', { timeout: 30_000 }).catch(() => {});
  await go('/auth/signin'); await sleep(1500);
  await move((await page.getByRole('button', { name: /Continue with Google/ }).boundingBox())); await sleep(4500);
  await type(page.locator('input[type=email]'), EMAIL); await page.keyboard.press('Tab');
  const bio = page.getByRole('button', { name: /Face ID \/ Touch ID/ }); await bio.waitFor({ timeout: 15_000 }); await sleep(3500);
  await click(bio);
  await page.waitForURL('**/client-acquisition/**', { timeout: 30_000 });
});

await scene('switch', 'Classic RUNVAX → switch to RUNVAX 2.0', async () => {
  await go('/'); await sleep(3000);
  await click(page.getByRole('link', { name: /Switch to the new experience/ }));
  await page.waitForURL('**/client-acquisition/find'); await sleep(1500);
});

await scene('tour', 'RUNVAX 2.0 · Client Acquisition', async () => {
  for (const l of ['Lead Lists', 'Campaigns', 'Automation Builder', 'Email Activity', 'Inbox & Opportunities', 'AI Agents']) {
    const a = page.getByRole('link', { name: l }).first(); const b = await a.boundingBox(); if (b) await move(b); await sleep(2200);
  }
  await go('/client-acquisition/find');
});

const country = page.locator('#pf-country');
await scene('countries', 'Built for any country in the world', async () => {
  await sleep(1500);
  for (const c of ['gha', 'ken', 'united k', 'cana']) { await click(country); await country.fill(c); await page.waitForTimeout(2500); await page.screenshot({ path: path.join(work, 'dbg-countries.png') }); await page.getByRole('option').first().waitFor(); await sleep(1200); await click(page.getByRole('option').first()); await sleep(1500); }
});

await scene('search', 'Nigeria · Victoria Island, Lagos · Restaurants · 200 businesses', async () => {
  await click(country); await country.fill('niger'); await page.getByRole('option', { name: 'Nigeria', exact: true }).click(); await sleep(900);
  const loc = page.locator('#pf-loc'); await click(loc); await loc.fill('victoria'); await sleep(900);
  const opt = page.getByRole('option', { name: /Victoria Island/ }).first(); await click(opt);
  await loc.fill('Lekki'); await sleep(900); await page.getByRole('option', { name: /Lekki/ }).first().click(); await sleep(700);
  // remove Lekki again so the demo searches Victoria Island only
  const rm = page.getByRole('button', { name: /^Remove Lekki/ }); if (await rm.count()) await rm.first().click();
  const ind = page.locator('#pf-ind'); await click(ind);
  for (const q of ['school', 'hospital', 'gym']) { await ind.fill(q); await sleep(1600); }
  await ind.fill('restaur'); await sleep(900); await click(page.getByRole('option', { name: /Restaurants/ }).first());
  await page.keyboard.press('Escape');
  await page.getByLabel('How many businesses').fill(COUNT); await sleep(1200);
  await click(page.getByRole('button', { name: 'Find prospects' }));
});

await scene('searching', 'Searching live across the map…', async () => {
  await page.getByText('Searching for prospects…').waitFor({ timeout: 60_000 }).catch(() => {});
  await page.getByText('Searching for prospects…').waitFor({ state: 'hidden', timeout: 600_000 });
  await sleep(1500);
});

await scene('filters', 'Filter the list down to the best prospects', async () => {
  await page.getByRole('group', { name: 'Filter and sort the prospects' }).scrollIntoViewIfNeeded(); await sleep(1500);
  await click(page.locator('#pf-f-web')); await page.locator('#pf-f-web').selectOption('without'); await sleep(2500);
  await click(page.locator('#pf-f-rate')); await page.locator('#pf-f-rate').selectOption('4+'); await sleep(2500);
  await click(page.locator('#pf-f-rev')); await page.locator('#pf-f-rev').selectOption('20'); await sleep(2500);
  await click(page.locator('#pf-f-sort')); await page.locator('#pf-f-sort').selectOption('reviews-high'); await sleep(2500);
  await click(page.getByLabel(/Has a phon/i)); await sleep(2000);
  await smoothScroll(500, 4);
});

await scene('discover', 'Discover by industry: find the people who decide', async () => {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' })); await sleep(1200);
  await click(page.getByRole('tab', { name: 'Discover by industry' })); await sleep(2500);
  await page.locator('#sd-ind').waitFor(); await click(page.locator('#sd-ind')); await page.locator('#sd-ind').selectOption('Restaurants');
  await type(page.locator('#sd-loc'), 'Nigeria'); await page.getByLabel('Kind of place').selectOption('country');
  await click(page.locator('#sd-titles')); await sleep(1500);
  await click(page.getByRole('button', { name: 'Find people' }));
  await page.getByText(/people match|No people found/).first().waitFor({ timeout: 90_000 }).catch(() => {}); await sleep(2000);
  const top3 = page.getByRole('button', { name: /Pick the top 3/ }); if (await top3.count()) await click(top3);
  await smoothScroll(400, 4);
});

await scene('campaign', 'Describe what you sell. RUNVAX builds the engine.', async () => {
  await go('/client-acquisition/automation'); await sleep(2000);
  await type(page.getByLabel('What do you want to sell, and to whom?'), 'I run a web design agency. I want to sell online ordering websites and AI chatbots to restaurants in Victoria Island, Lagos', 35);
  await click(page.getByRole('button', { name: 'Build my campaign' }));
});
await scene('building', 'Building your client acquisition engine…', async () => {
  await page.getByText(/All 7 build steps complete/).waitFor({ timeout: 180_000 }); await sleep(1000);
});
await scene('workflow', 'Workflow · Reply playbook · Test & preview', async () => {
  await sleep(6000); await smoothScroll(300, 3);
  await click(page.getByRole('tab', { name: 'Reply playbook' })); await sleep(5000);
  await click(page.getByRole('tab', { name: 'Test & preview' })); await sleep(2000);
  const run = page.getByRole('button', { name: 'Run test' }); if (await run.count()) { await click(page.getByRole('button', { name: 'Replies: interested', exact: true }).first()); await click(run); await sleep(3000); }
});
await scene('outro', 'RUNVAX · The AI-powered B2B client acquisition engine', async () => {
  await page.evaluate(() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;z-index:2147483645;background:#9333ea;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif;text-align:center'; d.innerHTML = '<div style="font-size:92px;font-weight:800;letter-spacing:-2px">RUNVAX</div><div style="font-size:34px;font-weight:600;margin-top:14px">The AI-powered B2B client acquisition engine</div><div style="font-size:26px;margin-top:34px">Find businesses · Find decision-makers · Launch campaigns · Win clients</div><div style="font-size:24px;margin-top:40px;opacity:.9">Create your free account at runvax.com</div>'; document.body.append(d); });
  await sleep(1000);
});

await page.waitForTimeout(1500);
await ctx.close(); await browser.close();
fs.writeFileSync(path.join(work, 'starts.json'), JSON.stringify(starts, null, 2));
console.log('recorded', starts);
