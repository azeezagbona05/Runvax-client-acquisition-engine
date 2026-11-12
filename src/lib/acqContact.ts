/**
 * One contact record for both ways of finding people on Find Prospects: people attached to a business found by location,
 * and people found by industry, place and seniority. Whatever the route, a contact is the same shape, and an email has two
 * separate facts: whether one was FOUND (and how), and whether it was VERIFIED (checked for deliverability).
 * A found email is never shown as a verified one.
 */

import { isVerifiedStatus, type Verdict } from '@/lib/acqFinder';

export type ContactRoute = 'business-search' | 'industry-discovery';
/** How an address was found. 'provider' means a lookup service returned it (the page does not name it). */
export type EmailBasis = 'published' | 'inferred' | 'guess' | 'provider';
export type Verification = 'verified' | 'unverified' | 'invalid';

export interface ContactRecord {
  route: ContactRoute;
  name: string;
  title: string;
  company: string;
  domain?: string;
  email?: string;
  emailBasis?: EmailBasis;
  verification: Verification;
  linkedin?: string;
  sourcePage?: string;
}

export interface Badge { label: string; tone: 'green' | 'blue' | 'amber' | 'gray' | 'red'; hint: string }

/** What the check (a deliverability verdict, or the source's own confirmation) says about this address. */
export function verificationOf(opts: { verdict?: Verdict; sourceStatus?: string; confirmedBySource?: boolean }): Verification {
  if (opts.verdict === 'valid') return 'verified';
  if (opts.verdict === 'invalid') return 'invalid';
  // 'unknown' (for example a catch-all domain) is not proof either way.
  if (opts.verdict === 'unknown') return 'unverified';
  if (opts.confirmedBySource || isVerifiedStatus(opts.sourceStatus)) return 'verified';
  if (opts.sourceStatus && /not[\s_-]?valid|invalid|undeliverable/i.test(opts.sourceStatus)) return 'invalid';
  return 'unverified';
}

export interface FinderPersonInput {
  name: string; title: string; email?: string; emailStatus?: string; emailBasis?: 'published' | 'inferred' | 'guess';
  linkedin?: string; sourcePage?: string;
}

export function fromFinderPerson(p: FinderPersonInput, ctx: { company: string; domain?: string }, verdict?: Verdict): ContactRecord {
  return {
    route: 'business-search', name: p.name, title: p.title, company: ctx.company, domain: ctx.domain,
    ...(p.email ? { email: p.email, emailBasis: p.emailBasis ?? 'provider', verification: verificationOf({ verdict, sourceStatus: p.emailStatus }) } : { verification: 'unverified' as const }),
    ...(p.linkedin ? { linkedin: p.linkedin } : {}), ...(p.sourcePage ? { sourcePage: p.sourcePage } : {}),
  };
}

export interface DiscoverInput { firstName: string; lastName: string; jobTitle: string; company: { name: string; domain: string } }
export interface RevealedInput { name?: string; email?: string; smtpStatus?: string; linkedin?: string }

export function fromDiscover(p: DiscoverInput, r?: RevealedInput, verdict?: Verdict): ContactRecord {
  const masked = `${p.firstName} ${p.lastName}`.trim();
  return {
    route: 'industry-discovery', name: r?.name ?? masked, title: p.jobTitle, company: p.company.name, domain: p.company.domain || undefined,
    ...(r?.email ? { email: r.email, emailBasis: 'provider' as const, verification: verificationOf({ verdict, sourceStatus: r.smtpStatus }) } : { verification: 'unverified' as const }),
    ...(r?.linkedin ? { linkedin: r.linkedin } : {}),
  };
}

const BASIS: Record<EmailBasis, Badge> = {
  published: { label: 'Found: on their site', tone: 'blue', hint: 'This address is published on the business\'s own website.' },
  inferred: { label: 'Found: pattern', tone: 'blue', hint: 'Built from the business\'s usual address pattern. It has not been checked.' },
  guess: { label: 'Found: best guess', tone: 'amber', hint: 'A guess from common address patterns. It has not been checked.' },
  provider: { label: 'Found', tone: 'blue', hint: 'An address was found for this person.' },
};

/** The two badges for a contact: was an email found, and was it verified. Never one merged status. */
export function statusOf(c: ContactRecord): { found: Badge; verified: Badge | null } {
  if (!c.email) return { found: { label: 'No email', tone: 'gray', hint: 'No email address was found for this person yet.' }, verified: null };
  const found = BASIS[c.emailBasis ?? 'provider'];
  const verified: Badge = c.verification === 'verified' ? { label: '✓ Verified', tone: 'green', hint: 'The address was checked and exists.' }
    : c.verification === 'invalid' ? { label: 'Invalid', tone: 'red', hint: 'The check says this address does not exist. It will not be added to a campaign.' }
    : { label: 'Not verified', tone: 'amber', hint: 'Nobody has checked that this address exists. Verify it before sending.' };
  return { found, verified };
}

/**
 * Whether a contact can be added to a campaign. Verified addresses always can; invalid ones never can; unverified ones only when
 * the sender chooses to include them. (An address published on the business's own site has long counted as ready on Find Prospects;
 * `publishedCounts` keeps that rule explicit so it can be switched off in one place.)
 */
export function campaignReady(c: ContactRecord, opts: { includeUnverified?: boolean; publishedCounts?: boolean } = {}): boolean {
  if (!c.email || c.verification === 'invalid') return false;
  if (c.verification === 'verified') return true;
  if (c.emailBasis === 'published' && (opts.publishedCounts ?? true)) return true;
  return !!opts.includeUnverified;
}

export function toLead(c: ContactRecord): { email: string; name: string; business: string; website?: string } | null {
  return c.email ? { email: c.email, name: c.name, business: c.company, ...(c.domain ? { website: c.domain } : {}) } : null;
}
