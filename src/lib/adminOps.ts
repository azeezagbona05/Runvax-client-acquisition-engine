import { prisma } from '@/lib/prisma';
import { createTransporter, planExpiringSoonHtml } from '@/lib/email';
import { getAppUrl, getAppName } from '@/lib/url';

export type AdminOpsRecommendationType = 'send_expiry_reminders' | 'review_flagged_signups';

export interface AdminOpsRecommendation {
  type: AdminOpsRecommendationType;
  label: string;
  detail: string;
  count: number;
  done: boolean;
  // Only set on review_flagged_signups — lets the admin UI pre-select exactly
  // who Argus flagged, without a server-side action ever suspending anyone.
  meta?: { userIds: string[] };
}

export interface AdminOpsBriefData {
  summary: string;
  recommendations: AdminOpsRecommendation[];
}

export interface AdminOpsActionResult {
  ok: boolean;
  message: string;
}

const EXPIRY_WINDOW_DAYS = 3;
const SUSPICIOUS_WINDOW_DAYS = 7;

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function expiringSoonWhere() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return {
    plan: { not: 'free' },
    planExpiresAt: { gte: now, lte: windowEnd },
    expiryReminderSentAt: null,
  };
}

/**
 * Pure, rule-based synthesis over data that already exists — no LLM call.
 * Mirrors atlas.ts's buildBrief, scoped to the whole platform instead of one
 * user's pipeline, since there's no admin-user model to key a per-user brief on.
 */
export async function buildAdminBrief(): Promise<AdminOpsBriefData> {
  const sevenDaysAgo = new Date(Date.now() - SUSPICIOUS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(Date.now() - SUSPICIOUS_WINDOW_DAYS * 2 * 24 * 60 * 60 * 1000);

  const [
    totalUsers, newSignups, expiringSoon, recentSignupRows, dupIpGroups,
    paymentsThisWeek, paymentsLastWeek, churnThisWeek,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: expiringSoonWhere() }),
    prisma.user.findMany({
      where: { createdAt: { gte: sevenDaysAgo }, isSuspended: false },
      select: {
        id: true, emailVerified: true, registrationIp: true,
        _count: { select: { prospects: true, searchHistory: true } },
      },
    }),
    prisma.user.groupBy({
      by: ['registrationIp'],
      where: { registrationIp: { not: null } },
      _count: { _all: true },
      having: { registrationIp: { _count: { gt: 1 } } },
    }),
    prisma.payment.aggregate({
      where: { status: 'success', paidAt: { gte: sevenDaysAgo } },
      _count: { _all: true }, _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: 'success', paidAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
      _count: { _all: true },
    }),
    prisma.adminAuditLog.count({
      where: { action: { in: ['plan_auto_expired', 'plan_downgraded_payment_failed'] }, createdAt: { gte: sevenDaysAgo } },
    }),
  ]);

  const dupIps = new Set(dupIpGroups.map((g) => g.registrationIp).filter((ip): ip is string => !!ip));
  const flaggedUserIds = recentSignupRows.filter((u) => {
    const dormant = !u.emailVerified && u._count.prospects === 0 && u._count.searchHistory === 0;
    const dupIp = !!(u.registrationIp && dupIps.has(u.registrationIp));
    return dormant || dupIp;
  }).map((u) => u.id);
  const suspiciousCount = flaggedUserIds.length;

  const paymentCount = paymentsThisWeek._count._all;
  const paymentRevenue = paymentsThisWeek._sum.amount ?? 0;
  const prevPaymentCount = paymentsLastWeek._count._all;
  const paymentGrowthPct = prevPaymentCount > 0 ? Math.round(((paymentCount - prevPaymentCount) / prevPaymentCount) * 100) : null;

  const lines: string[] = [];
  lines.push(`${totalUsers} total users, ${newSignups} new signup${newSignups === 1 ? '' : 's'} in the last ${SUSPICIOUS_WINDOW_DAYS} days.`);

  if (suspiciousCount > 0) {
    lines.push(`${suspiciousCount} of this week's signups look suspicious (unverified with no activity, or sharing a registration IP) — worth a look in the users table.`);
  }

  if (expiringSoon > 0) {
    lines.push(`${expiringSoon} paid plan${expiringSoon === 1 ? '' : 's'} expire${expiringSoon === 1 ? 's' : ''} within ${EXPIRY_WINDOW_DAYS} days.`);
  } else {
    lines.push('No paid plans expiring in the next few days.');
  }

  lines.push(
    `${paymentCount} payment${paymentCount === 1 ? '' : 's'} this week (₦${paymentRevenue.toLocaleString()})`
    + (paymentGrowthPct === null ? '.' : `, ${paymentGrowthPct >= 0 ? 'up' : 'down'} ${Math.abs(paymentGrowthPct)}% on last week.`),
  );
  if (churnThisWeek > 0) {
    lines.push(`${churnThisWeek} user${churnThisWeek === 1 ? '' : 's'} churned (downgraded) this week.`);
  }

  const recommendations: AdminOpsRecommendation[] = [];
  if (expiringSoon > 0) {
    recommendations.push({
      type: 'send_expiry_reminders',
      label: `Send ${expiringSoon} renewal reminder${expiringSoon === 1 ? '' : 's'}`,
      detail: `Email the ${expiringSoon} user${expiringSoon === 1 ? '' : 's'} whose plan expires within ${EXPIRY_WINDOW_DAYS} days, so they can renew before they're auto-downgraded.`,
      count: expiringSoon,
      done: false,
    });
  }
  if (suspiciousCount > 0) {
    recommendations.push({
      type: 'review_flagged_signups',
      label: `Review ${suspiciousCount} flagged signup${suspiciousCount === 1 ? '' : 's'}`,
      detail: 'Jump to the Users tab, filtered to suspicious signups, with these exact accounts pre-selected — nothing is suspended automatically.',
      count: suspiciousCount,
      done: false,
      meta: { userIds: flaggedUserIds },
    });
  }

  return { summary: lines.join(' '), recommendations };
}

