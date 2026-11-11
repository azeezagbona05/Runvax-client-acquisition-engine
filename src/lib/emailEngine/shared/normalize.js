// Domain, email and name normalisation shared by all modules.
const EMAIL_RE = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

/** "https://www.Example.com/about?x=1" -> "example.com". Returns null if not a plausible host. */
export function normalizeDomain(input) {
  if (!input || typeof input !== 'string') return null;
  let s = input.trim().toLowerCase();
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/^mailto:/, '');
  if (s.includes('@')) s = s.split('@').pop();
  s = s.split(/[/?#]/)[0].replace(/:\d+$/, '').replace(/\.$/, '').replace(/^www\d?\./, '');
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s) || s.length > 253) return null;
  return s;
}

export function normalizeEmail(input) {
  if (!input || typeof input !== 'string') return null;
  const s = input.trim().toLowerCase().replace(/^mailto:/, '').split('?')[0].replace(/[.,;:)>\]]+$/, '');
  const at = s.lastIndexOf('@');
  if (at < 1) return null;
  const domain = normalizeDomain(s.slice(at + 1));
  const local = s.slice(0, at);
  const out = `${local}@${domain}`;
  return domain && EMAIL_RE.test(out) && !local.startsWith('.') && !local.endsWith('.') && !local.includes('..') ? out : null;
}

export const splitEmail = (email) => { const i = email.lastIndexOf('@'); return { local: email.slice(0, i), domain: email.slice(i + 1) }; };

/** Is `host` the same organisation as `domain` (equal or subdomain)? */
export const sameSite = (host, domain) => { const h = normalizeDomain(host); return !!h && !!domain && (h === domain || h.endsWith('.' + domain)); };

export const stripDiacritics = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
export const asciiFold = (s) => stripDiacritics(s).replace(/ß/g, 'ss').replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/đ/g, 'd').replace(/ł/g, 'l');
