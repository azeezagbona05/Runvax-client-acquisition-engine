/**
 * Apollo — an optional second layer for finding a named decision-maker at a
 * business that has its own website domain. It never replaces the existing
 * sources (Google Places, site scraping): it only runs when a user asks for it,
 * and only if APOLLO_API_KEY is set.
 *
 * Endpoints follow Apollo's public docs as last known — confirm against
 * https://docs.apollo.io before relying on them.
 */

const BASE = 'https://api.apollo.io/api/v1';

export const DECISION_TITLES = [
  'owner', 'founder', 'ceo', 'managing director', 'director',
  'general manager', 'head of operations', 'operations manager',
];

export interface DecisionMaker {
  name: string;
  title: string;
  email?: string;
  /** Apollo's own confidence in the address — never shown as "verified" unless it says so. */
  emailStatus?: string;
  linkedin?: string;
}

export function apolloEnabled(): boolean {
  return !!process.env.APOLLO_API_KEY;
}

export function domainFromUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
    // Social pages and free site builders are not company domains.
    if (/(facebook|instagram|linktr|wa\.me|wixsite|business\.site|google\.)/.test(host)) return null;
    return host;
  } catch { return null; }
}

async function call<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.APOLLO_API_KEY ?? '', 'Cache-Control': 'no-cache' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Apollo ${res.status}`);
  return res.json() as Promise<T>;
}

/** Search first (names/titles), then reveal the email for the single best match. */
export async function findDecisionMaker(domain: string): Promise<DecisionMaker | null> {
  const search = await call<{ people?: Array<{ id: string; name?: string; first_name?: string; title?: string; linkedin_url?: string }> }>(
    '/mixed_people/search',
    { q_organization_domains: domain, person_titles: DECISION_TITLES, page: 1, per_page: 3 },
  );
  const top = search.people?.[0];
  if (!top) return null;

  const dm: DecisionMaker = {
    name: top.name ?? top.first_name ?? 'Unknown',
    title: top.title ?? '',
    linkedin: top.linkedin_url,
  };

  try {
    const match = await call<{ person?: { email?: string; email_status?: string } }>(
      '/people/match',
      { id: top.id, reveal_personal_emails: false },
    );
    const email = match.person?.email;
    // Apollo returns placeholders like "email_not_unlocked@domain.com" when nothing was revealed.
    if (email && !/not_unlocked/i.test(email)) {
      dm.email = email.toLowerCase();
      dm.emailStatus = match.person?.email_status;
    }
  } catch { /* a name and title are still useful without the email */ }

  return dm;
}
