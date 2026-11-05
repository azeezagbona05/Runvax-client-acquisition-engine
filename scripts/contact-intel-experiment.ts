/**
 * Contact-intelligence experiment: run the free discovery on a SMALL set of businesses and measure what it finds,
 * before spending anything on the rest.
 *
 *   npx ts-node -r tsconfig-paths/register --compiler-options '{"module":"CommonJS"}' \
 *     scripts/contact-intel-experiment.ts --file leads.csv --limit 20 [--no-search] [--out report.csv]
 *
 * Input: a CSV with at least `name` and `website` columns (the Lead Lists "Export CSV" button writes one; `address`
 * and `category` are used when present). Output: a CSV with one row per business, EMPTY REVIEW COLUMNS for the manual
 * quality check, and a summary printed at the end.
 *
 * It uses only free sources (the business's own website, and public search unless --no-search). Nothing here
 * spends Snov, Hunter or Apollo credits, and nothing is written to the database.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { config } from 'dotenv';
import { findDecisionMakers } from '../src/lib/dmFinder';
import { parseCsv, toCsv } from '../src/lib/acqFinder';
import { classifyEmail, titleRank } from '../src/lib/decisionMaker';

config({ path: '.env.local' });
config();

const args = process.argv.slice(2);
const flag = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };

async function main() {
  const file = flag('--file');
  if (!file) { console.error('Usage: --file leads.csv [--limit 20] [--no-search] [--out report.csv]'); process.exit(1); }
  const limit = Math.max(1, Number(flag('--limit') ?? 20));
  const skipSearch = args.includes('--no-search');
  const out = flag('--out') ?? 'contact-intel-report.csv';

  const [head, ...rows] = parseCsv(readFileSync(file, 'utf8'));
  const col = (n: string) => head.findIndex((h) => h.trim().toLowerCase() === n);
  const [iName, iSite, iAddr, iCat] = ['name', 'website', 'address', 'category'].map(col);
  if (iName < 0 || iSite < 0) { console.error('The CSV needs "name" and "website" columns.'); process.exit(1); }
  const todo = rows.filter((r) => r[iSite]?.trim()).slice(0, limit);
  console.log(`Running ${todo.length} businesses (${skipSearch ? 'website only' : 'website + public search'}) …`);

  const report: unknown[][] = [['business', 'website', 'ms', 'pages_read', 'people', 'relevant_title_people', 'people_with_direct_email', 'general_emails', 'contact_form', 'phones', 'best_person', 'best_title', 'best_email', 'source_page', 'review_correct_person (y/n)', 'review_email_belongs_to_them (y/n)', 'review_notes']];
  const tot = { n: 0, people: 0, relevant: 0, direct: 0, general: 0, form: 0, phone: 0, none: 0, ms: 0 };

  for (const r of todo) {
    const t0 = Date.now();
    const res = await findDecisionMakers({ businessName: r[iName], city: (r[iAddr] ?? '').split(',')[1]?.trim() ?? '', website: r[iSite], category: iCat >= 0 ? r[iCat] : undefined }, { deep: false, skipSearch });
    const ms = Date.now() - t0;
    const relevant = res.candidates.filter((c) => titleRank(c.title) >= 0 && titleRank(c.title) <= 5);
    const direct = res.candidates.filter((c) => c.email && classifyEmail(c.email) !== 'generic');
    const general = res.channels.filter((c) => c.type === 'general_email');
    const form = res.channels.some((c) => c.type === 'contact_form');
    const phones = res.channels.filter((c) => c.type === 'business_phone');
    const none = res.channels.every((c) => c.type === 'none');
    const best = res.best;
    tot.n++; tot.ms += ms; tot.people += res.candidates.length ? 1 : 0; tot.relevant += relevant.length ? 1 : 0; tot.direct += direct.length ? 1 : 0;
    tot.general += general.length ? 1 : 0; tot.form += form ? 1 : 0; tot.phone += phones.length ? 1 : 0; tot.none += none ? 1 : 0;
    report.push([r[iName], r[iSite], ms, res.pagesRead.length, res.candidates.length, relevant.length, direct.length, general.map((g) => g.value).join(' | '), form ? 'yes' : '', phones.map((p) => p.value).join(' | '), best?.name ?? '', best?.title ?? '', best?.email ?? '', best?.sourcePage ?? '', '', '', '']);
    console.log(`${String(tot.n).padStart(2)}. ${r[iName].slice(0, 38).padEnd(38)} ${String(ms).padStart(5)}ms  people ${res.candidates.length}  direct ${direct.length}  general ${general.length}  form ${form ? 'y' : '-'}`);
  }

  writeFileSync(out, toCsv(report));
  const pct = (x: number) => `${x}/${tot.n} (${Math.round((x / Math.max(1, tot.n)) * 100)}%)`;
  console.log(`\nSummary for ${tot.n} businesses\n  A person identified:        ${pct(tot.people)}\n  With a decision-level title: ${pct(tot.relevant)}\n  Direct professional email:   ${pct(tot.direct)}\n  General business email:      ${pct(tot.general)}\n  Contact form:                ${pct(tot.form)}\n  Public phone:                ${pct(tot.phone)}\n  Nothing usable found:        ${pct(tot.none)}\n  Average time per business:   ${Math.round(tot.ms / Math.max(1, tot.n))} ms\n  Paid credits spent:          0 (free sources only)\n\nReport written to ${out}. Fill in the review columns, then compare.`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
