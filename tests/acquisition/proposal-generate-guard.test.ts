/**
 * POST /api/proposal (generate) can also email the proposal to a client-supplied
 * `prospectEmail`. That path must use the same recipient guard as the dedicated
 * send routes. OpenAI and SMTP are mocked: nothing is called or sent.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import nodemailer from 'nodemailer';
import { seed } from '../helpers/fakePrisma';

const auth = vi.hoisted(() => ({ getToken: vi.fn() }));
vi.mock('next-auth/jwt', () => ({ getToken: auth.getToken }));
vi.mock('@/lib/userProfile', () => ({ getEffectiveProfile: vi.fn(async () => ({ senderName: 'Ada', whatsapp: '', tagline: '', city: 'Lagos', replyEmail: null, portfolio: [], rateCard: null, packages: [] })) }));
vi.mock('@/lib/usage', () => ({ requireFeature: vi.fn(async () => ({ ok: true })), checkAndIncrementAI: vi.fn(async () => ({ ok: true })) }));
vi.mock('openai', () => ({ default: class { chat = { completions: { create: vi.fn(async () => ({ choices: [{ message: { content: '---PROPOSAL---\n# Synthetic proposal' } }] })) } }; } }));

import { POST } from '@/app/api/proposal/route';
import { addSuppression } from '@/lib/acquisition/suppression';

const sendMail = vi.fn();
beforeEach(() => {
  auth.getToken.mockReset().mockResolvedValue({ id: 'u1', sub: 'u1' });
  seed('user', { id: 'u1', email: 'me@own.example', isSuspended: false });
  sendMail.mockReset().mockResolvedValue({});
  vi.mocked(nodemailer.createTransport).mockReturnValue({ sendMail } as never);
  Object.assign(process.env, { OPENAI_API_KEY: 'test-not-real', SMTP_HOST: 'smtp.test.local', SMTP_PORT: '587', SMTP_USER: 'p@test.local', SMTP_PASS: 'x' });
  seed('prospect', { id: 'p1', userId: 'u1', businessName: 'Coral', source: 'industry-acquisition' });
  seed('acquisitionProspect', { id: 'ap1', userId: 'u1', prospectId: 'p1', industryKey: 'dental', orgDomain: 'coral-fixture.ng' });
});

const gen = (prospectEmail?: string) => POST(new NextRequest('http://localhost/api/proposal', {
  method: 'POST',
  body: JSON.stringify({ business: { id: 'b', name: 'Some Clinic', category: 'dentist', address: 'Lagos', hasWebsite: false }, ...(prospectEmail ? { prospectEmail } : {}) }),
}));
const toProspect = () => sendMail.mock.calls.filter(([m]) => m.to !== 'me@own.example');
const flush = () => new Promise((r) => setTimeout(r, 20));

describe('POST /api/proposal prospect email', () => {
  it('an ordinary recipient is still emailed, and the response says so', async () => {
    const res = await gen('owner@ordinary-clinic.example'); await flush();
    expect(res.status).toBe(200);
    expect((await res.json()).prospectEmail).toEqual({ sent: true });
    expect(toProspect()).toHaveLength(1);
  });

  it('an acquisition clinic address (inbox domain) is NOT emailed, and the refusal is reported', async () => {
    const res = await gen('anyone@coral-fixture.ng'); await flush();
    const j = await res.json();
    expect(res.status).toBe(200); // the proposal itself is still returned
    expect(j.proposal).toContain('Synthetic proposal');
    expect(j.prospectEmail).toMatchObject({ sent: false, code: 'acquisition_managed' });
    expect(toProspect()).toHaveLength(0);
  });

  it('a suppressed address is NOT emailed', async () => {
    await addSuppression({ userId: 'u1', kind: 'email', value: 'optout@elsewhere.example', reason: 'opt_out', source: 't' });
    const j = await (await gen('OptOut@Elsewhere.example')).json(); await flush();
    expect(j.prospectEmail).toMatchObject({ sent: false, code: 'suppressed' });
    expect(toProspect()).toHaveLength(0);
  });

  it('no session: never emails the prospect', async () => {
    auth.getToken.mockResolvedValue(null);
    const j = await (await gen('owner@ordinary-clinic.example')).json(); await flush();
    expect(j.prospectEmail?.sent).toBe(false);
    expect(toProspect()).toHaveLength(0);
  });

  it('no prospectEmail: behaves as before (no field in the response)', async () => {
    const j = await (await gen()).json();
    expect(j.prospectEmail).toBeUndefined();
  });
});
