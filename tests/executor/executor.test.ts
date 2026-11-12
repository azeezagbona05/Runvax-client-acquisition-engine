import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { runExecutor, type ExecInput } from '@/lib/career/submit/executor';
import { sanitizeProfile } from '@/lib/career/types';

/**
 * Real Chromium against LOCAL fixture pages that imitate Greenhouse- and Lever-style forms. No employer site is ever contacted.
 * The server records every POST, so the tests can prove what was (and was not) sent.
 */
const page = (title: string, inner: string) => `<!doctype html><html><head><title>${title}</title></head><body><h1>${title}</h1>${inner}</body></html>`;
const input = (label: string, name: string, attrs = '') => `<div class="field"><label for="${name}">${label}</label><input id="${name}" name="${name}" ${attrs}></div>`;
const SUBMIT = '<button type="submit">Submit application</button>';
const form = (fields: string, extra = '') => `<form method="POST" enctype="multipart/form-data">${fields}${extra}${SUBMIT}</form>`;
const GH = input('First Name *', 'first_name', 'required') + input('Last Name *', 'last_name', 'required') + input('Email *', 'email', 'type="email" required') + input('Phone', 'phone', 'type="tel"')
  + '<div class="field"><label for="resume">Resume/CV *</label><input id="resume" name="resume" type="file" required></div>'
  + '<div class="field"><label for="why">Why do you want this role? *</label><textarea id="why" name="why" required></textarea></div>';
const LEVER = input('Full name', 'name', 'required') + input('Email', 'email', 'type="email" required') + input('Phone', 'phone') + input('Current company', 'org') + input('LinkedIn URL', 'urls[LinkedIn]')
  + '<div class="field"><label for="resume">Resume/CV</label><input id="resume" name="resume" type="file"></div>';

const posts: Record<string, string[]> = {};
let server: http.Server; let base = '';
const routes: Record<string, { status?: number; get: string; post?: string | ((body: string) => string) }> = {
  '/ok': { get: page('Acme - Frontend Developer', form(GH)), post: page('Done', '<p>Thank you for applying to Acme.</p>') },
  '/lever': { get: page('Initech - React Developer', form(LEVER)), post: page('Done', '<p>Application submitted!</p>') },
  '/unknown': { get: page('Beta', form(GH + '<div class="field"><label for="k8s">Describe your experience with Kubernetes *</label><textarea id="k8s" name="k8s" required></textarea></div>')), post: page('Done', 'Thank you for applying') },
  '/legal': { get: page('Beta', form(GH + '<fieldset><legend>Are you legally authorized to work in the United States? *</legend><label><input type="radio" name="auth" value="Yes" required> Yes</label><label><input type="radio" name="auth" value="No"> No</label></fieldset>')), post: page('Done', 'Thank you for applying') },
  '/consent': { get: page('Beta', form(GH + '<label><input type="checkbox" name="agree" required> I have read and agree to the Privacy Notice</label>')), post: page('Done', 'Thank you for applying') },
  '/captcha': { get: page('Gamma', form(GH, '<div class="g-recaptcha" data-sitekey="abc" style="width:300px;height:78px;border:1px solid #ccc">I am not a robot</div>')), post: page('Done', 'Thank you for applying') },
  '/invisible': { get: page('Gamma', form(GH, '<div class="g-recaptcha" data-sitekey="abc" data-size="invisible" style="width:256px;height:60px"></div><div class="grecaptcha-badge" style="width:256px;height:60px"></div>')), post: page('Done', 'Thank you for applying') },
  '/auth': { get: page('Beta', form(GH + input('LinkedIn Profile *', 'li', 'required') + '<fieldset><legend>Are you legally authorized to work in the United States? *</legend><label><input type="radio" name="auth" value="Yes" required> Yes</label><label><input type="radio" name="auth" value="No"> No</label></fieldset>')), post: page('Done', 'Thank you for applying') },
  '/silent': { get: page('Delta', form(GH)), post: page('Delta', form(GH)) },
  '/challenge-after': { get: page('Epsilon', form(GH)), post: page('Epsilon', '<p>Almost there</p><div class="h-captcha" data-sitekey="x" style="width:303px;height:78px">Verify you are human</div>') },
  '/blocked': { status: 403, get: 'Access denied' },
  '/closed': { get: page('Zeta', '<p>This job is no longer accepting applications.</p>') },
  '/noform': { get: page('Eta', '<p>Hello</p>') },
};

beforeAll(async () => {
  server = http.createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    if (path === '/away') { res.writeHead(302, { Location: `http://localhost:${(server.address() as AddressInfo).port}/ok` }); return res.end(); }
    const r = routes[path]; if (!r) { res.writeHead(404); return res.end('not found'); }
    if (req.method === 'POST') {
      const chunks: Buffer[] = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => { (posts[path] ??= []).push(Buffer.concat(chunks).toString('latin1')); res.writeHead(200, { 'content-type': 'text/html' }); res.end(typeof r.post === 'function' ? r.post('') : r.post ?? ''); });
      return;
    }
    res.writeHead(r.status ?? 200, { 'content-type': 'text/html' }); res.end(r.get);
  });
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((ok) => server.close(() => ok())));

