import { prisma } from '@/lib/prisma';
import {
  createTransporter, launchCampaignEmailHtml, launchCountdownEmailHtml, LAUNCH_EMAIL_1_SUBJECT, launchEmail2Subject, v2InviteEmailHtml, v2InviteSubject,
} from '@/lib/email';
import { getAppUrl, getAppName } from '@/lib/url';
import { trialOfferLastDayLabel, daysUntilLaunch, trialOfferOpen, trialOfferHasDeadline } from '@/lib/promo';
import { unsubscribeUrl } from '@/lib/unsubscribe';
import { emailConfigured } from '@/lib/lifecycleRunner';

/**
 * The launch emails (1: the offer, 2: the countdown, 3: the invitation to try RUNVAX 2.0), sent from the admin dashboard.
 *
 * "Who already got it" lives in the LifecycleEmail table (key launch_1 / launch_2), so a send
 * can be resumed in batches, never double-sends, and the dashboard always shows true counts.
 * People who unsubscribed (key 'optout') and suspended accounts are skipped.
 */

export type LaunchWhich = 1 | 2 | 3;

/** Accounts this new already land in RUNVAX 2.0 when they sign up, so the invitation to try it is for people who joined before. */
export const INVITE_MIN_ACCOUNT_AGE_DAYS = 3;
export const launchKey = (w: LaunchWhich) => `launch_${w}` as const;

/** Per request: keeps a batch inside the serverless time limit (about 0.5s per email). */
export const MAX_BATCH = 60;

export interface Audience {
  total: number;
  verified: number;
  unverified: number;
  optedOut: number;
  alreadySent: number;
  /** Email 2 only: people who already claimed the free Pro, so a "claim it" reminder doesn't apply. */
  alreadyClaimed: number;
  /** Email 3 only: accounts too new to be "existing users" (they already start in RUNVAX 2.0). */
  joinedRecently: number;
  eligible: Array<{ id: string; email: string; name: string | null; verified: boolean; claimed: boolean }>;
}

export async function launchAudience(which: LaunchWhich): Promise<Audience> {
  const users = await prisma.user.findMany({
    where: { isSuspended: false, email: { not: null } },
    select: { id: true, email: true, name: true, emailVerified: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  const rows = await prisma.lifecycleEmail.findMany({
    where: { key: { in: [launchKey(which), 'optout'] } },
    select: { userId: true, key: true },
  });
  // Who already has a trial or a paid plan: email 2 skips them; email 3 still invites them, but without the trial offer.
  const claimed = which !== 1
    ? new Set((await prisma.payment.findMany({
        where: { OR: [{ reference: { startsWith: 'trial_' } }, { amount: { gt: 0 }, status: 'success' }] },
        select: { userId: true },
      })).map((p) => p.userId))
    : new Set<string>();
  const sent = new Set(rows.filter((r) => r.key === launchKey(which)).map((r) => r.userId));
  const out = new Set(rows.filter((r) => r.key === 'optout').map((r) => r.userId));

  const seen = new Set<string>();
  const eligible: Audience['eligible'] = [];
  const newerThan = Date.now() - INVITE_MIN_ACCOUNT_AGE_DAYS * 24 * 60 * 60 * 1000;
  let optedOut = 0, alreadySent = 0, alreadyClaimed = 0, joinedRecently = 0;
  for (const u of users) {
    const email = u.email!.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || seen.has(email)) continue;
    seen.add(email);
    if (out.has(u.id)) { optedOut++; continue; }
    if (sent.has(u.id)) { alreadySent++; continue; }
    if (which === 3 && u.createdAt.getTime() > newerThan) { joinedRecently++; continue; }
    if (which === 2 && claimed.has(u.id)) { alreadyClaimed++; continue; }
    eligible.push({ id: u.id, email, name: u.name, verified: !!u.emailVerified, claimed: claimed.has(u.id) });
  }
  return {
    total: seen.size,
    verified: users.filter((u) => u.emailVerified).length,
    unverified: users.filter((u) => !u.emailVerified).length,
    optedOut, alreadySent, alreadyClaimed, joinedRecently, eligible,
  };
}

function render(which: LaunchWhich, name: string, unsub?: string, claimed = false) {
  const appUrl = getAppUrl(), appName = getAppName(), claimBy = trialOfferLastDayLabel();
  if (which === 3) {
    // The free trial is mentioned only to people who can still claim it: one trial per account, and the offer may have closed.
    const trialAvailable = trialOfferOpen() && !claimed;
    return { subject: v2InviteSubject(trialAvailable), html: v2InviteEmailHtml(name, appUrl, appName, { trialAvailable, claimBy: trialOfferHasDeadline() ? claimBy : null }, unsub) };
  }
  if (which === 1) return { subject: LAUNCH_EMAIL_1_SUBJECT, html: launchCampaignEmailHtml(name, appUrl, appName, claimBy, unsub) };
  const daysLeft = daysUntilLaunch();
  return { subject: launchEmail2Subject(daysLeft), html: launchCountdownEmailHtml(name, appUrl, appName, claimBy, daysLeft, unsub) };
}

function from(): string {
  return `"${getAppName()}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`;
}

/** A real send must never go out with a local or non-https link inside it. */
export function sendSafetyProblem(): string | null {
  if (!emailConfigured()) return 'Email is not configured on this server.';
  const url = getAppUrl();
  if (!/^https:\/\//.test(url) || /localhost|127\.0\.0\.1/.test(url)) return `Refusing to send to customers: the app URL is "${url}", not a public https address.`;
  return null;
}

/** One copy to the admin's own address, marked [TEST]. Records nothing. */
export async function sendLaunchTest(which: LaunchWhich, to: string, name = ''): Promise<void> {
  const mail = render(which, name);
  await createTransporter().sendMail({ from: from(), to, subject: `[TEST] ${mail.subject}`, html: mail.html });
}

export interface BatchResult { sent: number; failed: number; remaining: number }

/** Sends the next batch to people who haven't had this email. Call again until remaining is 0. */
export async function sendLaunchBatch(which: LaunchWhich, limit = MAX_BATCH): Promise<BatchResult> {
  const audience = await launchAudience(which);
  const batch = audience.eligible.slice(0, Math.min(limit, MAX_BATCH));
  const transporter = createTransporter();
  const appUrl = getAppUrl();
  let sent = 0, failed = 0;

  for (const u of batch) {
    // Claim first: the unique (userId, key) row stops a double click or parallel run double-sending.
    try { await prisma.lifecycleEmail.create({ data: { userId: u.id, key: launchKey(which) } }); } catch { continue; }
    try {
      const unsub = unsubscribeUrl(appUrl, u.id);
      const mail = render(which, u.name ?? '', unsub, u.claimed);
      await transporter.sendMail({
        from: from(), to: u.email, subject: mail.subject, html: mail.html,
        headers: { 'List-Unsubscribe': `<${unsub}>, <mailto:info@runvax.com?subject=Unsubscribe>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      });
      sent++;
    } catch (e) {
      failed++;
      console.error('[launch-campaign] send failed', which, u.email, e);
      await prisma.lifecycleEmail.deleteMany({ where: { userId: u.id, key: launchKey(which) } }).catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 500)); // stay under SMTP provider rate limits
  }
  return { sent, failed, remaining: Math.max(0, audience.eligible.length - batch.length) + failed };
}
