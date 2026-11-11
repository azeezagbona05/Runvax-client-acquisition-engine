import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { SITE_DEFAULTS, sanitizeSettings, type SiteSettings } from '@/lib/siteSettingsShared';

let site: SiteSettings = SITE_DEFAULTS; let token: Record<string, unknown> | null = null;
vi.mock('@/lib/siteSettings', async (orig) => ({ ...(await orig<typeof import('@/lib/siteSettings')>()), getSiteSettings: async () => site }));
vi.mock('next-auth/jwt', () => ({ getToken: async () => token }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/email', () => ({ createTransporter: () => ({ sendMail: async () => {} }), verificationEmailHtml: () => '', newUserRegisteredEmailHtml: () => '' }));

import { requireUser } from '@/lib/requireUser';
import { POST as register } from '@/app/api/auth/register/route';

const req = {} as NextRequest;
const ADMIN = 'owner@runvax.com';
beforeEach(() => { site = SITE_DEFAULTS; token = { id: 'u1' }; vi.stubEnv('ADMIN_EMAILS', ADMIN); });

describe('maintenance mode on the API', () => {
  it('lets a signed-in user through normally', async () => { expect((await requireUser(req)).ok).toBe(true); });
  it('stops a signed-in user with a 503 and the admin message', async () => {
    site = sanitizeSettings({ maintenance: { on: true, message: 'Back at 3pm' } });
    const r = await requireUser(req);
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.response.status).toBe(503); expect(await r.response.json()).toMatchObject({ code: 'MAINTENANCE', error: 'Back at 3pm' }); }
  });
  it('never blocks a fresh signed-in admin, so they can switch it off', async () => {
    site = sanitizeSettings({ maintenance: { on: true } });
    token = { id: 'a1', email: ADMIN, isAdmin: true, adminAt: Date.now() - 1000 };
    expect((await requireUser(req)).ok).toBe(true);
  });
  it('does not treat a stale or non-listed admin flag as an admin', async () => {
    site = sanitizeSettings({ maintenance: { on: true } });
    token = { id: 'a1', email: ADMIN, isAdmin: true };                          // no adminAt
    expect((await requireUser(req)).ok).toBe(false);
    token = { id: 'a1', email: 'x@y.com', isAdmin: true, adminAt: Date.now() }; // not on the list
    expect((await requireUser(req)).ok).toBe(false);
  });
  it('still answers 401 first for a signed-out request', async () => {
    site = sanitizeSettings({ maintenance: { on: true } }); token = null;
    const r = await requireUser(req);
    if (!r.ok) expect(r.response.status).toBe(401);
  });
});

describe('sign-ups switch', () => {
  it('refuses registration with a clear code when sign-ups are paused', async () => {
    site = sanitizeSettings({ signupsOpen: false });
    const res = await register(new Request('http://x/api/auth/register', { method: 'POST', body: JSON.stringify({ name: 'A', email: 'a@b.com', password: 'longenough1', acceptedTerms: true }) }) as unknown as NextRequest);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'SIGNUPS_CLOSED' });
  });
});
