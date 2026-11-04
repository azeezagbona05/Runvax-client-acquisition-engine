/**
 * Isolation of Industry Acquisition clinics from RUNVAX's existing outreach
 * automation, on a REAL disposable MySQL. Real SQL matters here: ordinary
 * prospects have source NULL, and the fake in-memory database does not share
 * SQL's NULL semantics or evaluate relation filters (Rex's query uses them).
 *
 * Message composition and AI quota are mocked; nothing is sent, no model is
 * called, and `autoDraftEnabled` is set only in this disposable database.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

const enqueued = vi.hoisted(() => [] as Array<{ type: string; prospectId: string | null }>);
const compose = vi.hoisted(() => vi.fn());

vi.mock('@/lib/tasks/queue', () => ({
  enqueueTask: vi.fn(async (p: { type: string; prospectId?: string | null }) => { enqueued.push({ type: p.type, prospectId: p.prospectId ?? null }); return `task-${enqueued.length}`; }),
  drainTasks: vi.fn(async () => ({ claimed: 0 })),
}));
vi.mock('@/lib/outreach/compose', () => ({ composeOutreach: compose }));
vi.mock('@/lib/usage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/usage')>()),
  checkAndIncrementAIForUser: vi.fn(async () => ({ ok: true })),
  checkAndIncrementSearchForUser: vi.fn(async () => ({ ok: true })),
}));

import { GET as rex } from '@/app/api/cron/prepare-drafts/route';
import { runDelegatedAction, buildBrief } from '@/lib/atlas';
import { handlers } from '@/lib/tasks/handlers';
import { addSuppression } from '@/lib/acquisition/suppression';

const USER = 'u_integration_isolation';
const OLD = new Date(Date.now() - 30 * 86_400_000);
const business = (id: string) => ({ id, name: `Clinic ${id}`, address: 'Lagos', hasWebsite: false, category: 'dentist' });
const ids: Record<string, string> = {};

async function mk(key: string, over: { source: string | null; stage?: string }) {
  const p = await prisma.prospect.create({
    data: { userId: USER, businessId: `iso_${key}`, businessName: `Clinic ${key}`, businessData: business(`iso_${key}`), stage: over.stage ?? 'found', source: over.source },
  });
  await prisma.$executeRawUnsafe('UPDATE `Prospect` SET `updatedAt` = ? WHERE `id` = ?', OLD, p.id); // idle long enough to be a "cold lead"
  ids[key] = p.id;
  return p;
}
const idOf = (...keys: string[]) => keys.map((k) => ids[k]).sort();

beforeAll(async () => {
  process.env.CRON_SECRET = 'integration-cron-secret';
  process.env.INDUSTRY_ACQUISITION_ENABLED = 'true';
  await prisma.$executeRawUnsafe('DELETE FROM `AcquisitionProspect` WHERE userId = ?', USER);
  await prisma.$executeRawUnsafe('DELETE FROM `AcquisitionSuppression` WHERE userId = ?', USER);
  await prisma.$executeRawUnsafe('DELETE FROM `OutreachDraft` WHERE userId = ?', USER);
  await prisma.$executeRawUnsafe('DELETE FROM `Prospect` WHERE userId = ?', USER);
  await prisma.$executeRawUnsafe('DELETE FROM `UserSettings` WHERE userId = ?', USER);
  await prisma.$executeRawUnsafe('DELETE FROM `AtlasBrief` WHERE userId = ?', USER);
  await prisma.$executeRawUnsafe('DELETE FROM `AgentActivity` WHERE userId = ?', USER);
  await prisma.$executeRawUnsafe('DELETE FROM `User` WHERE id = ?', USER);
  await prisma.user.create({ data: { id: USER, email: 'isolation@integration.test', plan: 'agency' } });
  // Opted in to auto-drafting ONLY in this disposable database, to prove the selectors.
  await prisma.userSettings.create({ data: { userId: USER, autoDraftEnabled: true } });

  // Ordinary RUNVAX prospects: every way a non-acquisition prospect can be created.
  await mk('ord_null', { source: null });
  await mk('ord_manual', { source: 'manual' });
  await mk('ord_campaign', { source: 'campaign' });
  await mk('ord_auto', { source: 'auto-prospect' });
  await mk('ord_contacted', { source: null, stage: 'contacted' });
  // Industry Acquisition clinics, including one that has opted out / is suppressed.
  await mk('eng_found', { source: 'industry-acquisition' });
  await mk('eng_contacted', { source: 'industry-acquisition', stage: 'contacted' });
  const sup = await mk('eng_suppressed', { source: 'industry-acquisition' });
  await prisma.acquisitionProspect.create({ data: { userId: USER, prospectId: sup.id, industryKey: 'dental', state: 'suppressed', orgDomain: 'suppressed-fixture.ng' } });
  await addSuppression({ userId: USER, kind: 'domain', value: 'suppressed-fixture.ng', reason: 'objection', source: 'test' });
});
afterAll(async () => { await prisma.$disconnect(); });

const rexCall = (token?: string) => rex(new NextRequest('http://localhost/api/cron/prepare-drafts', { headers: token ? { authorization: `Bearer ${token}` } : {} }));

describe('SQL fact the fix depends on', () => {
  it('a bare "source not acquisition" filter silently drops ordinary NULL-source prospects', async () => {
    const naive = await prisma.prospect.findMany({ where: { userId: USER, source: { not: 'industry-acquisition' } }, select: { id: true } });
    expect(naive.map((p) => p.id)).not.toContain(ids.ord_null);      // this is why the explicit NULL branch exists
    expect(naive.map((p) => p.id)).not.toContain(ids.ord_contacted);
  });
});

describe('Rex (daily auto-drafting)', () => {
  it('keeps its authentication unchanged', async () => {
    expect((await rexCall()).status).toBe(401);
    expect((await rexCall('wrong-secret')).status).toBe(401);
    expect(enqueued).toHaveLength(0);
  });

  it('queues every ordinary prospect, including NULL-source ones, and no Industry Acquisition clinic', async () => {
    enqueued.length = 0;
    const res = await rexCall('integration-cron-secret');
    expect(res.status).toBe(200);
    const queued = enqueued.filter((e) => e.type === 'detect_opportunity').map((e) => e.prospectId).sort();
    expect(queued).toEqual(idOf('ord_null', 'ord_manual', 'ord_campaign', 'ord_auto'));
    // eng_found (active) and eng_suppressed (opted out) are both excluded; ord_contacted is not stage "found".
    expect(queued).not.toContain(ids.eng_found);
    expect(queued).not.toContain(ids.eng_suppressed);
    expect((await res.json()).scanned).toBe(4);
  });
});

describe('Atlas "reactivate cold leads" (explicit click)', () => {
  it('counts and drafts only ordinary cold leads; Industry Acquisition clinics are never "cold leads"', async () => {
    const brief = await buildBrief(USER);
    const cold = brief.recommendations.find((r) => r.type === 'reactivate_cold_leads');
    expect(cold?.detail).toMatch(/of your 5 cold prospects/); // 4 found + 1 contacted ordinary; not the 3 engine clinics

    compose.mockClear();
    compose.mockResolvedValue({ whatsapp: 'Hi there', emailSubject: 'Subject', emailBody: 'Body', framework: 'test', opportunity: null, priorContext: null });
    const res = await runDelegatedAction(USER, 'reactivate_cold_leads');
    expect(res.ok).toBe(true);
    const drafts = await prisma.outreachDraft.findMany({ where: { userId: USER }, select: { prospectId: true, status: true, channel: true } });
    expect(drafts.map((d) => d.prospectId).sort()).toEqual(idOf('ord_null', 'ord_manual', 'ord_campaign', 'ord_auto', 'ord_contacted'));
    expect(drafts.every((d) => d.status === 'pending' && d.channel === 'whatsapp')).toBe(true); // still only pending drafts: nothing sent
    expect(compose).toHaveBeenCalledTimes(5);
    for (const key of ['eng_found', 'eng_contacted', 'eng_suppressed']) expect(drafts.map((d) => d.prospectId)).not.toContain(ids[key]);
  });
});

describe('existing task handlers (backstop for any path)', () => {
  const ctx = (prospectId: string) => ({ taskId: 't', userId: USER, prospectId, input: {}, attempt: 1 }) as never;

  it('draft_outreach still drafts for an ordinary prospect', async () => {
    await prisma.outreachDraft.deleteMany({ where: { userId: USER } });
    compose.mockClear();
    compose.mockResolvedValue({ whatsapp: 'Hi', emailSubject: 'S', emailBody: 'B', framework: 'test', opportunity: null, priorContext: null });
    const r = await handlers.draft_outreach(ctx(ids.ord_null));
    expect(r.status).toBe('completed');
    expect(compose).toHaveBeenCalledTimes(1);
    expect(await prisma.outreachDraft.count({ where: { prospectId: ids.ord_null } })).toBe(1);
  });

  it('draft_outreach and detect_opportunity skip Industry Acquisition clinics, active or suppressed, and compose nothing', async () => {
    compose.mockClear();
    for (const key of ['eng_found', 'eng_contacted', 'eng_suppressed']) {
      for (const type of ['draft_outreach', 'detect_opportunity'] as const) {
        const r = await handlers[type](ctx(ids[key]));
        expect(r, `${type} ${key}`).toMatchObject({ status: 'skipped', output: { reason: 'acquisition_prospect' } });
      }
      expect(await prisma.outreachDraft.count({ where: { prospectId: ids[key] } })).toBe(0);
    }
    expect(compose).not.toHaveBeenCalled();
  });

  it('detect_opportunity still analyses an ordinary prospect (it is not skipped as an acquisition clinic)', async () => {
    const r = await handlers.detect_opportunity(ctx(ids.ord_null));
    expect(r.output).not.toMatchObject({ reason: 'acquisition_prospect' });
    expect(['completed', 'skipped']).toContain(r.status);
  });
});
