import { asciiFold } from './normalize.js';

const PREFIXES = /^(dr|mr|mrs|ms|miss|prof|sir|dame|rev|hon|eng|engr|chief|alhaji|alhaja)\.?$/i;
const SUFFIXES = /^(jr|sr|ii|iii|iv|phd|md|mba|cpa|esq|cfa|pmp|dds)\.?$/i;
// Particles that glue to the following surname component ("van der Berg", "de la Cruz").
const PARTICLES = new Set(['van', 'von', 'der', 'den', 'de', 'del', 'della', 'di', 'da', 'do', 'dos', 'du', 'la', 'le', 'el', 'al', 'bin', 'ibn', 'ben', 'st', 'mac', 'mc', "o'", 'ter', 'ten']);

/**
 * Parse a display name into components. Conservative: we never invent a name.
 * Returns { first, middle[], last, lastParts[], hyphenParts[], initialsOnly, raw }
 * where every component is lowercase, ASCII-folded, letters only (internal ' and - removed for local-part use).
 */
export function parseName(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let s = raw.replace(/\(.*?\)/g, ' ').replace(/,\s*(jr|sr|ii|iii|iv|phd|md|mba|cpa|esq)\b.*$/i, '');
  // "Brown, James" -> "James Brown"
  if (/^[^,]+,[^,]+$/.test(s)) { const [l, f] = s.split(','); s = `${f.trim()} ${l.trim()}`; }
  let toks = s.split(/\s+/).map((t) => t.trim()).filter(Boolean).filter((t) => !PREFIXES.test(t) && !SUFFIXES.test(t));
  if (toks.length < 2) return null;
  const clean = (t) => asciiFold(t).toLowerCase().replace(/[^a-z'-]/g, '');
  const dispToks = toks.map(clean).filter(Boolean);
  if (dispToks.length < 2) return null;

  const first = dispToks[0];
  // Gather the surname: last token plus any preceding particles.
  let i = dispToks.length - 1;
  const lastParts = [dispToks[i]];
  while (i - 1 > 0 && PARTICLES.has(dispToks[i - 1])) { lastParts.unshift(dispToks[i - 1]); i--; }
  const middle = dispToks.slice(1, i);
  const hyphenParts = lastParts.join(' ').split(/[-\s]/).filter((p) => p && !PARTICLES.has(p));
  const strip = (x) => x.replace(/[-']/g, '');
  const firstHy = first.split('-').map(strip).filter(Boolean);
  return {
    raw,
    first: strip(first),
    firstParts: firstHy, // "Mary-Jane" -> ['mary','jane']
    middle: middle.map(strip),
    last: strip(lastParts.join('')),
    lastParts: lastParts.map(strip),
    surnameTokens: hyphenParts.map(strip), // "Smith-Jones" -> ['smith','jones']
    initialsOnly: strip(first).length === 1,
  };
}

/** Loose comparison key for matching names across sources. */
export function nameKey(n) { return n ? `${n.first}|${n.last}` : null; }
