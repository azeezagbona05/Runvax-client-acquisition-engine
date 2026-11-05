/**
 * Snov.io trial: try your keys without touching the app or the database.
 *
 *   SNOV_CLIENT_ID=... SNOV_CLIENT_SECRET=... \
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/snov-trial.ts --check
 *   ... scripts/snov-trial.ts --find "Ada Okafor" --domain example-clinic.com     # Email Finder: 1 credit if an address is found
 *   ... scripts/snov-trial.ts --verify someone@example.com                         # Email Verifier
 *
 * --check only signs in and costs no credits. --find and --verify spend credits on your
 * Snov.io plan, so they only run when you pass them. Keys are read from .env.local / .env
 * or the shell; a value already in the shell wins.
 */
import { config } from 'dotenv';
import { findEmail, snovEnabled, verifyEmail } from '../src/lib/snov';

config({ path: '.env.local' });
config();

const args = process.argv.slice(2);
const flag = (name: string) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

async function main() {
  if (!snovEnabled()) { console.error('Set SNOV_CLIENT_ID and SNOV_CLIENT_SECRET first (app.snov.io/account/api).'); process.exit(1); }

  const name = flag('--find'); const domain = flag('--domain'); const email = flag('--verify');
  if (name) {
    if (!domain) { console.error('--find needs --domain.'); process.exit(1); }
    console.log(`Looking for ${name} at ${domain} …`);
    console.log(await findEmail(domain, name) ?? 'No address found (nothing charged).');
  } else if (email) {
    console.log(`Verifying ${email} …`);
    console.log(await verifyEmail(email) ?? 'No answer from Snov.io in time.');
  } else {
    // --check (or no flag): sign in only.
    const res = await fetch('https://api.snov.io/v1/oauth/access_token', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'client_credentials', client_id: process.env.SNOV_CLIENT_ID, client_secret: process.env.SNOV_CLIENT_SECRET }),
    });
    console.log(res.ok ? 'Signed in to Snov.io. Keys work. No credits used.' : `Sign-in failed (${res.status}). Check the id and secret.`);
    process.exit(res.ok ? 0 : 1);
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
