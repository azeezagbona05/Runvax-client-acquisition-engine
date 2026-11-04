/**
 * Phase 2 against a REAL (disposable, local) MySQL: proves the guarantees that
 * the in-memory fake can't — atomic budget reservation under real concurrency,
 * unique-key idempotency, and a full-database scan for Places content — and
 * produces the synthetic-run report.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import { prisma } from '@/lib/prisma';
import { reserve } from '@/lib/acquisition/budget';
import { enqueueAcqTask, drainAcqTasks } from '@/lib/acquisition/tasks/queue';
import { previewImport, commitImport } from '@/lib/acquisition/imports/service';
import { __setResearchDeps } from '@/lib/acquisition/research/handlers';
import { ingestPlacesResults } from '@/lib/acquisition/places/adapter';
import { dental } from '@/lib/acquisition/config/industries/dental';
import { fakeDeps, CRAWLER_ENV } from '../helpers/fakeWeb';
import { S1, S2, S3, S15, allResponses } from '../fixtures/sites';

const USER = 'u_integration_admin';
const TABLES_IN_ORDER = [
  'AcquisitionAgentRun', 'AcquisitionApproval', 'AcquisitionTask', 'AcquisitionDraft', 'AcquisitionRecommendation',
  'AcquisitionScore', 'AcquisitionFinding', 'AcquisitionSignal', 'AcquisitionDecisionMaker', 'AcquisitionIdentity',
  'AcquisitionSource', 'AcquisitionPipelineEvent', 'AcquisitionProspect', 'AcquisitionCandidate', 'AcquisitionImportBatch',
  'AcquisitionPageCache', 'AcquisitionSuppression', 'AcquisitionProviderUsage', 'Prospect',
];
const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? Number(x) : x));

beforeAll(async () => {
  for (const t of TABLES_IN_ORDER) await prisma.$executeRawUnsafe(`DELETE FROM \`${t}\``);
  await prisma.$executeRawUnsafe('DELETE FROM `User` WHERE id = ?', USER);
  await prisma.user.create({ data: { id: USER, email: 'admin@integration.test', plan: 'agency' } });
  process.env.INDUSTRY_ACQUISITION_ENABLED = 'true';
  Object.assign(process.env, CRAWLER_ENV);
});
afterAll(async () => {
  __setResearchDeps(null);
  await prisma.$disconnect();
});

describe('real MySQL', () => {
  it('S14: 60 concurrent Places reservations on a cap of 50 → exactly 50 (single conditional UPDATE)', async () => {
    const now = new Date('2026-10-14T12:00:00Z');
    const results = await Promise.all(Array.from({ length: 60 }, () => reserve('google_places', now)));
    expect(results.filter((r) => r.ok)).toHaveLength(50);
    const row = await prisma.acquisitionProviderUsage.findFirst({ where: { provider: 'google_places', day: '2026-10-14' } });
    expect(row?.calls).toBe(50);
    expect(await prisma.acquisitionProviderUsage.count({ where: { provider: 'google_places' } })).toBe(1);
  });

  it('S17: 20 concurrent identical enqueues → one task (unique key)', async () => {
    const r = await Promise.all(Array.from({ length: 20 }, () => enqueueAcqTask({ userId: USER, type: 'acq.discover', input: { industryKey: 'dental', runKey: 'concurrency' } })));
    expect(new Set(r.map((x) => x.id)).size).toBe(1);
    expect(r.filter((x) => x.created)).toHaveLength(1);
    await prisma.acquisitionTask.deleteMany({ where: { userId: USER } });
  });

  it('S6: Places ingestion — nothing but place_id lands anywhere in the database', async () => {
    await ingestPlacesResults({
      userId: USER, industry: dental, area: 'Lekki', queryIndex: 0,
      results: [
        { id: 'ChIJintegrationfixture01', displayName: { text: 'Zebra Fixture Dental Lekki' }, types: ['dentist'], businessStatus: 'OPERATIONAL' },
        { id: 'ChIJintegrationfixture02', displayName: { text: 'Zebra Fixture Dental Supplies' }, types: ['dentist'], businessStatus: 'OPERATIONAL' },
      ],
    });
    const tables = (await prisma.$queryRawUnsafe<Array<{ t: string }>>('SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()')).map((r) => r.t);
    let dump = '';
    for (const t of tables) dump += json(await prisma.$queryRawUnsafe(`SELECT * FROM \`${t}\``));
    expect(dump).toContain('ChIJintegrationfixture01');
    for (const leaked of ['Zebra', 'Fixture Dental Lekki', 'Supplies', 'OPERATIONAL']) expect(dump).not.toContain(leaked);
  });

  it('S20: full chain on synthetic clinics, then writes the synthetic-run report', async () => {
    const { deps, requests } = fakeDeps({ responses: allResponses() });
    __setResearchDeps({ fetchDeps: deps });
    const clinics = [
      ['Pearl Smile Dental', `https://${S1.domain}`, 'Lekki'],
      ['Coral Teeth Clinic', `https://${S2.domain}`, 'Ikeja GRA'],
      ['Glow Dental', `https://${S3.domain}`, 'Lekki'],
      ['Bluecrest Dental', `https://${S15.domain}`, 'Victoria Island'],
      ['Ivory Dental (no website)', '', 'Surulere'],
    ];
    const csv = ['business_name,source,website,area,city', ...clinics.map(([n, w, a]) => `"${n}",Synthetic fixture list,${w},${a},Lagos`)].join('\n');
    const p = await previewImport({ userId: USER, industryKey: 'dental', kind: 'csv', csvText: csv });
    const c = await commitImport({ userId: USER, batchId: p.batchId, attestedBy: 'admin@integration.test', attest: true });
    expect(c.created).toBe(5);

    const runs = [];
    for (let i = 0; i < 10; i++) {
      const r = await drainAcqTasks({ budget: 50 });
      runs.push(r);
      if (r.claimed === 0) break;
    }
    expect(runs.reduce((s, r) => s + r.retried + r.dead, 0)).toBe(0);

    const acq = await prisma.acquisitionProspect.findMany({ where: { userId: USER }, include: { prospect: { select: { businessName: true } } } });
    expect(acq.every((a) => ['strategized', 'needs_review'].includes(a.state))).toBe(true);
    expect(await prisma.acquisitionDraft.count()).toBe(0);
    expect(await prisma.acquisitionAgentRun.count({ where: { provider: { not: null } } })).toBe(0);

    // Report
    const report = [];
    for (const a of acq.sort((x, y) => x.prospect.businessName.localeCompare(y.prospect.businessName))) {
      const score = await prisma.acquisitionScore.findFirst({ where: { acqProspectId: a.id }, orderBy: { computedAt: 'desc' } });
      const rec = await prisma.acquisitionRecommendation.findFirst({ where: { acqProspectId: a.id }, orderBy: { createdAt: 'desc' } });
      const signals = await prisma.acquisitionSignal.findMany({ where: { acqProspectId: a.id, supersededAt: null }, orderBy: { code: 'asc' } });
      const contacts = await prisma.acquisitionDecisionMaker.findMany({ where: { acqProspectId: a.id } });
      const findings = await prisma.acquisitionFinding.count({ where: { acqProspectId: a.id } });
      const sources = await prisma.acquisitionSource.findMany({ where: { acqProspectId: a.id }, select: { kind: true, url: true, httpStatus: true } });
      const cats = (score?.breakdown ?? []) as Array<{ id: string; score: number; points: number }>;
      expect(Math.round(cats.reduce((s, x) => s + x.points, 0))).toBe(score?.total);
      report.push({
        clinic: a.prospect.businessName, state: a.state, area: a.area,
        score: score && { total: score.total, band: score.band, coverage: score.coverage, contactability: score.contactability, eligible: score.eligible, version: score.scoreVersion, isEstimate: true },
        categories: cats.map((x) => ({ id: x.id, categoryScore: x.score, points: x.points })),
        recommendation: rec && { primary: rec.primaryOfferId, secondary: rec.secondaryOfferId, offerStatusAtTime: rec.offerStatusAtTime, confidence: rec.confidence, firstLine: rec.rationale.split('\n')[0] },
        eligibility: score?.eligibility,
        contacts: contacts.map((x) => ({ kind: x.kind, value: x.email ?? x.phone, source: x.sourceUrl ?? x.sourceNote })),
        signals: signals.map((s) => `${s.code}=${json(s.value)} [${s.basis}/${s.confidence}/${s.method}]`),
        findings, sources,
      });
    }
    const out = { generatedAt: new Date().toISOString(), runs, requests: requests.length, userAgent: requests[0]?.userAgent, budgets: await prisma.acquisitionProviderUsage.findMany(), clinics: report };
    if (process.env.SYNTHETIC_REPORT_PATH) fs.writeFileSync(process.env.SYNTHETIC_REPORT_PATH, json(out));
    expect(report).toHaveLength(5);
  });
});
