import { splitName } from '@/lib/snov';

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

/**
 * The addresses a person at a company most likely has, most common first. Used with an address
 * verifier, never sent to unchecked. Returns [] without a first and last name.
 */
export function emailPatterns(fullName: string, domain: string, max = 5): string[] {
  const n = splitName(fullName);
  const d = domain.trim().toLowerCase().replace(/^www\./, '');
  if (!n || !d || !d.includes('.')) return [];
  const f = plain(n[0]); const l = plain(n[1]);
  if (!f || !l) return [];
  const locals = [`${f}.${l}`, f, `${f[0]}${l}`, `${f}${l}`, l, `${f}${l[0]}`, `${f[0]}.${l}`, `${f}_${l}`];
  return Array.from(new Set(locals)).slice(0, max).map((x) => `${x}@${d}`);
}
