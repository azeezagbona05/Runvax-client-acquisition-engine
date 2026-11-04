/**
 * Discovery: the Places finder (built, gated), candidates, and the join with independent sources.
 * The activation constant is mocked open ONLY in this file; tests/acquisition/activation.test.ts still
 * fails if the real constant is ever flipped. No request leaves the process: the transport is injected
 * or fetch is stubbed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { rows, seed } from '../helpers/fakePrisma';

const act = vi.hoisted(() => ({ open: true }));
vi.mock('@/lib/acquisition/activation', async (orig) => {
  const real = await orig<typeof import('@/lib/acquisition/activation')>();
  return { ...real, ACTIVATION: new Proxy({ ...real.ACTIVATION }, { get: (t, k) => (k === 'googlePlaces' ? act.open : (t as Record<string, unknown>)[k as string]) }) };
});
const auth = vi.hoisted(() => ({ getServerSession: vi.fn() }));
vi.mock('next-auth', () => ({ getServerSession: auth.getServerSession }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.hoisted(() => { process.env.ADMIN_EMAILS = 'admin@harzotech.test'; });

import { searchPlaces, placesActivation, PLACES_FIELD_MASK, ingestPlacesResults, type PlacesTransport } from '@/lib/acquisition/places/adapter';
import { actOnCandidate, listCandidates, discoveryOverview } from '@/lib/acquisition/candidates';
import { enqueueAcqTask } from '@/lib/acquisition/tasks/queue';
import { drainAcqTasks } from '@/lib/acquisition/tasks/queue';
import { ActivationError } from '@/lib/acquisition/activation';
import { addSuppression } from '@/lib/acquisition/suppression';
import { dental } from '@/lib/acquisition/config/industries/dental';

const ADMIN = { user: { id: 'u1', email: 'admin@harzotech.test' } };
const P = (id: string, name: string, over: Record<string, unknown> = {}) => ({ id, displayName: { text: name }, types: ['dentist'], businessStatus: 'OPERATIONAL', ...over });
const SEARCH = { userId: 'u1', industry: dental, area: 'Lekki', queryIndex: 0 };
const req = (url: string, method = 'GET', body?: unknown) => new NextRequest(`http://localhost${url}`, { method, headers: { origin: 'http://localhost' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });

beforeEach(() => {
  act.open = true; process.env.IA_PLACES_ENABLED = 'true'; process.env.INDUSTRY_ACQUISITION_ENABLED = 'true';
  auth.getServerSession.mockReset().mockResolvedValue(ADMIN); seed('user', { id: 'u1', isSuspended: false });
});
afterEach(() => { delete process.env.IA_PLACES_ENABLED; delete process.env.INDUSTRY_ACQUISITION_ENABLED; delete process.env.GOOGLE_PLACES_API_KEY; vi.unstubAllGlobals(); });

describe('searchPlaces gates', () => {
  it('needs BOTH the code switch and the env flag; neither alone opens it, and nothing is reserved or requested', async () => {
    const t = vi.fn() as unknown as PlacesTransport;
    delete process.env.IA_PLACES_ENABLED;
    await expect(searchPlaces({ ...SEARCH, transport: t })).rejects.toBeInstanceOf(ActivationError);
    process.env.IA_PLACES_ENABLED = 'true'; act.open = false;
    await expect(searchPlaces({ ...SEARCH, transport: t })).rejects.toBeInstanceOf(ActivationError);
    expect(placesActivation().reasons.join(' ')).toMatch(/legal review pending/);
    expect(t).not.toHaveBeenCalled();
    expect(rows('acquisitionProviderUsage')).toHaveLength(0);
  });

  it('open: one search with the minimal field mask, budget reserved, results ingested as place_id + our metadata only', async () => {
    const t = vi.fn(async () => [P('ChIJdisc000000000001', 'Smile Dental Lekki'), P('ChIJdisc000000000002', 'Dental Supplies Depot'), P('ChIJdisc000000000003', 'Gone Clinic', { businessStatus: 'CLOSED_PERMANENTLY' })]);
    const r = await searchPlaces({ ...SEARCH, transport: t });
    expect(r).toEqual({ ok: true, found: 3, kept: 1, excluded: 2 });
    expect(t).toHaveBeenCalledWith({ textQuery: 'dental clinic in Lekki, Lagos', pageSize: 20, fieldMask: PLACES_FIELD_MASK });
    expect(rows('acquisitionProviderUsage').find((u) => u.provider === 'google_places')?.calls).toBe(1);
    const c = rows('acquisitionCandidate');
    expect(c.map((x) => x.status)).toEqual(['no_independent_source', 'excluded', 'excluded']);
    expect(JSON.stringify(c)).not.toMatch(/Smile Dental|Supplies|Gone Clinic/); // names are used in memory and dropped
  });

  it('a repeated search does not duplicate candidates', async () => {
    const t = async () => [P('ChIJdisc000000000001', 'Smile Dental Lekki')];
    await searchPlaces({ ...SEARCH, transport: t }); await searchPlaces({ ...SEARCH, transport: t });
    expect(rows('acquisitionCandidate')).toHaveLength(1);
  });

  it('the daily cap stops it before any request', async () => {
    process.env.IA_PLACES_DAILY_CAP = '1';
    const t = vi.fn(async () => []);
    await searchPlaces({ ...SEARCH, transport: t });
    const r = await searchPlaces({ ...SEARCH, transport: t });
    expect(r).toMatchObject({ ok: false, reason: 'cap_reached' });
    expect(t).toHaveBeenCalledTimes(1);
    delete process.env.IA_PLACES_DAILY_CAP;
  });

  it('provider errors: 429/403 pause the provider (no retry storm), other errors are transient', async () => {
    const quota = await searchPlaces({ ...SEARCH, transport: async () => { throw Object.assign(new Error('x'), { status: 429 }); } });
    expect(quota).toMatchObject({ ok: false, reason: 'failed', transient: false });
    const paused = await searchPlaces({ ...SEARCH, queryIndex: 1, transport: async () => [] });
    expect(paused).toMatchObject({ ok: false, reason: 'provider_paused' });
  });

  it('an unknown query index is refused before reserving anything', async () => {
    await expect(searchPlaces({ ...SEARCH, queryIndex: 99, transport: async () => [] })).rejects.toThrow(/No discovery query/);
    expect(rows('acquisitionProviderUsage')).toHaveLength(0);
  });
});

describe('the live transport, via the discover task (fetch stubbed)', () => {
  it('sends one POST with the key in a header, never in the URL, and only the minimal mask; ingests the answer', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-key-not-real';
    const f = vi.fn(async () => new Response(JSON.stringify({ places: [P('ChIJlive0000000000001', 'Live Dental Ikeja')] }), { status: 200 }));
    vi.stubGlobal('fetch', f);
    await enqueueAcqTask({ userId: 'u1', type: 'acq.discover', input: { industryKey: 'dental', area: 'Ikeja GRA', queryIndex: 1 } });
    const r = await drainAcqTasks();
    expect(r).toMatchObject({ claimed: 1, completed: 1 });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://places.googleapis.com/v1/places:searchText');
    expect(url).not.toContain('test-key');
    expect((init.headers as Record<string, string>)['X-Goog-FieldMask']).toBe(PLACES_FIELD_MASK);
    expect(JSON.parse(String(init.body))).toEqual({ textQuery: 'dentist in Ikeja GRA, Lagos', pageSize: 20 });
    expect(rows('acquisitionCandidate')[0]).toMatchObject({ placeId: 'ChIJlive0000000000001', area: 'Ikeja GRA', status: 'no_independent_source' });
    expect(rows('acquisitionTask')[0].output).toMatchObject({ found: 1, kept: 1 });
  });

  it('a task for an area the industry does not list is skipped without any request', async () => {
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    await enqueueAcqTask({ userId: 'u1', type: 'acq.discover', input: { industryKey: 'dental', area: 'Atlantis', queryIndex: 0 } });
    expect(await drainAcqTasks()).toMatchObject({ skipped: 1 });
    expect(f).not.toHaveBeenCalled();
  });

  it('gates closed: the task is skipped as places_disabled and no request is made', async () => {
    act.open = false; const f = vi.fn(); vi.stubGlobal('fetch', f);
    await enqueueAcqTask({ userId: 'u1', type: 'acq.discover', input: { industryKey: 'dental', area: 'Lekki', queryIndex: 0 } });
    expect(await drainAcqTasks()).toMatchObject({ skipped: 1, retried: 0 });
    expect((rows('acquisitionTask')[0].output as { reason: string }).reason).toBe('places_disabled');
    expect(f).not.toHaveBeenCalled();
  });
});

describe('candidates: Places finds, an independent source identifies', () => {
  beforeEach(async () => { await ingestPlacesResults({ userId: 'u1', industry: dental, area: 'Lekki', queryIndex: 0, results: [P('ChIJcand000000000001', 'x'), P('ChIJcand000000000002', 'y')] }); });
  const first = () => rows('acquisitionCandidate')[0].id as string;
  const promote = (over: Record<string, unknown> = {}) => ({ action: 'promote', business_name: 'Coral Smile Dental', website: 'https://coral-smile-fixture.ng', source: 'Association of Lagos Dentists member list 2026', attest: true, independentSource: true, ...over });

  it('promotion needs both attestations and a non-Google source', async () => {
    await expect(actOnCandidate('u1', 'a', first(), promote({ attest: false }))).rejects.toThrow();
    await expect(actOnCandidate('u1', 'a', first(), promote({ independentSource: false }))).rejects.toThrow();
    await expect(actOnCandidate('u1', 'a', first(), promote({ source: 'Google Maps listing' }))).rejects.toThrow(/independent/);
    await expect(actOnCandidate('u1', 'a', first(), { ...promote(), extra: 1 })).rejects.toThrow();
    expect(rows('acquisitionProspect')).toHaveLength(0);
  });

  it('a valid promotion creates a prospect that carries the place_id, and the candidate is linked and closed', async () => {
    const r = await actOnCandidate('u1', 'admin@x', first(), promote());
    expect(r).toMatchObject({ ok: true, status: 'promoted' });
    const acq = rows('acquisitionProspect')[0];
    expect(acq.orgDomain).toBe('coral-smile-fixture.ng');
    expect(rows('acquisitionIdentity').some((i) => i.kind === 'place_id' && i.value === 'ChIJcand000000000001')).toBe(true);
    expect(rows('acquisitionCandidate')[0]).toMatchObject({ status: 'promoted', acqProspectId: acq.id });
    await expect(actOnCandidate('u1', 'a', first(), promote())).rejects.toThrow(/already a prospect/);
  });

  it('a clinic already imported (same place id) is reported as a duplicate, not created twice, and the candidate stays open', async () => {
    const { addManualProspect } = await import('@/lib/acquisition/imports/service');
    await addManualProspect({ userId: 'u1', industryKey: 'dental', attestedBy: 'a', attest: true, row: { business_name: 'Earlier Import Dental', source: 'Expo list', website: 'https://earlier-fixture.ng', place_id: 'ChIJcand000000000002', city: 'Lagos' } });
    const second = rows('acquisitionCandidate')[1].id as string;
    const r = await actOnCandidate('u1', 'a', second, promote({ business_name: 'Earlier Import Dental', website: 'https://earlier-fixture.ng' }));
    expect(r).toMatchObject({ ok: false, outcome: 'duplicate' });
    expect(rows('acquisitionProspect')).toHaveLength(1);
    expect(rows('acquisitionCandidate')[1].status).toBe('no_independent_source');
  });

  it('a second place on the same website is a branch (the importer\'s existing rule), not a duplicate', async () => {
    await actOnCandidate('u1', 'a', first(), promote());
    const r = await actOnCandidate('u1', 'a', rows('acquisitionCandidate')[1].id as string, promote({ business_name: 'Coral Smile Dental Branch' }));
    expect(r).toMatchObject({ ok: true, status: 'promoted' });
    expect(rows('acquisitionProspect')).toHaveLength(2);
  });

  it('a suppressed domain cannot be promoted', async () => {
    await addSuppression({ userId: 'u1', kind: 'domain', value: 'optout-fixture.ng', reason: 'objection', source: 't' });
    const r = await actOnCandidate('u1', 'a', first(), promote({ website: 'https://optout-fixture.ng' }));
    expect(r).toMatchObject({ ok: false });
    expect(rows('acquisitionProspect')).toHaveLength(0);
  });

  it('exclude closes it; an excluded candidate cannot be promoted; another account cannot touch it', async () => {
    await expect(actOnCandidate('u2', 'a', first(), { action: 'exclude', reason: 'not ours' })).rejects.toThrow(/not found/);
    expect(await actOnCandidate('u1', 'a', first(), { action: 'exclude', reason: 'a dental lab' })).toMatchObject({ status: 'excluded' });
    await expect(actOnCandidate('u1', 'a', first(), promote())).rejects.toThrow(/excluded/);
    expect(await listCandidates('u2')).toHaveLength(0);
    expect((await listCandidates('u1', { status: 'excluded' })).map((c) => c.status)).toEqual(['excluded']);
  });

  it('the list never exposes anything beyond id, area, status and our own link', async () => {
    const [c] = await listCandidates('u1');
    expect(Object.keys(c).sort()).toEqual(['acqProspectId', 'area', 'discoveredAt', 'id', 'industryKey', 'placeId', 'status']);
  });
});

describe('routes', () => {
  it('overview: gate state with reasons, budget, counts and the planned searches (areas x queries)', async () => {
    act.open = false;
    const { GET } = await import('@/app/api/acquisition/discovery/route');
    const j = await (await GET(req('/api/acquisition/discovery'))).json();
    expect(j.gate.allowed).toBe(false); expect(j.gate.reasons.join(' ')).toMatch(/legal review pending/);
    expect(j.plan).toHaveLength(dental.geography.priorityAreas.length * dental.discovery.placesQueries.length);
    expect(j.plan[0]).toMatchObject({ area: 'Ikoyi', queryIndex: 0, textQuery: 'dental clinic in Ikoyi, Lagos' });
    expect(j.budget.cap).toBe(50);
    void discoveryOverview;
  });

  it('run: 409 with reasons while closed (nothing queued); 202 when open; validated; same-origin enforced', async () => {
    const { POST } = await import('@/app/api/acquisition/discovery/run/route');
    act.open = false;
    const closed = await POST(req('/api/acquisition/discovery/run', 'POST', { industryKey: 'dental', area: 'Lekki', queryIndex: 0 }));
    expect(closed.status).toBe(409); expect((await closed.json()).reasons.length).toBeGreaterThan(0);
    expect(rows('acquisitionTask')).toHaveLength(0);
    act.open = true;
    const ok = await POST(req('/api/acquisition/discovery/run', 'POST', { industryKey: 'dental', area: 'Lekki', queryIndex: 0 }));
    expect(ok.status).toBe(202); expect(rows('acquisitionTask')).toHaveLength(1);
    for (const bad of [{ industryKey: 'dental', area: 'Atlantis', queryIndex: 0 }, { industryKey: 'dental', area: 'Lekki', queryIndex: 9 }, { industryKey: 'nope', area: 'Lekki', queryIndex: 0 }, { industryKey: 'dental', area: 'Lekki', queryIndex: 0, x: 1 }]) {
      expect((await POST(req('/api/acquisition/discovery/run', 'POST', bad))).status).toBe(400);
    }
    const cross = new NextRequest('http://localhost/api/acquisition/discovery/run', { method: 'POST', headers: { origin: 'http://evil.example' }, body: JSON.stringify({ industryKey: 'dental', area: 'Lekki', queryIndex: 0 }) });
    expect((await POST(cross)).status).toBe(403);
  });

  it('candidate routes: list and act; promote refusal is a 4xx with reasons, not a 500', async () => {
    await ingestPlacesResults({ userId: 'u1', industry: dental, area: 'Lekki', queryIndex: 0, results: [P('ChIJroute0000000001', 'x')] });
    const { GET } = await import('@/app/api/acquisition/candidates/route');
    const { POST } = await import('@/app/api/acquisition/candidates/[id]/route');
    const list = await (await GET(req('/api/acquisition/candidates'))).json();
    expect(list.items).toHaveLength(1);
    const id = list.items[0].id;
    expect((await POST(req(`/api/acquisition/candidates/${id}`, 'POST', { action: 'promote', business_name: 'A' }), { params: { id } })).status).toBe(400);
    const ok = await POST(req(`/api/acquisition/candidates/${id}`, 'POST', { action: 'promote', business_name: 'Route Dental', website: 'https://route-fixture.ng', source: 'Own research: clinic website', attest: true, independentSource: true }), { params: { id } });
    expect(ok.status).toBe(200); expect((await ok.json()).status).toBe('promoted');
  });
});
