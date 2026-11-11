import { beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory SiteSetting + AdminAuditLog, enough for siteSettings.ts.
let store: Record<string, { value: string; updatedBy: string | null }> = {}; let audit: Array<{ action: string; detail: string }> = []; let tableMissing = false;
vi.mock('@/lib/prisma', () => ({ prisma: {
  siteSetting: {
    findUnique: async ({ where }: { where: { key: string } }) => { if (tableMissing) throw new Error('table does not exist'); const r = store[where.key]; return r ? { key: where.key, ...r } : null; },
    upsert: async ({ where, create, update }: { where: { key: string }; create: { value: string; updatedBy: string }; update: { value: string; updatedBy: string } }) => { store[where.key] = store[where.key] ? update : create; },
  },
  adminAuditLog: { create: async ({ data }: { data: { action: string; detail: string } }) => { audit.push(data); } },
} }));

import { SITE_DEFAULTS, sanitizeSettings, describeChanges, bannerVisible } from '@/lib/siteSettingsShared';
import { clearSiteSettingsCache, getSiteSettings, saveSiteSettings } from '@/lib/siteSettings';
import { checkGuestSearch } from '@/lib/guestLimit';
import type { NextRequest } from 'next/server';

beforeEach(() => { store = {}; audit = []; tableMissing = false; clearSiteSettingsCache(); });

describe('sanitizeSettings', () => {
  it('returns the defaults for nothing, junk, or arrays', () => {
    for (const bad of [undefined, null, 'x', 5, [], {}]) expect(sanitizeSettings(bad)).toEqual(SITE_DEFAULTS);
  });
  it('clamps numbers into their allowed range and rounds them', () => {
    const s = sanitizeSettings({ trialDays: 9999, guestSearchesPerDay: -4, guestPreviewResults: 7.6 });
    expect(s.trialDays).toBe(60); expect(s.guestSearchesPerDay).toBe(0); expect(s.guestPreviewResults).toBe(8);
    expect(sanitizeSettings({ trialDays: 'abc' }).trialDays).toBe(SITE_DEFAULTS.trialDays);   // not a number: keep the default
    expect(sanitizeSettings({ trialDays: '14' }).trialDays).toBe(14);
  });
  it('only accepts real booleans for switches', () => {
    const s = sanitizeSettings({ signupsOpen: 'no', trialOpen: 0, pricingVisible: true, agentBuilderOpen: false });
    expect(s.signupsOpen).toBe(true); expect(s.trialOpen).toBe(true);        // junk ignored
    expect(s.pricingVisible).toBe(true); expect(s.agentBuilderOpen).toBe(false);
  });
  it('banner links must be on-site paths or https: never javascript:, data: or protocol-relative', () => {
    const link = (u: unknown) => sanitizeSettings({ banner: { linkUrl: u } }).banner.linkUrl;
    expect(link('/client-acquisition')).toBe('/client-acquisition'); expect(link('https://runvax.com/x')).toBe('https://runvax.com/x');
    expect(link('javascript:alert(1)')).toBe(''); expect(link('data:text/html,hi')).toBe(''); expect(link('//evil.com')).toBe(''); expect(link('http://insecure.com')).toBe('');
    expect(link('')).toBe('');
  });
  it('trims and caps text, and a banner with no text never shows', () => {
    const s = sanitizeSettings({ banner: { on: true, text: '  ' + 'a'.repeat(500) + '  ' } });
    expect(s.banner.text.length).toBe(240);
    expect(bannerVisible(sanitizeSettings({ banner: { on: true, text: '   ' } }))).toBe(false);
    expect(bannerVisible(sanitizeSettings({ banner: { on: true, text: 'Hello' } }))).toBe(true);
    expect(bannerVisible(sanitizeSettings({ banner: { on: false, text: 'Hello' } }))).toBe(false);
  });
  it('an empty maintenance message falls back to the friendly default; an unknown tone is ignored', () => {
    expect(sanitizeSettings({ maintenance: { on: true, message: '   ' } }).maintenance.message).toBe(SITE_DEFAULTS.maintenance.message);
    expect(sanitizeSettings({ banner: { tone: 'rainbow' } }).banner.tone).toBe('info');
  });
  it('a partial update keeps everything else from the base', () => {
    const base = sanitizeSettings({ trialDays: 14, banner: { on: true, text: 'Hi' } });
    const next = sanitizeSettings({ signupsOpen: false }, base);
    expect(next.signupsOpen).toBe(false); expect(next.trialDays).toBe(14); expect(next.banner.text).toBe('Hi');
  });
});

describe('describeChanges', () => {
  it('names exactly what changed, and nothing when nothing did', () => {
    expect(describeChanges(SITE_DEFAULTS, SITE_DEFAULTS)).toEqual([]);
    const after = sanitizeSettings({ signupsOpen: false, trialDays: 14, maintenance: { on: true } });
    expect(describeChanges(SITE_DEFAULTS, after)).toEqual(['New sign-ups off', `Trial length ${SITE_DEFAULTS.trialDays} to 14 days`, 'Maintenance mode on']);
  });
});

describe('getSiteSettings / saveSiteSettings', () => {
  it('falls back to the defaults when the table is missing, so a deploy before the migration is harmless', async () => {
    tableMissing = true;
    expect(await getSiteSettings()).toEqual(SITE_DEFAULTS);
  });
  it('falls back to the defaults for a corrupt row', async () => {
    store.site = { value: '{not json', updatedBy: null };
    expect(await getSiteSettings()).toEqual(SITE_DEFAULTS);
  });
  it('saves a validated change, returns it, and writes one audit entry naming the admin action', async () => {
    const { settings, changes } = await saveSiteSettings({ signupsOpen: false, trialDays: 500 }, 'admin@runvax.com');
    expect(settings.signupsOpen).toBe(false); expect(settings.trialDays).toBe(60);
    expect(changes).toContain('New sign-ups off');
    expect((await getSiteSettings()).signupsOpen).toBe(false);          // the save cleared the cache
    expect(store.site.updatedBy).toBe('admin@runvax.com');
    expect(audit).toHaveLength(1); expect(audit[0].action).toBe('site_settings'); expect(audit[0].detail).toContain('New sign-ups off');
  });
  it('saving with no real change writes no audit entry', async () => {
    await saveSiteSettings({}, 'admin@runvax.com');
    expect(audit).toHaveLength(0);
  });
});

describe('guest search limit', () => {
  const req = (cookie?: string) => ({ cookies: { get: () => (cookie ? { value: cookie } : undefined) }, headers: { get: () => '203.0.113.9' } }) as unknown as NextRequest;
  it('uses the limit it is given: 0 blocks every guest search, a higher number allows more', () => {
    expect(checkGuestSearch(req(), 0).ok).toBe(false);
    expect(checkGuestSearch(req(), 3).ok).toBe(true);
  });
});
