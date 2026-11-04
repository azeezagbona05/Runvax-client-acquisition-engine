import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { outreachLead: m } }));

import { trackedLink, verifyTrackedLink } from '@/lib/trackedLink';
import { buildEmail, linkify } from '@/lib/outreachCampaign';
import { GET as click } from '@/app/api/oc/click/[token]/route';

process.env.NEXTAUTH_SECRET = 'test-secret';
const TOKEN = 'abcDEF123456_-abcDEF1234';
const APP = 'https://app.test';

beforeEach(() => { m.findUnique.mockReset(); m.update.mockReset(); });

describe('signed tracked links', () => {
  it('round-trips and rejects tampering', () => {
    const link = trackedLink(APP, TOKEN, 'https://example.com/a?b=1');
    const u = new URL(link);
    expect(u.pathname).toBe(`/api/oc/click/${TOKEN}`);
    const url = u.searchParams.get('u')!, sig = u.searchParams.get('s')!;
    expect(verifyTrackedLink(TOKEN, url, sig)).toBe('https://example.com/a?b=1');
    expect(verifyTrackedLink(TOKEN, 'https://evil.com', sig)).toBeNull();
    expect(verifyTrackedLink('otherTokenxxxxxxxxxxxxx', url, sig)).toBeNull();
    expect(verifyTrackedLink(TOKEN, url, 'x'.repeat(32))).toBeNull();
  });
  it('only ever redirects to web links', () => {
    const link = trackedLink(APP, TOKEN, 'javascript:alert(1)');
    const u = new URL(link);
    expect(verifyTrackedLink(TOKEN, u.searchParams.get('u')!, u.searchParams.get('s')!)).toBeNull();
  });
});

describe('links in the email body', () => {
  it('turns bare URLs into tracked links without swallowing trailing punctuation', () => {
    const html = linkify('See https://example.com/menu, then reply.\nOr http://a.co/x.', (u) => `T(${u})`);
    expect(html).toContain('<a href="T(https://example.com/menu)"');
    expect(html).toContain('>https://example.com/menu</a>, then reply.<br>');
    expect(html).toContain('href="T(http://a.co/x)"');
  });
  it('escapes HTML around links, and leaves them untracked when no tracker is given', () => {
    expect(linkify('<b>x</b> https://a.co', undefined)).toContain('&lt;b&gt;x&lt;/b&gt; <a href="https://a.co"');
  });
  it('tracks body links in the HTML only, never the unsubscribe link, and leaves the text alone', () => {
    const e = buildEmail({
      subject: 's', body: 'Hi {{name}}, see https://example.com/x', lead: { email: 'a@x.com', name: 'Ada' }, sender: { name: 'Sam' },
      unsubscribeUrl: `${APP}/api/oc/unsubscribe?t=${TOKEN}`, trackLink: (u) => `${APP}/api/oc/click/${TOKEN}?u=${encodeURIComponent(u)}`,
    });
    expect(e.html).toContain(`${APP}/api/oc/click/${TOKEN}?u=https%3A%2F%2Fexample.com%2Fx`);
    expect(e.html).toContain(`href="${APP}/api/oc/unsubscribe?t=${TOKEN}"`);
    expect(e.text).toContain('https://example.com/x');
    expect(e.text).not.toContain('/api/oc/click');
  });
});

describe('click route', () => {
  const call = (token: string, url: string, sig: string) =>
    click(new NextRequest(`http://x/api/oc/click/${token}?u=${encodeURIComponent(url)}&s=${sig}`), { params: { token } });
  const valid = (url = 'https://example.com/x') => { const u = new URL(trackedLink(APP, TOKEN, url)); return [u.searchParams.get('u')!, u.searchParams.get('s')!] as const; };

  it('redirects to the signed destination and counts the click (and the open)', async () => {
    m.findUnique.mockResolvedValue({ id: 'l1', lastSentAt: new Date(Date.now() - 60_000), openedAt: null, clickedAt: null });
    const [url, sig] = valid();
    const res = await call(TOKEN, url, sig);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://example.com/x');
    expect(m.update).toHaveBeenCalledWith({
      where: { id: 'l1' },
      data: { clickCount: { increment: 1 }, clickedAt: expect.any(Date), openedAt: expect.any(Date), openCount: { increment: 1 } },
    });
  });
  it('keeps the first click time and existing open', async () => {
    m.findUnique.mockResolvedValue({ id: 'l1', lastSentAt: new Date(Date.now() - 60_000), openedAt: new Date(), clickedAt: new Date() });
    const [url, sig] = valid();
    await call(TOKEN, url, sig);
    expect(m.update).toHaveBeenCalledWith({ where: { id: 'l1' }, data: { clickCount: { increment: 1 } } });
  });
  it('redirects but does not count a scanner hit in the first seconds', async () => {
    m.findUnique.mockResolvedValue({ id: 'l1', lastSentAt: new Date(Date.now() - 2_000), openedAt: null, clickedAt: null });
    const [url, sig] = valid();
    expect((await call(TOKEN, url, sig)).status).toBe(302);
    expect(m.update).not.toHaveBeenCalled();
  });
  it('refuses a forged destination: no open redirect', async () => {
    const [, sig] = valid();
    const res = await call(TOKEN, 'https://evil.com', sig);
    expect(res.status).toBe(400);
    expect(res.headers.get('location')).toBeNull();
    expect(m.update).not.toHaveBeenCalled();
  });
  it('still redirects if the database is down', async () => {
    m.findUnique.mockRejectedValue(new Error('db'));
    const [url, sig] = valid();
    expect((await call(TOKEN, url, sig)).status).toBe(302);
  });
});
