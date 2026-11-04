import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { outreachLead: m } }));

import { GET as unsubscribePage, POST as unsubscribe } from '@/app/api/oc/unsubscribe/route';
import { GET as openPixel } from '@/app/api/oc/open/[token]/route';

const TOKEN = 'abcDEF123456_-abcDEF1234';
const req = (url: string, method = 'GET') => new NextRequest(url, { method });

beforeEach(() => { m.findUnique.mockReset(); m.update.mockReset(); m.updateMany.mockReset(); });

describe('unsubscribe', () => {
  it('opening the link (GET) only shows a confirm button: link scanners must not unsubscribe anyone', async () => {
    const res = await unsubscribePage(req(`http://x/api/oc/unsubscribe?t=${TOKEN}`));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('Yes, unsubscribe me');
    expect(m.updateMany).not.toHaveBeenCalled();
    expect(m.findUnique).not.toHaveBeenCalled();
  });

  it('confirming (POST) opts the address out of every campaign on that account', async () => {
    m.findUnique.mockResolvedValue({ userId: 'u1', email: 'p@clinic.com' });
    m.updateMany.mockResolvedValue({ count: 2 });
    const res = await unsubscribe(req(`http://x/api/oc/unsubscribe?t=${TOKEN}`, 'POST'));
    expect(res.status).toBe(200);
    expect(m.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', email: 'p@clinic.com', unsubscribedAt: null },
      data: { status: 'unsubscribed', unsubscribedAt: expect.any(Date) },
    });
  });

  it('rejects malformed and unknown tokens without touching data', async () => {
    expect((await unsubscribe(req('http://x/api/oc/unsubscribe?t=short', 'POST'))).status).toBe(400);
    expect((await unsubscribe(req('http://x/api/oc/unsubscribe', 'POST'))).status).toBe(400);
    m.findUnique.mockResolvedValue(null);
    expect((await unsubscribe(req(`http://x/api/oc/unsubscribe?t=${TOKEN}`, 'POST'))).status).toBe(400);
    expect(m.updateMany).not.toHaveBeenCalled();
    expect((await unsubscribePage(req('http://x/api/oc/unsubscribe?t=bad'))).status).toBe(400);
  });

  it('the test-email preview link is harmless', async () => {
    const res = await unsubscribePage(req('http://x/api/oc/unsubscribe?t=preview'));
    expect(await res.text()).toContain('test email');
  });
});

describe('open pixel', () => {
  const call = (token = TOKEN) => openPixel(req(`http://x/api/oc/open/${token}`), { params: { token } });

  it('always returns a GIF, even for junk tokens or database errors', async () => {
    for (const token of ['x', TOKEN]) {
      m.findUnique.mockRejectedValue(new Error('db down'));
      const res = await call(token);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('image/gif');
      expect(res.headers.get('cache-control')).toContain('no-store');
    }
  });

  it('records the first open and counts later ones', async () => {
    m.findUnique.mockResolvedValue({ id: 'l1', lastSentAt: new Date(Date.now() - 60_000), openedAt: null });
    await call();
    expect(m.update).toHaveBeenCalledWith({ where: { id: 'l1' }, data: { openCount: { increment: 1 }, openedAt: expect.any(Date) } });
    m.update.mockClear();
    m.findUnique.mockResolvedValue({ id: 'l1', lastSentAt: new Date(Date.now() - 60_000), openedAt: new Date() });
    await call();
    expect(m.update).toHaveBeenCalledWith({ where: { id: 'l1' }, data: { openCount: { increment: 1 } } });
  });

  it('ignores fetches in the first seconds after sending (security scanners)', async () => {
    m.findUnique.mockResolvedValue({ id: 'l1', lastSentAt: new Date(Date.now() - 2_000), openedAt: null });
    await call();
    expect(m.update).not.toHaveBeenCalled();
  });

  it('does not query the database for malformed tokens', async () => {
    await call('x');
    expect(m.findUnique).not.toHaveBeenCalled();
  });
});
