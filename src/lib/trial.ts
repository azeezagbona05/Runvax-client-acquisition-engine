import { prisma } from '@/lib/prisma';
import { TRIAL_PLAN, trialOfferOpen } from '@/lib/promo';
import { getSiteSettings } from '@/lib/siteSettings';
import { createTransporter } from '@/lib/email';
import { trialStartedEmail } from '@/lib/lifecycleEmails';
import { getAppUrl, getAppName } from '@/lib/url';

export type GrantResult =
  | { ok: true; expiresAt: Date }
  | { ok: false; code: 'OFFER_ENDED' | 'UNAVAILABLE' | 'EMAIL_UNVERIFIED' | 'ALREADY_PAID' | 'TRIAL_USED' | 'ERROR' };

/**
 * Starts the free Pro trial for one account: Pro for TRIAL_DAYS days, $0, no card. A real plan change; the
 * expire-plans cron returns the account to Free afterwards, with everything the user made left intact.
 * One trial per account: it is recorded as a $0 Payment with a fixed per-user reference, and the unique
 * constraint on that reference makes a double claim impossible even under a race. Paying customers are never touched.
 * `trustVerified` is for Google sign-ups, whose address Google has already proven.
 */
export async function grantTrial(userId: string, opts: { trustVerified?: boolean } = {}): Promise<GrantResult> {
  const site = await getSiteSettings();
  if (!site.trialOpen || !trialOfferOpen()) return { ok: false, code: 'OFFER_ENDED' };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true, emailVerified: true, isSuspended: true } });
  if (!user || user.isSuspended) return { ok: false, code: 'UNAVAILABLE' };
  if (!user.emailVerified && !opts.trustVerified) return { ok: false, code: 'EMAIL_UNVERIFIED' };
  if (user.plan !== 'free') return { ok: false, code: 'ALREADY_PAID' };

  const expiresAt = new Date(Date.now() + site.trialDays * 24 * 60 * 60 * 1000);
  try {
    await prisma.$transaction([
      prisma.payment.create({ data: { userId, reference: `trial_${userId}`, plan: TRIAL_PLAN, amount: 0, status: 'trial' } }),
      prisma.user.update({ where: { id: userId }, data: { plan: TRIAL_PLAN, planExpiresAt: expiresAt, expiryReminderSentAt: null } }),
    ]);
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') return { ok: false, code: 'TRIAL_USED' };
    console.error('[trial] grant failed', e);
    return { ok: false, code: 'ERROR' };
  }

  // Confirmation email. Best effort: never fails or delays the grant itself.
  void (async () => {
    try {
      if (!process.env.SMTP_HOST && !process.env.RESEND_API_KEY) return;
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } });
      if (!u?.email) return;
      const appName = getAppName();
      const mail = trialStartedEmail({
        name: u.name ?? '', appUrl: getAppUrl(), appName, trialDays: site.trialDays,
        endsLabel: new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' }).format(expiresAt),
      });
      await createTransporter().sendMail({ from: `"${appName}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`, to: u.email, subject: mail.subject, html: mail.html });
      await prisma.lifecycleEmail.create({ data: { userId, key: 'trial_started' } }).catch(() => {});
    } catch (e) { console.error('[trial] confirmation email failed', e); }
  })();

  return { ok: true, expiresAt };
}
