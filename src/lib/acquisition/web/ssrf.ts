import net from 'node:net';

/**
 * Refuses any address that isn't a normal public unicast address. Website URLs
 * can come from untrusted CSVs, so a URL pointing at an internal service, a
 * cloud metadata endpoint or localhost must never be fetched. Checked for
 * every resolved address and again after every redirect.
 */

function v4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
}

const V4_BLOCKED: Array<[string, number]> = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
];

function blockedV4(ip: string): boolean {
  const n = v4ToInt(ip);
  return V4_BLOCKED.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) === (v4ToInt(base) & mask);
  });
}

function expandV6(ip: string): number[] | null {
  let s = ip.toLowerCase().split('%')[0];
  // Embedded IPv4 tail (::ffff:1.2.3.4, 64:ff9b::1.2.3.4)
  const v4 = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    const n = v4ToInt(v4[1]);
    s = s.slice(0, -v4[1].length) + `${((n >>> 16) & 0xffff).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const [head, tail] = s.split('::');
  const h = head ? head.split(':').filter(Boolean) : [];
  const t = tail !== undefined && tail ? tail.split(':').filter(Boolean) : [];
  const fill = s.includes('::') ? 8 - h.length - t.length : 0;
  const groups = [...h, ...Array(Math.max(0, fill)).fill('0'), ...t].map((g) => parseInt(g, 16));
  return groups.length === 8 && groups.every((g) => Number.isFinite(g)) ? groups : null;
}

function blockedV6(ip: string): boolean {
  const g = expandV6(ip);
  if (!g) return true; // unparseable → refuse
  const isZero = (from: number, to: number) => g.slice(from, to).every((x) => x === 0);
  if (isZero(0, 8)) return true;                                   // ::
  if (isZero(0, 7) && g[7] === 1) return true;                     // ::1
  if (isZero(0, 5) && g[5] === 0xffff) {                           // ::ffff:a.b.c.d (IPv4-mapped)
    return blockedV4(`${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`);
  }
  if (g[0] === 0x64 && g[1] === 0xff9b && isZero(2, 6)) {          // 64:ff9b::/96 (NAT64)
    return blockedV4(`${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`);
  }
  if ((g[0] & 0xfe00) === 0xfc00) return true;                     // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true;                     // fe80::/10 link-local
  if ((g[0] & 0xff00) === 0xff00) return true;                     // ff00::/8 multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true;             // 2001:db8::/32 documentation
  if (g[0] === 0x2002) return true;                                // 6to4 (can embed private v4)
  if (g[0] === 0x2001 && g[1] === 0) return true;                  // Teredo
  return false;
}

export function isBlockedAddress(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) return blockedV4(ip);
  if (v === 6) return blockedV6(ip);
  return true;
}

export class BlockedAddressError extends Error {}

/** Throws unless every address is public. Returns the address to pin the connection to. */
export function choosePublicAddress(addresses: string[]): string {
  if (addresses.length === 0) throw new BlockedAddressError('Host did not resolve');
  const bad = addresses.filter(isBlockedAddress);
  if (bad.length > 0) throw new BlockedAddressError(`Refusing non-public address ${bad[0]}`);
  return addresses[0];
}
