/**
 * RUNVAX's existing outbound routes must refuse Industry Acquisition clinics
 * and suppressed recipients on the SERVER, and behave exactly as before for
 * everyone else. Nothing is ever sent: nodemailer is mocked globally and the
 * Meta Cloud API call is a stub that records the request.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';
import { seed } from '../helpers/fakePrisma';

const auth = vi.hoisted(() => ({ getToken: vi.fn(), getServerSession: vi.fn() }));
vi.mock('next-auth/jwt', () => ({ getToken: auth.getToken }));
vi.mock('next-auth', () => ({ getServerSession: auth.getServerSession }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/userProfile', () => ({
  getEffectiveProfile: vi.fn(async () => ({ senderName: 'Ada', businessName: 'Harzotech', whatsapp: '', tagline: '' })),
}));

import { POST as sendEmail } from '@/app/api/send-email/route';
import { POST as sendProposal } from '@/app/api/proposal/send-email/route';
import { POST as waSend } from '@/app/api/whatsapp/send/route';
import { checkRecipient } from '@/lib/acquisition/recipientGuard';
import { addSuppression } from '@/lib/acquisition/suppression';

const sendMail = vi.fn();
const realFetch = globalThis.fetch;
const metaFetch = vi.fn();

beforeEach(() => {
  auth.getToken.mockReset().mockResolvedValue({ id: 'u1', sub: 'u1', plan: 'agency' });
  auth.getServerSession.mockReset().mockResolvedValue({ user: { id: 'u1' } });
  seed('user', { id: 'u1', isSuspended: false });
  sendMail.mockReset().mockResolvedValue({ messageId: 'm1' });
  vi.mocked(nodemailer.createTransport).mockClear();
  vi.mocked(nodemailer.createTransport).mockReturnValue({ sendMail } as never);
  Object.assign(process.env, { SMTP_HOST: 'smtp.test.local', SMTP_PORT: '587', SMTP_USER: 'platform@test.local', SMTP_PASS: 'x', SMTP_FROM: 'Platform' });
  metaFetch.mockReset().mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: 'wamid.1' }] }), { status: 200 }));
  globalThis.fetch = metaFetch as unknown as typeof fetch;
  seed('userSettings', { userId: 'u1', waPhoneNumberId: '1234', waAccessToken: 'test-token', waTemplateName: 'intro', waTemplateStatus: 'APPROVED' });
});
afterEach(() => { globalThis.fetch = realFetch; });

const post = (url: string, body: unknown) => new NextRequest(`http://localhost${url}`, { method: 'POST', body: JSON.stringify(body) });
const email = (to: string, extra: object = {}) => sendEmail(post('/api/send-email', { to, subject: 'Hi', body: 'Hello', ...extra }));
const proposal = (to: string) => sendProposal(post('/api/proposal/send-email', { prospectEmail: to, proposal: '# Proposal' }));
const whatsapp = (to: string) => waSend(post('/api/whatsapp/send', { to, businessName: 'Some Clinic' }));
const nothingSent = () => { expect(sendMail).not.toHaveBeenCalled(); expect(metaFetch).not.toHaveBeenCalled(); };

/** An Industry Acquisition clinic with a role inbox, a phone, and a domain. */
function engineClinic(userId = 'u1') {
  seed('prospect', { id: `p_${userId}`, userId, businessName: 'Coral Fixture Clinic', source: 'industry-acquisition' });
  seed('acquisitionProspect', { id: `ap_${userId}`, userId, prospectId: `p_${userId}`, industryKey: 'dental', orgDomain: 'coral-fixture.ng' });
  seed('acquisitionDecisionMaker', { userId, acqProspectId: `ap_${userId}`, email: 'reception@coral-fixture.ng', phone: '0803 123 4567', kind: 'role_inbox' });
  seed('acquisitionIdentity', { userId, acqProspectId: `ap_${userId}`, kind: 'phone', value: '2348031234567' });
}

describe('ordinary RUNVAX recipients are unaffected', () => {
  it('email, proposal email and WhatsApp still go out exactly as before', async () => {
    engineClinic(); // the account HAS engine clinics; other recipients must not notice
    expect((await email('owner@ordinary-clinic.ng')).status).toBe(200);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0]).toMatchObject({ to: 'owner@ordinary-clinic.ng', subject: 'Hi' });
    sendMail.mockClear();
    expect((await proposal('owner@ordinary-clinic.ng')).status).toBe(200);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect((await whatsapp('+234 802 999 8877')).status).toBe(200);
    expect(metaFetch).toHaveBeenCalledTimes(1);
    expect(String(metaFetch.mock.calls[0][0])).toContain('graph.facebook.com/v20.0/1234/messages');
    expect(JSON.parse(metaFetch.mock.calls[0][1].body).to).toBe('2348029998877');
  });

  it('an account with no acquisition data at all is unaffected, and personal-provider addresses are not matched by domain', async () => {
    engineClinic();
    expect((await email('someone@gmail.com')).status).toBe(200);
    expect((await email('x@coral-fixture.com')).status).toBe(200); // similar, but a different domain
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it("another account's acquisition clinics do not block this account", async () => {
    engineClinic('u2');
    expect((await email('reception@coral-fixture.ng')).status).toBe(200);
    expect((await whatsapp('0803 123 4567')).status).toBe(200);
  });

  it('existing failure behaviour is unchanged: signed out 401, WhatsApp not connected 400', async () => {
    auth.getToken.mockResolvedValue(null);
    expect((await email('owner@ordinary-clinic.ng')).status).toBe(401);
    auth.getServerSession.mockResolvedValue(null);
    expect((await whatsapp('0803 123 4567')).status).toBe(401);
    nothingSent();
  });
});

