import net from 'node:net';
import { parse } from 'tldts';

/**
 * URL rules for the acquisition fetcher: only a clinic's own http(s) site, on
 * standard ports, with a hostname under a real public suffix. "Same site" and
 * organisation identity use the Public Suffix List including its PRIVATE
 * section (via tldts), so two clinics on one hosting platform
 * (smile.netlify.app vs other.netlify.app) are different sites.
 */

const SOCIAL_OR_SHORTENER = /(^|\.)(facebook|instagram|linkedin|twitter|x|tiktok|youtube|wa|whatsapp|linktr|google|goo|bit|t)\.(com|me|ee|ly|gl|co)$/;

export class UnsupportedUrlError extends Error {}

/**
 * Site-builder platforms whose tenants are separate organisations but which
 * the Public Suffix List (as shipped in tldts 7.4.16) does not list as private
 * suffixes. Verified 2026-10-14: each resolves to the bare platform domain in
 * tldts. Review this list whenever tldts is updated; remove entries the PSL
 * gains.
 */
export const EXTRA_PLATFORM_SUFFIXES = ['wordpress.com', 'wpcomstaging.com', 'weebly.com', 'squarespace.com', 'godaddysites.com', 'business.site'];

function info(hostname: string) {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  return { h, p: parse(h, { allowPrivateDomains: true }) };
}

/** True for IPv4/IPv6 literals in any notation the URL parser accepts. */
export function isIpLiteral(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, '');
  return net.isIP(h) !== 0 || info(h).p.isIp === true;
}

/**
 * Registrable domain per the Public Suffix List (ICANN + private sections).
 * Falls back to the full hostname when there is no registrable domain, so an
 * unknown host is never merged with a different one.
 */
export function registrableDomain(hostname: string): string {
  const { h, p } = info(hostname);
  if (p.domain && EXTRA_PLATFORM_SUFFIXES.includes(p.domain) && h !== p.domain) {
    const labels = h.slice(0, -(p.domain.length + 1)).split('.');
    return `${labels[labels.length - 1]}.${p.domain}`;
  }
  return p.domain ?? h;
}

/** Hostname with a real public suffix and a registrable domain (no IPs, single labels, .local/.test…). */
export function isPublicHostname(hostname: string): boolean {
  const { h, p } = info(hostname);
  if (!h || isIpLiteral(h)) return false;
  if (!p.domain || !(p.isIcann || p.isPrivate)) return false;
  return !/(^|\.)(localhost|local|internal|intranet|lan|home|corp|test|example|invalid|onion)$/.test(h);
}

/**
 * Shared rules for every URL the fetcher will contact (start URL and every
 * redirect hop): http/https, standard port, no credentials, public hostname,
 * not a social network or link shortener.
 */
export function assertFetchableUrl(u: URL): void {
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new UnsupportedUrlError(`Scheme ${u.protocol} not allowed`);
  if (u.username || u.password) throw new UnsupportedUrlError('Credentials in URL not allowed');
  if (u.port && u.port !== '80' && u.port !== '443') throw new UnsupportedUrlError(`Port ${u.port} not allowed`);
  if (isIpLiteral(u.hostname)) throw new UnsupportedUrlError('IP-address hosts are not clinic sites');
  if (!isPublicHostname(u.hostname)) throw new UnsupportedUrlError('Host has no public registrable domain');
  if (SOCIAL_OR_SHORTENER.test(u.hostname.toLowerCase())) throw new UnsupportedUrlError('Social / link-shortener hosts are not fetched');
}

/** Normalises a website value from an import into a fetchable site URL. */
export function normalizeSiteUrl(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed) throw new UnsupportedUrlError('Empty URL');
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let u: URL;
  try { u = new URL(withScheme); } catch { throw new UnsupportedUrlError('Not a valid URL'); }
  assertFetchableUrl(u);
  u.hash = '';
  return u;
}

export function sameSite(a: URL, b: URL): boolean {
  if (isIpLiteral(a.hostname) || isIpLiteral(b.hostname)) return false;
  return registrableDomain(a.hostname) === registrableDomain(b.hostname);
}

/** Query strings are never crawled. */
export function hasQuery(u: URL): boolean {
  return u.search.length > 0;
}
