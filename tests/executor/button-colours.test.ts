import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { Browser, Page } from '@playwright/test';

/**
 * Real Chromium + the real stylesheet. Every purple (or green) filled button must have WHITE text, whether it is a <button> or a link
 * styled as a button, in its normal state and on hover. (Links used to inherit dark text from ".acq-root a { color: inherit }".)
 */
const css = fs.readFileSync(path.join(process.cwd(), 'src/app/client-acquisition/acq.css'), 'utf8');
const FILLED = ['acq-btn-primary', 'acq-btn-indigo', 'acq-btn-gen', 'acq-btn-start', 'acq-btn-green'];
const WHITE = 'rgb(255, 255, 255)';
let browser: Browser; let page: Page;

beforeAll(async () => {
  const { chromium } = await import('@playwright/test');
  browser = await chromium.launch({ headless: true }); page = await browser.newPage();
  const items = FILLED.flatMap((c) => [`<a id="a-${c}" href="#x" class="acq-btn ${c}">Link</a>`, `<a id="as-${c}" href="#x" class="acq-btn acq-btn-sm ${c}">Small link</a>`, `<button id="b-${c}" class="acq-btn ${c}">Button</button>`, `<button id="bd-${c}" class="acq-btn ${c}" disabled>Disabled</button>`]);
  await page.setContent(`<style>${css}</style><div class="acq-root"><div class="acq-card">${items.join(' ')}</div></div>`);
});
afterAll(async () => { await browser?.close(); });
const colour = (sel: string) => page.locator(sel).evaluate((el) => getComputedStyle(el).color);

describe('filled buttons have white text', () => {
  for (const c of FILLED) {
    it(`${c}: as a link, as a small link, as a button, disabled`, async () => {
      expect(await colour(`#a-${c}`)).toBe(WHITE); expect(await colour(`#as-${c}`)).toBe(WHITE);
      expect(await colour(`#b-${c}`)).toBe(WHITE); expect(await colour(`#bd-${c}`)).toBe(WHITE);
    });
    it(`${c}: stays white on hover (link and button)`, async () => {
      for (const sel of [`#a-${c}`, `#b-${c}`]) {
        const bgOf = () => page.locator(sel).evaluate((el) => getComputedStyle(el).backgroundColor);
        await page.mouse.move(0, 600); await page.waitForTimeout(250); const before = await bgOf();
        const r = (await page.locator(sel).boundingBox())!; await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2, { steps: 6 }); await page.waitForTimeout(300);
        expect(await colour(sel)).toBe(WHITE);
        if (c !== 'acq-btn-gen' && c !== 'acq-btn-start') expect(await bgOf()).not.toBe(before);          // the hover style really applied (gradient buttons keep their image)
      }
    });
  }
});
