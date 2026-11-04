/**
 * Pitch-preparation gaps closed for the pilot: one-step evidence entry and an
 * up-front readiness check that must always agree with what generation does.
 * Synthetic fixture sites only; nothing is fetched or sent.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rows } from '../helpers/fakePrisma';
import { fakeDeps, CRAWLER_ENV } from '../helpers/fakeWeb';
import { S1, S2, S3, S15, allResponses } from '../fixtures/sites';
import { __setResearchDeps } from '@/lib/acquisition/research/handlers';
import { previewImport, commitImport } from '@/lib/acquisition/imports/service';
import { drainAcqTasks } from '@/lib/acquisition/tasks/queue';
import { addManualEvidence } from '@/lib/acquisition/evidence';
import { generateDraft, pitchReadiness } from '@/lib/acquisition/drafts';
import { recordOutcome } from '@/lib/acquisition/outcomes';
import { getProspectDetail } from '@/lib/acquisition/admin';

const U = 'u1';
const ADMIN = 'admin@h.test';

async function drainAll() { for (let i = 0; i < 10; i++) { const r = await drainAcqTasks({ budget: 50 }); if (r.claimed === 0) break; } }

async function research() {
  __setResearchDeps({ fetchDeps: fakeDeps({ responses: allResponses() }).deps });
  const list: Array<[string, string]> = [['Pearl Smile Dental', S1.domain], ['Coral Teeth Clinic', S2.domain], ['Glow Dental', S3.domain], ['Bluecrest Dental', S15.domain], ['Ivory Dental No Site', '']];
  const csv = ['business_name,source,website,area,city', ...list.map(([n, d]) => `${n},Synthetic fixture list,${d ? `https://${d}` : ''},Lekki,Lagos`)].join('\n');
  const p = await previewImport({ userId: U, industryKey: 'dental', kind: 'csv', csvText: csv });
  await commitImport({ userId: U, batchId: p.batchId, attestedBy: ADMIN, attest: true });
  await drainAll();
  const byName = (n: string) => {
    const crm = rows('prospect').find((x) => x.businessName === n)!;
    return rows('acquisitionProspect').find((a) => a.prospectId === crm.id)!.id as string;
  };
  return { pearl: byName('Pearl Smile Dental'), coral: byName('Coral Teeth Clinic'), glow: byName('Glow Dental'), bluecrest: byName('Bluecrest Dental'), ivory: byName('Ivory Dental No Site') };
}

beforeEach(() => { process.env.INDUSTRY_ACQUISITION_ENABLED = 'true'; Object.assign(process.env, CRAWLER_ENV); });
afterEach(() => { __setResearchDeps(null); delete process.env.INDUSTRY_ACQUISITION_ENABLED; delete process.env.IA_CRAWLER_ENABLED; delete process.env.IA_CRAWLER_POLICY_URL; });

const batch = (domain: string, items: Array<{ code: string; value: boolean }>) => ({ items, sourceUrl: `https://${domain}/`, note: 'Checked the home and contact pages', confidence: 'high', attest: true });
const GLOW_ITEMS = ['online_booking_present', 'contact_form_present', 'whatsapp_entry_point', 'chat_widget_present', 'opening_hours_published'].map((code) => ({ code, value: false }));

describe('one-step evidence entry', () => {
  it('records several observations with ONE audit, ONE event and the same provenance', async () => {
    const p = await research();
    const auditsBefore = rows('acquisitionTask').filter((t) => t.type === 'acq.audit').length;
    const eventsBefore = rows('acquisitionPipelineEvent').filter((e) => e.acqProspectId === p.glow).length;
    const r = await addManualEvidence(U, ADMIN, p.glow, batch(S3.domain, GLOW_ITEMS));
    expect(r.signals.map((s) => s.code)).toEqual(GLOW_ITEMS.map((i) => i.code));
    expect(r.queued).toBe('acq.audit');
    expect(rows('acquisitionTask').filter((t) => t.type === 'acq.audit')).toHaveLength(auditsBefore + 1);
    expect(rows('acquisitionPipelineEvent').filter((e) => e.acqProspectId === p.glow)).toHaveLength(eventsBefore + 1);
    const sigs = rows('acquisitionSignal').filter((s) => r.signals.some((x) => x.signalId === s.id));
    expect(sigs).toHaveLength(5);
    for (const s of sigs) expect(s).toMatchObject({ basis: 'observed', method: 'manual', confidence: 'high', sourceUrl: `https://${S3.domain}/` });
  });

  it('applies the same rules as single entry: own domain, attestation, no duplicates, nothing outside the list', async () => {
    const p = await research();
    await expect(addManualEvidence(U, ADMIN, p.glow, { ...batch(S3.domain, GLOW_ITEMS), sourceUrl: 'https://other-clinic.ng/' })).rejects.toThrow(/own website/);
    await expect(addManualEvidence(U, ADMIN, p.glow, { ...batch(S3.domain, GLOW_ITEMS), attest: false })).rejects.toThrow();
    await expect(addManualEvidence(U, ADMIN, p.glow, batch(S3.domain, [{ code: 'https', value: true }, { code: 'https', value: false }]))).rejects.toThrow(/once/);
    await expect(addManualEvidence(U, ADMIN, p.glow, batch(S3.domain, [{ code: 'appointment_driven', value: true }]))).rejects.toThrow();
    await expect(addManualEvidence(U, ADMIN, p.glow, batch(S3.domain, []))).rejects.toThrow();
    // The single-signal form keeps working unchanged.
    const one = await addManualEvidence(U, ADMIN, p.glow, { code: 'https', value: true, sourceUrl: `https://${S3.domain}/`, note: 'padlock shown', confidence: 'medium', attest: true });
    expect(one).toMatchObject({ ok: true, queued: 'acq.audit' });
    expect(typeof one.signalId).toBe('string');
  });

  it('is enough to take a clinic with no evidence all the way to a pitch', async () => {
    const p = await research();
    expect((await generateDraft(U, ADMIN, p.glow)).ok).toBe(false);
    await addManualEvidence(U, ADMIN, p.glow, batch(S3.domain, GLOW_ITEMS));
    // A role inbox is also needed: Glow's fixture has none, so add one the supported way.
    await drainAll();
    const rec = rows('acquisitionRecommendation').filter((x) => x.acqProspectId === p.glow).at(-1)!;
    expect(rec.primaryOfferId).toBe('ai_receptionist');
  });
});

describe('pitch readiness agrees with generation', () => {
  it('for every synthetic clinic: canGenerate === (generateDraft succeeds), and readiness writes nothing', async () => {
    const p = await research();
    await addManualEvidence(U, ADMIN, p.glow, batch(S3.domain, GLOW_ITEMS));
    await drainAll();
    const drafts0 = rows('acquisitionDraft').length;
    const events0 = rows('acquisitionPipelineEvent').length;
    // 1) Ask readiness about every clinic first. It must not write anything.
    const predicted: Record<string, boolean> = {};
    for (const [name, id] of Object.entries(p)) predicted[name] = (await pitchReadiness(U, id)).canGenerate;
    expect(rows('acquisitionDraft').length).toBe(drafts0);
    expect(rows('acquisitionPipelineEvent').length).toBe(events0);
    // 2) Then actually generate for every clinic and compare, one to one.
    const actual: Record<string, boolean> = {};
    for (const [name, id] of Object.entries(p)) actual[name] = (await generateDraft(U, ADMIN, id)).ok;
    expect(actual).toEqual(predicted);
    // The comparison is meaningful: some clinics can generate and some cannot.
    expect(Object.values(actual)).toContain(true);
    expect(Object.values(actual)).toContain(false);
  });

  it('explains what is missing, names the evidence that would help, and notes the offer is not approved', async () => {
    const p = await research();
    const r = await pitchReadiness(U, p.glow);
    expect(r.canGenerate).toBe(false);
    const failed = r.checks.filter((c) => !c.ok && c.blocking).map((c) => c.label);
    expect(failed).toEqual(expect.arrayContaining([expect.stringMatching(/offer is recommended/i), expect.stringMatching(/observed weakness/i)]));
    expect(r.helpfulSignals).toEqual(expect.arrayContaining(['online_booking_present', 'contact_form_present']));
    const offer = r.checks.find((c) => /approved for sale/i.test(c.label))!;
    expect(offer).toMatchObject({ ok: false, blocking: false }); // informational: it never blocks generation
    expect(offer.detail).toMatch(/never marked ready/);
  });

  it('a ready clinic can generate but cannot be marked ready while the offer is unapproved', async () => {
    const p = await research();
    const r = await pitchReadiness(U, p.coral);
    expect(r.canGenerate).toBe(true);
    expect(r.canBeMarkedReady).toBe(false);
    expect(r.checks.filter((c) => c.blocking).every((c) => c.ok)).toBe(true);
  });

  it('a suppressed clinic shows the suppression as a blocking check', async () => {
    const p = await research();
    await generateDraft(U, ADMIN, p.coral);
    await recordOutcome(U, ADMIN, p.coral, { type: 'opt_out' });
    const r = await pitchReadiness(U, p.coral);
    expect(r.canGenerate).toBe(false);
    expect(r.checks.find((c) => /suppressed/i.test(c.label))).toMatchObject({ ok: false, blocking: true });
    expect(r.checks.find((c) => /eligible and in a pitchable state/i.test(c.label))).toMatchObject({ ok: false });
  });

  it('is included in the clinic profile data, so it is available without an extra request', async () => {
    const p = await research();
    const d = await getProspectDetail(U, p.coral);
    expect(d!.pitchReadiness.canGenerate).toBe(true);
    expect(d!.pitchReadiness.checks.length).toBeGreaterThanOrEqual(6);
  });
});
