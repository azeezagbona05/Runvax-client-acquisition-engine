/**
 * Keeps Industry Acquisition prospects out of RUNVAX's existing outreach
 * automation (Rex's daily drafting, Atlas's "reactivate cold leads", and the
 * task handlers they use).
 *
 * The acquisition engine stores each clinic as an ordinary CRM Prospect row so
 * the Pipeline can show it, but it must reach a clinic only through its own
 * approval gate and suppression list. Existing automation selects prospects by
 * stage alone, so it would draft WhatsApp messages for engine clinics and
 * bypass both. Every selector that can create a draft excludes them with this.
 *
 * This file imports nothing, so existing code can use it without pulling in
 * the acquisition module.
 */

/** Value of Prospect.source on every engine-created row (set by the importer). */
export const ACQUISITION_SOURCE = 'industry-acquisition';

/**
 * Prisma where-fragment: ordinary CRM prospects only. Use inside AND: [...].
 *
 * The explicit NULL branch matters. Manually saved prospects have source NULL,
 * and in SQL `NULL != 'x'` is not true, so a bare `source: { not: ... }` would
 * silently drop every ordinary prospect from the automation.
 */
export const notAcquisition = {
  OR: [{ source: null }, { source: { not: ACQUISITION_SOURCE } }],
};

/** For code that already holds a Prospect row. */
export function isAcquisitionProspect(p: { source?: string | null }): boolean {
  return p.source === ACQUISITION_SOURCE;
}
