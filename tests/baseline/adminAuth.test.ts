import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// A tiny in-memory VerificationToken table, enough for the shapes adminCode.ts uses.
type Row = { identifier: string; token: string; expires: Date };
let rows: Row[] = []; let sent: Array<{ to: string; html: string }> = [];
const match = (r: Row, w: any) => (!w.identifier || (typeof w.identifier === 'string' ? r.identifier === w.identifier : w.identifier.in.includes(r.identifier))) && (!w.expires || (w.expires.gt ? r.expires > w.expires.gt : true) && (w.expires.lt ? r.expires < w.expires.lt : true)); // eslint-disable-line @typescript-eslint/no-explicit-any
vi.mock('@/lib/prisma', () => ({ prisma: { verificationToken: {
  create: async ({ data }: { data: Row }) => { rows.push(data); return data; },
  findFirst: async ({ where }: { where: any }) => rows.find((r) => match(r, where)) ?? null, // eslint-disable-line @typescript-eslint/no-explicit-any
  count: async ({ where }: { where: any }) => rows.filter((r) => match(r, where)).length, // eslint-disable-line @typescript-eslint/no-explicit-any
  deleteMany: async ({ where }: { where: any }) => { const before = rows.length; rows = rows.filter((r) => !match(r, where)); return { count: before - rows.length }; }, // eslint-disable-line @typescript-eslint/no-explicit-any
} } }));
vi.mock('@/lib/email', () => ({ emailShell: (_a: string, body: string) => body, createTransporter: () => ({ sendMail: async (m: { to: string; html: string }) => { sent.push(m); } }) }));

import { COOLDOWN_MS, LOCK_MS, MAX_FAILS, requestAdminCode, verifyAdminCode } from '@/lib/adminCode';
import { ADMIN_SESSION_MS, adminTokenValid, isAdminEmail, isAdminSession } from '@/lib/adminSessionShared';

const ADMIN = 'owner@runvax.com';
const lastCode = () => sent.at(-1)!.html.match(/>(\d{6})</)![1];
beforeEach(() => { rows = []; sent = []; vi.stubEnv('ADMIN_EMAILS', `${ADMIN}, Second@Runvax.com`); vi.stubEnv('NEXTAUTH_SECRET', 'test-secret'); vi.stubEnv('RESEND_API_KEY', 'x'); });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe('who counts as an admin', () => {
  it('only addresses on the admin list, ignoring case and spaces', () => {
    expect(isAdminEmail('OWNER@runvax.com')).toBe(true); expect(isAdminEmail(' second@runvax.com ')).toBe(true);
    expect(isAdminEmail('someone@else.com')).toBe(false); expect(isAdminEmail('')).toBe(false); expect(isAdminEmail(undefined)).toBe(false);
    vi.stubEnv('ADMIN_EMAILS', ''); expect(isAdminEmail(ADMIN)).toBe(false);
  });
  it('a session token is admin only when made by the admin sign-in, fresh, and for a listed address', () => {
    const now = Date.now(); const ok = { isAdmin: true, adminAt: now - 1000, email: ADMIN };
    expect(adminTokenValid(ok, now)).toBe(true);
    expect(adminTokenValid({ ...ok, adminAt: now - ADMIN_SESSION_MS - 1 }, now)).toBe(false);   // older than 12 hours
    expect(adminTokenValid({ isAdmin: true, email: ADMIN }, now)).toBe(false);                   // an old-style session with no admin timestamp
    expect(adminTokenValid({ ...ok, adminAt: now + 60_000 }, now)).toBe(false);                  // a timestamp from the future
    expect(adminTokenValid({ ...ok, isAdmin: false }, now)).toBe(false);
    expect(adminTokenValid({ ...ok, email: 'x@y.com' }, now)).toBe(false);                       // removed from the list
    expect(adminTokenValid(null)).toBe(false);
  });
  it('an API session needs the admin flag AND a listed address', () => {
    expect(isAdminSession({ user: { email: ADMIN, isAdmin: true } })).toBe(true);
    expect(isAdminSession({ user: { email: ADMIN } })).toBe(false);                               // signed in by password or Google
    expect(isAdminSession({ user: { email: 'x@y.com', isAdmin: true } })).toBe(false);
    expect(isAdminSession(null)).toBe(false);
  });
});

