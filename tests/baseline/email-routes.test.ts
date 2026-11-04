/**
 * The two outbound email routes. Pins the existing signed-in behaviour (user
 * SMTP → platform fallback, signature, Email Blast gate) and the approved auth
 * fix: signed-out callers can no longer relay through the platform SMTP.
 * Uses the real requireFeature/plan gating; nodemailer is mocked globally —
 * nothing is ever sent.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import nodemailer from 'nodemailer';
import { seed } from '../helpers/fakePrisma';

const auth = vi.hoisted(() => ({ getToken: vi.fn() }));
vi.mock('next-auth/jwt', () => ({ getToken: auth.getToken }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(async () => null) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/userProfile', () => ({
  getEffectiveProfile: vi.fn(async () => ({ senderName: 'Ada', businessName: 'Harzotech', whatsapp: '', tagline: '' })),
}));

import { POST as sendEmail } from '@/app/api/send-email/route';
import { POST as sendProposal } from '@/app/api/proposal/send-email/route';

const sendMail = vi.fn();

beforeEach(() => {
  auth.getToken.mockReset();
  sendMail.mockReset().mockResolvedValue({ messageId: 'm1' });
  vi.mocked(nodemailer.createTransport).mockReturnValue({ sendMail } as never);
  process.env.SMTP_HOST = 'smtp.test.local';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'platform@test.local';
  process.env.SMTP_PASS = 'x';
  process.env.SMTP_FROM = 'Platform';
});

const post = (url: string, body: unknown) =>
  new NextRequest(`http://localhost${url}`, { method: 'POST', body: JSON.stringify(body) });
const signIn = (plan = 'pro', isSuspended = false) => {
  auth.getToken.mockResolvedValue({ id: 'u1', sub: 'u1', plan });
  seed('user', { id: 'u1', isSuspended });
};
const MAIL = { to: 'a@b.c', subject: 'Hi', body: 'Hello' };

describe('POST /api/send-email', () => {
  it('401 when signed out — and nothing is sent', async () => {
    auth.getToken.mockResolvedValue(null);
    const res = await sendEmail(post('/api/send-email', { to: 'victim@x.com', subject: 'Hi', body: 'Hello' }));
    expect(res.status).toBe(401);
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('401 for a token whose user no longer exists', async () => {
    auth.getToken.mockResolvedValue({ id: 'ghost' });
    expect((await sendEmail(post('/api/send-email', MAIL))).status).toBe(401);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('403 for a suspended user — and nothing is sent', async () => {
    signIn('pro', true);
    const res = await sendEmail(post('/api/send-email', MAIL));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Account suspended' });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('400 on missing fields when signed in', async () => {
    signIn();
    expect((await sendEmail(post('/api/send-email', { to: 'a@b.c' }))).status).toBe(400);
  });

  it('signed in with own SMTP: sends through the user SMTP with signature (unchanged)', async () => {
    signIn();
    seed('userSettings', { userId: 'u1', smtpHost: 'smtp.user', smtpPort: 465, smtpUser: 'me@user', smtpPass: 'p', smtpFrom: 'Me' });
    const res = await sendEmail(post('/api/send-email', MAIL));
    expect(await res.json()).toEqual({ success: true, messageId: 'm1' });
    expect(nodemailer.createTransport).toHaveBeenCalledWith({ host: 'smtp.user', port: 465, secure: true, auth: { user: 'me@user', pass: 'p' } });
    expect(sendMail).toHaveBeenCalledWith({
      from: '"Me" <me@user>', to: 'a@b.c', subject: 'Hi',
      text: 'Hello\n\n— Ada | Harzotech', html: 'Hello<br><br>— Ada | Harzotech',
    });
  });

  it('signed in without own SMTP: falls back to platform SMTP (unchanged)', async () => {
    signIn('free');
    const res = await sendEmail(post('/api/send-email', MAIL));
    expect(res.status).toBe(200);
    expect(nodemailer.createTransport).toHaveBeenCalledWith({ host: 'smtp.test.local', port: 587, secure: false, auth: { user: 'platform@test.local', pass: 'x' } });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: '"Platform" <platform@test.local>' }));
  });

  it('bulk send on the free plan is still blocked by the Email Blast gate (402)', async () => {
    signIn('free');
    const res = await sendEmail(post('/api/send-email', { ...MAIL, bulk: true }));
    expect(res.status).toBe(402);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('bulk send on pro is allowed', async () => {
    signIn('pro');
    expect((await sendEmail(post('/api/send-email', { ...MAIL, bulk: true }))).status).toBe(200);
  });
});

describe('POST /api/proposal/send-email', () => {
  const PROPOSAL = { prospectEmail: 'clinic@x.ng', proposal: 'Proposal text', agencyName: 'Harzotech' };

  it('401 when signed out — and nothing is sent', async () => {
    auth.getToken.mockResolvedValue(null);
    const res = await sendProposal(post('/api/proposal/send-email', { prospectEmail: 'victim@x.com', proposal: 'Hi' }));
    expect(res.status).toBe(401);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('402 on a plan without AI Proposals — matching the UI gate', async () => {
    signIn('free');
    const res = await sendProposal(post('/api/proposal/send-email', PROPOSAL));
    expect(res.status).toBe(402);
    expect((await res.json()).code).toBe('FEATURE_LOCKED');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('400 on missing fields when allowed', async () => {
    signIn('pro');
    expect((await sendProposal(post('/api/proposal/send-email', {}))).status).toBe(400);
  });

  it('sends through platform SMTP when signed in on pro (unchanged)', async () => {
    signIn('pro');
    const res = await sendProposal(post('/api/proposal/send-email', PROPOSAL));
    expect(await res.json()).toEqual({ ok: true });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: '"Harzotech" <Platform>', to: 'clinic@x.ng', subject: 'Website Proposal — Harzotech',
    }));
  });
});