/** Loads today's cached admin brief, generating and caching one if it doesn't exist yet. */
export async function getOrCreateTodaysAdminBrief() {
  const date = todayStr();
  const existing = await prisma.adminBrief.findUnique({ where: { date } });
  if (existing) return existing;

  const { summary, recommendations } = await buildAdminBrief();
  return prisma.adminBrief.create({
    data: { date, summary, recommendations: recommendations as unknown as object },
  });
}

async function markRecommendationDone(type: AdminOpsRecommendationType) {
  const date = todayStr();
  const brief = await prisma.adminBrief.findUnique({ where: { date } });
  if (!brief) return;
  const recs = (brief.recommendations as unknown as AdminOpsRecommendation[]).map((r) =>
    r.type === type ? { ...r, done: true } : r,
  );
  await prisma.adminBrief.update({ where: { id: brief.id }, data: { recommendations: recs as unknown as object } });
}

/**
 * Executes one recommendation on an admin's explicit click. Nothing here is
 * ever automatic — Argus only ever surfaces information; a human always
 * triggers the send.
 */
export async function runAdminOpsAction(type: AdminOpsRecommendationType, actorEmail: string): Promise<AdminOpsActionResult> {
  if (type === 'send_expiry_reminders') {
    const users = await prisma.user.findMany({
      where: expiringSoonWhere(),
      select: { id: true, email: true, name: true, plan: true, planExpiresAt: true },
    });

    if (users.length === 0) {
      await markRecommendationDone(type);
      return { ok: false, message: 'No expiring plans to remind.' };
    }

    let sent = 0;
    if (process.env.SMTP_HOST) {
      const appName = getAppName();
      const appUrl = getAppUrl();
      const transporter = createTransporter();

      for (const u of users) {
        if (!u.email || !u.planExpiresAt) continue;
        const expiryDateStr = u.planExpiresAt.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
        try {
          await transporter.sendMail({
            from: `"${appName}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
            to: u.email,
            subject: `Your ${appName} plan expires soon`,
            html: planExpiringSoonHtml(u.name ?? 'there', u.plan, expiryDateStr, appUrl, appName),
          });
          sent++;
        } catch (e) {
          console.error('[adminOps] Failed to email', u.email, e);
        }
      }
    }

    await prisma.user.updateMany({
      where: { id: { in: users.map((u) => u.id) } },
      data: { expiryReminderSentAt: new Date() },
    });
    await markRecommendationDone(type);
    await prisma.adminAuditLog.create({
      data: {
        actorEmail,
        action: 'sent_expiry_reminders',
        title: `Sent ${sent} renewal reminder${sent === 1 ? '' : 's'}`,
        detail: `${users.length} user(s) matched; ${sent} email(s) sent${process.env.SMTP_HOST ? '' : ' (SMTP not configured — skipped)'}.`,
      },
    });

    return { ok: true, message: process.env.SMTP_HOST ? `Sent ${sent} renewal reminder${sent === 1 ? '' : 's'}.` : 'SMTP not configured — reminders marked handled but not sent.' };
  }

  return { ok: false, message: 'Unknown recommendation type' };
}
