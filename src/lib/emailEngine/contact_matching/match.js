import { parseName } from '../shared/names.js';
import { splitEmail, normalizeDomain } from '../shared/normalize.js';
import { ROLE_LOCALS } from '../shared/constants.js';
import { matchingPatterns, nameVariants } from '../pattern_detection/patterns.js';

/**
 * Score how likely `email` belongs to `person`. Name similarity ALONE is never enough: at least one piece of
 * email-side evidence (local-part consistency or a structured/co-located source) is required for a match.
 */
export function scorePair(email, person, { domain, patternReport } = {}) {
  const { local, domain: ed } = splitEmail(email.email);
  const name = parseName(person.name);
  const evidence = []; let score = 0; let emailSide = false;
  if (!name) return { score: 0, evidence: ['unparseable name'], emailSide: false };

  if (ROLE_LOCALS.has(local)) return { score: 0, evidence: ['role mailbox is not a person'], emailSide: false };

  const hits = matchingPatterns(local, name);
  const tokens = new Set(nameVariants(name).flatMap((v) => [v.first, v.last]));
  if (hits.length) {
    const fullStrong = hits.some((h) => !['first', 'last', 'flast', 'lastf', 'f.last'].includes(h));
    score += fullStrong ? 0.5 : hits.includes('first') || hits.includes('last') ? 0.2 : 0.3;
    evidence.push(`local part "${local}" is consistent with ${person.name} via ${hits.join('/')}`); emailSide = true;
  } else if ([...tokens].some((t) => t.length >= 3 && local.includes(t))) { score += 0.1; evidence.push('local part contains a name component'); emailSide = true; }
  else { score -= 0.25; evidence.push('local part shares nothing with this name'); }

  if (email.name) {
    const en = parseName(email.name);
    if (en && en.first === name.first && en.last === name.last) { score += 0.3; evidence.push('name appears next to the email on the source page'); emailSide = true; }
    else if (en) { score -= 0.35; evidence.push(`a different name (${email.name}) appears next to this email`); }
  }
  if (person.emailFromStructuredData) { score += 0.4; evidence.push('email attached to this Person in structured data'); emailSide = true; }

  const sameDomain = normalizeDomain(ed) === domain || ed.endsWith('.' + domain);
  if (sameDomain) { score += 0.1; evidence.push('email is on the business domain'); } else { score -= 0.3; evidence.push('email is on a different domain'); }
  if (patternReport?.dominant && hits.includes(patternReport.dominant)) { score += 0.1; evidence.push(`matches domain's dominant pattern ${patternReport.dominant}`); }
  if (person.title && email.title && person.title.toLowerCase() === email.title.toLowerCase()) { score += 0.05; evidence.push('same job title near both'); }
  if (email.sources?.some((s) => person.sourceUrl && s.url === person.sourceUrl)) { score += 0.05; evidence.push('found on the same page as the person'); }
  return { score: Math.max(0, Math.min(0.97, score)), evidence, emailSide };
}

/**
 * Assign each discovered email to at most one person. Ambiguous cases (runner-up within 0.1) are flagged and
 * downgraded rather than guessed.
 */
export function matchContacts({ domain: domainInput, emails, people, patternReport = null, minMatch = 0.6, minPossible = 0.4 }) {
  const domain = normalizeDomain(domainInput);
  const matches = []; const unmatched = [];
  for (const e of emails) {
    const ranked = people.map((p) => ({ person: p, ...scorePair(e, p, { domain, patternReport }) })).filter((r) => r.emailSide).sort((a, b) => b.score - a.score);
    const best = ranked[0]; const second = ranked[1];
    if (!best || best.score < minPossible) { unmatched.push({ email: e.email, reason: ROLE_LOCALS.has(splitEmail(e.email).local) ? 'role-based mailbox' : 'no person with sufficient evidence' }); continue; }
    const ambiguous = !!second && best.score - second.score < 0.1 && second.score >= minPossible;
    let score = ambiguous ? best.score * 0.6 : best.score;
    const level = score >= minMatch ? 'MATCHED' : 'POSSIBLE';
    matches.push({ email: e.email, person: { name: best.person.name, title: best.person.title }, score: +score.toFixed(2), level, ambiguous, alternatives: ambiguous ? [second.person.name] : [], evidence: best.evidence });
  }
  return { matches, unmatched };
}
