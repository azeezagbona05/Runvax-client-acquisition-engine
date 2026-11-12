// Records "How to create an AI agent with RUNVAX" against a LOCAL server + throwaway database. Never point BASE at production.
// usage: node record-agent.mjs <workdir>   env: BASE (default http://localhost:3200), EMAIL, PASS
import { chromium } from '/Users/user/Documents/ai-prospect-tool/node_modules/playwright/index.mjs';
import fs from 'node:fs'; import path from 'node:path';

const work = process.argv[2];
const BASE = process.env.BASE ?? 'http://localhost:3200';
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error('Refusing to record against a non-local server');
const EMAIL = process.env.EMAIL ?? 'chioma.eze@example.com', PASS = process.env.PASS ?? 'Demo-Pass-2026!';
const SITE = 'http://localhost:3201/'; // a pretend customer website, served by a route in this script
const dur = JSON.parse(fs.readFileSync(path.join(work, 'audio/durations.json')));
fs.rmSync(path.join(work, 'video'), { recursive: true, force: true });
const ARGS = ['--disable-features=BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,LocalNetworkAccessChecks,LocalNetworkAccessChecksWebSockets'];
const SEED = () => { try { localStorage.setItem('runvax_welcome_seen', '1'); localStorage.setItem('pwa_dismissed_at', String(Date.now())); localStorage.setItem('runvax_v2_popup_seen_at', String(Date.now())); localStorage.setItem('runvax_v2_banner_seen_at', String(Date.now())); } catch {} };

const browser = await chromium.launch({ headless: true, args: ARGS });
// Log in first, in a separate context, so the recording starts inside the app.
const pre = await browser.newContext({ viewport: { width: 1536, height: 864 } }); await pre.addInitScript(SEED);
const pp = await pre.newPage(); pp.setDefaultTimeout(90_000);
await pp.goto(BASE + '/auth/signin', { waitUntil: 'domcontentloaded' }); await pp.waitForLoadState('networkidle').catch(() => {}); await pp.waitForTimeout(2500);
for (let i = 0; i < 6; i++) { await pp.locator('#signin-email').fill(EMAIL); await pp.locator('#signin-password').fill(PASS); if ((await pp.locator('#signin-password').inputValue()) === PASS) break; await pp.waitForTimeout(1500); }
await pp.locator('form button[type=submit]').click(); await pp.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 90_000 });
const state = await pre.storageState(); await pre.close();

