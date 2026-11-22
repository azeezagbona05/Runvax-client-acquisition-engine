import { describe, it, expect, vi, beforeEach } from 'vitest';

const pages: Record<string, { status?: number; type?: string; body: string }> = {};
vi.mock('@/lib/safeFetch', () => ({
  safeFetch: vi.fn(async (u: string) => {
    let key = u; try { key = new URL(u).toString(); } catch { /* keep */ } const p = pages[key] ?? pages[u.replace(/\/$/, '')]; if (!p) throw new Error('unreachable');
    return { ok: (p.status ?? 200) < 400, status: p.status ?? 200, headers: { get: () => p.type ?? 'text/html' }, text: async () => p.body };
  }),
}));
vi.mock('@/lib/ai', () => ({ hasProvider: () => false, generate: vi.fn(), extractJson: vi.fn() }));

import { auditSite, runReview } from '@/lib/agents/seoReview';
import { sanitizeConfig, type VisibilityConfig } from '@/lib/agents/kinds';

const GOOD = `<html lang="en"><head><title>Dental Clinic in Lekki, Lagos | Bright Smile</title><meta name="description" content="Bright Smile Dental in Lekki offers whitening, braces and root canal treatment with same-week appointments. Call or book online today.">
<meta name="viewport" content="width=device-width"><link rel="canonical" href="https://good.example/"><meta property="og:title" content="x"><meta property="og:image" content="https://good.example/i.png">
<script type="application/ld+json">{"@type":"Dentist"}</script></head><body><h1>Dental clinic in Lekki</h1><a href="tel:+2348000000000">Call</a><a href="/services">Services</a>${'<p>Teeth whitening and braces in Lekki Lagos for families. </p>'.repeat(60)}<img src="a.jpg" alt="dentist"></body></html>`;
const BAD = `<html><head><title>Home</title></head><body><img src="a.jpg"><img src="b.jpg"><p>Hi</p></body></html>`;

beforeEach(() => { for (const k of Object.keys(pages)) delete pages[k]; });

describe('website visibility review', () => {
  it('scores a well-built site high and a bare site low, and says what is wrong', async () => {
    pages['https://good.example/'] = { body: GOOD }; pages['https://good.example/robots.txt'] = { body: 'User-agent: *\nAllow: /\nSitemap: https://good.example/sitemap.xml', type: 'text/plain' };
    pages['https://good.example/sitemap.xml'] = { body: '<urlset><url><loc>https://good.example/</loc></url><url><loc>https://good.example/services</loc></url></urlset>', type: 'application/xml' };
    pages['https://good.example/services'] = { body: GOOD.replace('Bright Smile', 'Bright Smile Services').replace('Dental clinic in Lekki', 'Services') };
    pages['https://bad.example/'] = { body: BAD };
    const good = await auditSite('https://good.example', ['dental clinic lekki']); const bad = await auditSite('https://bad.example');
    if ('error' in good || 'error' in bad) throw new Error('audit failed');
    expect(good.score).toBeGreaterThan(80); expect(bad.score).toBeLessThan(40);
    expect(bad.checks.filter((c) => !c.ok).map((c) => c.id)).toEqual(expect.arrayContaining(['title', 'desc', 'h1', 'viewport', 'schema', 'sitemap', 'words']));
    expect(good.sitemapUrls).toBe(2); expect(good.schemaTypes).toContain('Dentist');
  });
  it('flags a robots.txt that hides the whole site', async () => {
    pages['https://hidden.example/'] = { body: GOOD }; pages['https://hidden.example/robots.txt'] = { body: 'User-agent: *\nDisallow: /\n', type: 'text/plain' };
    const a = await auditSite('https://hidden.example'); if ('error' in a) throw new Error('x');
    expect(a.checks.find((c) => c.id === 'robots')?.ok).toBe(false);
  });
  it('gives a clear message when the site cannot be read or no address is set', async () => {
    expect(await auditSite('')).toEqual({ error: expect.stringContaining('website address') });
    expect(await auditSite('https://gone.example')).toEqual({ error: expect.stringContaining('did not answer') });
    pages['https://down.example/'] = { status: 503, body: '' };
    expect(await auditSite('https://down.example')).toEqual({ error: expect.stringContaining('503') });
  });
  it('writes a private report with the honesty note, never a promise of rankings', async () => {
    pages['https://bad.example/'] = { body: BAD };
    const cfg = sanitizeConfig('visibility', { business: { name: 'Bad Co', about: 'We sell things.', url: 'https://bad.example' }, keywords: ['things lagos'] }) as VisibilityConfig;
    const r = await runReview(cfg, { useAi: false, previousScore: 20 });
    if ('error' in r) throw new Error(r.error);
    expect(r.source).toBe('rules'); expect(r.title).toContain('bad.example'); expect(r.summary).toMatch(/Score \d+\/100/);
    expect(r.body).toContain('What this review cannot see'); expect(r.body).toMatch(/Fix these first/); expect(r.body).not.toMatch(/<script/i);
    expect(r.notice).toBeTruthy();
  });
});
