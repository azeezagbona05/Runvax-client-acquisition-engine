import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/requireUser';
import { prisma } from '@/lib/prisma';
import { TRIAL_DAYS, TRIAL_PLAN, trialOfferOpen } from '@/lib/promo';
import { createTransporter } from '@/lib/email';
import { trialStartedEmail } from '@/lib/lifecycleEmails';
import { getAppUrl, getAppName } from '@/lib/url';

export const dynamic = 'force-dynamic';

/**
 * POST — start the free Pro trial: Pro for TRIAL_DAYS days, $0, no card.
 * A real plan change; the expire-plans cron returns the account to Free afterwards.
 * One trial per account: it is recorded as a $0 Payment with a fixed per-user reference,
 * and the unique constraint on that reference makes a double claim impossible even under
 * a race.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  if (!trialOfferOpen()) return NextResponse.json({ error: 'The free Pro trial offer has ended' }, { status: 410 });

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { plan: true, emailVerified: true, isSuspended: true },
  });
  if (!user || user.isSuspended) return NextResponse.json({ error: 'Account unavailable' }, { status: 403 });
  if (!user.emailVerified) return NextResponse.json({ error: 'Verify your email first, then start your trial', code: 'EMAIL_UNVERIFIED' }, { status: 403 });
  if (user.plan !== 'free') return NextResponse.json({ error: 'You are already on a paid plan' }, { status: 409 });

  const expiresAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  try {
    await prisma.$transaction([
      prisma.payment.create({
        data: { userId: auth.userId, reference: `trial_${auth.userId}`, plan: TRIAL_PLAN, amount: 0, status: 'trial' },
      }),
      prisma.user.update({
        where: { id: auth.userId },
        data: { plan: TRIAL_PLAN, planExpiresAt: expiresAt, expiryReminderSentAt: null },
      }),
    ]);
  } catch (e) {
    // Unique violation on the reference = this account already used its trial.
    if ((e as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'You have already used your free trial', code: 'TRIAL_USED' }, { status: 409 });
    }
    console.error('[/api/trial/start]', e);
    return NextResponse.json({ error: 'Could not start the trial — try again' }, { status: 500 });
  }

  // Confirmation email. Best effort: never fails or delays the claim itself.
  void (async () => {
    try {
      if (!process.env.SMTP_HOST && !process.env.RESEND_API_KEY) return;
      const u = await prisma.user.findUnique({ where: { id: auth.userId }, select: { email: true, name: true } });
      if (!u?.email) return;
      const appName = getAppName();
      const mail = trialStartedEmail({
        name: u.name ?? '', appUrl: getAppUrl(), appName,
        endsLabel: new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos' }).format(expiresAt),
      });
      await createTransporter().sendMail({ from: `"${appName}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`, to: u.email, subject: mail.subject, html: mail.html });
      await prisma.lifecycleEmail.create({ data: { userId: auth.userId, key: 'trial_started' } }).catch(() => {});
    } catch (e) { console.error('[/api/trial/start] confirmation email failed', e); }
  })();

  return NextResponse.json({ ok: true, plan: TRIAL_PLAN, expiresAt: expiresAt.toISOString() });
}
