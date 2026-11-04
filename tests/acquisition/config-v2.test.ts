import { describe, it, expect } from 'vitest';
import { IndustryConfigSchema, RULE_SIGNALS } from '@/lib/acquisition/config/schema';
import { dental } from '@/lib/acquisition/config/industries/dental';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const valid = (mutate: (c: any) => void) => { const c = clone(dental) as any; mutate(c); return IndustryConfigSchema.safeParse(c).success; };

describe('dental config v2', () => {
  it('is version 2 and validates', () => {
    expect(dental.version).toBe(2);
    expect(IndustryConfigSchema.safeParse(dental).success).toBe(true);
  });

  it('every category has rules over known, independently sourced signals', () => {
    for (const c of dental.opportunityCategories) {
      expect(c.signalRules.length).toBeGreaterThan(0);
      for (const r of c.signalRules) expect(RULE_SIGNALS).toContain(r.signal);
    }
  });

  it('retention is marked provisional (pending legal / provider-term review)', () => {
    expect(dental.retention.provisional).toBe(true);
    expect(dental.retention.pageCacheHours).toBeLessThanOrEqual(24);
  });

  it('rejects Google-sourced imports by default', () => {
    expect(dental.imports.prohibitedSourcePhrases).toEqual(expect.arrayContaining(['google', 'maps', 'places']));
  });

  it('insufficient-evidence band is evaluated first', () => {
    expect(dental.bands[0]).toMatchObject({ band: 'insufficient_evidence', maxCoverageExclusive: 0.34 });
  });

  it.each([
    ['rule on an unknown signal', (c: any) => { c.opportunityCategories[0].signalRules[0].signal = 'google_rating'; }], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['rule weight out of range', (c: any) => { c.opportunityCategories[0].signalRules[0].weight = 3; }], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['category without rules', (c: any) => { c.opportunityCategories[0].signalRules = []; }], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['regex-like booking host', (c: any) => { c.research.bookingProviderHosts.push('.*'); }], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['too many pages per site', (c: any) => { c.research.maxPagesPerSite = 50; }], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['page cache over 24h', (c: any) => { c.retention.pageCacheHours = 72; }], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['stale before re-verify', (c: any) => { c.retention.signalStaleDays = 30; }], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['import row limit above 1000', (c: any) => { c.imports.maxRows = 5000; }], // eslint-disable-line @typescript-eslint/no-explicit-any
    ['no prohibited source phrases', (c: any) => { c.imports.prohibitedSourcePhrases = []; }], // eslint-disable-line @typescript-eslint/no-explicit-any
  ])('rejects: %s', (_n, m) => expect(valid(m)).toBe(false));
});
