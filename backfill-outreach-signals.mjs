/**
 * Backfill the cross-user outreach tracker (OutreachSignal) from existing history.
 *
 * Without this the tracker starts empty and every badge reads "Untouched" until
 * users organically send enough messages — the feature looks broken on day one.
 * The real history is already in the database: Prospect.outreachSentAt and
 * Conversation rows of type 'sent', both keyed to stable Google Place ids.
 *
 * A prospect counts as contacted if it has an outreachSentAt OR at least one
 * 'sent' conversation. Pipeline stage alone is deliberately NOT enough — a user
 * can move a card to "contacted" after a phone call, which is not what this
 * tracker measures.
 *
 * Idempotent: uses createMany({ skipDuplicates }), so existing rows are never
 * touched and re-running can't inflate anyone's counts. Safe to run on a live
 * database, and safe to run again later.
 *
 * Run:  node --env-file=.env backfill-outreach-signals.mjs --dry-run
 *       node --env-file=.env backfill-outreach-signals.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');
const PAGE_SIZE = 500;
const INSERT_CHUNK = 1000;

// Must match isTrackableBusinessId() in src/lib/saturation.ts — locally minted
// `manual_*` ids are unique per user and can never aggregate across accounts.
function isTrackable(id) {
  return !!id && !id.startsWith('manual_');
}

async function main() {
  console.log(`\n📊 Outreach tracker backfill${DRY_RUN ? ' (DRY RUN — nothing will be written)' : ''}\n`);

  // key: `${businessId}::${userId}` — one row per business per user, matching
  // the unique constraint on OutreachSignal.
  const signals = new Map();

  let cursor;
  let scanned = 0;

  for (;;) {
    const page = await prisma.prospect.findMany({
      take: PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        userId: true,
        businessId: true,
        outreachSentAt: true,
        conversations: {
          where: { type: 'sent' },
          select: { channel: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (page.length === 0) break;
    scanned += page.length;
    cursor = page[page.length - 1].id;

    for (const p of page) {
      if (!isTrackable(p.businessId)) continue;

      const sends = p.conversations;
      if (!p.outreachSentAt && sends.length === 0) continue;

      const stamps = sends.map((c) => c.createdAt);
      if (p.outreachSentAt) stamps.push(p.outreachSentAt);

      const first = new Date(Math.min(...stamps.map((d) => d.getTime())));
      const last = new Date(Math.max(...stamps.map((d) => d.getTime())));
      // Channel of the most recent recorded send; WhatsApp is the app's default.
      const channel = sends.length ? sends[sends.length - 1].channel : 'whatsapp';

      const key = `${p.businessId}::${p.userId}`;
      const existing = signals.get(key);

      if (!existing) {
        signals.set(key, {
          businessId: p.businessId,
          userId: p.userId,
          channel,
          sendCount: Math.max(1, sends.length),
          firstSentAt: first,
          lastSentAt: last,
        });
      } else {
        // Same user saved the same business twice (rare, but the unique index on
        // Prospect is per-user so duplicates across rows are possible after merges).
        existing.sendCount += Math.max(1, sends.length);
        if (first < existing.firstSentAt) existing.firstSentAt = first;
        if (last > existing.lastSentAt) {
          existing.lastSentAt = last;
          existing.channel = channel;
        }
      }
    }

    process.stdout.write(`\r   scanned ${scanned} prospects · ${signals.size} signals found`);
  }

  console.log('\n');

  const rows = [...signals.values()];
  if (rows.length === 0) {
    console.log('   Nothing to backfill — no contacted prospects with trackable ids.\n');
    return;
  }

  // How much saturation this actually creates: businesses contacted by >1 user.
  const perBusiness = new Map();
  for (const r of rows) perBusiness.set(r.businessId, (perBusiness.get(r.businessId) ?? 0) + 1);
  const contested = [...perBusiness.values()].filter((n) => n > 1);

  console.log(`   Signals to insert:      ${rows.length}`);
  console.log(`   Distinct businesses:    ${perBusiness.size}`);
  console.log(`   Contacted by >1 user:   ${contested.length}`);
  console.log(`   Most contacted:         ${Math.max(...perBusiness.values())} users on one business\n`);

  if (DRY_RUN) {
    console.log('   Dry run — re-run without --dry-run to write.\n');
    return;
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);
    // skipDuplicates makes this safe to re-run and safe alongside live traffic:
    // any (businessId, userId) already recorded organically is left untouched.
    const res = await prisma.outreachSignal.createMany({ data: chunk, skipDuplicates: true });
    inserted += res.count;
    process.stdout.write(`\r   inserting… ${Math.min(i + INSERT_CHUNK, rows.length)}/${rows.length}`);
  }

  console.log(`\n\n✅ Inserted ${inserted} signals (${rows.length - inserted} already existed).\n`);
}

main()
  .catch((err) => {
    console.error('\n❌ Backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
