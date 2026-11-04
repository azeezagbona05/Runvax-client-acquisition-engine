/**
 * Baseline: pins the existing WhatsApp acquisition workflow — the wa.me
 * deep-link builder and the Cloud API template send route. These files are
 * imported read-only; the acquisition engine must never change them.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { seed } from '../helpers/fakePrisma';
import type { Business } from '@/types';

const session = vi.hoisted(() => ({ getServerSession: vi.fn() }));
vi.mock('next-auth', () => ({ getServerSession: session.getServerSession }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

import { normalizePhone, whatsappLink } from '@/lib/phone';
import { buildQuickWAMessage, buildWALink } from '@/lib/waMessage';
import { POST as waSend } from '@/app/api/whatsapp/send/route';

const biz = (over: Partial<Business> = {}): Business => ({
  id: 'b1', name: 'Smile Dental Clinic', address: 'Lekki, Lagos', hasWebsite: false, category: 'dentist',
  phone: '0803 123 4567', reviewCount: 42, ...over,
});

describe('normalizePhone', () => {
  it.each([
    ['0803 123 4567', undefined, '2348031234567'],
    ['+234 803 123 4567', undefined, '2348031234567'],
    ['803 123 4567', undefined, '2348031234567'],
    ['08031234567', undefined, '2348031234567'],
    ['0803', '+44 20 7946 0958', '442079460958'],
    ['', undefined, ''],
  ])('%s / %s → %s', (national, intl, expected) => {
    expect(normalizePhone(national, intl)).toBe(expected);
  });
});

describe('wa.me deep links', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 14, 9, 0, 0)); // local 09:00 → "Good morning"
  });
  afterEach(() => vi.useRealTimers());

  it('builds the quick message with reviews and no website', () => {
    expect(buildQuickWAMessage(biz())).toBe(
      "Good morning Smile Dental Clinic! Hope you're having a great start to the day.\n\n" +
      "Noticed *Smile Dental Clinic* has *42 Google reviews* but no website yet. That's real trust you've built — without a website, new customers searching online can't find you properly.\n\n" +
      "Is this something you're thinking about for the business?",
    );
  });

  it('falls back to the no-reviews observation', () => {
    expect(buildQuickWAMessage(biz({ reviewCount: 0 }))).toContain('Saw *Smile Dental Clinic* on Google — no website linked');
  });

  it('builds an encoded wa.me URL', () => {
    const url = buildWALink(biz())!;
    expect(url.startsWith('https://wa.me/2348031234567?text=')).toBe(true);
    expect(decodeURIComponent(url.split('?text=')[1])).toBe(buildQuickWAMessage(biz()));
  });

  it('returns null without a phone', () => {
    expect(whatsappLink(biz({ phone: undefined }))).toBeNull();
  });
});

describe('POST /api/whatsapp/send', () => {
  const req = (body: unknown) =>
    new NextRequest('http://localhost/api/whatsapp/send', { method: 'POST', body: JSON.stringify(body) });

  beforeEach(() => session.getServerSession.mockReset());

  it('401 when signed out', async () => {
    session.getServerSession.mockResolvedValue(null);
    expect((await waSend(req({ to: '1', businessName: 'x' }))).status).toBe(401);
  });

  it('400 when WhatsApp is not connected', async () => {
    session.getServerSession.mockResolvedValue({ user: { id: 'u1' } });
    const res = await waSend(req({ to: '1', businessName: 'x' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('WhatsApp API not connected.');
  });

  it('400 when the template is not approved', async () => {
    session.getServerSession.mockResolvedValue({ user: { id: 'u1' } });
    seed('userSettings', { userId: 'u1', waPhoneNumberId: 'PN', waAccessToken: 'tok', waTemplateName: 'tpl', waTemplateStatus: 'PENDING' });
    const res = await waSend(req({ to: '1', businessName: 'x' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('not yet approved');
  });

  it('sends the template payload to the Graph API (mocked)', async () => {
    session.getServerSession.mockResolvedValue({ user: { id: 'u1' } });
    seed('userSettings', { userId: 'u1', waPhoneNumberId: 'PN', waAccessToken: 'tok', waTemplateName: 'tpl', waTemplateStatus: 'APPROVED' });
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ messages: [{ id: 'wamid.1' }] }), { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await waSend(req({ to: '+234 803 123 4567', businessName: 'Smile Dental' }));

    expect(await res.json()).toEqual({ ok: true, messageId: 'wamid.1' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://graph.facebook.com/v20.0/PN/messages');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body as string)).toEqual({
      messaging_product: 'whatsapp',
      to: '2348031234567',
      type: 'template',
      template: { name: 'tpl', language: { code: 'en' }, components: [{ type: 'body', parameters: [{ type: 'text', text: 'Smile Dental' }] }] },
    });
  });
});
