import { describe, it, expect } from 'vitest';
import { listCountries, regionsOf } from '@/lib/geo';

describe('countries and regions', () => {
  it('lists every country, alphabetically, with real codes', () => {
    const c = listCountries();
    expect(c.length).toBeGreaterThan(240);
    expect(c.map((x) => x.name)).toEqual([...c.map((x) => x.name)].sort((a, b) => a.localeCompare(b)));
    for (const code of ['NG', 'GH', 'US', 'GB', 'IN', 'BR', 'JP', 'AU', 'DE', 'FR']) expect(c.some((x) => x.code === code)).toBe(true);
  });
  it('gives each country its own regions', () => {
    expect(regionsOf('NG').some((r) => r.name === 'Lagos')).toBe(true);
    expect(regionsOf('ng').length).toBe(regionsOf('NG').length);
    expect(regionsOf('CA').some((r) => r.name === 'Ontario')).toBe(true);
    expect(regionsOf('IN').length).toBeGreaterThan(25);
  });
  it('returns nothing for an unknown country', () => {
    expect(regionsOf('ZZ')).toEqual([]);
  });
});
