import { PATTERNS, PATTERN_BY_ID, matchingPatterns } from './patterns.js';
import { parseName } from '../shared/names.js';
import { splitEmail, normalizeDomain } from '../shared/normalize.js';
import { ROLE_LOCALS, FREE_MAIL_DOMAINS } from '../shared/constants.js';

const wilsonLower = (k, n, z = 1.0) => { if (!n) return 0; const p = k / n; const d = 1 + z * z / n; return (p + z * z / (2 * n) - z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n)) / d; };

/**
 * Learn a domain's naming convention.
 * Input: observations = [{ email, name?, sourceUrl?, observedAt? }] (on-domain, discovered emails).
 * Only observations with a parseable name can give strong evidence. Nameless personal-looking locals
 * ("jane.smith") give weak evidence (weight 0.25) for the dotted/underscored shape only.
 *
 * Output per pattern: count (fractional when ambiguous), frequency, consistency (share of strong evidence),
 * confidence (Wilson lower bound x evidence-volume discount), examples, lastObserved.
 * `dominant` is set only when confidence >= minConfidence; otherwise generation falls back to priors, flagged as such.
 */
export function detectPatterns(domainInput, observations, { minConfidence = 0.5, now = new Date() } = {}) {
  const domain = normalizeDomain(domainInput);
  const stats = new Map(PATTERNS.map((p) => [p.id, { id: p.id, count: 0, weak: 0, examples: [], lastObserved: null }]));
  let strong = 0, weak = 0, ignored = 0; const seen = new Set();

  for (const o of observations) {
    if (!o?.email) continue;
    const { local, domain: d } = splitEmail(o.email);
    if (d !== domain || seen.has(o.email) || FREE_MAIL_DOMAINS.has(d)) { ignored++; continue; }
    seen.add(o.email);
    if (ROLE_LOCALS.has(local)) { ignored++; continue; }
    const name = o.name ? parseName(o.name) : null;
    const when = o.observedAt || now.toISOString();
    const hits = name ? matchingPatterns(local, name) : [];
    if (hits.length) {
      strong++;
      for (const id of hits) { const s = stats.get(id); s.count += 1 / hits.length; s.examples.push({ email: o.email, name: o.name, sourceUrl: o.sourceUrl }); if (!s.lastObserved || when > s.lastObserved) s.lastObserved = when; }
    } else if (!name) {
      const shape = /^[a-z]{2,}\.[a-z]{2,}$/.test(local) ? 'first.last' : /^[a-z]{2,}_[a-z]{2,}$/.test(local) ? 'first_last' : /^[a-z]\.[a-z]{2,}$/.test(local) ? 'f.last' : null;
      if (shape) { weak++; const s = stats.get(shape); s.weak += 0.25; s.examples.push({ email: o.email, weak: true, sourceUrl: o.sourceUrl }); if (!s.lastObserved || when > s.lastObserved) s.lastObserved = when; }
    } else ignored++; // named but explained by no pattern: counted as contradiction below
  }
  const contradictions = observations.filter((o) => o?.name && o.email && !ROLE_LOCALS.has(splitEmail(o.email).local) && splitEmail(o.email).domain === domain && !matchingPatterns(splitEmail(o.email).local, parseName(o.name) || {}).length && parseName(o.name)).length;
  const total = strong + contradictions + 0;           // strong-evidence denominator
  const weakTotal = [...stats.values()].reduce((a, s) => a + s.weak, 0);
  const evidence = total + weakTotal;

  const patterns = [...stats.values()].filter((s) => s.count > 0 || s.weak > 0).map((s) => {
    const k = s.count + s.weak, n = Math.max(evidence, 1);
    const consistency = k / n;
    const confidence = wilsonLower(k, n) * (n >= 2 ? 1 : 0.85); // single observation: capped
    return { id: s.id, example: PATTERN_BY_ID[s.id].example, observations: +k.toFixed(2), frequency: +(k / n).toFixed(3), consistency: +consistency.toFixed(3), confidence: +confidence.toFixed(3), examples: s.examples.slice(0, 5), lastObserved: s.lastObserved };
  }).sort((a, b) => b.confidence - a.confidence || b.observations - a.observations);

  const top = patterns[0];
  return {
    domain, strongObservations: strong, weakObservations: weak, contradictions, ignored, patterns,
    dominant: top && top.confidence >= minConfidence ? top.id : null,
    basis: evidence === 0 ? 'NO_EVIDENCE' : top && top.confidence >= minConfidence ? 'DOMAIN_EVIDENCE' : 'WEAK_EVIDENCE',
  };
}
