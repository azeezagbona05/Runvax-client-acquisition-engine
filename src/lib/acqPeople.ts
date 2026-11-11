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
  /** How we know their email: published online, the company's pattern, or a best guess. Never "verified". */
  emailBasis?: 'published' | 'inferred' | 'guess';
  emailSource?: string;
  /** The engine's status for the email (VERIFIED, LIKELY_VALID, UNVERIFIED, INVALID...). A DNS-level check, never a mailbox probe. */
  status?: string;
  statusNote?: string;
}

export interface ChannelFound { type: 'decision_maker_email' | 'general_email' | 'contact_form' | 'business_phone' | 'none'; value?: string; person?: string; sourcePage?: string }

export interface PeopleResult { people: PersonFound[]; via: 'primary' | 'fallback' | 'none'; note?: string; channels?: ChannelFound[] }

export interface PeopleInput { name: string; address?: string; website?: string; category?: string; max: number }

export interface PeopleDeps {
  primary: { enabled: () => boolean; contacts: (domain: string, max: number) => Promise<DomainContact[]> } | null;
  fallback: (ctx: FindContext) => Promise<Pick<FindResult, 'candidates'> & { channels?: ChannelFound[] }>;
  /** RUNVAX's own email engine: the people listed on the site (the whole team), each email with its status. Optional. */
  engine?: ((website: string) => Promise<PersonFound[]>) | null;
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
    const next: PersonFound = { name, title: clean(p.title, 120), ...(email ? { email, emailState: p.emailState ?? 'unconfirmed' } : {}), ...(p.phone ? { phone: clean(p.phone, 40) } : {}), ...(p.linkedin ? { linkedin: clean(p.linkedin, 200) } : {}), ...(p.sourcePage ? { sourcePage: clean(p.sourcePage, 300) } : {}), ...(p.match ? { match: p.match } : {}), ...(email && p.emailBasis ? { emailBasis: p.emailBasis } : {}), ...(email && p.emailSource ? { emailSource: clean(p.emailSource, 300) } : {}), ...(email && p.status ? { status: clean(p.status, 20) } : {}), ...(email && p.statusNote ? { statusNote: clean(p.statusNote, 200) } : {}), ...(p.evidence ? { evidence: { url: clean(p.evidence.url, 300), snippet: clean(p.evidence.snippet, 240) } } : {}) };
    const key = name.toLowerCase();
    const old = by.get(key);
    if (!old || (!old.email && next.email)) by.set(key, { ...old, ...next });
  }
  return Array.from(by.values()).slice(0, Math.max(1, Math.min(max, MAX_PEOPLE)));
}

/** Adds the engine's status to people the finder already has, and appends people only the engine saw. */
export function mergePeople(finder: PersonFound[], engine: PersonFound[]): PersonFound[] {
  const key = (n: string) => n.toLowerCase().replace(/\b(dr|mr|mrs|ms|miss|prof|engr|chief)\.?\s+/g, '').replace(/\s+/g, ' ').trim();
  const byName = new Map(engine.map((p) => [key(p.name), p]));
  const used = new Set<string>();
  const out = finder.map((f) => {
    const e = byName.get(key(f.name));
    if (!e) return f;
    used.add(key(f.name));
    // Keep the finder's own email; fill the status from the engine only when it is for the same address.
    if (f.email && e.email && f.email.toLowerCase() === e.email.toLowerCase()) return { ...f, status: e.status, statusNote: e.statusNote };
    return f.email ? f : { ...f, email: e.email, emailBasis: e.emailBasis, emailSource: e.emailSource, status: e.status, statusNote: e.statusNote };
  });
  return [...out, ...engine.filter((e) => !used.has(key(e.name)))];
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

  const city = (input.address ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const site = domain && input.website ? input.website : '';
  // The decision-maker finder and the engine run side by side. Either can fail without losing the other.
  const [fb, eng] = await Promise.all([
    deps.fallback({ businessName: input.name, city: city[1] ?? city[0] ?? '', website: input.website, category: input.category }).catch(() => null),
    site && deps.engine ? deps.engine(site).catch((): PersonFound[] => []) : Promise.resolve([] as PersonFound[]),
  ]);
  const fromFinder: PersonFound[] = (fb?.candidates ?? []).map((c) => ({ name: c.name, title: c.title, email: c.email, emailState: c.email ? emailStateOf(c.emailStatus) : undefined, phone: c.phone, linkedin: c.linkedin, sourcePage: c.sourcePage, match: c.match, evidence: c.evidence, emailBasis: c.emailBasis, emailSource: c.emailSource }));
  // The finder's people come first (they carry the profile evidence); the engine adds the rest of the team and a status per email.
  const people = tidyPeople(mergePeople(fromFinder, eng), max);
  if (people.length) return { people, via: 'fallback', channels: fb?.channels };
  // Nobody named, but the website may still give a general inbox or a contact form.
  if (fb?.channels?.some((c) => c.type !== 'none')) return { people: [], via: 'none', channels: fb.channels, note: 'No named people were found, but the business has a general contact.' };

  return { people: [], via: 'none', note: domain ? 'No named people were found for this business.' : 'This business has no website of its own, so there was nobody to look up. Try its phone number.' };
}