describe('email sign-in codes', () => {
  it('a non-admin address gets nothing sent, and nothing is stored', async () => {
    expect(await requestAdminCode('stranger@example.com')).toEqual({ sent: false, reason: 'not_admin' });
    expect(sent.length).toBe(0); expect(rows.length).toBe(0);
  });
  it('sends a 6-digit code to an admin and stores only a hash of it', async () => {
    expect((await requestAdminCode(' Owner@Runvax.com ')).sent).toBe(true);
    expect(sent[0].to).toBe(ADMIN); const code = lastCode(); expect(code).toMatch(/^\d{6}$/);
    expect(JSON.stringify(rows)).not.toContain(code);
  });
  it('the right code works once, and then it is used up', async () => {
    await requestAdminCode(ADMIN); const code = lastCode();
    expect(await verifyAdminCode(ADMIN, code)).toBe('ok');
    expect(await verifyAdminCode(ADMIN, code)).toBe('bad');
  });
  it('spaces in the code are fine, other shapes are not', async () => {
    await requestAdminCode(ADMIN); const code = lastCode();
    expect(await verifyAdminCode(ADMIN, '12345')).toBe('bad'); expect(await verifyAdminCode(ADMIN, 'abcdef')).toBe('bad');
    expect(await verifyAdminCode(ADMIN, `${code.slice(0, 3)} ${code.slice(3)}`)).toBe('ok');
  });
  it('a code for one admin does not work for another address', async () => {
    await requestAdminCode(ADMIN); const code = lastCode();
    expect(await verifyAdminCode('second@runvax.com', code)).toBe('bad');
    expect(await verifyAdminCode('stranger@example.com', code)).toBe('bad');
  });
  it('a code expires after 10 minutes', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-08T10:00:00Z'));
    await requestAdminCode(ADMIN); const code = lastCode();
    vi.setSystemTime(new Date('2026-11-08T10:10:01Z'));
    expect(await verifyAdminCode(ADMIN, code)).toBe('bad');
  });
  it('five wrong codes lock the sign-in, burn the code, and the right code no longer helps', async () => {
    await requestAdminCode(ADMIN); const code = lastCode(); const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 1; i < MAX_FAILS; i++) expect(await verifyAdminCode(ADMIN, wrong)).toBe('bad');
    expect(await verifyAdminCode(ADMIN, wrong)).toBe('locked');
    expect(await verifyAdminCode(ADMIN, code)).toBe('locked');
    expect((await requestAdminCode(ADMIN)).reason).toBe('locked'); // and no fresh code is sent while locked
  });
  it('the lock ends after 15 minutes', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-08T10:00:00Z'));
    await requestAdminCode(ADMIN); for (let i = 0; i < MAX_FAILS; i++) await verifyAdminCode(ADMIN, '000001');
    expect((await requestAdminCode(ADMIN)).reason).toBe('locked');
    vi.setSystemTime(new Date(Date.parse('2026-11-08T10:00:00Z') + LOCK_MS + 1000));
    expect((await requestAdminCode(ADMIN)).sent).toBe(true);
    expect(await verifyAdminCode(ADMIN, lastCode())).toBe('ok');
  });
  it('asking again within a minute does not send a second email; a new code replaces the old one after that', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-08T10:00:00Z'));
    await requestAdminCode(ADMIN); const first = lastCode();
    expect((await requestAdminCode(ADMIN)).reason).toBe('cooldown'); expect(sent.length).toBe(1);
    vi.setSystemTime(new Date(Date.now() + COOLDOWN_MS + 1000));
    expect((await requestAdminCode(ADMIN)).sent).toBe(true); const second = lastCode();
    if (second !== first) expect(await verifyAdminCode(ADMIN, first)).toBe('bad');
    expect(await verifyAdminCode(ADMIN, second)).toBe('ok');
  });
  it('a correct code clears earlier wrong guesses', async () => {
    await requestAdminCode(ADMIN); const code = lastCode(); const wrong = code === '000000' ? '111111' : '000000';
    await verifyAdminCode(ADMIN, wrong); await verifyAdminCode(ADMIN, wrong);
    expect(await verifyAdminCode(ADMIN, code)).toBe('ok');
    expect(rows.filter((r) => r.identifier.startsWith('admin-fail:')).length).toBe(0);
  });
});
