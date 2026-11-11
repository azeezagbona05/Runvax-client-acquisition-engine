import { discoverEmails, discoverFromPages } from './email_discovery/discover.js';
import { detectPatterns } from './pattern_detection/detect.js';
import { generateCandidates } from './candidate_generation/generate.js';
import { createVerifier } from './email_verification/verify.js';
import { matchContacts } from './contact_matching/match.js';
import { normalizeDomain } from './shared/normalize.js';

/**
 * Orchestrator. Input: domain (+ optional person name). Output: discovered emails, learned patterns, inferred candidates,
 * verification, contact matches — each with evidence. Pure library; no RUNVAX imports, no DB, no env access.
 * Options: { pages } to bypass crawling (tests/datasets), { fetchImpl, maxPages, delayMs }, { verifier } or { smtp }.
 */
export async function findEmails({ domain: domainInput, name = null, pages = null, crawlOptions = {}, verifier = null, smtp = false, probeFrom, verifyCandidates = true } = {}) {
  const domain = normalizeDomain(domainInput);
  if (!domain) throw new Error('A valid business domain is required');
  const t0 = Date.now();
  const disc = pages ? discoverFromPages(domain, pages) : await discoverEmails(domain, crawlOptions);
  const onDomain = disc.emails.filter((e) => e.onSiteDomain);
  const observations = onDomain.map((e) => ({ email: e.email, name: e.name, sourceUrl: e.sources[0].url, observedAt: e.sources[0].discoveredAt }));
  const patternReport = detectPatterns(domain, observations);
  const matching = matchContacts({ domain, emails: onDomain, people: disc.people, patternReport });
  const v = verifier || createVerifier({ smtp, ...(probeFrom ? { probeFrom } : {}) });

  const discovered = [];
  for (const e of disc.emails) {
    const verification = await v.verify(e.email, { discovered: true });
    const match = matching.matches.find((m) => m.email === e.email) || null;
    discovered.push({ ...e, verification, match });
  }
  let candidates = [];
  if (name) {
    candidates = generateCandidates(name, domain, patternReport);
    const known = new Set(disc.emails.map((e) => e.email));
    candidates = candidates.filter((c) => !known.has(c.email));
    if (verifyCandidates) for (const c of candidates) c.verification = await v.verify(c.email, { discovered: false });
  }
  return {
    domain, query: { name }, discovered, patterns: patternReport, people: disc.people, candidates,
    unmatchedEmails: matching.unmatched, pagesScanned: disc.pagesScanned, crawlErrors: disc.crawlErrors || [],
    meta: { elapsedMs: Date.now() - t0, generatedAt: new Date().toISOString(), smtpEnabled: !!smtp, notice: 'INFERRED candidates are guesses from naming patterns and are never confirmed emails.' },
  };
}
