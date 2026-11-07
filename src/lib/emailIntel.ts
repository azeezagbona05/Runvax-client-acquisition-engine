/**
 * Finding a decision-maker's email address without a paid provider, from public information only, and saying how we know it.
 *
 *   published : the address itself appears on a public page (the company's site or a search result) and carries the person's name
 *   inferred  : we have seen how this company writes its addresses (ada.okafor@ ...) and applied that to this person
 *   guess     : no pattern known, so the single most common form (first.last@); the domain does receive mail, nothing more is known
 *
 * None of these is "verified", and none is shown as such. Without a checker, "published" is the safest and "guess" the riskiest.
 */
import { splitName } from '@/lib/personName';

export type EmailBasis = 'published' | 'inferred' | 'guess';
export const EMAIL_BASIS_LABEL: Record<EmailBasis, string> = { published: 'Found online', inferred: 'Company pattern', guess: 'Best guess' };
export const EMAIL_BASIS_HINT: Record<EmailBasis, string> = {
  published: 'This address appears on a public page and carries their name. It has not been checked.',
  inferred: 'Built from the way this company writes its other addresses. It has not been checked.',
  guess: 'The most common way to write a name at a company. Nothing confirms it, so check before relying on it.',
};

export interface FoundEmail { email: string; basis: EmailBasis; /** The page it was seen on, for "published". */ source?: string }
export interface SeenEmail { email: string; source?: string }

const EMAIL_RE = /[A-Za-z0-9][A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const ROLE = /^(info|contact|contacts|hello|hi|hey|admin|office|support|sales|enquir(y|ies)|inquir(y|ies)|mail|reception|booking|bookings|reservations?|team|help|service|services|marketing|careers?|hr|press|media|noreply|no-reply|webmaster|accounts?|billing)$/i;

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const dom = (d: string) => d.trim().toLowerCase().replace(/^www\./, '');

/** Every address at this domain in a piece of text, lower-cased, once each. */
export function emailsIn(text: string, domain: string): string[] {
  const d = dom(domain);
  const out = new Set<string>();
  for (const m of Array.from(text.matchAll(EMAIL_RE))) {
    const e = m[0].replace(/[.,;:)\]]+$/, '').toLowerCase();
    if (e.endsWith(`@${d}`)) out.add(e);
  }
  return Array.from(out);
}

export const isRoleAddress = (email: string): boolean => ROLE.test(email.split('@')[0]);

/** Does this address carry the person's name (ada.okafor@, aokafor@, okafor@)? Role inboxes never do. */
export function belongsTo(email: string, fullName: string): boolean {
  const local = email.split('@')[0];
  if (ROLE.test(local)) return false;
  const l = plain(local);
  const n = splitName(fullName);
  if (!n) return false;
  const first = plain(n[0]), last = plain(n[1]);
  if (!first || !last) return false;
  return (last.length >= 3 && l.includes(last)) || (first.length >= 4 && l.includes(first)) || l === `${first[0]}${last}`;
}

// ── How a company writes its addresses ───────────────────────────────────────
export const PATTERNS = ['first.last', 'first', 'flast', 'firstlast', 'last', 'firstl', 'f.last', 'first_last'] as const;
export type PatternId = (typeof PATTERNS)[number];

function localFor(p: PatternId, first: string, last: string): string {
  switch (p) {
    case 'first.last': return `${first}.${last}`;
    case 'first': return first;
    case 'flast': return `${first[0]}${last}`;
    case 'firstlast': return `${first}${last}`;
    case 'last': return last;
    case 'firstl': return `${first}${last[0]}`;
    case 'f.last': return `${first[0]}.${last}`;
    case 'first_last': return `${first}_${last}`;
  }
}

export function applyPattern(p: PatternId, fullName: string, domain: string): string | null {
  const n = splitName(fullName);
  if (!n || !dom(domain).includes('.')) return null;
  const first = plain(n[0]), last = plain(n[1]);
  return first && last ? `${localFor(p, first, last)}@${dom(domain)}` : null;
}

/** The pattern a company uses, read from addresses we can tie to named people. Needs at least one pair, and the pairs must agree. */
export function detectPattern(pairs: Array<{ name: string; email: string }>): PatternId | null {
  const votes = new Map<PatternId, number>();
  for (const { name, email } of pairs) {
    const n = splitName(name);
    if (!n || !belongsTo(email, name)) continue;
    const first = plain(n[0]), last = plain(n[1]);
    const local = email.split('@')[0].toLowerCase();
    const hit = PATTERNS.find((p) => first && last && localFor(p, first, last) === local);
    if (hit) votes.set(hit, (votes.get(hit) ?? 0) + 1);
  }
  const ranked = Array.from(votes).sort((a, b) => b[1] - a[1]);
  if (!ranked.length) return null;
  if (ranked.length > 1 && ranked[0][1] === ranked[1][1]) return null; // the examples disagree: do not guess
  return ranked[0][0];
}

/**
 * The best email for one person: an address published with their name, else the company's pattern applied, else (if allowed)
 * the single most common form. Null when the name is a single word, or nothing can be built.
 */
export function pickEmail(name: string, o: { domain: string; seen: SeenEmail[]; pattern: PatternId | null; allowGuess: boolean }): FoundEmail | null {
  const mine = o.seen.find((s) => belongsTo(s.email, name));
  if (mine) return { email: mine.email, basis: 'published', ...(mine.source ? { source: mine.source } : {}) };
  if (o.pattern) { const e = applyPattern(o.pattern, name, o.domain); if (e) return { email: e, basis: 'inferred' }; }
  if (o.allowGuess) { const e = applyPattern('first.last', name, o.domain); if (e) return { email: e, basis: 'guess' }; }
  return null;
}
