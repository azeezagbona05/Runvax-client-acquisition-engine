/**
 * Runs the free decision-maker lookup (website + public search) for many search results,
 * a few at a time. Paid sources never run from here: they spend credits per business and
 * stay a one-at-a-time choice in the outreach window.
 */

import type { Business } from '@/types';

export const BULK_DM_MAX = 25;
const CONCURRENCY = 3;

export type DmUpdate = Pick<Business, 'decisionMaker' | 'dmCandidates'> & { dmSearched: true };

export interface BulkDmResult {
  checked: number;
  found: number;
  /** Set when the run stopped early: signed out, or the per-minute limit was hit. */
  stopped?: 'auth' | 'rate';
}

/** Businesses worth looking up: not already named, not already searched this session. */
export function pendingForLookup(businesses: Business[]): Business[] {
  return businesses.filter((b) => !b.decisionMaker && !b.dmSearched).slice(0, BULK_DM_MAX);
}

export async function bulkFindDecisionMakers(
  businesses: Business[],
  opts: {
    onResult: (id: string, update: DmUpdate) => void;
    onProgress?: (done: number, total: number) => void;
    fetcher?: typeof fetch;
  },
): Promise<BulkDmResult> {
  const doFetch = opts.fetcher ?? fetch;
  const queue = [...businesses];
  const total = queue.length;
  let done = 0;
  let found = 0;
  let stopped: BulkDmResult['stopped'];

  const worker = async () => {
    while (!stopped) {
      const b = queue.shift();
      if (!b) return;
      try {
        const res = await doFetch('/api/decision-maker', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId: b.id, name: b.name, address: b.address, website: b.website,
            category: b.category, categoryTypes: b.categoryTypes,
          }),
        });
        if (res.status === 401) { stopped = 'auth'; return; }
        if (res.status === 429) { stopped = 'rate'; return; }
        if (res.ok) {
          const json = await res.json() as { decisionMaker?: Business['decisionMaker'] | null; candidates?: Business['dmCandidates'] };
          if (json.decisionMaker) found++;
          opts.onResult(b.id, { decisionMaker: json.decisionMaker ?? undefined, dmCandidates: json.candidates ?? [], dmSearched: true });
        }
      } catch { /* one failed lookup never stops the rest */ }
      done++;
      opts.onProgress?.(done, total);
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));
  return { checked: done, found, ...(stopped ? { stopped } : {}) };
}
