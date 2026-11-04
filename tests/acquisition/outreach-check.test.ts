/**
 * The server decision behind every browser-opened outreach link (wa.me,
 * mailto:). It must reuse the send routes' matching, refuse acquisition
 * clinics and suppressed contacts, work with the feature flag off, keep
 * ordinary prospects (including source = NULL) working, and never leak across
 * accounts. Synthetic data only; nothing is sent.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { seed } from '../helpers/fakePrisma';

const auth = vi.hoisted(() => ({ getToken: vi.fn() }));
vi.mock('next-auth/jwt', () => ({ getToken: auth.getToken }));

import { POST as check } from '@/app/api/outreach/check/route';
import { checkOutreachTarget, checkRecipient } from '@/lib/acquisition/recipientGuard';
import { addSuppression } from '@/lib/acquisition/suppression';

const U = 'u1';
beforeEach(() => {
  auth.getToken.mockReset().mockResolvedValue({ id: U, sub: U, plan: 'free' });
  seed('user', { id: U, isSuspended: false });
});
afterEach(() => { delete process.env.INDUSTRY_ACQUISITION_ENABLED; });

const post = (body: unknown) => new NextRequest('http://localhost/api/outreach/check', { method: 'POST', body: JSON.stringify(body) });

function crmProspect(id: string, over: Record<string, unknown> = {}) {
  return seed('prospect', { id, userId: U, businessId: `biz_${id}`, businessName: `Clinic ${id}`, businessData: { id: `biz_${id}`, name: `Clinic ${id}` }, ...over });
}
function engineClinic(id = 'eng', contact: { email?: string; phone?: string } = {}) {
  crmProspect(id, { source: 'industry-acquisition' });
  seed('acquisitionProspect', { id: `ap_${id}`, userId: U, prospectId: id, industryKey: 'dental', orgDomain: 'coral-fixture.ng' });
  if (contact.email || contact.phone) seed('acquisitionDecisionMaker', { userId: U, acqProspectId: `ap_${id}`, email: contact.email ?? null, phone: contact.phone ?? null, kind: 'role_inbox' });
  if (contact.phone) seed('acquisitionIdentity', { userId: U, acqProspectId: `ap_${id}`, kind: 'phone', value: '2348031234567' });
}

describe('an acquisition clinic is refused', () => {
  it('by its source alone, even with no contact details recorded', async () => {
    engineClinic('eng');
    expect(await checkOutreachTarget(U, { businessId: 'biz_eng' })).toMatchObject({ allowed: false, status: 409, code: 'acquisition_managed' });
  });

  it('by its linked acquisition record, even if its CRM source were ever missing', async () => {
    crmProspect('p1', { source: null });
    seed('acquisitionProspect', { id: 'ap_p1', userId: U, prospectId: 'p1', industryKey: 'dental' });
    expect(await checkOutreachTarget(U, { businessId: 'biz_p1' })).toMatchObject({ allowed: false, code: 'acquisition_managed' });
  });

  it('by contact details alone, for an unsaved search result (inbox, same-domain address, subdomain, phone in any format)', async () => {
    engineClinic('eng', { email: 'reception@coral-fixture.ng', phone: '0803 123 4567' });
    for (const t of [
      { email: 'reception@coral-fixture.ng' }, { email: 'dr.ada@coral-fixture.ng' }, { email: 'info@mail.coral-fixture.ng' },
      { phone: '0803 123 4567' }, { phone: '+234 803 123 4567' }, { phone: '2348031234567' },
    ]) expect(await checkOutreachTarget(U, { businessId: 'place_unsaved', ...t }), JSON.stringify(t)).toMatchObject({ allowed: false, code: 'acquisition_managed' });
  });

  it('with the feature flag OFF (a clinic imported earlier stays protected)', async () => {
    engineClinic('eng', { email: 'reception@coral-fixture.ng' });
    delete process.env.INDUSTRY_ACQUISITION_ENABLED;
    expect((await checkOutreachTarget(U, { businessId: 'biz_eng' })).allowed).toBe(false);
    expect((await checkOutreachTarget(U, { email: 'reception@coral-fixture.ng' })).allowed).toBe(false);
  });

  it('the matching is the send routes’ matching: the same input gets the same verdict from both', async () => {
    engineClinic('eng', { email: 'reception@coral-fixture.ng', phone: '0803 123 4567' });
    for (const t of [{ email: 'info@mail.coral-fixture.ng' }, { phone: '08031234567' }, { email: 'owner@elsewhere.ng' }, { phone: '08029998877' }]) {
      const viaRoute = await checkRecipient(U, t);
      const viaLink = await checkOutreachTarget(U, t);
      expect(viaLink.allowed, JSON.stringify(t)).toBe(viaRoute.allowed);
    }
  });
});

describe('suppression takes precedence', () => {
  it('a suppressed email, domain or phone is refused (403) for an unsaved search result', async () => {
    await addSuppression({ userId: U, kind: 'email', value: 'optout@elsewhere.ng', reason: 'opt_out', source: 't' });
    await addSuppression({ userId: U, kind: 'domain', value: 'objected-clinic.ng', reason: 'objection', source: 't' });
    await addSuppression({ userId: U, kind: 'phone', value: '08021112222', reason: 'erasure', source: 't' });
    for (const t of [{ email: 'OptOut@Elsewhere.ng' }, { email: 'info@objected-clinic.ng' }, { phone: '+234 802 111 2222' }]) {
      expect(await checkOutreachTarget(U, t), JSON.stringify(t)).toMatchObject({ allowed: false, status: 403, code: 'suppressed' });
    }
  });

  it('a SAVED ordinary prospect whose stored contact became suppressed after the page loaded is refused (stale UI state)', async () => {
    crmProspect('p1', { source: null, businessData: { id: 'biz_p1', name: 'Clinic p1', phone: '0802 111 2222', email: 'owner@later-optout.ng' } });
    // The page was loaded while this was allowed; later the contact opts out:
    expect((await checkOutreachTarget(U, { businessId: 'biz_p1' })).allowed).toBe(true);
    await addSuppression({ userId: U, kind: 'email', value: 'owner@later-optout.ng', reason: 'opt_out', source: 't' });
    expect(await checkOutreachTarget(U, { businessId: 'biz_p1' })).toMatchObject({ allowed: false, code: 'suppressed' });
    // ...and the page's own (possibly stale) supplied values cannot override what the server holds.
    expect((await checkOutreachTarget(U, { businessId: 'biz_p1', email: 'someone-else@fine.ng' })).allowed).toBe(false);
  });

  it('"managed" outranks "suppressed" when both apply', async () => {
    engineClinic('eng', { email: 'reception@coral-fixture.ng' });
    await addSuppression({ userId: U, kind: 'email', value: 'reception@coral-fixture.ng', reason: 'opt_out', source: 't' });
    expect(await checkOutreachTarget(U, { email: 'reception@coral-fixture.ng' })).toMatchObject({ code: 'acquisition_managed' });
  });
});

describe('ordinary RUNVAX prospects keep working', () => {
  it.each([null, undefined, 'manual', 'campaign', 'auto-prospect'])('source = %s is allowed (NULL is not accidentally excluded)', async (source) => {
    crmProspect('p1', { source, businessData: { id: 'biz_p1', name: 'Ordinary', phone: '0803 777 6655', email: 'owner@ordinary-clinic.ng' } });
    expect(await checkOutreachTarget(U, { businessId: 'biz_p1', phone: '0803 777 6655', email: 'owner@ordinary-clinic.ng' })).toEqual({ allowed: true });
  });

  it('an unsaved search result with no acquisition match is allowed', async () => {
    engineClinic('eng', { email: 'reception@coral-fixture.ng' }); // the account HAS engine clinics
    expect(await checkOutreachTarget(U, { businessId: 'place_xyz', phone: '08029998877', email: 'hello@another-clinic.ng' })).toEqual({ allowed: true });
  });

  it('an empty target is allowed and left to the caller', async () => {
    expect(await checkOutreachTarget(U, {})).toEqual({ allowed: true });
  });
});

describe('isolation and fail-safes', () => {
  it("another account's acquisition clinic neither blocks this account nor is revealed to it", async () => {
    crmProspect('theirs', { userId: 'u2', businessId: 'shared_place', source: 'industry-acquisition' });
    seed('acquisitionProspect', { id: 'ap_t', userId: 'u2', prospectId: 'theirs', industryKey: 'dental', orgDomain: 'coral-fixture.ng' });
    seed('acquisitionDecisionMaker', { userId: 'u2', acqProspectId: 'ap_t', email: 'reception@coral-fixture.ng', kind: 'role_inbox' });
    expect(await checkOutreachTarget(U, { businessId: 'shared_place', email: 'reception@coral-fixture.ng' })).toEqual({ allowed: true });
  });

  it('allows when the acquisition tables do not exist yet (migrations not applied)', async () => {
    crmProspect('p1', { source: null });
    vi.spyOn(prisma.acquisitionProspect, 'findFirst').mockRejectedValueOnce(Object.assign(new Error('no table'), { code: 'P2021' }));
    expect((await checkOutreachTarget(U, { businessId: 'biz_p1' })).allowed).toBe(true);
  });

  it('refuses (503) on any other database error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(prisma.prospect, 'findUnique').mockRejectedValueOnce(new Error('connection lost'));
    expect(await checkOutreachTarget(U, { businessId: 'biz_p1' })).toMatchObject({ allowed: false, status: 503, code: 'check_unavailable' });
  });
});

describe('POST /api/outreach/check', () => {
  it('401 signed out, 403 suspended, 400 on a malformed or oversized body', async () => {
    auth.getToken.mockResolvedValue(null);
    expect((await check(post({ targets: [{ phone: '0803' }] }))).status).toBe(401);
    auth.getToken.mockResolvedValue({ id: 'u9', sub: 'u9' });
    seed('user', { id: 'u9', isSuspended: true });
    expect((await check(post({ targets: [{ phone: '0803' }] }))).status).toBe(403);
    auth.getToken.mockResolvedValue({ id: U, sub: U });
    for (const body of [{}, { targets: [] }, { targets: [{ phone: '1' }], extra: true }, { targets: [{ nope: 1 }] }, { targets: Array.from({ length: 101 }, () => ({ phone: '08031234567' })) }, 'nonsense']) {
      expect((await check(post(body))).status, JSON.stringify(body).slice(0, 40)).toBe(400);
    }
  });

  it('works for any signed-in user (not admin- or flag-gated) and answers in request order', async () => {
    engineClinic('eng', { email: 'reception@coral-fixture.ng', phone: '0803 123 4567' });
    await addSuppression({ userId: U, kind: 'phone', value: '08021112222', reason: 'opt_out', source: 't' });
    delete process.env.INDUSTRY_ACQUISITION_ENABLED; // flag off; plan 'free'; not an admin
    const res = await check(post({ targets: [
      { phone: '08029998877' },                      // ordinary
      { email: 'reception@coral-fixture.ng' },       // acquisition
      { phone: '08021112222' },                      // suppressed
      { businessId: 'biz_eng' },                     // acquisition, by source
    ] }));
    expect(res.status).toBe(200);
    const { results } = await res.json();
    expect(results).toEqual([
      { allowed: true },
      { allowed: false, code: 'acquisition_managed', message: expect.stringMatching(/managed by Industry Acquisition/) },
      { allowed: false, code: 'suppressed', message: expect.stringMatching(/opted out or been suppressed/) },
      { allowed: false, code: 'acquisition_managed', message: expect.any(String) },
    ]);
    // Nothing beyond allowed / code / message is revealed.
    for (const r of results) expect(Object.keys(r).sort()).toEqual(r.allowed ? ['allowed'] : ['allowed', 'code', 'message']);
  });
});
