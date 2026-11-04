import { prisma } from '@/lib/prisma';
import {
  createTransporter, launchCampaignEmailHtml, launchCountdownEmailHtml, LAUNCH_EMAIL_1_SUBJECT, launchEmail2Subject,
} from '@/lib/email';
import { getAppUrl, getAppName } from '@/lib/url';
import { trialOfferLastDayLabel, daysUntilLaunch } from '@/lib/promo';
import { unsubscribeUrl } from '@/lib/unsubscribe';
import { emailConfigured } from '@/lib/lifecycleRunner';

/**
 * The two launch emails (offer, then countdown), sent from the admin dashboard.
 *
 * "Who already got it" lives in the LifecycleEmail table (key launch_1 / launch_2), so a send
 * can be resumed in batches, never double-sends, and the dashboard always shows true counts.
 * People who unsubscribed (key 'optout') and suspended accounts are skipped.
 */

export type LaunchWhich = 1 | 2;
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
  eligible: Array<{ id: string; email: string; name: string | null; verified: boolean }>;
}

export async function launchAudience(which: LaunchWhich): Promise<Audience> {
  const users = await prisma.user.findMany({
    where: { isSuspended: false, email: { not: null } },
    select: { id: true, email: true, name: true, emailVerified: true },
    orderBy: { createdAt: 'asc' },
  });
  const rows = await prisma.lifecycleEmail.findMany({
    where: { key: { in: [launchKey(which), 'optout'] } },
    select: { userId: true, key: true },
  });
  // Email 2 reminds people to claim the offer, so it skips anyone who already has (a trial, or a paid plan).
  const claimed = which === 2
    ? new Set((await prisma.payment.findMany({
        where: { OR: [{ reference: { startsWith: 'trial_' } }, { amount: { gt: 0 }, status: 'success' }] },
        select: { userId: true },
      })).map((p) => p.userId))
    : new Set<string>();
  const sent = new Set(rows.filter((r) => r.key === launchKey(which)).map((r) => r.userId));
  const out = new Set(rows.filter((r) => r.key === 'optout').map((r) => r.userId));

  const seen = new Set<string>();
  const eligible: Audience['eligible'] = [];
  let optedOut = 0, alreadySent = 0, alreadyClaimed = 0;
  for (const u of users) {
    const email = u.email!.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || seen.has(email)) continue;
    seen.add(email);
    if (out.has(u.id)) { optedOut++; continue; }
    if (sent.has(u.id)) { alreadySent++; continue; }
    if (claimed.has(u.id)) { alreadyClaimed++; continue; }
    eligible.push({ id: u.id, email, name: u.name, verified: !!u.emailVerified });
  }
  return {
    total: seen.size,
    verified: users.filter((u) => u.emailVerified).length,
    unverified: users.filter((u) => !u.emailVerified).length,
    optedOut, alreadySent, alreadyClaimed, eligible,
  };
}

function render(which: LaunchWhich, name: string, unsub?: string) {
  const appUrl = getAppUrl(), appName = getAppName(), claimBy = trialOfferLastDayLabel();
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
      const mail = render(which, u.name ?? '', unsub);
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
