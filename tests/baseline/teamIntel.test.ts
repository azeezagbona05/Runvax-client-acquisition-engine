import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyHit, classifyHits, planTeamQueries, shortName } from '@/lib/teamIntel';
import { mergeCandidates, type DmCandidate } from '@/lib/decisionMaker';
import { resetSearchCache, webSearch, webSearchConfigured } from '@/lib/webSearch';

const biz = { businessName: 'Smile Dental Clinic (Lekki)', domain: 'smiledental.ng' };
const hit = (title: string, description = '', url = 'https://ng.linkedin.com/in/ade-bello-12345?trk=x') => ({ title, description, url });

describe('the search plan', () => {
  it('drops the branch from the name and plans up to four useful searches', () => {
    expect(shortName('Smile Dental Clinic (Lekki)')).toBe('Smile Dental Clinic');
    const q = planTeamQueries({ ...biz, city: 'Lagos', titles: ['principal dentist', 'practice owner', 'clinical director', 'dentist'] });
    expect(q).toHaveLength(4);
    expect(q[0]).toContain('site:linkedin.com/in "Smile Dental Clinic" Lagos');
    expect(q[0]).toContain('"principal dentist"');
    expect(q[1]).toMatch(/director OR manager OR head/);
    expect(q[1]).toContain('Lagos'); // the city narrows a short or common name
    expect(q[2]).toBe('site:linkedin.com/in "smiledental.ng"');
    expect(q[3]).not.toContain('site:linkedin.com');
  });
  it('skips the website search when there is no website, honours a lower limit, and never repeats a search', () => {
    expect(planTeamQueries({ businessName: 'Acme', titles: ['owner'] }).some((x) => x.includes('smiledental'))).toBe(false);
    expect(planTeamQueries({ ...biz, titles: ['owner'], max: 2 })).toHaveLength(2);
    expect(new Set(planTeamQueries({ ...biz, titles: ['owner'] })).size).toBe(planTeamQueries({ ...biz, titles: ['owner'] }).length);
    expect(planTeamQueries({ businessName: '', titles: ['owner'] })).toEqual([]);
  });
});

describe('how sure we are', () => {
  it('confirmed: the profile headline names the company next to a title, and the evidence is kept', () => {
    const c = classifyHit(hit('Ade Bello - Owner - Smile Dental Clinic | LinkedIn', 'Lagos, Nigeria. Owner at Smile Dental Clinic.'), biz)!;
    expect(c).toMatchObject({ name: 'Ade Bello', match: 'confirmed', confidence: 'high', source: 'search' });
    expect(c.title.toLowerCase()).toContain('owner');
    expect(c.evidence?.url).toBe('https://ng.linkedin.com/in/ade-bello-12345');
    expect(c.evidence?.snippet).toContain('Smile Dental Clinic');
  });
  it('likely: the company is only in the snippet, not in their headline', () => {
    const c = classifyHit(hit('Ade Bello - Owner | LinkedIn', 'Owner. Experience: Smile Dental Clinic. Lagos.'), biz)!;
    expect(c.match).toBe('likely');
    expect(c.confidence).toBe('medium');
  });
  it('confirmed when the snippet shows the company website, even if the headline is short', () => {
    const c = classifyHit(hit('Ade Bello - Owner | LinkedIn', 'Owner at Smile Dental Clinic. smiledental.ng'), biz)!;
    expect(c.match).toBe('confirmed');
  });
  it('ignores a profile for another company, one with no real title, and pages that are not people', () => {
    expect(classifyHit(hit('Ade Bello - Owner - Bright Auto Parts | LinkedIn'), biz)).toBeNull();
    expect(classifyHit(hit('Ade Bello - Student - Smile Dental Clinic | LinkedIn'), biz)).toBeNull();
    expect(classifyHit({ title: 'Smile Dental Clinic - Home', description: 'Book now', url: 'https://smiledental.ng' }, biz)).toBeNull();
  });
  it('a third-party page that names someone with a title here is likely, never confirmed', () => {
    const c = classifyHit({ title: 'Our dentists', description: 'Dr. Ade Bello, Principal Dentist at Smile Dental Clinic, has practised in Lagos for years.', url: 'https://directory.example/clinics/1' }, biz);
    if (c) { expect(c.match).toBe('likely'); expect(c.evidence?.url).toBe('https://directory.example/clinics/1'); }
  });
  it('reads several results at once', () => {
    const list = classifyHits([hit('Ade Bello - Owner - Smile Dental Clinic | LinkedIn'), hit('Chika Obi - Practice Manager - Smile Dental Clinic | LinkedIn', '', 'https://ng.linkedin.com/in/chika-obi-9')], biz);
    expect(list.map((c) => c.name)).toEqual(['Ade Bello', 'Chika Obi']);
  });
});

