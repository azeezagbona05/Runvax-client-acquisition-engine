import { prisma } from '@/lib/prisma';
import { SITE_DEFAULTS, sanitizeSettings, describeChanges, type SiteSettings } from './siteSettingsShared';

/**
 * Server side of the admin "Site controls". One JSON row in SiteSetting (key "site").
 *
 * Reads are cached for a few seconds per server instance, so a busy site does not hit the database on every request;
 * a save clears the cache on the instance that handled it and every other instance catches up within CACHE_MS.
 * If the table or row is missing, or the database is unreachable, the built-in defaults apply: the app behaves exactly
 * as it did before these controls existed.
 */
const KEY = 'site';
const CACHE_MS = 15_000;
let cache: { at: number; value: SiteSettings } | null = null;

export async function getSiteSettings(): Promise<SiteSettings> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  let value = SITE_DEFAULTS;
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: KEY } });
    if (row) value = sanitizeSettings(JSON.parse(row.value));
  } catch {
    // table not migrated yet, bad JSON or database down: defaults
  }
  cache = { at: Date.now(), value };
  return value;
}

export function clearSiteSettingsCache() { cache = null; }

/** Validates, saves and audit-logs a change. Returns the saved settings and what changed. */
export async function saveSiteSettings(input: unknown, actorEmail: string): Promise<{ settings: SiteSettings; changes: string[] }> {
  clearSiteSettingsCache();
  const before = await getSiteSettings();
  const after = sanitizeSettings(input, before);
  const changes = describeChanges(before, after);
  await prisma.siteSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(after), updatedBy: actorEmail },
    update: { value: JSON.stringify(after), updatedBy: actorEmail },
  });
  clearSiteSettingsCache();
  if (changes.length) {
    await prisma.adminAuditLog.create({
      data: { actorEmail, action: 'site_settings', title: 'Site controls changed', detail: changes.join('\n') },
    }).catch(() => {});
  }
  return { settings: after, changes };
}

/** The error a blocked action returns, with a code the front end can recognise. */
export const SIGNUPS_CLOSED_MESSAGE = 'New sign-ups are paused right now. Please check back soon.';
export const AGENTS_PAUSED_MESSAGE = 'Creating new AI agents is paused right now. Your existing agents keep working.';
export const MAINTENANCE_CODE = 'MAINTENANCE';
