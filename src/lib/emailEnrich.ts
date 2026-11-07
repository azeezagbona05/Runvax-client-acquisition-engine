/**
 * Gives the people we found an email address, from public information only (see emailIntel for what each label means).
 * It reads the addresses the company's own site already showed, searches the open web for the address of each person
 * (a few searches, only if web search is switched on), learns how the company writes its addresses, and checks that the
 * domain receives mail at all. Every dependency can be replaced, so it is easy to test.
 */
import dns from 'dns/promises';
import { titleRank, type DmCandidate } from '@/lib/decisionMaker';
import { splitName } from '@/lib/personName';
import { EMAIL_BASIS_LABEL, belongsTo, detectPattern, emailsIn, isRoleAddress, pickEmail, type SeenEmail } from '@/lib/emailIntel';
import type { SearchHit } from '@/lib/webSearch';

/** Does the domain receive email at all? A domain with no mail records can only produce bounces. If DNS itself fails, give it the benefit of the doubt. */
export async function domainHasMx(domain: string): Promise<boolean> {
  try { return (await dns.resolveMx(domain)).length > 0; }
  catch (e) { const code = (e as { code?: string }).code; return !(code === 'ENODATA' || code === 'ENOTFOUND'); }
}

export interface EnrichOptions {
  domain: string | null | undefined;
  /** Addresses the company's own pages showed. */
  siteEmails: Array<{ email: string; sourcePage: string; ownDomain: boolean }>;
  /** Offer the single most common form when nothing better exists. Off when a paid checker will do the work. */
  allowGuess: boolean;
  /** At most this many people get an address (each can cost a search). */
  maxPeople?: number;
  /** Web search, or undefined when it is not switched on. */
  search?: (query: string) => Promise<SearchHit[]>;
  hasMx?: (domain: string) => Promise<boolean>;
}

const clean = (domain: string) => domain.trim().toLowerCase().replace(/^www\./, '');

export async function enrichEmails(candidates: DmCandidate[], o: EnrichOptions): Promise<DmCandidate[]> {
  if (!o.domain) return candidates;
  const domain = clean(o.domain);
  const need = candidates.filter((c) => !c.email && titleRank(c.title) >= 0 && !!splitName(c.name)).slice(0, o.maxPeople ?? 3);
  if (!need.length) return candidates;

  // 1. What is already public: the company's own pages, then the open web.
  const seen: SeenEmail[] = o.siteEmails.filter((e) => e.ownDomain).map((e) => ({ email: e.email.toLowerCase(), source: e.sourcePage }));
  for (const c of candidates) if (c.email && c.email.toLowerCase().endsWith(`@${domain}`)) seen.push({ email: c.email.toLowerCase(), source: c.emailSource ?? c.sourcePage });
  const take = (hits: SearchHit[]) => {
    for (const h of hits) for (const email of emailsIn(`${h.title ?? ''} ${h.description ?? ''} ${h.url ?? ''}`, domain)) if (!seen.some((s) => s.email === email)) seen.push({ email, source: (h.url ?? '').split('?')[0] });
  };
  if (o.search) {
    for (const c of need) {
      if (seen.some((s) => belongsTo(s.email, c.name))) continue; // already published for this person
      take(await o.search(`"${c.name}" "@${domain}"`));
    }
    // With no personal address seen yet, one search for any address at the domain shows how the company writes them.
    if (!seen.some((s) => !isRoleAddress(s.email))) take(await o.search(`"@${domain}" email`));
  }

  // 2. How this company writes its addresses, from addresses we can tie to named people.
  const pairs = candidates.flatMap((c) => seen.filter((s) => belongsTo(s.email, c.name)).map((s) => ({ name: c.name, email: s.email })));
  const pattern = detectPattern(pairs);

  // 3. A domain that cannot receive mail gets nothing.
  if (!(await (o.hasMx ?? domainHasMx)(domain))) return candidates;

  const chosen = new Map<DmCandidate, ReturnType<typeof pickEmail>>();
  // An address that is published exists, whoever it is for. A pattern or a guess is only worth building for someone we are reasonably sure
  // works there (their own profile names the company, their company's site names them, or two sources agree); for a doubtful match it
  // would just send mail to the wrong person.
  const trusted = (c: DmCandidate) => c.match === 'confirmed' || c.source === 'website' || (c.sources?.length ?? 1) >= 2;
  for (const c of need) chosen.set(c, pickEmail(c.name, { domain, seen, pattern: trusted(c) ? pattern : null, allowGuess: o.allowGuess && trusted(c) }));
  return candidates.map((c) => {
    const f = chosen.get(c);
    return f ? { ...c, email: f.email, emailStatus: EMAIL_BASIS_LABEL[f.basis], emailBasis: f.basis, ...(f.source ? { emailSource: f.source } : {}) } : c;
  });
}
