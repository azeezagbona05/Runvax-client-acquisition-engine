/**
 * The sales workflow on a REAL disposable MySQL: JSON columns and nulls,
 * the new outcome table and its foreign keys, review state changes, and an
 * objection's suppression taking effect. Synthetic fixture data only.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import { previewImport, commitImport } from '@/lib/acquisition/imports/service';
import { drainAcqTasks } from '@/lib/acquisition/tasks/queue';
import { __setResearchDeps } from '@/lib/acquisition/research/handlers';
import { generateDraft, actOnDraft, invalidateStaleDrafts } from '@/lib/acquisition/drafts';
import { addManualEvidence } from '@/lib/acquisition/evidence';
import { recordOutcome, funnelMetrics } from '@/lib/acquisition/outcomes';
import { findSuppressionHits } from '@/lib/acquisition/suppression';
import { eraseContacts } from '@/lib/acquisition/contacts';
import { fakeDeps, CRAWLER_ENV } from '../helpers/fakeWeb';
import { S2, allResponses } from '../fixtures/sites';

const USER = 'u_integration_sales';
const ADMIN = 'reviewer@integration.test';

beforeAll(async () => {
  await prisma.$executeRawUnsafe('DELETE FROM `AcquisitionProspect` WHERE userId = ?', USER); // cascades drafts, approvals, outcomes
  for (const t of ['AcquisitionTask', 'AcquisitionAgentRun', 'AcquisitionSuppression', 'AcquisitionImportBatch', 'AcquisitionPageCache', 'AcquisitionIdentity']) {
    await prisma.$executeRawUnsafe(`DELETE FROM \`${t}\` WHERE userId = ?`, USER);
  }
  await prisma.$executeRawUnsafe('DELETE FROM `Prospect` WHERE userId = ?', USER);
  await prisma.$executeRawUnsafe('DELETE FROM `User` WHERE id = ?', USER);
  await prisma.user.create({ data: { id: USER, email: 'sales@integration.test', plan: 'agency' } });
  process.env.INDUSTRY_ACQUISITION_ENABLED = 'true';
  Object.assign(process.env, CRAWLER_ENV);
});
afterAll(async () => { __setResearchDeps(null); await prisma.$disconnect(); });

async function drain() { for (let i = 0; i < 8; i++) { const r = await drainAcqTasks({ budget: 50 }); if (r.claimed === 0) break; } }

describe('real MySQL — sales workflow', () => {
  it('generate → approve → refused readiness → evidence change → regenerate → objection → erasure', async () => {
    const { deps } = fakeDeps({ responses: allResponses() });
    __setResearchDeps({ fetchDeps: deps });
    const p = await previewImport({ userId: USER, industryKey: 'dental', kind: 'csv', csvText: `business_name,source,website,area,city\nCoral Teeth Clinic,fixture,https://${S2.domain},Lekki,Lagos` });
    await commitImport({ userId: USER, batchId: p.batchId, attestedBy: ADMIN, attest: true });
    await drain();
    const acq = (await prisma.acquisitionProspect.findFirst({ where: { userId: USER } }))!;
    expect(acq.state).toBe('strategized');

    const g = await generateDraft(USER, ADMIN, acq.id);
    expect(g.ok).toBe(true);
    const id = g.ok ? g.draftId : '';
    const d = (await prisma.acquisitionDraft.findUnique({ where: { id } }))!;
    expect(d.evidenceSignalIds).toHaveLength(2);
    expect(d.evidenceHash).toMatch(/^[0-9a-f]{64}$/);

    expect(await actOnDraft(USER, ADMIN, id, { action: 'approve' })).toMatchObject({ ok: true });
    const ready = await actOnDraft(USER, ADMIN, id, { action: 'mark_ready' });
    expect(ready.ok).toBe(false); // the real offer is unapproved
    expect((await prisma.acquisitionDraft.findUnique({ where: { id } }))!.readiness).toMatchObject({ ready: false });

    await addManualEvidence(USER, ADMIN, acq.id, { code: 'online_booking_present', value: true, sourceUrl: `https://${S2.domain}/book`, note: 'Booking link now visible', confidence: 'high', attest: true });
    const stale = (await prisma.acquisitionDraft.findUnique({ where: { id } }))!;
    expect(stale.status).toBe('stale');
    expect(stale.readiness).toBeNull(); // Prisma.DbNull written as SQL NULL
    expect((await prisma.acquisitionProspect.findUnique({ where: { id: acq.id } }))!.state).toBe('strategized');
    expect(await invalidateStaleDrafts(USER, acq.id, 'again')).toBe(0); // idempotent

    await drain(); // re-audit with the manual evidence
    const again = await generateDraft(USER, ADMIN, acq.id);
    expect(again.ok).toBe(true); // contact form still missing → one observation remains
    const v2 = again.ok ? again.draftId : '';

    const r = await recordOutcome(USER, ADMIN, acq.id, { type: 'objection', reason: 'asked not to be contacted (synthetic)' });
    expect(r).toMatchObject({ ok: true, state: 'suppressed' });
    expect((await prisma.acquisitionDraft.findUnique({ where: { id: v2 } }))!.status).toBe('blocked');
    expect(await findSuppressionHits(USER, { domain: S2.domain })).toEqual([`domain:${S2.domain}`]);
    expect(await prisma.acquisitionOutcome.count({ where: { userId: USER, type: 'objection' } })).toBe(1);
    expect((await funnelMetrics(USER)).objections).toBe(1);

    await eraseContacts({ userId: USER, acqProspectId: acq.id, reason: 'erasure', actor: ADMIN, domain: S2.domain });
    const drafts = await prisma.acquisitionDraft.findMany({ where: { userId: USER } });
    expect(drafts.every((x) => x.body === '[erased with contacts]' && x.recipientDmId === null && x.riskFlags === null)).toBe(true);
    const approvals = await prisma.acquisitionApproval.findMany({ where: { userId: USER }, orderBy: { createdAt: 'asc' } });
    expect(approvals.map((a) => a.action)).toEqual(expect.arrayContaining(['approve', 'invalidate']));
  });
});
