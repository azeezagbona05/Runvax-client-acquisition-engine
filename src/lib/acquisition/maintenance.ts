import { purgeExpiredImports } from './imports/service';
import { purgeExpiredPageCache } from './web/pageCache';

/**
 * Time-based cleanup for the acquisition engine's short-lived data:
 *   - import previews past their 24h expiry lose their parsed rows (which can
 *     contain contact columns) and are marked expired;
 *   - cached page HTML past its expiry is deleted.
 *
 * There is no cron in this phase, so this runs on every authorised
 * acquisition API request and at the start and end of every queue run —
 * whenever the module is used, the expired data goes. Both deletes are
 * bounded by indexed expiry conditions and are cheap when there is nothing
 * to do. Never run against production (nothing here is deployed).
 */
export async function runMaintenance(opts: { now?: Date; force?: boolean } = {}): Promise<{ importsExpired: number; pagesPurged: number }> {
  const now = opts.now ?? new Date();
  const [importsExpired, pagesPurged] = await Promise.all([purgeExpiredImports(now), purgeExpiredPageCache(now)]);
  return { importsExpired, pagesPurged };
}