describe('merging with what the website says', () => {
  const base = (over: Partial<DmCandidate>): DmCandidate => ({ name: 'Ade Bello', title: 'Owner', source: 'search', confidence: 'medium', ...over });
  it('a person named by the website and found by search is confirmed', () => {
    const [m] = mergeCandidates([base({ source: 'website', confidence: 'medium' }), base({ match: 'likely', evidence: { url: 'https://x', snippet: 's' } })]);
    expect(m.match).toBe('confirmed');
    expect(m.sources).toEqual(['website', 'search']);
    expect(m.evidence?.url).toBe('https://x');
  });
  it('keeps the strongest match and never invents one', () => {
    expect(mergeCandidates([base({ match: 'likely' }), base({ match: 'confirmed' })])[0].match).toBe('confirmed');
    expect(mergeCandidates([base({ source: 'website' })])[0].match).toBeUndefined();
  });
});

describe('the search layer', () => {
  beforeEach(() => { resetSearchCache(); vi.stubEnv('BRAVE_SEARCH_KEY', 'test-key'); });
  afterEach(() => { vi.unstubAllEnvs(); });
  const ok = (results: unknown[]) => vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify({ web: { results } }), { status: 200 }));

  it('is off without a real key, and never calls out', async () => {
    vi.stubEnv('BRAVE_SEARCH_KEY', '');
    const f = ok([]);
    expect(webSearchConfigured()).toBe(false);
    expect(await webSearch('anything', { fetchImpl: f })).toEqual([]);
    vi.stubEnv('BRAVE_SEARCH_KEY', 'your-brave-key-here');
    expect(webSearchConfigured()).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
  it('keeps nothing by default, because standard plans do not allow retaining results: each search runs', async () => {
    const f = ok([{ title: 'T', url: 'https://u' }]);
    await webSearch('q-nokeep', { fetchImpl: f });
    await webSearch('q-nokeep', { fetchImpl: f });
    expect(f).toHaveBeenCalledTimes(2);
  });
  it('remembers for a day when the plan has storage rights (BRAVE_ALLOW_CACHE=1): the same question is not paid for twice', async () => {
    vi.stubEnv('BRAVE_ALLOW_CACHE', '1');
    const f = ok([{ title: 'T', url: 'https://u', description: 'D', extra: 'ignored' }]);
    const a = await webSearch('site:linkedin.com/in "Acme"', { fetchImpl: f });
    const b = await webSearch('  site:linkedin.com/in   "Acme" ', { fetchImpl: f });
    expect(a).toEqual([{ title: 'T', url: 'https://u', description: 'D' }]);
    expect(b).toBe(a);
    expect(f).toHaveBeenCalledTimes(1);
    expect(String(f.mock.calls[0][0])).toContain('api.search.brave.com');
    expect((f.mock.calls[0][1] as RequestInit).headers).toMatchObject({ 'X-Subscription-Token': 'test-key' });
  });
  it('shares a search that is already running', async () => {
    const f = ok([{ title: 'T', url: 'https://u' }]);
    await Promise.all([webSearch('q1', { fetchImpl: f }), webSearch('q1', { fetchImpl: f })]);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('a failure returns nothing and is not remembered, so a retry can work', async () => {
    const bad = vi.fn(async (_url: string, _init: RequestInit) => new Response('rate limited', { status: 429 }));
    expect(await webSearch('q2', { fetchImpl: bad })).toEqual([]);
    const good = ok([{ title: 'T', url: 'https://u' }]);
    expect(await webSearch('q2', { fetchImpl: good })).toHaveLength(1);
    const boom = vi.fn(async (_url: string, _init: RequestInit): Promise<Response> => { throw new Error('network'); });
    expect(await webSearch('q3', { fetchImpl: boom })).toEqual([]);
  });
});