describe('Industry Acquisition clinics cannot be messaged from the existing routes', () => {
  beforeEach(() => engineClinic());

  it('email: the clinic inbox, any address at its domain (and subdomains), single or bulk', async () => {
    for (const to of ['reception@coral-fixture.ng', 'Reception@Coral-Fixture.ng', 'dr.ada@coral-fixture.ng', 'info@mail.coral-fixture.ng']) {
      const res = await email(to);
      expect(res.status, to).toBe(409);
      expect(await res.json()).toMatchObject({ code: 'acquisition_managed', error: expect.stringMatching(/managed by Industry Acquisition/) });
    }
    expect((await email('reception@coral-fixture.ng', { bulk: true })).status).toBe(409);
    nothingSent();
    expect(nodemailer.createTransport).not.toHaveBeenCalled(); // refused before an SMTP connection was even built
  });

  it('proposal email: refused the same way', async () => {
    expect((await proposal('reception@coral-fixture.ng')).status).toBe(409);
    expect((await proposal('anyone@coral-fixture.ng')).status).toBe(409);
    nothingSent();
  });

  it('WhatsApp: refused for the clinic phone in every common format, before any call to Meta', async () => {
    for (const to of ['0803 123 4567', '08031234567', '+234 803 123 4567', '2348031234567', '803 123 4567']) {
      const res = await whatsapp(to);
      expect(res.status, to).toBe(409);
      expect((await res.json()).code).toBe('acquisition_managed');
    }
    nothingSent();
  });

  it('the refusal does not depend on the feature flag: a clinic imported earlier stays protected when it is switched off', async () => {
    delete process.env.INDUSTRY_ACQUISITION_ENABLED;
    expect((await email('reception@coral-fixture.ng')).status).toBe(409);
    expect((await whatsapp('0803 123 4567')).status).toBe(409);
    nothingSent();
  });
});

describe('suppressed recipients are refused server-side', () => {
  it('an opted-out email, domain and phone (even after the contact record was erased)', async () => {
    await addSuppression({ userId: 'u1', kind: 'email', value: 'optout@elsewhere.ng', reason: 'opt_out', source: 't' });
    await addSuppression({ userId: 'u1', kind: 'domain', value: 'objected-clinic.ng', reason: 'objection', source: 't' });
    await addSuppression({ userId: 'u1', kind: 'phone', value: '08021112222', reason: 'erasure', source: 't' });
    for (const to of ['optout@elsewhere.ng', 'OptOut@Elsewhere.ng', 'info@objected-clinic.ng']) {
      const res = await email(to);
      expect(res.status, to).toBe(403);
      expect((await res.json()).code).toBe('suppressed');
    }
    expect((await proposal('info@objected-clinic.ng')).status).toBe(403);
    expect((await whatsapp('+234 802 111 2222')).status).toBe(403);
    nothingSent();
    // Someone who has not opted out is still reachable.
    expect((await email('fine@elsewhere.ng')).status).toBe(200);
  });
});

describe('the guard fails safe', () => {
  it('allows a send when the acquisition tables do not exist yet (migrations not applied): normal RUNVAX keeps working', async () => {
    vi.spyOn(prisma.acquisitionDecisionMaker, 'findFirst').mockRejectedValueOnce(Object.assign(new Error('table does not exist'), { code: 'P2021' }));
    expect(await checkRecipient('u1', { email: 'owner@ordinary-clinic.ng' })).toEqual({ allowed: true });
  });

  it('refuses (503) on any other database error rather than guessing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(prisma.acquisitionDecisionMaker, 'findFirst').mockRejectedValueOnce(new Error('connection lost'));
    expect(await checkRecipient('u1', { email: 'owner@ordinary-clinic.ng' })).toMatchObject({ allowed: false, status: 503, code: 'check_unavailable' });
    vi.spyOn(prisma.acquisitionProspect, 'findFirst').mockRejectedValueOnce(new Error('connection lost'));
    expect((await email('owner@ordinary-clinic.ng')).status).toBe(503);
    nothingSent();
  });

  it('without a suppression key: allows when the feature is off, refuses when it is on', async () => {
    const saved = process.env.IA_SUPPRESSION_KEY;
    delete process.env.IA_SUPPRESSION_KEY;
    try {
      delete process.env.INDUSTRY_ACQUISITION_ENABLED;
      expect(await checkRecipient('u1', { email: 'owner@ordinary-clinic.ng' })).toEqual({ allowed: true });
      process.env.INDUSTRY_ACQUISITION_ENABLED = 'true';
      expect(await checkRecipient('u1', { email: 'owner@ordinary-clinic.ng' })).toMatchObject({ allowed: false, status: 503 });
    } finally { process.env.IA_SUPPRESSION_KEY = saved; delete process.env.INDUSTRY_ACQUISITION_ENABLED; }
  });

  it('a request with no recipient is left to the route’s own validation', async () => {
    expect(await checkRecipient('u1', {})).toEqual({ allowed: true });
    expect((await sendEmail(post('/api/send-email', { subject: 'Hi', body: 'Hello' }))).status).toBe(400);
  });
});

