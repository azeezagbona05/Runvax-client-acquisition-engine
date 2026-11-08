import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { rows, seed } from '../helpers/fakePrisma';
import { addSuppression } from '@/lib/acquisition/suppression';

const auth = vi.hoisted(() => ({ getServerSession: vi.fn() }));
vi.mock('next-auth', () => ({ getServerSession: auth.getServerSession }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.hoisted(() => { process.env.ADMIN_EMAILS = 'admin@harzotech.test'; });

const ADMIN = { user: { id: 'u1', email: 'admin@harzotech.test', isAdmin: true } }; // an admin session: made by the admin sign-in
const ROOT = path.resolve(__dirname, '../../src/app/api/acquisition');
function routeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? routeFiles(p) : e.name === 'route.ts' ? [p] : [];
  });
}
const ROUTES = routeFiles(ROOT).map((f) => ({ file: f, rel: path.relative(ROOT, f), mod: path.relative(path.resolve(__dirname, '../../src'), f).replace(/\.ts$/, '') }));
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

const req = (url: string, method = 'GET', body?: unknown) =>
  new NextRequest(`http://localhost${url}`, { method, headers: { origin: 'http://localhost' }, ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });

beforeEach(() => { auth.getServerSession.mockReset(); process.env.INDUSTRY_ACQUISITION_ENABLED = 'true'; });
afterEach(() => { delete process.env.INDUSTRY_ACQUISITION_ENABLED; });

describe('every acquisition API route and method (direct requests)', () => {
  it('discovers all route files', () => expect(ROUTES.length).toBeGreaterThanOrEqual(10));

  it.each(ROUTES.map((r) => [r.rel, r]))('%s: 404 flag off · 401 signed out · 403 non-admin', async (_rel, r) => {
    const mod = (await import(/* @vite-ignore */ `@/${r.mod}`)) as Record<string, (rq: NextRequest, ctx: { params: { id: string } }) => Promise<Response>>;
    const methods = METHODS.filter((m) => typeof mod[m] === 'function');
    expect(methods.length).toBeGreaterThan(0);
    for (const m of methods) {
      const call = () => mod[m](req('/api/acquisition/x', m, m === 'GET' || m === 'DELETE' ? undefined : {}), { params: { id: 'x' } });
      delete process.env.INDUSTRY_ACQUISITION_ENABLED;
      auth.getServerSession.mockResolvedValue(ADMIN);
      expect((await call()).status, `${r.rel} ${m} flag off`).toBe(404);
      process.env.INDUSTRY_ACQUISITION_ENABLED = 'true';
      auth.getServerSession.mockResolvedValue(null);
      expect((await call()).status, `${r.rel} ${m} signed out`).toBe(401);
      auth.getServerSession.mockResolvedValue({ user: { id: 'u2', email: 'customer@example.com' } });
      expect((await call()).status, `${r.rel} ${m} non-admin`).toBe(403);
    }
  });
});

