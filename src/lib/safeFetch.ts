import dns from 'node:dns';
import net from 'node:net';
import { isBlockedAddress } from '@/lib/acquisition/web/ssrf';

/**
 * Fetch for URLs that come from a request (a website a user typed, a prospect's site).
 * Refuses anything that is not a plain http(s) URL to a public address, and re-checks every
 * redirect hop, so a request cannot make the server read localhost, a private network or a
 * cloud metadata endpoint. Reuses the acquisition crawler's address rules (one definition of
 * "public").
 *
 * Limit: the address is checked, then the normal fetch resolves the name again, so a hostile
 * DNS server that answers differently the second time (rebinding) is not fully excluded. The
 * acquisition crawler pins the connection; these utility routes do not.
 */
export class UnsafeUrlError extends Error {}

export async function assertPublicHttpUrl(raw: string | URL): Promise<URL> {
  let u: URL;
  try { u = typeof raw === 'string' ? new URL(raw) : raw; } catch { throw new UnsafeUrlError('Invalid URL'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new UnsafeUrlError('Only http(s) URLs are allowed');
  if (u.username || u.password) throw new UnsafeUrlError('Credentials in URL are not allowed');
  if (u.port && u.port !== '80' && u.port !== '443') throw new UnsafeUrlError('Port not allowed');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  let addrs: string[];
  try { addrs = net.isIP(host) ? [host] : (await dns.promises.lookup(host, { all: true, verbatim: true })).map((r) => r.address); } catch { throw new UnsafeUrlError('Host did not resolve'); }
  if (addrs.length === 0 || addrs.some(isBlockedAddress)) throw new UnsafeUrlError('Host is not a public address');
  return u;
}

export async function safeFetch(raw: string, init: RequestInit = {}, opts: { maxRedirects?: number } = {}): Promise<Response> {
  const maxRedirects = opts.maxRedirects ?? 3;
  let url = await assertPublicHttpUrl(raw);
  for (let hop = 0; ; hop++) {
    const res = await fetch(url, { ...init, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      if (hop >= maxRedirects) throw new UnsafeUrlError('Too many redirects');
      url = await assertPublicHttpUrl(new URL(res.headers.get('location')!, url));
      continue;
    }
    return res;
  }
}
