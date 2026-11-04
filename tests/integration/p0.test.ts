/**
 * P0 hardening on a REAL disposable MySQL: unique-key behaviour of the keyed
 * suppression upgrade, and erasure completeness scanned across every table.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { addSuppression, findSuppressionHits } from '@/lib/acquisition/suppression';
import { eraseContacts } from '@/lib/acquisition/contacts';
import { previewImport, commitImport } from '@/lib/acquisition/imports/service';
import { drainAcqTasks } from '@/lib/acquisition/tasks/queue';
import { __setResearchDeps } from '@/lib/acquisition/research/handlers';
import { fakeDeps, CRAWLER_ENV } from '../helpers/fakeWeb';
import { S2, allResponses } from '../fixtures/sites';

const USER = 'u_integration_p0';
const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? Number(x) : x));

beforeAll(async () => {
  for (const t of ['AcquisitionAgentRun', 'AcquisitionTask', 'AcquisitionRecommendation', 'AcquisitionScore', 'AcquisitionFinding', 'AcquisitionSignal', 'AcquisitionDecisionMaker', 'AcquisitionIdentity', 'AcquisitionSource', 'AcquisitionPipelineEvent', 'AcquisitionProspect', 'AcquisitionImportBatch', 'AcquisitionPageCache', 'AcquisitionSuppression', 'AcquisitionProviderUsage']) {
    await prisma.$executeRawUnsafe(`DELETE FROM \`${t}\` WHERE ${t === 'AcquisitionProviderUsage' ? '1=1' : `userId = '${USER}'`}`);
  }
  await prisma.$executeRawUnsafe('DELETE FROM `Prospect` WHERE userId = ?', USER);
  await prisma.$executeRawUnsafe('DELETE FROM `User` WHERE id = ?', USER);
  await prisma.user.create({ data: { id: USER, email: 'p0@integration.test', plan: 'agency' } });
  process.env.INDUSTRY_ACQUISITION_ENABLED = 'true';
  Object.assign(process.env, CRAWLER_ENV);
});
afterAll(async () => { __setResearchDeps(null); await prisma.$disconnect(); });

describe('real MySQL — P0', () => {
  it('keyed hashes are stored; a legacy row is upgraded, and a conflicting legacy duplicate is removed', async () => {
    await addSuppression({ userId: USER, kind: 'phone', value: '0803 123 4567', reason: 'opt_out', source: 't' });
    const row = await prisma.acquisitionSuppression.findFirst({ where: { userId: USER, kind: 'phone' } });
    expect(row?.valueHash.startsWith('hmac:kt:')).toBe(true);
    const sha = crypto.createHash('sha256').update('phone:2348031234567').digest('hex');
    await prisma.acquisitionSuppression.create({ data: { userId: USER, kind: 'phone', valueHash: sha, reason: 'erasure', source: 'legacy' } });
    process.env.IA_SUPPRESSION_LEGACY_MATCH = 'true';
    expect((await findSuppressionHits(USER, { phone: '08031234567' })).length).toBeGreaterThan(0);
    delete process.env.IA_SUPPRESSION_LEGACY_MATCH;
    expect(await prisma.acquisitionSuppression.count({ where: { userId: USER, kind: 'phone' } })).toBe(1);
  });

  it('erasure leaves no erased value in any table', async () => {
    const { deps } = fakeDeps({ responses: allResponses() });
    __setResearchDeps({ fetchDeps: deps });
    const p = await previewImport({ userId: USER, industryKey: 'dental', kind: 'csv', csvText: `business_name,source,website,phone,email\nCoral Teeth Clinic,fixture,https://${S2.domain},0800 000 0202,reception@${S2.domain}` });
    await commitImport({ userId: USER, batchId: p.batchId, attestedBy: 'a', attest: true });
    for (let i = 0; i < 6; i++) { const r = await drainAcqTasks({ budget: 50 }); if (r.claimed === 0) break; }
    const acq = await prisma.acquisitionProspect.findFirst({ where: { userId: USER } });
    await eraseContacts({ userId: USER, acqProspectId: acq!.id, reason: 'erasure', actor: 'admin', domain: S2.domain });
    // Every table that carries a userId, restricted to this account (erasure is per account), plus tables without one.
    // (lower-cased: with lower_case_table_names=2 the two views can differ in case)
    const withUser = new Set((await prisma.$queryRawUnsafe<Array<{ t: string }>>("SELECT TABLE_NAME AS t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'userId'")).map((r) => r.t.toLowerCase()));
    const tables = (await prisma.$queryRawUnsafe<Array<{ t: string }>>('SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()')).map((r) => r.t);
    let dump = '';
    for (const t of tables) {
      dump += json(withUser.has(t.toLowerCase())
        ? await prisma.$queryRawUnsafe(`SELECT * FROM \`${t}\` WHERE userId = ?`, USER)
        : t.toLowerCase() === 'user' ? [] : await prisma.$queryRawUnsafe(`SELECT * FROM \`${t}\``));
    }
    for (const v of ['0800 000 0202', '08000000202', '2348000000202', `reception@${S2.domain}`]) expect(dump).not.toContain(v);
  });
});