describe('Phase 2 API behaviour (admin)', () => {
  beforeEach(() => { auth.getServerSession.mockResolvedValue(ADMIN); seed('user', { id: 'u1', isSuspended: false }); });

  it('CSV preview → commit requires attest:true, then lists and shows prospects', async () => {
    const { POST: preview, GET: listImports } = await import('@/app/api/acquisition/imports/route');
    const { POST: commit } = await import('@/app/api/acquisition/imports/[id]/commit/route');
    const { GET: list } = await import('@/app/api/acquisition/prospects/route');
    const { GET: detail } = await import('@/app/api/acquisition/prospects/[id]/route');

    const p = await preview(req('/api/acquisition/imports', 'POST', { industryKey: 'dental', csvText: 'business_name,source,website\nSmile Dental,Expo list,smile-api.ng' }));
    const pj = await p.json();
    expect(pj).toMatchObject({ accepted: 1, rowCount: 1 });
    expect((await commit(req('/x', 'POST', { attest: false }), { params: { id: pj.batchId } })).status).toBe(400);
    expect((await commit(req('/x', 'POST', {}), { params: { id: pj.batchId } })).status).toBe(400);
    expect((await (await commit(req('/x', 'POST', { attest: true }), { params: { id: pj.batchId } })).json()).created).toBe(1);

    expect((await (await listImports()).json()).batches[0]).toMatchObject({ status: 'committed', acceptedCount: 1 });
    const l = await (await list(req('/api/acquisition/prospects?q=smile'))).json();
    expect(l.total).toBe(1);
    const d = await (await detail(req('/x'), { params: { id: l.items[0].id } })).json();
    expect(d.prospect.name).toBe('Smile Dental');
    expect(d.labels).toEqual({ scoreIsEstimate: true, offerNotice: 'Internal: offer not yet approved for sale' });
    expect((await detail(req('/x'), { params: { id: 'nope' } })).status).toBe(404);
  });

  it('rejects malformed and oversized bodies', async () => {
    const { POST: preview } = await import('@/app/api/acquisition/imports/route');
    expect((await preview(req('/x', 'POST', 'not json'))).status).toBe(400);
    expect((await preview(req('/x', 'POST', { industryKey: 'dental', csvText: 'a', extra: 1 }))).status).toBe(400);
    const huge = { industryKey: 'dental', csvText: 'x'.repeat(2 * 1024 * 1024 + 10_000) };
    expect([400, 413]).toContain((await preview(req('/x', 'POST', huge))).status);
    const { POST: action } = await import('@/app/api/acquisition/prospects/[id]/actions/route');
    expect((await action(req('/x', 'POST', JSON.stringify({ action: 'rescore', reason: 'x'.repeat(70_000) })), { params: { id: 'a' } })).status).toBe(413);
  });

  it('actions need a reason, are scoped to the admin, and are recorded', async () => {
    seed('acquisitionProspect', { id: 'apA', userId: 'u1', prospectId: 'pA', industryKey: 'dental', state: 'strategized', orgDomain: 'clinic-a.ng' });
    seed('acquisitionProspect', { id: 'apB', userId: 'someone-else', prospectId: 'pB', industryKey: 'dental', state: 'strategized' });
    const { POST: action } = await import('@/app/api/acquisition/prospects/[id]/actions/route');
    expect((await action(req('/x', 'POST', { action: 'disqualify' }), { params: { id: 'apA' } })).status).toBe(400);
    expect((await action(req('/x', 'POST', { action: 'disqualify', reason: 'no' }), { params: { id: 'apA' } })).status).toBe(400);
    expect((await action(req('/x', 'POST', { action: 'send_email', reason: 'please' }), { params: { id: 'apA' } })).status).toBe(400);
    expect((await action(req('/x', 'POST', { action: 'disqualify', reason: 'not a clinic' }), { params: { id: 'apB' } })).status).toBe(400);
    expect(rows('acquisitionProspect').find((a) => a.id === 'apB')!.state).toBe('strategized');

    expect((await action(req('/x', 'POST', { action: 'block_crawling', reason: 'owner asked us not to crawl' }), { params: { id: 'apA' } })).status).toBe(200);
    expect(rows('acquisitionSuppression')[0]).toMatchObject({ kind: 'crawl_domain', value: 'clinic-a.ng' });
    expect((await action(req('/x', 'POST', { action: 'suppress_domain', reason: 'clinic objected' }), { params: { id: 'apA' } })).status).toBe(200);
    expect(rows('acquisitionProspect').find((a) => a.id === 'apA')!.state).toBe('suppressed');
    expect(rows('acquisitionPipelineEvent').map((e) => e.actor)).toEqual(['admin@harzotech.test', 'admin@harzotech.test']);
  });

  it('manual named contacts: Google-sourced or suppressed contacts are refused; attestation required', async () => {
    seed('acquisitionProspect', { id: 'apC', userId: 'u1', prospectId: 'pC', industryKey: 'dental', state: 'strategized' });
    const { POST: add } = await import('@/app/api/acquisition/contacts/route');
    const { DELETE: del } = await import('@/app/api/acquisition/contacts/[id]/route');
    const base = { acqProspectId: 'apC', name: 'Dr Fixture Okoro', role: 'Owner', email: 'okoro@clinic-c.ng', source: 'Spoke at the 2026 Lagos dental CPD; business card', lawfulBasis: 'legitimate_interest_b2b', confidence: 'medium' };
    expect((await add(req('/x', 'POST', base))).status).toBe(400); // no attest
    expect((await add(req('/x', 'POST', { ...base, attest: true, source: 'Google Maps listing owner name' }))).status).toBe(400);
    expect((await add(req('/x', 'POST', { ...base, attest: true, lawfulBasis: 'none' }))).status).toBe(400);
    await addSuppression({ userId: 'u1', kind: 'email', value: 'blocked@clinic-c.ng', reason: 'erasure', source: 't' });
    const blocked = await add(req('/x', 'POST', { ...base, attest: true, email: 'blocked@clinic-c.ng' }));
    expect(blocked.status).toBe(400);
    expect((await blocked.json()).error).toMatch(/suppressed or was erased/);

    const ok = await add(req('/x', 'POST', { ...base, attest: true }));
    expect(ok.status).toBe(200);
    const id = (await ok.json()).id;
    expect(rows('acquisitionDecisionMaker')[0]).toMatchObject({ kind: 'manual_named', name: 'Dr Fixture Okoro', lawfulBasis: 'legitimate_interest_b2b' });
    expect(String(rows('acquisitionPipelineEvent').at(-1)!.reason)).not.toContain('Okoro');
    expect((await del(req('/x', 'DELETE'), { params: { id } })).status).toBe(200);
    expect(rows('acquisitionDecisionMaker')).toHaveLength(0);
  });

  it('status reports everything live as off', async () => {
    const { GET } = await import('@/app/api/acquisition/status/route');
    const s = await (await GET()).json();
    expect(s.overview.activation.switches).toEqual({ googlePlaces: false, liveWebFetch: false, pagespeedApi: false, liveDns: false });
    expect(s.overview.activation.crawler).toBe('crawler_disabled');
    expect(s.overview.activation.places.join(' ')).toMatch(/legal review pending/);
    expect(s.overview.budgets.find((b: { provider: string }) => b.provider === 'google_places')).toMatchObject({ used: 0, cap: 50 });
  });

  it('no API route can send; the only discovery route is the gated run route (which queues, never calls Places itself)', () => {
    const names = ROUTES.map((r) => r.rel.replace(/\\/g, '/'));
    expect(names.some((n) => /send|deliver|outreach|whatsapp|email|follow|places/i.test(n))).toBe(false);
    expect(names.filter((n) => /discover/i.test(n)).sort()).toEqual(['discovery/route.ts', 'discovery/run/route.ts'].map((x) => names.find((n) => n.endsWith(x))!).sort());
  });
});
