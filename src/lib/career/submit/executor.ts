import type { Page } from '@playwright/test';
import { cvFileName, cvPdfBytes } from '@/lib/career/cvPdfCore';
import type { CareerProfileData, Standing } from '@/lib/career/types';
import { assertAllowed, type Platform } from './platform';
import { BLOCKED_TEXT, CHALLENGE_TEXT, CLOSED_TEXT, CONFIRMATION, SUBMIT_LABEL } from './detect';
import { planForm, type FormField, type PreparedAnswer, type Plan, type Unresolved } from './mapper';

/**
 * Application Executor: opens ONE employer's hosted form, reads it, maps it, and (only if everything required can be answered honestly) fills and submits it.
 * Runs in the worker process (needs Chromium); the web app never imports this file.
 *
 * Hard rules, enforced here:
 *  - only allow-listed hosts are ever opened;
 *  - no stealth, no solving, no waiting out a CAPTCHA / security check / block: it stops and hands the application back;
 *  - nothing is typed until the whole form is mapped and nothing required is unresolved;
 *  - the submit button is pressed AT MOST ONCE; 'submitted' is reported only after the site's own confirmation is seen;
 *  - a press with no confirmation is 'unconfirmed' (it may have gone through) and is never retried.
 */
export interface ExecInput { applyUrl: string; platform: Platform | 'fixture'; cv: CareerProfileData; coverLetter: string; answers: PreparedAnswer[]; standing?: Standing; mode: 'check' | 'submit'; extraHosts?: string[]; confirmWaitMs?: number }
export type ExecStatus = 'checked' | 'submitted' | 'needs_you' | 'unconfirmed' | 'failed';
export interface ExecResult { status: ExecStatus; reason: string; questions: Unresolved[]; steps: Array<{ label: string; source: string }>; evidence: string; finalUrl: string }

const done = (status: ExecStatus, reason: string, extra: Partial<ExecResult> = {}): ExecResult => ({ status, reason, questions: [], steps: [], evidence: '', finalUrl: '', ...extra });

/** Runs in the page: every visible field of the main form, with a stable data-rvx id, its label, type and whether it is required. */
const READ_FORM = `(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const txt = (el) => (el ? (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim() : '');
  const labelOf = (el) => {
    const aria = el.getAttribute('aria-label'); if (aria) return aria.trim();
    const lb = el.getAttribute('aria-labelledby'); if (lb) { const t = lb.split(/\\s+/).map((i) => txt(document.getElementById(i))).join(' ').trim(); if (t) return t; }
    if (el.id) { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (l) return txt(l); }
    const wrap = el.closest('label'); if (wrap && txt(wrap)) return txt(wrap);
    const fs = el.closest('fieldset'); if (fs) { const lg = fs.querySelector('legend'); if (lg) return txt(lg); }
    const box = el.closest('.application-field, .application-question, .field, .form-group, [class*="question"]');
    if (box) { const l = box.querySelector('label, .application-label, [class*="label"]'); if (l && txt(l)) return txt(l); }
    return (el.getAttribute('placeholder') || el.getAttribute('name') || '').trim();
  };
  const clean = (t) => t.replace(/[\u2731*]+/g, ' ').replace(/\\s+/g, ' ').trim();
  // The question a control belongs to: an ARIA group label, else the nearest question label above it (Lever: .application-label, Greenhouse: label/legend of the group).
  const questionOf = (el, form) => {
    const grp = el.closest('[role="group"],[role="radiogroup"]');
    if (grp) { const lb = grp.getAttribute('aria-labelledby'); const t = lb ? lb.split(/\s+/).map((i) => txt(document.getElementById(i))).join(' ').trim() : (grp.getAttribute('aria-label') || ''); if (t) return t; }
    let node = el.parentElement;
    for (let i = 0; i < 7 && node && node !== form; i++, node = node.parentElement) {
      const c = node.querySelector('.application-label .text, .application-label, legend, [class*="question-label" i], [class*="field-label" i], label:not(:has(input,select,textarea))');
      if (c && txt(c).length > 1) return txt(c);
    }
    return '';
  };
  const forms = Array.from(document.forms); if (!forms.length) return { fields: [], formCount: 0 };
  const count = (f) => f.querySelectorAll('input,textarea,select').length;
  const form = forms.sort((a, b) => count(b) - count(a))[0];
  const out = []; const groups = new Map(); let n = 0;
  for (const el of Array.from(form.querySelectorAll('input,textarea,select'))) {
    const t = (el.getAttribute('type') || el.tagName).toLowerCase();
    if (['hidden', 'submit', 'button', 'image', 'reset'].includes(t)) continue;
    if (/g-recaptcha-response|h-captcha-response/.test(el.name || el.id || '')) continue;
    if (t !== 'file' && !vis(el)) continue;
    const name = el.getAttribute('name') || '';
    let label = labelOf(el); const q = questionOf(el, form);
    if (!label || label === name || /\\[.*\\]/.test(label) || label.length > 200) label = q || label;
    const required = el.required || el.getAttribute('aria-required') === 'true' || /[*\u2731]\\s*$/.test(label) || /[*\u2731]/.test(q.slice(-3));
    label = clean(label);
    if ((t === 'radio' || t === 'checkbox') && name) {
      const g = groups.get(t + ':' + name);
      const opt = txt(el.closest('label')) || el.value;
      if (g) { g.options.push(clean(opt)); el.setAttribute('data-rvx', g.id + '#' + (g.options.length - 1)); g.required = g.required || required; continue; }
      const id = 'f' + (n++); const fs = el.closest('fieldset'); const gl = fs && fs.querySelector('legend') ? txt(fs.querySelector('legend')) : '';
      const grp = { id, label: clean(q || gl || label), type: t, required, name, options: [clean(opt)] }; groups.set(t + ':' + name, grp); out.push(grp); el.setAttribute('data-rvx', id + '#0'); continue;
    }
    const id = 'f' + (n++); el.setAttribute('data-rvx', id);
    const combo = el.getAttribute('role') === 'combobox';
    const type = el.tagName === 'TEXTAREA' ? 'textarea' : el.tagName === 'SELECT' || combo ? 'select' : t === 'file' ? 'file' : ['email', 'tel', 'url', 'number', 'checkbox', 'radio'].includes(t) ? t : 'text';
    const options = el.tagName === 'SELECT' ? Array.from(el.options).map((o) => txt(o)).filter(Boolean) : combo ? [] : undefined;
    out.push({ id, label, type, required, name, options, accept: el.getAttribute('accept') || undefined });
  }
  return { fields: out, formCount: forms.length };
})()`;

