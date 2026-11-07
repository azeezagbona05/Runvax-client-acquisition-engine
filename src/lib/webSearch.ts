/**
 * Web search for finding public pages about people and businesses, through an official search API only.
 *
 * Today that is Brave Search (BRAVE_SEARCH_KEY). Nothing here fetches Google, Bing or LinkedIn pages directly: scraping their
 * results pages breaks their terms and gets blocked, so without a key the answer is simply "no results", and callers can say
 * that search is not switched on.
 *
 * Retention: Brave's standard plans do not allow keeping any part of its results (only its "storage rights" plan does). So by default
 * nothing is kept: a search runs each time, and only identical searches happening at the same moment are shared. If the account is on a
 * plan with storage rights, set BRAVE_ALLOW_CACHE=1 and results are also remembered for a day, which saves credits.
 */

export interface SearchHit { title?: string; url?: string; description?: string }

const TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 500;
const TIMEOUT_MS = 8000;
const cache = new Map<string, { at: number; hits: SearchHit[] }>();
const inflight = new Map<string, Promise<SearchHit[]>>();

/** Whether results may be remembered. Off unless the owner confirms the plan allows it. */
export const cacheAllowed = (): boolean => process.env.BRAVE_ALLOW_CACHE === '1';

/** True when a real search key is set (a placeholder from an example file does not count). */
export function webSearchConfigured(): boolean {
  const key = process.env.BRAVE_SEARCH_KEY?.trim();
  return !!key && !/your-|changeme|example/i.test(key);
}

export function resetSearchCache(): void { cache.clear(); inflight.clear(); }

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

async function brave(q: string, fetchImpl: FetchLike): Promise<SearchHit[] | null> {
  try {
    const res = await fetchImpl(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=10`, {
      headers: { Accept: 'application/json', 'X-Subscription-Token': process.env.BRAVE_SEARCH_KEY!.trim() },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null; // rate limit, bad key or an outage: not cached, so a retry later can succeed
    const json = await res.json() as { web?: { results?: SearchHit[] } };
    return (json.web?.results ?? []).map((r) => ({ title: r.title, url: r.url, description: r.description }));
  } catch { return null; }
}

/** One search. Always resolves: an empty list means no results, no key, or a failure. */
export async function webSearch(query: string, deps: { fetchImpl?: FetchLike } = {}): Promise<SearchHit[]> {
  const q = query.replace(/\s+/g, ' ').trim();
  if (!q || !webSearchConfigured()) return [];
  const hit = cacheAllowed() ? cache.get(q) : undefined;
  if (hit && Date.now() - hit.at < TTL_MS) return hit.hits;
  const running = inflight.get(q);
  if (running) return running;
  const p = (async () => {
    const hits = await brave(q, deps.fetchImpl ?? ((u, i) => fetch(u, i)));
    if (hits === null) return [];
    if (cacheAllowed()) {
      if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
      cache.set(q, { at: Date.now(), hits });
    }
    return hits;
  })().finally(() => inflight.delete(q));
  inflight.set(q, p);
  return p;
}
