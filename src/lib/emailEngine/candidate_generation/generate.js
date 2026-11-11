import { PATTERNS, nameVariants } from '../pattern_detection/patterns.js';
import { parseName } from '../shared/names.js';
import { normalizeDomain } from '../shared/normalize.js';
import { Provenance } from '../shared/constants.js';

const NEEDS_FULL_FIRST = new Set(['first', 'firstlast', 'first.last', 'first_last', 'first-last', 'first.l', 'firstl']);

/**
 * Generate a SMALL ranked list of inferred addresses for a person at a domain.
 *
 * score(pattern) = w * domainConfidence + (1 - w) * genericPrior,   w = n / (n + 2)
 * where n = strong observations on this domain. With real domain evidence, evidence dominates; with none, priors rule
 * and every candidate is labelled basis=GENERIC_PRIOR with a hard-capped score.
 *
 * EVERY returned object has provenance INFERRED and confirmed:false. Callers must not present these as confirmed emails.
 */
export function generateCandidates(personName, domainInput, patternReport = null, { maxCandidates = 3, minScore = 0.04 } = {}) {
  const domain = normalizeDomain(domainInput);
  const name = typeof personName === 'string' ? parseName(personName) : personName;
  if (!domain || !name || !name.last || !name.first) return [];
  const n = patternReport?.strongObservations ?? 0;
  const w = n / (n + 2);
  const domConf = Object.fromEntries((patternReport?.patterns || []).map((p) => [p.id, p]));
  const basis = n === 0 ? 'GENERIC_PRIOR' : patternReport.dominant ? 'DOMAIN_EVIDENCE' : 'WEAK_DOMAIN_EVIDENCE';
  const variants = nameVariants(name);
  const byLocal = new Map();

  for (const p of PATTERNS) {
    for (const v of variants) {
      if (name.initialsOnly && NEEDS_FULL_FIRST.has(p.id)) continue;
      if (v.first.length < 2 && NEEDS_FULL_FIRST.has(p.id)) continue;
      const local = p.render(v);
      if (!/^[a-z0-9._-]{2,64}$/.test(local)) continue;
      let score = w * (domConf[p.id]?.confidence ?? 0) + (1 - w) * p.prior;
      if (!v.primary) score *= 0.6; // alternate spelling of hyphenated/compound names ranks lower
      if (basis === 'GENERIC_PRIOR') score = Math.min(score, 0.35); // never imply confidence we don't have
      const prev = byLocal.get(local);
      if (!prev || score > prev.score) byLocal.set(local, { local, score, patternId: p.id, variantPrimary: v.primary });
    }
  }
  return [...byLocal.values()].filter((c) => c.score >= minScore).sort((a, b) => b.score - a.score).slice(0, maxCandidates).map((c, i) => ({
    email: `${c.local}@${domain}`,
    provenance: Provenance.INFERRED,
    confirmed: false,
    rank: i + 1,
    patternId: c.patternId,
    score: +c.score.toFixed(3),
    basis,
    note: 'INFERRED from naming pattern; not seen publicly. Verify before use.',
  }));
}
