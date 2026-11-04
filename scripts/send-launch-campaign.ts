/**
 * One-off launch emails: the free Pro trial offer. Two emails, three modes each:
 *
 *   --email 1   the launch offer (default)
 *   --email 2   the story-style follow-up with a countdown to November 1st (send ~2 days after #1)
 *
 *   npx tsx scripts/send-launch-campaign.ts --email 2 --test you@example.com   # one email, no database access
 *   npx tsx scripts/send-launch-campaign.ts --email 2                          # dry run: counts who WOULD get it
 *
 * Reads SMTP/Resend settings from .env.local / .env. The link and brand are pinned below so a
 * local NEXTAUTH_URL (localhost) can never end up in a customer's inbox.
 *
 * Real sends are done from Admin → Email campaigns, not here: the dashboard records every send in
 * the database, so it always knows who already received each email and never double-sends.
 */
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

const APP_URL = process.env.CAMPAIGN_APP_URL || 'https://runvax.com';
const BRAND = 'Runvax';
process.env.NEXTAUTH_URL = APP_URL; // email.ts builds the logo URL from this
process.env.APP_NAME = BRAND;

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const val = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };

const WHICH = val('--email') === '2' ? 2 : 1;

async function main() {
  const { createTransporter, launchCampaignEmailHtml, launchCountdownEmailHtml, LAUNCH_EMAIL_1_SUBJECT, launchEmail2Subject } = await import('../src/lib/email');
  const { trialOfferLastDayLabel, daysUntilLaunch } = await import('../src/lib/promo');
  const claimBy = trialOfferLastDayLabel();
  // Email 2 only: computed at send time. --days N previews what the email will say on a later day.
  const daysLeft = val('--days') !== undefined ? Number(val('--days')) : daysUntilLaunch();
  const SUBJECT = WHICH === 1 ? LAUNCH_EMAIL_1_SUBJECT : launchEmail2Subject(daysLeft);
  const render = (name: string) => WHICH === 1
    ? launchCampaignEmailHtml(name, APP_URL, BRAND, claimBy)
    : launchCountdownEmailHtml(name, APP_URL, BRAND, claimBy, daysLeft);
  const from = `"${BRAND}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`;
  const transporter = createTransporter();
  const headers = { 'List-Unsubscribe': '<mailto:info@runvax.com?subject=Unsubscribe>' };

  const sendOne = (to: string, name: string, subject = SUBJECT) =>
    transporter.sendMail({ from, to, subject, html: render(name), headers });

  const testTo = val('--test');
  if (testTo) {
    await sendOne(testTo, val('--name') ?? '', `[TEST] ${SUBJECT}`);
    console.log(`Test email ${WHICH} sent to ${testTo} (from ${from}, link ${APP_URL}, claim-by ${claimBy}${WHICH === 2 ? `, ${daysLeft} days to launch` : ''}).`);
    return;
  }

  // Dry run: read-only counts. (Per-email "will receive / already sent" numbers are on the dashboard.)
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const [all, verified] = await Promise.all([
      prisma.user.count({ where: { email: { not: null }, isSuspended: false } }),
      prisma.user.count({ where: { email: { not: null }, isSuspended: false, emailVerified: { not: null } } }),
    ]);
    console.log(`Email ${WHICH}: ${all} accounts would be eligible (${verified} verified, ${all - verified} not). Nothing sent.`);
    if (flag('--send')) { console.error('Refusing to send from the command line. Use Admin → Email campaigns.'); process.exitCode = 1; }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
