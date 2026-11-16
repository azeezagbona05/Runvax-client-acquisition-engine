import { searchPlaces } from '@/lib/google-places';
import { placeFromLocation } from '@/lib/career/suggest';
import type { CareerProfileData, Preferences } from '@/lib/career/types';
import type { Job } from './sources';

/**
 * "Employers near you": real organisations in the person's city, found on Google Maps, for OPEN applications. They have no vacancy listed
 * (the listing says so). This is what helps a nurse in Accra or an accountant in Nairobi, where most jobs are never posted on the public job boards.
 * Google's terms restrict how long Places content may be kept (place IDs may be kept; other fields only briefly), so these listings are removed after 30 days.
 */
export const EMPLOYER_PREFIX = 'Open application: ';
export const EMPLOYER_TTL_DAYS = 30;

const KINDS: Array<[RegExp, string[]]> = [
  [/nurs|midwi|clinic|doctor|physician|medical|health|caregiver|paramedic/i, ['hospital', 'clinic']],
  [/pharmac/i, ['pharmacy', 'hospital']],
  [/account|audit|bookkeep|finance|tax|payroll|treasur/i, ['accounting firm', 'audit firm']],
  [/software|developer|programmer|frontend|backend|full ?stack|devops|data (?:analyst|scientist|engineer)|it support|web|mobile app/i, ['software company', 'technology company']],
  [/teach|lectur|tutor|educat|school/i, ['school', 'university']],
  [/law|legal|paralegal|attorney|counsel/i, ['law firm']],
  [/civil|mechanical|electrical|structural|construction|architect|surveyor|engineer/i, ['engineering company', 'construction company']],
  [/market|brand|social media|content|copywrit|designer|advertis|communications/i, ['marketing agency', 'advertising agency']],
  [/driver|logistic|supply chain|warehouse|dispatch|fleet/i, ['logistics company']],
  [/hotel|hospitality|chef|cook|restaurant|waiter|front desk/i, ['hotel', 'restaurant']],
  [/bank|teller|credit|loan|insurance|underwrit/i, ['bank', 'insurance company']],
  [/human resource|\bhr\b|recruit|talent/i, ['recruitment agency']],
];

/** What kind of employer hires for these job titles. Crude on purpose and explainable; a recruitment agency is always a useful second stop. */
export function employerQueries(titles: string[], industries: string[] = []): string[] {
  const text = [...titles, ...industries].join(' | ');
  const out: string[] = [];
  for (const [re, kinds] of KINDS) if (re.test(text)) { out.push(kinds[0]); break; }
  if (!out.length && titles[0]) out.push(`${titles[0]} employer`.replace(/\b(senior|junior|lead|head of)\b/gi, '').replace(/\s+/g, ' ').trim());
  if (!out.includes('recruitment agency')) out.push('recruitment agency');
  return out.slice(0, 2);
}

interface Place { id?: string; displayName?: { text?: string }; formattedAddress?: string; websiteUri?: string; rating?: number; userRatingCount?: number; primaryTypeDisplayName?: { text?: string }; businessStatus?: string }

export function fromPlaces(places: Place[], role: string, city: string, primary = true): Job[] {
  return places.flatMap((p) => {
    const name = p.displayName?.text?.trim(); if (!p.id || !name || (p.businessStatus && p.businessStatus !== 'OPERATIONAL')) return [];
    const site = p.websiteUri && /^https?:\/\//i.test(p.websiteUri) ? p.websiteUri : `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(p.id)}`;
    const bits = [p.primaryTypeDisplayName?.text, p.rating ? `rated ${p.rating}${p.userRatingCount ? ` (${p.userRatingCount} reviews)` : ''}` : ''].filter(Boolean);
    const rank = (primary ? 6 : 0) + (p.rating && p.rating >= 4 ? 2 : 0) + (p.userRatingCount && p.userRatingCount >= 50 ? 2 : 0);
    return [{ rank, source: 'places' as const, externalId: p.id.slice(0, 120), title: `${EMPLOYER_PREFIX}${role}`.slice(0, 200), company: name.slice(0, 160), location: (p.formattedAddress ?? city).slice(0, 200), remote: false, url: site.slice(0, 600),
      description: `Employer near you on Google Maps${bits.length ? ` (${bits.join(', ')})` : ''}. No vacancy is listed: this is a place to send an open application.`, postedAt: null }];
  });
}

/** Where to look: the first city the person chose, else the city on their CV. Without a city and country there is nothing to search. */
export function whereFor(prefs: Preferences, profile: CareerProfileData): { city: string; country: string } | null {
  const fromCv = placeFromLocation(profile.location);
  const city = prefs.locations[0] || fromCv.city; const country = prefs.country || fromCv.country;
  return city && country ? { city, country } : null;
}

const cache = new Map<string, { at: number; jobs: Job[] }>();
export async function findEmployers(prefs: Preferences, profile: CareerProfileData, search: typeof searchPlaces = searchPlaces): Promise<Job[] | null> {
  const where = whereFor(prefs, profile); if (!where) return null;
  const role = (prefs.titles[0] ?? profile.experience[0]?.title ?? 'your role').replace(/\s+/g, ' ').trim();
  const out: Job[] = [];
  const kinds = employerQueries(prefs.titles.length ? prefs.titles : [role], prefs.industries);
  for (const kind of kinds) {
    const q = `${kind} in ${where.city}, ${where.country}`; const hit = cache.get(q);
    if (hit && Date.now() - hit.at < 24 * 3_600_000) { out.push(...hit.jobs); continue; }
    const r = await search({ query: q, radius: 20, maxPages: 1 });              // one request per kind: Places is billed per request
    const jobs = fromPlaces(r.places as Place[], role, where.city, kind !== 'recruitment agency' || kinds.length === 1); cache.set(q, { at: Date.now(), jobs }); out.push(...jobs);
  }
  return out;
}
export const clearEmployerCache = () => cache.clear();