const cv = sanitizeProfile({ name: 'Ada Obi', email: 'ada@example.com', phone: '+234 801 234 5678', location: 'Lagos', headline: 'Frontend Developer', experience: [{ title: 'Dev', company: 'Bright Labs', start: '2021', end: 'Present', bullets: ['Built a React dashboard used by 300 customers'] }], skills: ['React'] });
const run = (path: string, mode: 'check' | 'submit' = 'submit', over: Partial<ExecInput> = {}) => runExecutor({ applyUrl: base + path, platform: 'fixture', cv, coverLetter: 'Dear team', answers: [{ question: 'Why do you want this role?', answer: 'I build React dashboards.' }], mode, extraHosts: [new URL(base).host], confirmWaitMs: 2500, ...over });

describe('executor on fixture forms (real Chromium)', () => {
  it('Greenhouse-style: fills from the profile + approved answers, uploads the CV, submits once, and only then says submitted', async () => {
    const r = await run('/ok');
    expect(r.status).toBe('submitted'); expect(r.evidence).toMatch(/Thank you for applying/); expect(r.steps.map((s) => s.source)).toEqual(expect.arrayContaining(['profile', 'resume', 'approved answer']));
    expect(posts['/ok']).toHaveLength(1);
    const body = posts['/ok'][0];
    expect(body).toContain('Ada'); expect(body).toContain('Obi'); expect(body).toContain('ada@example.com'); expect(body).toContain('I build React dashboards.');
    expect(body).toContain('filename="Ada_Obi_CV.pdf"'); expect(body).toContain('%PDF-');            // the tailored CV really was uploaded
  });
  it('Lever-style: full name, current company from the profile, optional LinkedIn left blank (never made up)', async () => {
    const r = await run('/lever'); expect(r.status).toBe('submitted');
    const body = posts['/lever'][0]; expect(body).toContain('Bright Labs'); expect(body).toMatch(/name="urls\[LinkedIn\]"\r\n\r\n\r\n/);
  });
  it('check mode reads and maps the form but types and sends nothing', async () => {
    const before = (posts['/ok'] ?? []).length; const r = await run('/ok', 'check');
    expect(r.status).toBe('checked'); expect(r.steps.length).toBeGreaterThanOrEqual(5); expect((posts['/ok'] ?? []).length).toBe(before);
  });
  it('a required question it cannot answer stops everything: nothing is sent', async () => {
    const r = await run('/unknown'); expect(r.status).toBe('needs_you'); expect(r.questions.map((q) => q.label).join()).toMatch(/Kubernetes/); expect(posts['/unknown']).toBeUndefined();
  });
  it('legal / eligibility and consent questions are never answered', async () => {
    const a = await run('/legal'); expect(a.status).toBe('needs_you'); expect(a.questions[0].label).toMatch(/authorized to work/); expect(a.questions[0].reason).toMatch(/Only you/);
    const c = await run('/consent'); expect(c.status).toBe('needs_you'); expect(c.questions[0].label).toMatch(/Privacy/);
    expect(posts['/legal']).toBeUndefined(); expect(posts['/consent']).toBeUndefined();
  });
  it('with saved details it answers LinkedIn and work authorization exactly as saved; without them it stops', async () => {
    const stop = await run('/auth'); expect(stop.status).toBe('needs_you'); expect(posts['/auth']).toBeUndefined();
    const ok = await run('/auth', 'submit', { standing: { linkedin: 'https://www.linkedin.com/in/ada', github: '', website: '', authorizedToWork: 'no', needsSponsorship: '', residenceCountry: '', howHeard: '' } });
    expect(ok.status).toBe('submitted'); expect(ok.steps.map((s) => s.source)).toContain('your saved details');
    expect(posts['/auth'][0]).toContain('https://www.linkedin.com/in/ada'); expect(posts['/auth'][0]).toMatch(/name="auth"\r\n\r\nNo\r\n/);    // the candidate said "no": it did not choose "Yes"
  });
  it('a visible CAPTCHA is handed back, never attempted', async () => {
    const r = await run('/captcha'); expect(r.status).toBe('needs_you'); expect(r.reason).toMatch(/CAPTCHA/); expect(posts['/captcha']).toBeUndefined();
  });
  it('an invisible badge alone is not a challenge', async () => { expect((await run('/invisible')).status).toBe('submitted'); });
  it('a press with no confirmation is "unconfirmed" and the button was pressed exactly once', async () => {
    const r = await run('/silent'); expect(r.status).toBe('unconfirmed'); expect(r.reason).toMatch(/will not be retried/i); expect(posts['/silent']).toHaveLength(1);
  });
  it('a security check that appears after pressing submit is "unconfirmed", not submitted', async () => {
    const r = await run('/challenge-after'); expect(r.status).toBe('unconfirmed'); expect(r.reason).toMatch(/security check/i); expect(posts['/challenge-after']).toHaveLength(1);
  });
  it('blocked, closed and form-less pages are reported honestly', async () => {
    expect((await run('/blocked')).status).toBe('needs_you');
    expect((await run('/closed')).status).toBe('failed');
    expect((await run('/noform')).status).toBe('needs_you');
  });
  it('refuses hosts outside the allow-list, and a redirect to one', async () => {
    expect((await run('/ok', 'submit', { applyUrl: 'https://evil.test/apply', extraHosts: [] })).status).toBe('failed');
    const r = await run('/away'); expect(r.status).toBe('failed'); expect(r.reason).toMatch(/not a supported/i);
  });
});