/** Runs in the page: is a human-check actually in front of the user (not just an invisible badge)? */
const CHALLENGE_VISIBLE = `(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 40 && r.height > 40 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const sel = 'iframe[src*="recaptcha/api2/bframe"], iframe[src*="recaptcha/api2/anchor"], iframe[src*="hcaptcha.com"], iframe[src*="challenges.cloudflare.com"], .h-captcha, .g-recaptcha, .cf-turnstile, [data-sitekey], #security-input, input[name*="security" i], input[autocomplete="one-time-code"]';
  return Array.from(document.querySelectorAll(sel)).some((el) => !el.closest('.grecaptcha-badge') && el.getAttribute('data-size') !== 'invisible' && (el.matches('input') ? vis(el) : vis(el)));
})()`;

const pageText = (p: Page) => p.evaluate(() => document.body?.innerText ?? '').catch(() => '');
const snippet = (t: string, re: RegExp) => { const m = t.match(re); if (!m || m.index == null) return ''; return t.slice(Math.max(0, m.index - 20), m.index + m[0].length + 80).replace(/\s+/g, ' ').trim().slice(0, 300); };

export async function runExecutor(input: ExecInput): Promise<ExecResult> {
  try { assertAllowed(input.applyUrl, input.extraHosts); } catch (e) { return done('failed', e instanceof Error ? e.message : 'That address is not allowed.'); }
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({ headless: true });
  let pressed = false;
  const overall = setTimeout(() => { void browser.close().catch(() => undefined); }, 150_000);
  try {
    const ctx = await browser.newContext({ acceptDownloads: false, viewport: { width: 1280, height: 1600 } });
    const page = await ctx.newPage();
    const resp = await page.goto(input.applyUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    assertAllowed(page.url(), input.extraHosts);                              // a redirect must not take us somewhere else
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
    const text = await pageText(page);
    if (resp && (resp.status() === 403 || resp.status() === 429 || BLOCKED_TEXT.test(text.slice(0, 600)))) return done('needs_you', 'The site blocked automated access. Apply yourself using the posting link.', { finalUrl: page.url() });
    if (resp && resp.status() >= 400 || CLOSED_TEXT.test(text.slice(0, 1500))) return done('failed', 'The form is closed or no longer exists.', { finalUrl: page.url() });
    if (await page.evaluate(CHALLENGE_VISIBLE) || CHALLENGE_TEXT.test(text.slice(0, 2000))) return done('needs_you', 'The form shows a CAPTCHA or security check. Those are for you to complete, so apply yourself using the posting link.', { finalUrl: page.url() });

    const read = await page.evaluate(READ_FORM) as { fields: FormField[]; formCount: number };
    if (!read.fields.length) return done('needs_you', 'The agent could not find an application form on that page.', { finalUrl: page.url() });
    const plan: Plan = planForm(read.fields, input.cv, { coverLetter: input.coverLetter, answers: input.answers, standing: input.standing });
    const steps = plan.fill.map((f) => ({ label: f.field.label.slice(0, 120), source: f.source }));
    if (plan.unresolved.length) return done('needs_you', `${plan.unresolved.length} required question(s) cannot be answered from your confirmed profile or approved answers. Nothing was typed or sent.`, { questions: plan.unresolved.slice(0, 20), steps, finalUrl: page.url() });
    if (input.mode === 'check') return done('checked', `The form can be completed from your profile and approved answers (${plan.fill.length} field(s)). Nothing was typed or sent.`, { steps, finalUrl: page.url() });

    // ── fill (only now) ──
    const pdf = await cvPdfBytes(input.cv); const fileName = cvFileName(input.cv);
    for (const f of plan.fill) {
      const loc = page.locator(`[data-rvx="${f.field.id}"], [data-rvx^="${f.field.id}#"]`);
      if (f.field.type === 'file') { await loc.first().setInputFiles({ name: fileName, mimeType: 'application/pdf', buffer: Buffer.from(pdf) }); continue; }
      if (f.field.type === 'select') { await loc.first().selectOption({ label: f.value }); continue; }
      if (f.field.type === 'radio') { const i = (f.field.options ?? []).indexOf(f.value); await page.locator(`[data-rvx="${f.field.id}#${i}"]`).check(); continue; }
      await loc.first().fill(f.value);
    }
    if (await page.evaluate(CHALLENGE_VISIBLE)) return done('needs_you', 'A security check appeared while filling the form. Nothing was sent.', { steps, finalUrl: page.url() });

    // ── submit: pressed once, never retried ──
    const buttons = page.locator('button[type="submit"], input[type="submit"], button');
    const n = await buttons.count(); let target = -1;
    for (let i = 0; i < n; i++) { const b = buttons.nth(i); if (!(await b.isVisible()) || !(await b.isEnabled())) continue; const label = ((await b.innerText().catch(() => '')) || (await b.getAttribute('value')) || '').replace(/\s+/g, ' ').trim(); if (SUBMIT_LABEL.test(label)) { target = i; break; } }
    if (target < 0) return done('needs_you', 'The agent could not find the submit button. Nothing was sent.', { steps, finalUrl: page.url() });
    pressed = true; await buttons.nth(target).click({ timeout: 10_000 });

    const re = CONFIRMATION[input.platform] ?? CONFIRMATION.fixture; const deadline = Date.now() + (input.confirmWaitMs ?? 25_000);
    while (Date.now() < deadline) {
      await page.waitForTimeout(500);
      const t = await pageText(page);
      if (re.test(t)) return done('submitted', 'The site confirmed the application.', { steps, evidence: snippet(t, re), finalUrl: page.url() });
      if (await page.evaluate(CHALLENGE_VISIBLE)) return done('unconfirmed', 'A security check appeared after pressing submit. The application may NOT have gone through. Check your email, then apply yourself if needed. It will not be retried.', { steps, finalUrl: page.url() });
    }
    const t = await pageText(page); const err = await page.locator('[aria-invalid="true"], .error, .field-error, [class*="error" i]').first().innerText({ timeout: 1000 }).catch(() => '');
    return done('unconfirmed', `Submit was pressed but no confirmation appeared${err ? ` (the page said: "${err.replace(/\s+/g, ' ').slice(0, 120)}")` : ''}. It may or may not have gone through. Check your email before applying again. It will not be retried.`, { steps, evidence: t.slice(0, 200).replace(/\s+/g, ' '), finalUrl: page.url() });
  } catch (e) {
    const msg = e instanceof Error ? e.message.split('\n')[0].slice(0, 200) : 'Unknown error';
    return pressed ? done('unconfirmed', `The submit button was pressed, then the browser stopped (${msg}). It may or may not have gone through. It will not be retried.`) : done('failed', `The form could not be opened or read (${msg}). Nothing was sent.`);
  } finally { clearTimeout(overall); await browser.close().catch(() => undefined); }
}
