// Email local-part pattern catalogue. Each pattern renders a local part from name components.
// `prior` is a weak generic belief used ONLY when a domain has little/no evidence (see detect.js).
export const PATTERNS = [
  { id: 'first.last', example: 'james.brown', prior: 0.30, render: (n) => `${n.first}.${n.last}` },
  { id: 'first', example: 'james', prior: 0.16, render: (n) => n.first },
  { id: 'flast', example: 'jbrown', prior: 0.15, render: (n) => `${n.first[0]}${n.last}` },
  { id: 'firstlast', example: 'jamesbrown', prior: 0.12, render: (n) => `${n.first}${n.last}` },
  { id: 'firstl', example: 'jamesb', prior: 0.04, render: (n) => `${n.first}${n.last[0]}` },
  { id: 'first_last', example: 'james_brown', prior: 0.04, render: (n) => `${n.first}_${n.last}` },
  { id: 'f.last', example: 'j.brown', prior: 0.04, render: (n) => `${n.first[0]}.${n.last}` },
  { id: 'first.l', example: 'james.b', prior: 0.02, render: (n) => `${n.first}.${n.last[0]}` },
  { id: 'last', example: 'brown', prior: 0.05, render: (n) => n.last },
  { id: 'last.first', example: 'brown.james', prior: 0.02, render: (n) => `${n.last}.${n.first}` },
  { id: 'lastfirst', example: 'brownjames', prior: 0.01, render: (n) => `${n.last}${n.first}` },
  { id: 'lastf', example: 'brownj', prior: 0.02, render: (n) => `${n.last}${n.first[0]}` },
  { id: 'first-last', example: 'james-brown', prior: 0.02, render: (n) => `${n.first}-${n.last}` },
  { id: 'last_first', example: 'brown_james', prior: 0.005, render: (n) => `${n.last}_${n.first}` },
];
export const PATTERN_BY_ID = Object.fromEntries(PATTERNS.map((p) => [p.id, p]));

/**
 * Name variants for matching/rendering: handles hyphenated first/last names and compound surnames.
 * Preserves culturally meaningful components: "van der Berg" -> "vanderberg" and "berg"; "Smith-Jones" -> "smithjones", "smith", "jones".
 */
export function nameVariants(n) {
  if (!n || !n.first || !n.last) return [];
  const firsts = [...new Set([n.first, n.firstParts?.length > 1 ? n.firstParts[0] : null].filter(Boolean))];
  const lasts = [...new Set([n.last, n.lastParts?.length > 1 ? n.lastParts[n.lastParts.length - 1] : null, n.surnameTokens?.length > 1 ? n.surnameTokens[0] : null].filter(Boolean))];
  const out = [];
  for (const first of firsts) for (const last of lasts) out.push({ first, last, primary: first === n.first && last === n.last });
  return out;
}

/** Which patterns explain `local` for this person? Returns pattern ids (all that match, across variants). */
export function matchingPatterns(local, name) {
  const hits = new Set();
  for (const v of nameVariants(name)) for (const p of PATTERNS) {
    if (v.first.length < 2 && ['first', 'firstlast', 'first.last', 'first_last', 'first-last', 'first.l', 'firstl'].includes(p.id)) continue;
    if (p.render(v) === local) hits.add(p.id);
  }
  return [...hits];
}
