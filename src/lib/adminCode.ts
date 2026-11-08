import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { createTransporter, emailShell } from '@/lib/email';
import { isAdminEmail } from '@/lib/adminSessionShared';

/**
 * Email sign-in codes for the admin area. Stored hashed in the existing VerificationToken table (no new table):
 *   admin-code:<email>  one row = the current code (10 minutes, single use)
 *   admin-fail:<email>  one row per wrong guess (15 minutes); five of them lock the sign-in, and the code is burned.
 * The counters live in the database, so they hold across servers.
 */
export const CODE_TTL_MS = 10 * 60_000;
export const COOLDOWN_MS = 60_000;
export const LOCK_MS = 15 * 60_000;
export const MAX_FAILS = 5;

const norm = (e: string) => e.trim().toLowerCase();
const idCode = (e: string) => `admin-code:${e}`;
const idFail = (e: string) => `admin-fail:${e}`;
const hash = (email: string, code: string) => crypto.createHmac('sha256', process.env.NEXTAUTH_SECRET ?? '').update(`${email}:${code}`).digest('hex');
const same = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function failCount(email: string): Promise<number> {
  return prisma.verificationToken.count({ where: { identifier: idFail(norm(email)), expires: { gt: new Date() } } });
}

function codeEmail(code: string, app: string) {
  const body = `<h2 style="margin:0 0 8px;font-size:22px;color:#0f172a;">Your admin sign-in code</h2>
    <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">Use this code to sign in to the ${app} admin area. It works once and expires in 10 minutes.</p>
    <p style="margin:0 0 20px;font-size:38px;font-weight:800;letter-spacing:10px;color:#7e22ce;font-family:ui-monospace,Menlo,monospace;">${code}</p>
    <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">If you did not ask for this, ignore this email. Nobody can sign in without the code.</p>`;
  return emailShell(app, body, `Your admin sign-in code is ${code}`, 'You are receiving this because an admin sign-in was requested for this address.');
}

/** "o***@runvax.com": enough to recognise an address in the host's logs without printing it in full. */
const mask = (e: string) => e.replace(/^(.).*(@.*)$/, '$1***$2');
const logOutcome = (what: string, email: string) => console.log(`[admin-code] ${what} (${mask(email)})`);

export type RequestResult = { sent: boolean; reason?: 'not_admin' | 'cooldown' | 'locked' | 'mail' };

/** Makes and emails a fresh code. Silent about non-admin addresses: the caller answers the same either way. */
export async function requestAdminCode(rawEmail: string): Promise<RequestResult> {
  const email = norm(rawEmail);
  if (!isAdminEmail(email)) { logOutcome('no email sent: this address is not in ADMIN_EMAILS on this server', email); return { sent: false, reason: 'not_admin' }; }
  const now = Date.now();
  await prisma.verificationToken.deleteMany({ where: { identifier: { in: [idCode(email), idFail(email)] }, expires: { lt: new Date(now) } } });
  if ((await failCount(email)) >= MAX_FAILS) { logOutcome('no email sent: too many wrong codes, locked for 15 minutes', email); return { sent: false, reason: 'locked' }; }
  const current = await prisma.verificationToken.findFirst({ where: { identifier: idCode(email), expires: { gt: new Date(now + CODE_TTL_MS - COOLDOWN_MS) } } });
  if (current) { logOutcome('no email sent: a code was already sent in the last minute', email); return { sent: false, reason: 'cooldown' }; } // asked for one in the last minute
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await prisma.verificationToken.deleteMany({ where: { identifier: idCode(email) } });
  await prisma.verificationToken.create({ data: { identifier: idCode(email), token: hash(email, code), expires: new Date(now + CODE_TTL_MS) } });
  const app = process.env.APP_NAME ?? 'Runvax';
  if (!process.env.RESEND_API_KEY && !process.env.SMTP_HOST) {
    // No mail server: in development only, print the code so the flow can be tried. Never in production.
    if (process.env.NODE_ENV !== 'production') { console.log(`[admin-code] ${email} ${code}`); return { sent: true }; }
    console.error('[admin-code] no mail server is configured, so the sign-in code cannot be sent');
    return { sent: false, reason: 'mail' };
  }
  try {
    await createTransporter().sendMail({ from: `"${app}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER ?? 'no-reply@runvax.com'}>`, to: email, subject: `${app} admin sign-in code`, html: codeEmail(code, app) });
    logOutcome('code email accepted by the mail server', email);
    return { sent: true };
  } catch (e) { console.error('[admin-code] sending failed', e instanceof Error ? e.message : e); return { sent: false, reason: 'mail' }; }
}

export type VerifyResult = 'ok' | 'bad' | 'locked';

/** Checks a code. Right: it is used up and the failure count cleared. Wrong: counted, and the fifth burns the code and locks for 15 minutes. */
export async function verifyAdminCode(rawEmail: string, rawCode: string): Promise<VerifyResult> {
  const email = norm(rawEmail); const code = rawCode.replace(/\s+/g, '');
  if (!isAdminEmail(email) || !/^\d{6}$/.test(code)) return 'bad';
  if ((await failCount(email)) >= MAX_FAILS) return 'locked';
  const row = await prisma.verificationToken.findFirst({ where: { identifier: idCode(email), expires: { gt: new Date() } } });
  if (row && same(row.token, hash(email, code))) {
    await prisma.verificationToken.deleteMany({ where: { identifier: { in: [idCode(email), idFail(email)] } } });
    return 'ok';
  }
  await prisma.verificationToken.create({ data: { identifier: idFail(email), token: crypto.randomBytes(16).toString('hex'), expires: new Date(Date.now() + LOCK_MS) } });
  if ((await failCount(email)) >= MAX_FAILS) { await prisma.verificationToken.deleteMany({ where: { identifier: idCode(email) } }); return 'locked'; }
  return 'bad';
}
