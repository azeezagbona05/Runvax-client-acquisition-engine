/**
 * Writes the RUNVAX 2.0 invitation email to local HTML files so it can be read in a browser. Sends nothing and reads no database.
 *   npx tsx scripts/preview-v2-invite.ts <output folder>
 */
import fs from 'node:fs';
import path from 'node:path';

process.env.NEXTAUTH_URL = 'https://runvax.com';
process.env.APP_NAME = 'Runvax';

async function main() {
  const out = process.argv[2];
  if (!out) throw new Error('Usage: npx tsx scripts/preview-v2-invite.ts <output folder>');
  fs.mkdirSync(out, { recursive: true });
  const { v2InviteEmailHtml, v2InviteSubject } = await import('../src/lib/email');
  const { trialOfferLastDayLabel, trialOfferHasDeadline } = await import('../src/lib/promo');
  for (const trialAvailable of [true, false]) {
    const file = path.join(out, trialAvailable ? 'invite-with-trial.html' : 'invite-no-trial.html');
    fs.writeFileSync(file, v2InviteEmailHtml('Tunde Bakare', 'https://runvax.com', 'Runvax', { trialAvailable, claimBy: trialOfferHasDeadline() ? trialOfferLastDayLabel() : null }, 'https://runvax.com/unsubscribe'));
    console.log(`${file}\n   subject: ${v2InviteSubject(trialAvailable)}`);
  }
}
void main();
