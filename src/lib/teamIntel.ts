/**
 * Finding the people who run a business from public web search results, and saying how sure we are.
 *
 * We read only what a search API already shows (name, headline, snippet). We never open linkedin.com. A person is
 * "confirmed" when their own profile headline names the company next to a real title, and "likely" when the company
 * appears only in the surrounding snippet or in a third-party page. The evidence (page and snippet) is kept so a person can check it.
 */
import { companyMatches, parseLinkedInResult, parseSnippetResult, titleQuery, type DmCandidate } from './decisionMaker';
import type { SearchHit } from './webSearch';

export type MatchTier = 'confirmed' | 'likely';

const MANAGEMENT = '(director OR manager OR head OR chief OR partner OR principal OR president)';

/** The business name without a branch or legal tail: "Smile Dental Clinic (Lekki)" becomes "Smile Dental Clinic". */
export const shortName = (businessName: string): string => businessName.split('(')[0].replace(/["“”]/g, '').trim();

/**
 * The searches to run for one business, most useful first, at most `max`:
 * the owner-level titles for the industry, a wider management sweep, anyone whose profile mentions the website, and third-party mentions.
 */
export function planTeamQueries(o: { businessName: string; domain?: string | null; city?: string; titles: string[]; max?: number }): string[] {
  const name = shortName(o.businessName);
  if (!name) return [];
  const city = (o.city ?? '').trim();
  const qs: string[] = [
    `site:linkedin.com/in "${name}" ${city} ${titleQuery(o.titles.slice(0, 6))}`.replace(/\s+/g, ' ').trim(),
    `site:linkedin.com/in "${name}" ${city} ${MANAGEMENT}`.replace(/\s+/g, ' ').trim(),
  ];
  if (o.domain) qs.push(`site:linkedin.com/in "${o.domain}"`);
  qs.push(`"${name}" ${city} ${titleQuery(o.titles.slice(0, 4))} -jobs`.replace(/\s+/g, ' ').trim());
  return Array.from(new Set(qs)).slice(0, Math.max(1, o.max ?? 4));
}

const clip = (s: string, n: number) => { const t = s.replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

/** The part of a LinkedIn result title after the person's name: "Ade Bello - Owner - Smile Dental | LinkedIn" gives "Owner - Smile Dental". */
function headlineOf(title?: string): string {
  const t = (title ?? '').replace(/\s*[|·]\s*LinkedIn.*$/i, '').trim();
  const parts = t.split(/\s+[-–—]\s+/).map((p) => p.trim()).filter(Boolean);
  return parts.slice(1).join(' - ');
}

/**
 * Turns one search result into a person with a match tier and the evidence, or null if it does not name someone
 * with a real title at this business.
 */
export function classifyHit(hit: SearchHit, o: { businessName: string; domain?: string | null }): DmCandidate | null {
  const name = shortName(o.businessName);
  const li = parseLinkedInResult(hit, name);
  const c = li ?? parseSnippetResult(hit, name);
  if (!c) return null;
  const snippet = clip(hit.description || hit.title || '', 220);
  let match: MatchTier = 'likely';
  if (li) {
    const inHeadline = companyMatches(headlineOf(hit.title), name);
    const domainMentioned = !!o.domain && `${hit.description ?? ''} ${hit.title ?? ''}`.toLowerCase().includes(o.domain.toLowerCase());
    if (inHeadline || domainMentioned) match = 'confirmed';
  }
  return { ...c, confidence: match === 'confirmed' ? 'high' : 'medium', match, evidence: { url: (hit.url ?? '').split('?')[0], snippet } };
}

/** Every person the results name, one entry per profile page or snippet. */
export function classifyHits(hits: SearchHit[], o: { businessName: string; domain?: string | null }): DmCandidate[] {
  const out: DmCandidate[] = [];
  for (const h of hits) { const c = classifyHit(h, o); if (c) out.push(c); }
  return out;
}
