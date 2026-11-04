/**
 * Sends every new-user workflow email to ONE address so you can review them in a real inbox.
 * No database access, nothing is recorded.
 *
 *   npx tsx scripts/preview-lifecycle-emails.ts you@example.com [Name]
 */
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

const APP_URL = process.env.CAMPAIGN_APP_URL || 'https://runvax.com';
process.env.NEXTAUTH_URL = APP_URL; // email.ts builds the logo URL from this
process.env.APP_NAME = 'Runvax';

async function main() {
  const to = process.argv[2];
  const name = process.argv[3] ?? '';
  if (!to) { console.error('usage: preview-lifecycle-emails.ts you@example.com [Name]'); process.exit(1); }

  const { createTransporter } = await import('../src/lib/email');
  const { renderStep, welcomeEmail, trialStartedEmail } = await import('../src/lib/lifecycleEmails');
  const { STEP_ORDER } = await import('../src/lib/lifecycle');
  const { unsubscribeUrl } = await import('../src/lib/unsubscribe');

  const ctx = { name, appUrl: APP_URL, appName: 'Runvax' };
  const verifyUrl = `${APP_URL}/api/auth/verify-email?token=PREVIEW-ONLY`;
  const unsub = unsubscribeUrl(APP_URL, 'preview-user');
  const from = `"Runvax" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`;
  const transporter = createTransporter();

  // In the order a new user would meet them.
  const order = ['welcome', 'verify_1', 'verify_2', 'trial_started', 'first_search', 'research_outreach', 'pipeline', 'reengage', 'feedback', 'trial_ending_soon', 'trial_ends_today', 'post_expiry'];
  let n = 0;
  for (const key of order) {
    n++;
    const mail = key === 'welcome'
      ? welcomeEmail({ ...ctx, verifyUrl })
      : key === 'trial_started'
      ? trialStartedEmail({ ...ctx, endsLabel: 'Saturday, 12 December 2026' })
      : renderStep(key as (typeof STEP_ORDER)[number], { ...ctx, verifyUrl, unsubscribeUrl: unsub });
    await transporter.sendMail({ from, to, subject: `[${n}/${order.length} ${key}] ${mail.subject}`, html: mail.html });
    console.log(`sent ${n}/${order.length}: ${key}`);
    await new Promise((r) => setTimeout(r, 800));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
