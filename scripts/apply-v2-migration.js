// Applies ONLY the Client Acquisition (RUNVAX 2.0) migrations, using the same database driver as the app:
//   5_outreach_campaigns   -> new tables OutreachCampaign, OutreachLead
//   6_acquisition_pipeline -> new tables CampaignReply, CampaignLog + 7 new columns on OutreachLead
//   7_campaign_templates   -> new table CampaignTemplate
//   9_email_credits        -> new tables EmailWallet, EmailCreditLedger
//   8_integration_connections -> new table IntegrationConnection
//   10_whatsapp_campaigns  -> new table LeadWhatsApp
//   11_custom_agents       -> new tables CustomAgent, CustomAgentPost, CustomAgentChat
// Additive only. Each migration is skipped if it is already applied, so it is safe to run twice.
// It never touches migrations 1-4 or any RUNVAX 1.0 table. Pass --yes to skip the confirmation prompt.
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
require(path.join(root, 'node_modules/dotenv')).config({ path: path.join(root, '.env') });
const { PrismaClient } = require(path.join(root, 'node_modules/@prisma/client'));

const MIGRATIONS = [
  { dir: '5_outreach_campaigns', tables: ['OutreachCampaign', 'OutreachLead'], columns: [] },
  { dir: '6_acquisition_pipeline', tables: ['CampaignReply', 'CampaignLog'], columns: ['replyClass', 'pausedUntil', 'stage', 'demoAt', 'closedAt', 'dealValue', 'ownerNotifiedAt'] },
  { dir: '7_campaign_templates', tables: ['CampaignTemplate'], columns: [] },
  { dir: '8_integration_connections', tables: ['IntegrationConnection'], columns: [] },
  { dir: '10_whatsapp_campaigns', tables: ['LeadWhatsApp'], columns: [] },
  { dir: '9_email_credits', tables: ['EmailWallet', 'EmailCreditLedger'], columns: [] },
  { dir: '11_custom_agents', tables: ['CustomAgent', 'CustomAgentPost', 'CustomAgentChat'], columns: [] },
];

(async () => {
  const db = new PrismaClient();
  try {
    const [{ name }] = await db.$queryRawUnsafe('SELECT DATABASE() AS name');
    console.log(`Database: ${name}`);
    const tablesNow = async () => (await db.$queryRawUnsafe('SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE()')).map((r) => r.t || r.TABLE_NAME);
    const colsNow = async () => (await db.$queryRawUnsafe("SELECT column_name AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'OutreachLead'")).map((r) => r.c || r.COLUMN_NAME);

    const pending = [];
    for (const m of MIGRATIONS) {
      const tables = await tablesNow();
      const cols = m.columns.length ? await colsNow() : [];
      const haveT = m.tables.filter((t) => tables.includes(t)).length;
      const haveC = m.columns.filter((c) => cols.includes(c)).length;
      const total = m.tables.length + m.columns.length;
      if (haveT + haveC === total) { console.log(`${m.dir}: already applied.`); continue; }
      if (haveT + haveC > 0) { console.error(`${m.dir}: partly applied (${haveT + haveC} of ${total} objects exist). Stopping so nothing is changed by guesswork.`); process.exit(1); }
      // Migration 6 builds on migration 5's tables.
      if (m.dir.startsWith('6_') && !(await tablesNow()).includes('OutreachLead')) { console.error('6_acquisition_pipeline needs migration 5 first.'); process.exit(1); }
      pending.push(m);
      // Dry-run the ordering: migration 5 must run before the check for 6 can see its tables, so apply as we go.
      if (!process.argv.includes('--yes')) {
        const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
        const what = [...m.tables.map((t) => `table ${t}`), ...m.columns.map((c) => `column OutreachLead.${c}`)].join(', ');
        const ans = await new Promise((r) => rl.question(`Apply ${m.dir} to '${name}' (adds ${what})? Type YES: `, r));
        rl.close();
        if (ans.trim() !== 'YES') { console.log('Cancelled.'); process.exit(1); }
      }
      const sql = fs.readFileSync(path.join(root, 'prisma/migrations', m.dir, 'migration.sql'), 'utf8');
      const statements = sql.split(/;\s*\n/).map((s) => s.replace(/^\s*--.*$/gm, '').trim()).filter(Boolean);
      for (const s of statements) { await db.$executeRawUnsafe(s); console.log('ok:', s.split('\n')[0].slice(0, 70)); }
      console.log(`${m.dir}: applied.`);
    }
    if (!pending.length) console.log('Nothing to do.');
  } finally { await db.$disconnect(); }
})().catch((e) => { console.error('FAILED:', e.message.split('\n').filter(Boolean).slice(-2).join(' ')); process.exit(1); });
