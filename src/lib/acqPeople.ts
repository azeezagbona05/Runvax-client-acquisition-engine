/**
 * "Find people" for one business: who runs it, and how to reach them.
 * First the business's own website is looked up for the people attached to it (and their emails). If that gives
 * nobody, or is not available on the account, RUNVAX's own contact intelligence takes over (the website and public
 * information). The page never says which source answered.
 */

import type { DomainContact } from '@/lib/snov';
import type { FindContext, FindResult } from '@/lib/dmFinder';

export interface PersonFound {
  name: string;
  title: string;
  email?: string;
  /** 'confirmed' means the address was checked and exists; 'unconfirmed' means it could not be checked. */
  emailState?: 'confirmed' | 'unconfirmed';
  phone?: string;
  linkedin?: string;
  /** The page where the person was seen, when known. */
  sourcePage?: string;
  /** How firmly they are tied to the business: their own profile names it next to a title, or it is likely. */
  match?: 'confirmed' | 'likely';
  /** The page and snippet that put them here, so it can be checked. */
  evidence?: { url: string; snippet: string };
}

export interface ChannelFound { type: 'decision_maker_email' | 'general_email' | 'contact_form' | 'business_phone' | 'none'; value?: string; person?: string; sourcePage?: string }

export interface PeopleResult { people: PersonFound[]; via: 'primary' | 'fallback' | 'none'; note?: string; channels?: ChannelFound[] }

export interface PeopleInput { name: string; address?: string; website?: string; category?: string; max: number }

export interface PeopleDeps {
  primary: { enabled: () => boolean; contacts: (domain: string, max: number) => Promise<DomainContact[]> } | null;
  fallback: (ctx: FindContext) => Promise<Pick<FindResult, 'candidates'> & { channels?: ChannelFound[] }>;
}

const SOCIAL = /(^|\.)(facebook|instagram|twitter|x|linkedin|tiktok|youtube|wa|linktr)\.(com|me|ee)$|(^|\.)(business|sites)\.google\.com$/i;
export const MAX_PEOPLE = 10;

/** The business's own domain, or null when it has no website or only a social page. */
export function domainOf(website?: string): string | null {
  if (!website?.trim()) return null;
  try {
    const host = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`).hostname.replace(/^www\./i, '').toLowerCase();
    return host.includes('.') && !SOCIAL.test(host) ? host : null;
  } catch { return null; }
}

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (s: unknown, n: number) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, n) : '');

/** "valid" or "address exists" in any provider's wording is confirmed; anything else with an address is unconfirmed. */
export function emailStateOf(status?: string): 'confirmed' | 'unconfirmed' {
  return status && /(^|[^a-z])valid\b|exists/i.test(status) && !/not[_ ]valid|invalid/i.test(status) ? 'confirmed' : 'unconfirmed';
}

/** One list of people: duplicates by name merged (keeping the one with an email), blanks dropped, capped. */
export function tidyPeople(list: PersonFound[], max = MAX_PEOPLE): PersonFound[] {
  const by = new Map<string, PersonFound>();
  for (const p of list) {
    const name = clean(p.name, 120);
    if (!name) continue;
    const email = p.email && EMAIL_OK.test(p.email) ? p.email.toLowerCase() : undefined;
    const next: PersonFound = { name, title: clean(p.title, 120), ...(email ? { email, emailState: p.emailState ?? 'unconfirmed' } : {}), ...(p.phone ? { phone: clean(p.phone, 40) } : {}), ...(p.linkedin ? { linkedin: clean(p.linkedin, 200) } : {}), ...(p.sourcePage ? { sourcePage: clean(p.sourcePage, 300) } : {}), ...(p.match ? { match: p.match } : {}), ...(p.evidence ? { evidence: { url: clean(p.evidence.url, 300), snippet: clean(p.evidence.snippet, 240) } } : {}) };
    const key = name.toLowerCase();
    const old = by.get(key);
    if (!old || (!old.email && next.email)) by.set(key, { ...old, ...next });
  }
  return Array.from(by.values()).slice(0, Math.max(1, Math.min(max, MAX_PEOPLE)));
}

export async function findPeople(input: PeopleInput, deps: PeopleDeps): Promise<PeopleResult> {
  const max = Math.max(1, Math.min(input.max, MAX_PEOPLE));
  const domain = domainOf(input.website);

  if (domain && deps.primary?.enabled()) {
    try {
      const got = await deps.primary.contacts(domain, max);
      const people = tidyPeople(got.map((c) => ({ name: c.name, title: c.position, email: c.email, emailState: c.email ? emailStateOf(c.smtpStatus) : undefined })), max);
      if (people.length) return { people, via: 'primary' };
    } catch { /* fall through to the next source */ }
  }

  try {
    const city = (input.address ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const r = await deps.fallback({ businessName: input.name, city: city[1] ?? city[0] ?? '', website: input.website, category: input.category });
    const people = tidyPeople(r.candidates.map((c) => ({ name: c.name, title: c.title, email: c.email, emailState: c.email ? emailStateOf(c.emailStatus) : undefined, phone: c.phone, linkedin: c.linkedin, sourcePage: c.sourcePage, match: c.match, evidence: c.evidence })), max);
    if (people.length) return { people, via: 'fallback', channels: r.channels };
    // Nobody named, but the website may still give a general inbox or a contact form.
    if (r.channels?.some((c) => c.type !== 'none')) return { people: [], via: 'none', channels: r.channels, note: 'No named people were found, but the business has a general contact.' };
  } catch { /* nothing more to try */ }

  return { people: [], via: 'none', note: domain ? 'No named people were found for this business.' : 'This business has no website of its own, so there was nobody to look up. Try its phone number.' };
}
