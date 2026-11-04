import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { createTransporter } from '@/lib/email';
import { getAppUrl, getAppName } from '@/lib/url';
import { nextStep, lifecycleStartsAt, TRANSACTIONAL, type Snapshot, type StepKey } from '@/lib/lifecycle';
import { renderStep } from '@/lib/lifecycleEmails';
import { unsubscribeUrl } from '@/lib/unsubscribe';

/**
 * Runs the new-user email workflow once. Used by the daily cron AND the admin dashboard button,
 * so there is one implementation. Safe at any frequency: each step is claimed in the
 * LifecycleEmail table before sending, so nobody ever gets the same email twice.
 * See src/lib/lifecycle.ts for the rules.
 */

const MAX_USERS_PER_RUN = 400;
const WINDOW_DAYS = 45; // the sequence plus the post-trial tail is shorter than this

export interface LifecycleRunResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  dryRun: boolean;
  considered: number;
  /** Emails sent (or, in a dry run, that would be sent), by step. */
  sent: Record<string, number>;
  failed: number;
  at: string;
}

async function issueVerifyUrl(userId: string, appUrl: string): Promise<string> {
  await prisma.emailVerificationToken.deleteMany({ where: { userId } });
  const token = crypto.randomBytes(32).toString('hex');
  await prisma.emailVerificationToken.create({ data: { userId, token, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
  return `${appUrl}/api/auth/verify-email?token=${token}`;
}

export function emailConfigured(): boolean {
  return !!process.env.SMTP_HOST || !!process.env.RESEND_API_KEY;
}

export async function runLifecycle(opts: { dryRun?: boolean; now?: Date } = {}): Promise<LifecycleRunResult> {
  const dryRun = !!opts.dryRun;
  const now = opts.now ?? new Date();
  const base = { dryRun, considered: 0, sent: {} as Record<string, number>, failed: 0, at: now.toISOString() };

  if (!dryRun && !emailConfigured()) return { ok: false, skipped: true, reason: 'Email is not configured', ...base };

  const since = new Date(Math.max(lifecycleStartsAt().getTime(), now.getTime() - WINDOW_DAYS * 86_400_000));
  const appUrl = getAppUrl();
  const appName = getAppName();

  let users, searched, prospects, outreach, payments, sentRows;
  try {
    users = await prisma.user.findMany({
      where: { createdAt: { gte: since }, isSuspended: false, email: { not: null } },
      select: { id: true, email: true, name: true, createdAt: true, emailVerified: true, plan: true, planExpiresAt: true },
      orderBy: { createdAt: 'asc' },
      take: MAX_USERS_PER_RUN,
    });
    const ids = users.map((u) => u.id);
    [searched, prospects, outreach, payments, sentRows] = await Promise.all([
      prisma.searchHistory.groupBy({ by: ['userId'], where: { userId: { in: ids } }, _count: { _all: true } }),
      prisma.prospect.groupBy({ by: ['userId'], where: { userId: { in: ids } }, _count: { _all: true } }),
      prisma.prospect.groupBy({ by: ['userId'], where: { userId: { in: ids }, outreachSentAt: { not: null } }, _count: { _all: true } }),
      prisma.payment.findMany({ where: { userId: { in: ids } }, select: { userId: true, reference: true, amount: true, status: true, paidAt: true } }),
      prisma.lifecycleEmail.findMany({ where: { userId: { in: ids } }, select: { userId: true, key: true, sentAt: true } }),
    ]);
  } catch (e) {
    // Most likely the 4_lifecycle_emails migration has not been applied yet. Do nothing, loudly.
    console.error('[lifecycle] data load failed — has migration 4_lifecycle_emails been applied?', e);
    return { ok: false, skipped: true, reason: 'Lifecycle data unavailable. Has migration 4_lifecycle_emails been applied?', ...base };
  }

  const count = (rows: { userId: string; _count: { _all: number } }[]) => new Map(rows.map((r) => [r.userId, r._count._all]));
  const searchedBy = count(searched), prospectsBy = count(prospects), outreachBy = count(outreach);

  const transporter = dryRun ? null : createTransporter();
  const from = `"${appName}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`;
  const sent: Record<string, number> = {};
  let failed = 0;

  for (const u of users) {
    const log: Record<string, Date> = {};
    for (const r of sentRows) if (r.userId === u.id) log[r.key] = r.sentAt;
    const pay = payments.filter((p) => p.userId === u.id);
    const trial = pay.find((p) => p.reference === `trial_${u.id}`);

    const snap: Snapshot = {
      createdAt: u.createdAt,
      verifiedAt: u.emailVerified,
      plan: u.plan,
      planExpiresAt: u.planExpiresAt,
      searched: (searchedBy.get(u.id) ?? 0) > 0,
      prospectCount: prospectsBy.get(u.id) ?? 0,
      outreachStarted: (outreachBy.get(u.id) ?? 0) > 0,
      trialStartedAt: trial?.paidAt ?? null,
      paid: pay.some((p) => p.amount > 0 && p.status === 'success'),
      sent: log,
      optedOut: !!log.optout,
    };

    const step: StepKey | null = nextStep(snap, now);
    if (!step) continue;

    if (dryRun) { sent[step] = (sent[step] ?? 0) + 1; continue; }

    // Claim first: the unique (userId, key) row means a concurrent run cannot send the same email.
    try {
      await prisma.lifecycleEmail.create({ data: { userId: u.id, key: step } });
    } catch { continue; }

    try {
      const transactional = TRANSACTIONAL.has(step);
      const unsub = unsubscribeUrl(appUrl, u.id);
      const mail = renderStep(step, {
        name: u.name ?? '', appUrl, appName,
        verifyUrl: transactional ? await issueVerifyUrl(u.id, appUrl) : undefined,
        unsubscribeUrl: transactional ? undefined : unsub,
      });
      await transporter!.sendMail({
        from, to: u.email!, subject: mail.subject, html: mail.html,
        ...(transactional ? {} : {
          headers: {
            'List-Unsubscribe': `<${unsub}>, <mailto:info@runvax.com?subject=Unsubscribe>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        }),
      });
      sent[step] = (sent[step] ?? 0) + 1;
    } catch (e) {
      failed++;
      console.error('[lifecycle] send failed', step, u.email, e);
      // Release the claim so the next run retries.
      await prisma.lifecycleEmail.deleteMany({ where: { userId: u.id, key: step } }).catch(() => {});
    }
  }

  return { ok: true, dryRun, considered: users.length, sent, failed, at: now.toISOString() };
}