const ctx = await browser.newContext({ storageState: state, viewport: { width: 1536, height: 864 }, recordVideo: { dir: path.join(work, 'video'), size: { width: 1536, height: 864 } }, locale: 'en-NG', timezoneId: 'Africa/Lagos' });
await ctx.addInitScript(SEED);
await ctx.addInitScript(() => {
  const mk = () => {
    if (document.getElementById('__cur')) return;
    const c = document.createElement('div'); c.id = '__cur';
    c.style.cssText = 'position:fixed;z-index:2147483647;width:22px;height:22px;border-radius:50%;background:rgba(147,51,234,.35);border:2px solid #9333ea;pointer-events:none;left:-50px;top:-50px;transform:translate(-50%,-50%);transition:left .05s,top .05s';
    const k = document.createElement('div'); k.id = '__cap';
    k.style.cssText = 'position:fixed;z-index:2147483646;left:50%;bottom:26px;transform:translateX(-50%);max-width:1100px;padding:12px 26px;border-radius:14px;background:rgba(15,23,42,.88);color:#fff;font:600 21px/1.35 Inter,system-ui,sans-serif;text-align:center;pointer-events:none;display:none;box-shadow:0 8px 30px rgba(0,0,0,.3)';
    document.documentElement.append(c, k);
    const m = document.cookie.match(/(?:^|; )__cap=([^;]*)/); const cap = m ? decodeURIComponent(m[1]) : localStorage.getItem('__capText'); if (cap) { k.textContent = cap; k.style.display = 'block'; }
    const pos = JSON.parse(sessionStorage.getItem('__pos') || '[-50,-50]'); c.style.left = pos[0] + 'px'; c.style.top = pos[1] + 'px';
  };
  document.addEventListener('DOMContentLoaded', mk); if (document.readyState !== 'loading') mk();
  document.addEventListener('mousemove', (e) => { const c = document.getElementById('__cur'); if (c) { c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; } try { sessionStorage.setItem('__pos', JSON.stringify([e.clientX, e.clientY])); } catch {} }, true);
  const st = document.createElement('style'); st.textContent = 'nextjs-portal{display:none!important}'; document.addEventListener('DOMContentLoaded', () => document.head.append(st));
});
// The pretend customer website: a page with the RUNVAX chat script installed, exactly as a customer would paste it.
await ctx.route(SITE, (r) => r.fulfill({ contentType: 'text/html', body: '__SITE__' }));
const page = await ctx.newPage(); page.setDefaultTimeout(120_000);
const t0 = Date.now(); const starts = {}; const cuts = []; let sceneEnd = 0;
const now = () => (Date.now() - t0) / 1000; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let curCap = '';
async function caption(text) { curCap = text; await page.evaluate((t) => { try { localStorage.setItem('__capText', t); document.cookie = '__cap=' + encodeURIComponent(t) + ';path=/;max-age=3600'; } catch {} const k = document.getElementById('__cap'); if (k) { k.textContent = t; k.style.display = t ? 'block' : 'none'; } }, text).catch(() => {}); }
async function move(box) { await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 22 }); }
async function click(loc, opts = {}) { await loc.scrollIntoViewIfNeeded(); const b = await loc.boundingBox(); if (b) await move(b); await sleep(250); await loc.click({ force: true, ...opts }); await sleep(350); }
async function typeSure(loc, text, delay = 28) { for (let k = 0; k < 6; k++) { await loc.fill(''); await click(loc); await loc.pressSequentially(text, { delay }); await sleep(300); if ((await loc.inputValue()) === text) return; await page.waitForTimeout(1500); } throw new Error('typing did not stick'); }
async function hover(loc, ms = 1300) { const b = await loc.boundingBox().catch(() => null); if (b) await move(b); await sleep(ms); }
async function smoothScroll(by, steps = 6) { for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, by / steps); await sleep(450); } }
// A wait for the AI: whatever lasts longer than the narration is sped up in the final video.
async function slow(p) { const from = now(); const r = await p; const to = now(); const f = Math.max(from + 2, sceneEnd + 0.6); if (to - f > 4) cuts.push({ from: f, to, factor: 10 }); return r; }
async function scene(id, cap, fn) {
  console.log('▶', id); starts[id] = now(); sceneEnd = starts[id] + dur[id]; const s = Date.now();
  await caption(cap);
  try { await fn(); } catch (e) { await page.screenshot({ path: path.join(work, `fail-${id}.png`) }).catch(() => {}); throw e; }
  const left = (dur[id] + 0.8) * 1000 - (Date.now() - s); if (left > 0) await sleep(left);
}
const go = async (u) => { await page.goto(BASE + u, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(1200); await caption(curCap); };
const card = (id, sub, extra = '') => page.evaluate(([id, sub, extra, base]) => { const d = document.createElement('div'); d.id = id; d.style.cssText = 'position:fixed;inset:0;z-index:2147483645;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Inter,system-ui,sans-serif;text-align:center'; d.innerHTML = `<img src="${base}/logo-horizontal.png" style="width:min(820px,80vw)"><div style="font-size:34px;font-weight:700;margin-top:30px;color:#4c1d95">${sub}</div><div style="font-size:23px;margin-top:20px;color:#475569">${extra}</div>`; document.body.append(d); }, [id, sub, extra, BASE]);

const ASSISTANT_PROMPT = 'We are Brightpay, a payroll and HR software company for small businesses in Lagos. Put a chat on our website that answers questions, asks company size and the tool they use today, and books a demo with warm leads.';
const CONTENT_PROMPT = 'We are Brightpay, payroll software for SMEs in Lagos. Publish two articles a week for HR managers about payroll, pension and tax.';
async function ask(prompt) {
  const box = page.getByLabel('Describe the agent you want, in plain English'); await box.waitFor();
  await typeSure(box, prompt); await sleep(800); await click(page.getByRole('button', { name: 'Build my agent' }));
}

await go('/'); await go('/client-acquisition/agents');

await scene('intro', 'Build an AI agent for your business with RUNVAX', async () => { await card('__title', 'Build an AI agent for your business', 'Describe it in plain English · Try it · Deploy it anywhere'); await sleep(800); });

await scene('agents', 'AI Agents → Build an agent', async () => {
  await page.evaluate(() => document.getElementById('__title')?.remove()); await sleep(1500);
  await hover(page.getByText('Your agents').first(), 1800);
  await hover(page.getByRole('link', { name: /Build an agent/ }), 1200);
  await click(page.getByRole('link', { name: /Build an agent/ })); await page.waitForURL('**/agents/new');
});

await scene('describe', 'Describe the agent you want, in plain English', async () => {
  await sleep(1500);
  await hover(page.getByText('Or start from a template'), 1500);
  await ask('A WhatsApp bot that answers my customers and sends them price lists every morning');
  await page.getByText('Not available yet').waitFor(); await sleep(3500);
  await ask(ASSISTANT_PROMPT.replace('', ''));
});

await scene('build', 'RUNVAX builds your agent…', async () => {
  await slow(page.getByRole('region', { name: 'Review your agent' }).waitFor({ timeout: 180_000 }));
  await sleep(500);
});

await scene('review', 'Review: business, knowledge, qualifying questions', async () => {
  await sleep(1500); await hover(page.locator('#ab-name'), 1200); await hover(page.locator('#ag-about'), 1800); await hover(page.locator('#ag-know'), 2800);
  await page.locator('#ag-q').scrollIntoViewIfNeeded(); await hover(page.locator('#ag-q'), 3500); await hover(page.locator('#ag-cal'), 1500); await hover(page.locator('#ag-priv'), 1500); await hover(page.locator('#ag-mail'), 1500);
});

await scene('try', 'Try it: a safe preview. Nothing is saved or sent', async () => {
  const sec = page.locator('section[aria-label="Try your agent"]'); await sec.scrollIntoViewIfNeeded(); await sleep(1800);
  const input = page.getByLabel('Your message to the assistant'); const bubbles = () => page.locator('[aria-label="Preview conversation"] > div');
  await typeSure(input, 'How does it work, and what does it cost?'); await input.press('Enter');
  await slow(page.waitForFunction(() => { const l = document.querySelector('[aria-label="Preview conversation"]'); return !!l && !l.querySelector('.animate-spin') && l.querySelectorAll(':scope > div').length >= 4; }, null, { timeout: 90_000 })); await sleep(2500);
  await typeSure(input, 'We have 40 staff and use spreadsheets. I am Tunde, tunde@brightpay-demo.test'); await input.press('Enter');
  await slow(page.getByText(/The assistant picked up/).waitFor({ timeout: 90_000 })); await sleep(3500);
});

await scene('save', 'Save the agent, then switch it on', async () => {
  await click(page.getByRole('button', { name: 'Save agent' })); await page.waitForURL((u) => /agents\/[a-z0-9]{20,}$/.test(u.pathname)); await page.waitForLoadState('networkidle').catch(() => {}); await sleep(1500);
  await click(page.getByRole('button', { name: 'Switch on' })); await page.getByText('Your agent is running.').waitFor(); await sleep(1500);
});

await scene('deploy', 'Deploy: your website, a hosted page, or Telegram', async () => {
  await click(page.getByRole('tab', { name: 'Deploy' })); await sleep(1500);
  await hover(page.locator('pre').first(), 3500); await smoothScroll(300, 3); await hover(page.getByRole('heading', { name: 'Telegram bot' }), 2500); await hover(page.locator('#tg-token'), 2500);
});

await scene('live', 'On a customer\'s website', async () => {
  const key = (await (await ctx.request.get(BASE + '/api/client-acquisition/agents')).json()).agents.find((a) => a.kind === 'assistant').publicKey;
  await ctx.unroute(SITE); await ctx.route(SITE, (r) => r.fulfill({ contentType: 'text/html', body: SITE_HTML(BASE, key) }));
  await page.goto(SITE, { waitUntil: 'domcontentloaded' }); await page.getByLabel(/Chat with/).waitFor(); await caption(curCap); await sleep(1500);
  await click(page.getByLabel(/Chat with/)); await sleep(2500);
  const inp = page.getByLabel('Your message'); await hover(page.getByText(/You are chatting with an AI assistant/), 2500);
  await typeSure(inp, 'Do you support pension and tax?'); await inp.press('Enter');
  await slow(page.waitForFunction(() => !document.body.innerText.includes('…') , null, { timeout: 90_000 })); await sleep(1500);
  await typeSure(inp, 'Great. I am Tunde from Kola Foods, tunde@kolafoods-demo.test'); await inp.press('Enter');
  await slow(page.waitForFunction(() => !document.body.innerText.includes('…') , null, { timeout: 90_000 })); await sleep(2500);
});

await scene('leads', 'The lead arrives in RUNVAX', async () => {
  const id = (await (await ctx.request.get(BASE + '/api/client-acquisition/agents')).json()).agents.find((a) => a.kind === 'assistant').id;
  await go('/client-acquisition/agents/' + id); await sleep(1500);
  await page.getByText(/kolafoods-demo\.test/).first().waitFor({ timeout: 30_000 }); await hover(page.getByText(/kolafoods-demo\.test/).first(), 2200);
  await click(page.getByRole('button', { name: /Read the conversation/ }).first()); await sleep(3500);
});

await scene('content', 'The same way: a Visibility Agent writes articles', async () => {
  await go('/client-acquisition/agents/new'); await sleep(1000);
  await ask(CONTENT_PROMPT);
  await slow(page.getByRole('region', { name: 'Review your agent' }).waitFor({ timeout: 180_000 })); await sleep(1500);
  await page.locator('section[aria-label="Try your agent"]').scrollIntoViewIfNeeded(); await sleep(1500);
  await click(page.getByRole('button', { name: 'Write a preview article' }));
  await slow(page.getByRole('article', { name: 'Preview article' }).waitFor({ timeout: 180_000 })); await sleep(2500); await smoothScroll(500, 4);
});

await scene('outro', 'RUNVAX · runvax.com', async () => { await card('__end', 'Describe it · Review it · Try it · Deploy it', 'AI agents for your business, built in minutes · Start free at runvax.com'); await sleep(800); });

await page.waitForTimeout(1500);
await ctx.close(); await browser.close();
fs.writeFileSync(path.join(work, 'starts.json'), JSON.stringify(starts, null, 2));
fs.writeFileSync(path.join(work, 'cuts.json'), JSON.stringify(cuts, null, 2));
console.log('recorded', starts, cuts);

function SITE_HTML(base, key) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Brightpay</title><style>body{margin:0;font-family:system-ui,sans-serif;color:#0f172a}header{display:flex;justify-content:space-between;padding:18px 48px;border-bottom:1px solid #e2e8f0}.hero{padding:90px 48px;background:linear-gradient(135deg,#eff6ff,#f5f3ff)}.hero h1{font-size:46px;margin:0 0 12px;max-width:640px}.hero p{font-size:19px;color:#475569;max-width:560px}.btn{display:inline-block;margin-top:18px;padding:12px 22px;background:#1d4ed8;color:#fff;border-radius:10px;font-weight:600}</style></head><body><header><b>Brightpay</b><span>Product · Pricing · About</span></header><div class="hero"><h1>Payroll and HR for growing Lagos businesses</h1><p>Run payroll, pension and tax in minutes, not days.</p><span class="btn">Book a demo</span></div><script async src="${base}/runvax-chat.js" data-key="${key}" data-color="#7e22ce"></script></body></html>`;
}
