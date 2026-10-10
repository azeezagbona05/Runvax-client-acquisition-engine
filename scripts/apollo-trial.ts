/**
 * Apollo coverage trial — read-only. Answers: for businesses RUNVAX users have
 * actually saved, does Apollo know a decision-maker? Nothing is written to the
 * database or to any prospect.
 *
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/apollo-trial.ts            # dry run: lists who would be tested
 *   APOLLO_API_KEY=... npx ts-node ... scripts/apollo-trial.ts --run [--limit 50]
 *
 * Endpoints/params follow Apollo's public docs as last known; confirm against
 * https://docs.apollo.io before trusting results. The people *search* step is
 * used for coverage only (names + titles) — no email reveal, so it should not
 * spend email credits. Check your plan's credit rules before running.
 */
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

config({ path: '.env.local' });
config();

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const RUN = args.includes('--run');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) || 50 : 50;

const DECISION_TITLES = ['owner', 'founder', 'ceo', 'managing director', 'director', 'general manager', 'head of operations', 'operations manager'];

function domainOf(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch { return null; }
}

interface Candidate { id: string; name: string; domain: string; hadEmail: boolean }

async function loadCandidates(): Promise<Candidate[]> {
  const rows = await prisma.prospect.findMany({
    orderBy: { savedAt: 'desc' },
    take: 2000,
    select: { id: true, businessName: true, businessData: true },
  });
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const b = r.businessData as { website?: string; email?: string };
    const domain = domainOf(b?.website);
    if (!domain || seen.has(domain)) continue;
    if (/(facebook|instagram|linktr|wa\.me|wixsite|business\.site)/.test(domain)) continue; // not a company domain
    seen.add(domain);
    out.push({ id: r.id, name: r.businessName, domain, hadEmail: !!b.email });
    if (out.length >= LIMIT) break;
  }
  return out;
}

async function apolloPeople(domain: string, key: string) {
  const res = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'Cache-Control': 'no-cache' },
    body: JSON.stringify({ q_organization_domains: domain, person_titles: DECISION_TITLES, page: 1, per_page: 3 }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const json = await res.json() as { people?: Array<{ name?: string; title?: string }> };
  return json.people ?? [];
}

async function main() {
  const candidates = await loadCandidates();
  console.log(`${candidates.length} saved prospects with their own website domain (limit ${LIMIT}).`);
  console.log(`${candidates.filter((c) => !c.hadEmail).length} of them have no email on file — Apollo's real upside.\n`);

  if (!RUN) {
    candidates.forEach((c) => console.log(`  ${c.domain.padEnd(36)} ${c.name}`));
    console.log('\nDry run only. Re-run with APOLLO_API_KEY set and --run to query Apollo.');
    return;
  }

  const key = process.env.APOLLO_API_KEY;
  if (!key) throw new Error('APOLLO_API_KEY is not set');

  let found = 0, errors = 0, foundNoEmail = 0;
  for (const c of candidates) {
    try {
      const people = await apolloPeople(c.domain, key);
      if (people.length) {
        found++;
        if (!c.hadEmail) foundNoEmail++;
        console.log(`✓ ${c.name} (${c.domain}) → ${people[0].name} — ${people[0].title}`);
      } else {
        console.log(`· ${c.name} (${c.domain}) → nothing`);
      }
    } catch (e) {
      errors++;
      console.log(`✗ ${c.name} (${c.domain}) → ${e instanceof Error ? e.message : e}`);
    }
    await new Promise((r) => setTimeout(r, 400)); // stay well under rate limits
  }

  const tested = candidates.length - errors;
  const pct = (n: number) => (tested ? Math.round((n / tested) * 100) : 0);
  console.log(`\nDecision-maker found: ${found}/${tested} (${pct(found)}%)`);
  console.log(`…of which had no email on file: ${foundNoEmail}`);
  console.log(`Errors: ${errors}`);
  console.log(pct(found) >= 20 ? 'Verdict: worth building the integration.' : 'Verdict: coverage too thin — skip Apollo for this market.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
