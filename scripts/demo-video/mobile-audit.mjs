// Phone audit against a LOCAL server: overflow, small tap targets, screenshots. usage: node mobile-audit.mjs <outdir> [label]
import { chromium, devices } from '/Users/user/Documents/ai-prospect-tool/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const out = process.argv[2], label = process.argv[3] ?? 'before'; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['iPhone 14'] }); const p = await ctx.newPage();
await p.goto('http://localhost:3200/auth/signin', { timeout: 90000 }); await p.locator('input[type=email]').waitFor({ timeout: 90000 }); await p.waitForLoadState('networkidle'); await p.waitForTimeout(1500);
await p.locator('input[type=email]').fill('mobile@example.com'); await p.locator('input[type=password]').fill('Demo-Pass-2026!'); await p.locator('form button[type=submit]').click();
await p.waitForURL('**/client-acquisition/**', { timeout: 30000 });
await p.evaluate(() => localStorage.setItem('runvax_welcome_seen', '1'));
const pages = ['/client-acquisition/find', '/client-acquisition', '/client-acquisition/leads', '/client-acquisition/campaigns', '/client-acquisition/automation', '/client-acquisition/activity', '/client-acquisition/inbox', '/client-acquisition/agents', '/client-acquisition/templates', '/client-acquisition/integrations', '/client-acquisition/settings', '/', '/auth/signin', '/auth/signup'];
for (const u of pages) {
  await p.goto('http://localhost:3200' + u, { waitUntil: 'domcontentloaded', timeout: 90000 }); await p.waitForLoadState('networkidle').catch(() => {}); await p.waitForTimeout(2500);
  const m = await p.evaluate(() => {
    const vw = window.innerWidth; const over = document.documentElement.scrollWidth - vw;
    const wide = [...document.querySelectorAll('body *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > vw + 2 && getComputedStyle(e).position !== 'fixed' && !e.closest('[style*="overflow"],table,.overflow-x-auto'); }).slice(0, 3).map((e) => e.tagName + '.' + String(e.className).slice(0, 40));
    const small = [...document.querySelectorAll('button,a,input,select,[role=button],[role=tab]')].filter((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && (r.height < 40 || r.width < 40) && e.type !== 'checkbox' && e.type !== 'radio'; }).length;
    return { over, wide, small, bottomNav: !!document.querySelector('[data-mobile-tabs]') };
  });
  console.log(u.padEnd(34), JSON.stringify(m));
  await p.screenshot({ path: `${out}/${label}-${u.replace(/\W+/g, '_')}.png` });
}
await b.close();
