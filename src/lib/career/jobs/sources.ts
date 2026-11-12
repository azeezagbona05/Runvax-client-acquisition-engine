import crypto from 'node:crypto';

/** Vacancy sources. Only public, documented endpoints that are offered for others to read: no scraping, no logins. */
export interface Job { source: 'remotive' | 'arbeitnow' | 'greenhouse' | 'lever'; externalId: string; title: string; company: string; location: string; remote: boolean; url: string; description: string; postedAt: Date | null }
export const SOURCE_LABEL: Record<string, string> = { remotive: 'Remotive', arbeitnow: 'Arbeitnow', greenhouse: 'Greenhouse', lever: 'Lever' };

export const stripHtml = (h: string) => h.replace(/<(?:br|\/p|\/li|\/h\d)\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);
const date = (v: unknown) => { const d = typeof v === 'number' ? new Date(v < 1e12 ? v * 1000 : v) : typeof v === 'string' ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? d : null; };
const safeUrl = (u: unknown) => { try { const x = new URL(String(u)); return x.protocol === 'https:' || x.protocol === 'http:' ? x.toString().slice(0, 600) : ''; } catch { return ''; } };

/** The same vacancy found twice (two boards, or a repost) gets the same key: company + title + place, ignoring case, punctuation and gender tags. */
export function dedupeKey(j: Pick<Job, 'company' | 'title' | 'location'>): string {
  const n = (s: string) => s.toLowerCase().replace(/\((?:m|f|d|w|x|\/|\s|\*)+\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  return crypto.createHash('sha1').update(`${n(j.company)}|${n(j.title)}|${n(j.location)}`).digest('hex');
}

// ── normalisers (pure, so they can be tested against saved samples) ──
type R = Record<string, unknown>;
export function fromRemotive(body: unknown): Job[] {
  const jobs = (body as { jobs?: R[] } | null)?.jobs; if (!Array.isArray(jobs)) return [];
  return jobs.flatMap((x) => { const url = safeUrl(x.url); if (!url || !x.title) return []; return [{ source: 'remotive' as const, externalId: String(x.id ?? url).slice(0, 120), title: cut(String(x.title), 200), company: cut(String(x.company_name ?? ''), 160), location: cut(String(x.candidate_required_location ?? 'Worldwide'), 200), remote: true, url, description: cut(stripHtml(String(x.description ?? '')), 6000), postedAt: date(x.publication_date) }]; });
}
export function fromArbeitnow(body: unknown): Job[] {
  const jobs = (body as { data?: R[] } | null)?.data; if (!Array.isArray(jobs)) return [];
  return jobs.flatMap((x) => { const url = safeUrl(x.url); if (!url || !x.title) return []; return [{ source: 'arbeitnow' as const, externalId: String(x.slug ?? url).slice(0, 120), title: cut(String(x.title), 200), company: cut(String(x.company_name ?? ''), 160), location: cut(String(x.location ?? ''), 200), remote: x.remote === true, url, description: cut(stripHtml(String(x.description ?? '')), 6000), postedAt: date(x.created_at) }]; });
}
/** `slug` is the board name; it is kept in externalId ("board/id") so the hosted application form can be located later. */
export function fromGreenhouse(body: unknown, company: string, slug = ''): Job[] {
  const jobs = (body as { jobs?: R[] } | null)?.jobs; if (!Array.isArray(jobs)) return [];
  return jobs.flatMap((x) => { const url = safeUrl(x.absolute_url); if (!url || !x.title) return []; const loc = String((x.location as R | undefined)?.name ?? '').replace(/^n\/a$/i, ''); return [{ source: 'greenhouse' as const, externalId: (slug ? `${slug}/${x.id ?? url}` : String(x.id ?? url)).slice(0, 120), title: cut(String(x.title), 200), company: cut(String(x.company_name ?? company), 160), location: cut(loc, 200), remote: /remote/i.test(loc), url, description: cut(stripHtml(decodeEntities(String(x.content ?? ''))), 6000), postedAt: date(x.first_published ?? x.updated_at) }]; });
}
const decodeEntities = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
export function fromLever(body: unknown, company: string): Job[] {
  if (!Array.isArray(body)) return [];
  return (body as R[]).flatMap((x) => { const url = safeUrl(x.hostedUrl); if (!url || !x.text) return []; const cat = (x.categories ?? {}) as R; const loc = String(cat.location ?? ''); return [{ source: 'lever' as const, externalId: String(x.id ?? url).slice(0, 120), title: cut(String(x.text), 200), company: cut(company, 160), location: cut(loc, 200), remote: x.workplaceType === 'remote' || /remote/i.test(loc), url, description: cut(String(x.descriptionPlain ?? stripHtml(String(x.description ?? ''))), 6000), postedAt: date(x.createdAt) }]; });
}

// ── fetching ──
const TTL = 6 * 60 * 60 * 1000; const cache = new Map<string, { at: number; jobs: Job[] }>();
async function getJson(url: string): Promise<unknown> {
  const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'RUNVAX-CareerAgent/1.0' }, signal: AbortSignal.timeout(12_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
/** Shared across users on a warm server so one popular query is not sent to a small provider again and again. */
async function cached(key: string, load: () => Promise<Job[]>): Promise<Job[]> {
  const hit = cache.get(key); if (hit && Date.now() - hit.at < TTL) return hit.jobs;
  const jobs = await load(); cache.set(key, { at: Date.now(), jobs }); return jobs;
}
export const clearJobCache = () => cache.clear();

export const searchRemotive = (q: string) => cached(`rem:${q.toLowerCase()}`, async () => fromRemotive(await getJson(`https://remotive.com/api/remote-jobs?limit=40&search=${encodeURIComponent(q)}`)));
export const fetchArbeitnow = () => cached('arb', async () => fromArbeitnow(await getJson('https://www.arbeitnow.com/api/job-board-api')));

/** A company's own public board, if it has one on Greenhouse or Lever. Returns null when neither exists. */
export async function fetchCompanyBoard(name: string): Promise<Job[] | null> {
  const base = name.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim(); if (!base) return null;
  const slugs = Array.from(new Set([base.replace(/\s+/g, ''), base.replace(/\s+/g, '-')])).filter((s) => s.length > 1);
  for (const slug of slugs) {
    const g = await cached(`gh:${slug}`, async () => { try { return fromGreenhouse(await getJson(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`), name, slug); } catch { return []; } });
    if (g.length) return g;
    const l = await cached(`lv:${slug}`, async () => { try { return fromLever(await getJson(`https://api.lever.co/v0/postings/${slug}?mode=json`), name); } catch { return []; } });
    if (l.length) return l;
  }
  return null;
}
