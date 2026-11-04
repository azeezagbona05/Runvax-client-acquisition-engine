import { describe, it, expect } from 'vitest';
import { bulkFindDecisionMakers, pendingForLookup, BULK_DM_MAX } from '@/lib/bulkDmLookup';
import type { Business } from '@/types';

const biz = (id: string, extra: Partial<Business> = {}): Business =>
  ({ id, name: `Biz ${id}`, address: 'Street, Lagos', hasWebsite: true, category: 'Dentist', ...extra });

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('pendingForLookup', () => {
  it('skips named and already-searched businesses and caps the run', () => {
    const list = [biz('a', { decisionMaker: { name: 'A B', title: 'Owner', source: 'manual' } }), biz('b', { dmSearched: true }), biz('c')];
    expect(pendingForLookup(list).map((b) => b.id)).toEqual(['c']);
    expect(pendingForLookup(Array.from({ length: 40 }, (_, i) => biz(String(i))))).toHaveLength(BULK_DM_MAX);
  });
});

describe('bulkFindDecisionMakers', () => {
  it('reports each result and counts finds', async () => {
    const updates: Record<string, unknown> = {};
    const sent: unknown[] = [];
    const fetcher = (async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      sent.push(body);
      return body.businessId === 'a'
        ? json(200, { decisionMaker: { name: 'Ada Obi', title: 'Principal dentist', source: 'website' }, candidates: [] })
        : json(200, { decisionMaker: null, candidates: [] });
    }) as unknown as typeof fetch;
    const r = await bulkFindDecisionMakers([biz('a'), biz('b'), biz('c')], { onResult: (id, u) => { updates[id] = u; }, fetcher });
    expect(r).toEqual({ checked: 3, found: 1 });
    expect(Object.keys(updates).sort()).toEqual(['a', 'b', 'c']);
    expect((updates.b as { dmSearched: boolean }).dmSearched).toBe(true);
    expect(sent[0]).toMatchObject({ category: 'Dentist' });
    expect(sent.every((b) => !(b as { deep?: boolean }).deep)).toBe(true);
  });

  it('stops at the rate limit', async () => {
    let calls = 0;
    const fetcher = (async () => { calls++; return json(429, { error: 'Too many requests' }); }) as unknown as typeof fetch;
    const r = await bulkFindDecisionMakers(Array.from({ length: 10 }, (_, i) => biz(String(i))), { onResult: () => {}, fetcher });
    expect(r.stopped).toBe('rate');
    expect(calls).toBeLessThanOrEqual(3);
  });
});
