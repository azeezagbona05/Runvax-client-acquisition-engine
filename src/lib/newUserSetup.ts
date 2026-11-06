import { prisma } from '@/lib/prisma';
import { getAppUrl, getAppName } from '@/lib/url';
import { createTransporter, newUserRegisteredEmailHtml } from '@/lib/email';
import { welcomeEmail } from '@/lib/lifecycleEmails';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

/**
 * Everything the password sign-up route does after creating a user, for accounts created through
 * Google. Google has already verified the address, so the welcome email carries no verify link.
 * Every step is best-effort: signing in must never fail because an email did.
 */
export async function onGoogleUserCreated(user: { id: string; email?: string | null; name?: string | null }) {
  const email = user.email;
  if (!email) return;
  const name = user.name || email.split('@')[0];
  const appUrl = getAppUrl();
  const appName = getAppName();

  // Signing in with Google is the consent moment; the sign-in pages show the Terms/Privacy notice.
  await prisma.user.update({ where: { id: user.id }, data: { termsAcceptedAt: new Date() } }).catch(() => {});

  try {
    const welcome = welcomeEmail({ name, appUrl, appName });
    await createTransporter().sendMail({
      from: `"${appName}" <${process.env.SMTP_FROM}>`,
      to: email,
      subject: welcome.subject,
      html: welcome.html,
    });
    await prisma.lifecycleEmail.create({ data: { userId: user.id, key: 'welcome' } }).catch(() => {});
  } catch (err) {
    // Non-critical, but log it: a silent failure here means new users never get the email.
    console.error('[newUserSetup] welcome email failed for', email, err instanceof Error ? err.message : err);
  }

  if (ADMIN_EMAILS.length > 0) {
    try {
      const totalUsers = await prisma.user.count();
      await createTransporter().sendMail({
        from: `"${appName}" <${process.env.SMTP_FROM}>`,
        to: ADMIN_EMAILS.join(', '),
        subject: `New user registered (Google) — ${totalUsers} total users`,
        html: newUserRegisteredEmailHtml(name, email, totalUsers, appUrl, appName),
      });
    } catch (err) {
      console.error('[newUserSetup] admin notification failed', err instanceof Error ? err.message : err);
    }
  }
}