describe('tripwire: every server route that messages prospects uses the guard', () => {
  const ROOT = path.resolve(__dirname, '../../src');
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
  const rel = (p: string) => path.relative(path.resolve(ROOT, '..'), p);
  const all = walk(ROOT).filter((f) => !rel(f).startsWith('src/lib/acquisition/') && !rel(f).startsWith('src/app/api/acquisition/') && !rel(f).startsWith('src/app/acquisition/'));

  // Routes that send to the account's OWN user (system mail) or manage the WhatsApp account, never to a prospect.
  // src/lib/platformCampaign.ts: the admin's campaigns go only to RUNVAX's own account holders (never prospects), each with an unsubscribe link.
  // src/lib/support.ts: support-ticket mail goes only to the customer who opened the ticket and to the admin addresses on ADMIN_EMAILS, never to a prospect.
  // src/lib/adminCode.ts: the admin sign-in code goes only to an address on ADMIN_EMAILS (the admin's own), never to a prospect.
  // src/lib/career/manage/digest.ts: the Career Agent reminder email goes only to the signed-in candidate's own account address (never to an employer or prospect), at most one a day.
  // src/lib/agents/chat.ts: the assistant's new-lead alert goes only to the owner's address (capped per agent per day); visitors are only ever answered in their own chat.
  const NOT_PROSPECT_FACING = new Set([
    'src/app/api/admin/users/resend-verification/route.ts', 'src/app/api/auth/forgot-password/route.ts', 'src/app/api/auth/register/route.ts',
    'src/app/api/auth/resend-verification/route.ts', 'src/app/api/cron/admin-daily-brief/route.ts', 'src/app/api/cron/expire-plans/route.ts',
    'src/app/api/cron/lifecycle-emails/route.ts', 'src/app/api/cron/onboarding-emails/route.ts', 'src/app/api/payments/webhook/route.ts',
    'src/app/api/trial/start/route.ts', 'src/app/api/user/smtp-test/route.ts', 'src/app/api/whatsapp/template-status/route.ts', 'src/app/api/whatsapp/connect/route.ts',
    'src/app/api/whatsapp/create-template/route.ts', 'src/app/api/whatsapp/test/route.ts', 'src/lib/acqNotify.ts', 'src/lib/integrations/providers.ts', 'src/lib/adminOps.ts', 'src/lib/agents/chat.ts', 'src/lib/career/manage/digest.ts', 'src/lib/adminCode.ts', 'src/lib/email.ts', 'src/lib/launchCampaign.ts', 'src/lib/platformCampaign.ts', 'src/lib/support.ts', 'src/lib/lifecycleRunner.ts', 'src/lib/newUserSetup.ts', 'src/lib/trial.ts', 'src/lib/usage.ts',
  ]);

  it('finds the senders, and each prospect-facing one applies checkRecipient before sending', () => {
    const senders = all.filter((f) => /sendMail\(|createTransporter\(|createTransport\(|graph\.facebook\.com/.test(fs.readFileSync(f, 'utf8')));
    expect(senders.length).toBeGreaterThan(10);
    const prospectFacing = senders.map(rel).filter((f) => !NOT_PROSPECT_FACING.has(f)).sort();
    // A NEW sender must be classified: guard it, or add it to the list above with a reason.
    expect(prospectFacing).toEqual(['src/app/api/client-acquisition/replies/[id]/respond/route.ts', 'src/app/api/proposal/route.ts', 'src/app/api/proposal/send-email/route.ts', 'src/app/api/send-email/route.ts', 'src/app/api/whatsapp/send/route.ts', 'src/lib/outreachSender.ts', 'src/lib/waCampaign.ts']);
    for (const f of prospectFacing) {
      const src = fs.readFileSync(path.resolve(ROOT, '..', f), 'utf8');
      expect(src, f).toMatch(/checkRecipient\(/);
      // The check must come before anything is sent TO THE PROSPECT. (/api/proposal also sends a self-copy to
      // the account owner first; that one is not prospect-facing, so for it the marker is the prospect send.)
      const firstSend = f === 'src/app/api/proposal/route.ts' ? src.indexOf('to: prospectEmail') : src.search(/sendMail\(|\bfetch\(/);
      expect(firstSend, f).toBeGreaterThan(-1);
      expect(src.indexOf('checkRecipient('), f).toBeLessThan(firstSend);
    }
  });
});
