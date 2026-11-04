/**
 * The dental sales-preparation workflow end to end on synthetic clinics:
 * research → deterministic pitch → human review → readiness → manually
 * recorded outcomes. Fixture websites only; nothing is fetched, no model is
 * called and nothing is delivered.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rows } from '../helpers/fakePrisma';
import { fakeDeps, CRAWLER_ENV } from '../helpers/fakeWeb';
import { S1, S2, S3, S15, allResponses } from '../fixtures/sites';
import { __setResearchDeps } from '@/lib/acquisition/research/handlers';
import { previewImport, commitImport } from '@/lib/acquisition/imports/service';
import { drainAcqTasks } from '@/lib/acquisition/tasks/queue';
import { getIndustry } from '@/lib/acquisition/config/registry';
import type { Offer } from '@/lib/acquisition/config/schema';
import { generateDraft, actOnDraft, draftValidity, getDraftDetail, listDrafts, DraftError } from '@/lib/acquisition/drafts';
import { checkDraftForDelivery, deliverDraft, draftHash } from '@/lib/acquisition/gate';
import { addManualEvidence } from '@/lib/acquisition/evidence';
import { recordOutcome, funnelMetrics } from '@/lib/acquisition/outcomes';
import { findSuppressionHits } from '@/lib/acquisition/suppression';
import { storeContact, eraseContacts } from '@/lib/acquisition/contacts';
import { runAction } from '@/lib/acquisition/admin';

const ADMIN = 'reviewer@harzotech.test';
const U = 'u1';

async function drainAll() {
  for (let i = 0; i < 10; i++) {
    const r = await drainAcqTasks({ budget: 50 });
    if (r.claimed === 0) break;
  }
}

/** Imports the synthetic clinics and runs the research chain on fixture sites. */
async function research() {
  const { deps } = fakeDeps({ responses: allResponses() });
  __setResearchDeps({ fetchDeps: deps });
  const list: Array<[string, string]> = [
    ['Pearl Smile Dental', S1.domain], ['Coral Teeth Clinic', S2.domain], ['Glow Dental', S3.domain],
    ['Bluecrest Dental', S15.domain], ['Ivory Dental No Site', ''],
  ];
  const csv = ['business_name,source,website,area,city', ...list.map(([n, d]) => `${n},Synthetic fixture list,${d ? `https://${d}` : ''},Lekki,Lagos`)].join('\n');
  const p = await previewImport({ userId: U, industryKey: 'dental', kind: 'csv', csvText: csv });
  await commitImport({ userId: U, batchId: p.batchId, attestedBy: ADMIN, attest: true });
  await drainAll();
  const id = (domain: string | null, name?: string) => {
    const a = rows('acquisitionProspect').find((x) => (domain ? x.orgDomain === domain : rows('prospect').find((pp) => pp.id === x.prospectId)?.businessName === name));
    return a!.id as string;
  };
  return { coral: id(S2.domain), bluecrest: id(S15.domain), glow: id(S3.domain), ivory: id(null, 'Ivory Dental No Site') };
}

const state = (acqId: string) => rows('acquisitionProspect').find((a) => a.id === acqId)!.state;
const draftRow = (id: string) => rows('acquisitionDraft').find((d) => d.id === id)!;

// A HYPOTHETICAL owner approval of the AI Receptionist, applied in memory for
// one test so the "ready" path can be proven. The real catalogue stays
// unconfigured and unapproved (asserted below).
let saved: Offer | null = null;
function approveReceptionistHypothetically(over: Partial<Offer> = {}) {
  const offers = getIndustry('dental')!.offers;
  const i = offers.findIndex((o) => o.id === 'ai_receptionist');
  saved = JSON.parse(JSON.stringify(offers[i]));
  offers[i] = {
    ...offers[i], status: 'approved', description: 'TEST-ONLY description', scope: 'TEST-ONLY scope',
    proposal: { ...offers[i].proposal!, approvalState: 'approved_by_owner', approvedBy: 'test-owner', approvedAt: '2026-10-14' },
    ...over,
  };
}
function restoreReceptionist() {
  if (!saved) return;
  const offers = getIndustry('dental')!.offers;
  offers[offers.findIndex((o) => o.id === 'ai_receptionist')] = saved;
  saved = null;
}

async function generated(acqId: string) {
  const r = await generateDraft(U, ADMIN, acqId);
  if (!r.ok) throw new Error(`refused: ${JSON.stringify(r.reasons)}`);
  return r.draftId;
}
async function readyDraft(acqId: string) {
  const id = await generated(acqId);
  expect(await actOnDraft(U, ADMIN, id, { action: 'approve' })).toMatchObject({ ok: true, status: 'approved' });
  expect(await actOnDraft(U, ADMIN, id, { action: 'mark_ready' })).toMatchObject({ ok: true, status: 'ready' });
  return id;
}

beforeEach(() => {
  process.env.INDUSTRY_ACQUISITION_ENABLED = 'true';
  Object.assign(process.env, CRAWLER_ENV);
});
afterEach(() => {
  restoreReceptionist();
  __setResearchDeps(null);
  delete process.env.INDUSTRY_ACQUISITION_ENABLED;
  delete process.env.IA_CRAWLER_ENABLED;
  delete process.env.IA_CRAWLER_POLICY_URL;
});

describe('generation', () => {
  it('drafts only where observed evidence supports the offer, and refuses the rest with reasons', async () => {
    const p = await research();
    const coral = await generateDraft(U, ADMIN, p.coral);
    expect(coral.ok).toBe(true);
    expect(state(p.coral)).toBe('draft_pending_approval');

    const glow = await generateDraft(U, ADMIN, p.glow);
    const ivory = await generateDraft(U, ADMIN, p.ivory);
    expect(glow.ok || ivory.ok).toBe(false);
    if (!glow.ok) expect(glow.reasons.map((r) => r.code)).toEqual(expect.arrayContaining(['no_recommendation', 'insufficient_evidence']));
    if (!ivory.ok) expect(ivory.reasons.map((r) => r.code)).toEqual(expect.arrayContaining(['insufficient_evidence', 'no_recipient']));
    expect(state(p.glow)).toBe('strategized');
    expect(rows('acquisitionDraft')).toHaveLength(1);
  });

  it('binds the draft to the cited signals, their hash and the offer / industry config versions', async () => {
    const p = await research();
    const d = draftRow(await generated(p.coral));
    const cited = d.evidenceSignalIds as string[];
    const signals = rows('acquisitionSignal').filter((s) => cited.includes(s.id as string));
    expect(signals.map((s) => [s.code, s.value, s.basis])).toEqual([['online_booking_present', false, 'observed'], ['contact_form_present', false, 'observed']]);
    expect(signals.every((s) => String(s.sourceUrl).startsWith(`https://${S2.domain}/`))).toBe(true);
    expect(d).toMatchObject({ status: 'pending_approval', offerId: 'ai_receptionist', offerConfigVersion: 1, industryConfigVersion: 2, channel: 'email' });
    expect(String(d.evidenceHash)).toMatch(/^[0-9a-f]{64}$/);
    expect(String(d.offerHash)).toMatch(/^[0-9a-f]{64}$/);
    // Cited findings are this prospect's own observed weaknesses on those signals.
    for (const fid of d.evidenceFindingIds as string[]) {
      const f = rows('acquisitionFinding').find((x) => x.id === fid)!;
      expect(f).toMatchObject({ acqProspectId: p.coral, polarity: 'weakness', basis: 'observed' });
      expect((f.signalIds as string[]).some((s) => cited.includes(s))).toBe(true);
    }
    const detail = await getDraftDetail(U, d.id as string);
    expect(detail!.evidence.observed.every((e) => e.current)).toBe(true);
    expect(detail!.offer).toMatchObject({ sellable: false, approvalState: 'proposed_unapproved', pricingStatus: 'unapproved' });
  });
});

describe('review queue', () => {
  it('the real (unapproved) offer: wording can be approved, but the draft can never be marked ready', async () => {
    expect(getIndustry('dental')!.offers.every((o) => o.status === 'unconfigured')).toBe(true);
    const p = await research();
    const id = await generated(p.coral);
    const appr = await actOnDraft(U, ADMIN, id, { action: 'approve' });
    expect(appr).toMatchObject({ ok: true, status: 'approved' });
    expect(appr.ok && appr.warnings?.[0]).toMatch(/cannot be marked ready/);
    const ready = await actOnDraft(U, ADMIN, id, { action: 'mark_ready' });
    expect(ready.ok).toBe(false);
    if (!ready.ok) expect(ready.blockers.map((b) => b.code)).toContain('offer_unconfigured');
    expect(draftRow(id).status).toBe('approved');
    expect(draftRow(id).readiness).toMatchObject({ ready: false });
  });

  it('a hypothetically approved offer reaches "ready" — still undeliverable (no adapter)', async () => {
    approveReceptionistHypothetically();
    const p = await research();
    const id = await readyDraft(p.coral);
    expect(draftRow(id).readiness).toMatchObject({ ready: true, deferred: expect.arrayContaining(['sender_identity_missing', 'live_sending_disabled']) });
    expect(state(p.coral)).toBe('approved');
    await expect(deliverDraft(U, id)).rejects.toThrow(/Draft blocked|No delivery adapter/);
  });

  it('records reviewer, timestamp and decision for every step', async () => {
    approveReceptionistHypothetically();
    const p = await research();
    const id = await readyDraft(p.coral);
    const history = (await getDraftDetail(U, id))!.history;
    expect(history.map((h) => [h.action, h.actor])).toEqual([['approve', ADMIN], ['mark_ready', ADMIN]]);
    expect(history.every((h) => h.at instanceof Date)).toBe(true);
    const d = draftRow(id);
    expect(history[0]).toMatchObject({ bodyHashAfter: draftHash(d.subject as string, d.body as string), evidenceHash: d.evidenceHash, offerHash: d.offerHash });
  });

  it('an edit withdraws approval and readiness; the edited text needs a fresh approval', async () => {
    approveReceptionistHypothetically();
    const p = await research();
    const id = await readyDraft(p.coral);
    const d = draftRow(id);
    const body = String(d.body).replace('Would a short call', 'Would a brief call');
    expect(await actOnDraft(U, ADMIN, id, { action: 'edit', subject: String(d.subject), body })).toMatchObject({ ok: true, status: 'pending_approval' });
    expect(draftRow(id)).toMatchObject({ status: 'pending_approval', version: 2 });
    expect(state(p.coral)).toBe('draft_pending_approval');
    // The old approval no longer covers this text.
    const gate = await checkDraftForDelivery(U, id);
    expect(gate.blocks.map((b) => b.code)).toContain('not_approved');
    await expect(actOnDraft(U, ADMIN, id, { action: 'mark_ready' })).rejects.toThrow(DraftError);
    // Re-approve → ready again.
    await actOnDraft(U, ADMIN, id, { action: 'approve' });
    expect(await actOnDraft(U, ADMIN, id, { action: 'mark_ready' })).toMatchObject({ ok: true, status: 'ready' });
    const actions = (await getDraftDetail(U, id))!.history.map((h) => h.action);
    expect(actions).toEqual(['approve', 'mark_ready', 'edit', 'approve', 'mark_ready']);
  });

  it('an approval racing an edit cannot attach to text it did not see', async () => {
    // Found in the browser check: Approve clicked while an edit was still saving read the old text, then
    // succeeded after the edit committed, leaving an "approved" draft whose approval covered other text.
    const p = await research();
    const id = await generated(p.coral);
    const d = draftRow(id);
    const body = String(d.body).replace('Would a short call', 'Would a brief call');
    const [edit, approve] = await Promise.allSettled([
      actOnDraft(U, ADMIN, id, { action: 'edit', subject: String(d.subject), body }),
      actOnDraft(U, ADMIN, id, { action: 'approve' }),
    ]);
    expect(edit.status).toBe('fulfilled');
    const row = draftRow(id);
    const approvals = rows('acquisitionApproval').filter((a) => a.draftId === id && a.action === 'approve');
    // Either the approve was refused, or whatever approval exists is for the text now stored.
    for (const a of approvals) expect(a.bodyHashAfter).toBe(draftHash(row.subject as string, row.body as string));
    if (row.status === 'approved') expect(approvals).toHaveLength(1);
    else expect(approve.status).toBe('rejected');
  });

  it('an edit that adds an unsupported claim cannot be approved', async () => {
    const p = await research();
    const id = await generated(p.coral);
    const d = draftRow(id);
    const r = await actOnDraft(U, ADMIN, id, { action: 'edit', subject: String(d.subject), body: String(d.body).replace('Would a short call', 'Clinics like yours saw more bookings. Would a short call') });
    expect(r.ok).toBe(true);
    const appr = await actOnDraft(U, ADMIN, id, { action: 'approve' });
    expect(appr.ok).toBe(false);
    if (!appr.ok) expect(appr.blockers.map((b) => b.code)).toEqual(expect.arrayContaining(['unsupported_claim', 'prohibited_phrase']));
    expect(draftRow(id).status).toBe('pending_approval');
  });

  it('a text change made outside the review flow makes the approval stale', async () => {
    approveReceptionistHypothetically();
    const p = await research();
    const id = await readyDraft(p.coral);
    draftRow(id).body = `${draftRow(id).body} `; // tampered directly in the database
    const gate = await checkDraftForDelivery(U, id);
    expect(gate.blocks.map((b) => b.code)).toContain('approval_stale');
    const sent = await recordOutcome(U, ADMIN, p.coral, { type: 'sent', draftId: id, attest: true });
    expect(sent.ok).toBe(false);
  });

  it('rejected drafts cannot be approved or marked ready; the prospect returns to strategized', async () => {
    const p = await research();
    const id = await generated(p.coral);
    expect(await actOnDraft(U, ADMIN, id, { action: 'reject', reason: 'tone not right' })).toMatchObject({ ok: true, status: 'rejected' });
    expect(state(p.coral)).toBe('strategized');
    await expect(actOnDraft(U, ADMIN, id, { action: 'approve' })).rejects.toThrow(/pending approval/);
    await expect(actOnDraft(U, ADMIN, id, { action: 'mark_ready' })).rejects.toThrow(/approved draft/);
    await expect(actOnDraft(U, ADMIN, id, { action: 'reject', reason: 'x' })).rejects.toThrow(); // reason too short
  });

  it('regenerating supersedes the previous version', async () => {
    const p = await research();
    const v1 = await generated(p.coral);
    const r = await actOnDraft(U, ADMIN, v1, { action: 'regenerate' });
    expect(r.ok).toBe(true);
    expect(draftRow(v1).status).toBe('superseded');
    const v2 = r.ok ? r.draftId : '';
    expect(draftRow(v2)).toMatchObject({ status: 'pending_approval', version: 2 });
    expect((await listDrafts(U, { status: 'pending_approval' })).items.map((i) => i.id)).toEqual([v2]);
  });
});

describe('evidence and offer changes invalidate drafts and approvals', () => {
  it('new contradicting evidence makes an approved draft stale and blocks readiness', async () => {
    approveReceptionistHypothetically();
    const p = await research();
    const id = await generated(p.coral);
    await actOnDraft(U, ADMIN, id, { action: 'approve' });
    expect(state(p.coral)).toBe('approved');

    const r = await addManualEvidence(U, ADMIN, p.coral, {
      code: 'online_booking_present', value: true, sourceUrl: `https://${S2.domain}/book`,
      note: 'Booking link added to the header', confidence: 'high', attest: true,
    });
    expect(r.invalidatedDrafts).toBe(1);
    expect(draftRow(id)).toMatchObject({ status: 'stale' });
    expect(String(draftRow(id).statusReason)).toMatch(/superseded/);
    expect(state(p.coral)).toBe('strategized');
    await expect(actOnDraft(U, ADMIN, id, { action: 'mark_ready' })).rejects.toThrow(/approved draft/);
    expect((await getDraftDetail(U, id))!.history.at(-1)).toMatchObject({ action: 'invalidate', actor: 'system' });
  });

  it('re-confirming the same evidence does not invalidate anything', async () => {
    const p = await research();
    const id = await generated(p.coral);
    await drainAll(); // re-audit / re-score from the cached fixture pages
    expect((await draftValidity(U, draftRow(id) as never)).valid).toBe(true);
    expect(draftRow(id).status).toBe('pending_approval');
  });

  it('a re-audit that removes the cited evidence invalidates the draft', async () => {
    const p = await research();
    const id = await generated(p.coral);
    // Evidence entered for a different page that now shows an enquiry form.
    await addManualEvidence(U, ADMIN, p.coral, { code: 'contact_form_present', value: true, sourceUrl: `https://${S2.domain}/contact`, note: 'Enquiry form now on the contact page', confidence: 'high', attest: true });
    await drainAll(); // audit + strategize run, and their hooks re-check drafts
    expect(draftRow(id).status).toBe('stale');
  });

  it('manual evidence on a prospect that was already scored re-scores it, so a pitch can then be generated', async () => {
    // Regression (found in the browser check): the audit's chained rescore had the same input as the first
    // one, so the queue's idempotency key dropped it and the recommendation never updated.
    const p = await research();
    const before = await generateDraft(U, ADMIN, p.glow);
    expect(before.ok).toBe(false);
    const scores = () => rows('acquisitionScore').filter((x) => x.acqProspectId === p.glow).length;
    const n = scores();
    for (const code of ['online_booking_present', 'contact_form_present', 'whatsapp_entry_point', 'chat_widget_present', 'opening_hours_published']) {
      await addManualEvidence(U, ADMIN, p.glow, { code, value: false, sourceUrl: `https://${S3.domain}/`, note: `No ${code} seen`, confidence: 'high', attest: true });
    }
    await drainAll();
    expect(scores()).toBeGreaterThan(n);
    const rec = rows('acquisitionRecommendation').filter((x) => x.acqProspectId === p.glow).at(-1)!;
    expect(rec.primaryOfferId).toBe('ai_receptionist');
  });

  it('a change to the offer configuration makes the approval stale', async () => {
    approveReceptionistHypothetically();
    const p = await research();
    const id = await generated(p.coral);
    await actOnDraft(U, ADMIN, id, { action: 'approve' });
    const offers = getIndustry('dental')!.offers;
    const i = offers.findIndex((o) => o.id === 'ai_receptionist');
    offers[i] = { ...offers[i], configVersion: 2, pitch: { ...offers[i].pitch!, cta: 'Changed CTA?' } };
    const v = await draftValidity(U, draftRow(id) as never);
    expect(v.reasons.map((x) => x.code)).toContain('offer_changed');
    const r = await actOnDraft(U, ADMIN, id, { action: 'mark_ready' });
    expect(r.ok).toBe(false);
    expect(draftRow(id).status).toBe('stale');
  });

  it('evidence must be from the clinic\'s own site, attested, and is masked', async () => {
    const p = await research();
    const base = { code: 'chat_widget_present', value: false, sourceUrl: `https://${S2.domain}/services`, note: 'No chat; call 08031234567', confidence: 'medium', attest: true };
    await expect(addManualEvidence(U, ADMIN, p.coral, { ...base, sourceUrl: 'https://www.google.com/maps/place/x' })).rejects.toThrow(/own website/);
    await expect(addManualEvidence(U, ADMIN, p.coral, { ...base, sourceUrl: 'https://other-clinic.ng/' })).rejects.toThrow(/own website/);
    await expect(addManualEvidence(U, ADMIN, p.coral, { ...base, attest: false })).rejects.toThrow();
    await expect(addManualEvidence(U, ADMIN, p.coral, { ...base, code: 'appointment_driven' })).rejects.toThrow();
    const r = await addManualEvidence(U, ADMIN, p.coral, base);
    const s = rows('acquisitionSignal').find((x) => x.id === r.signalId)!;
    expect({ basis: s.basis, method: s.method, code: s.code, value: s.value }).toEqual({ basis: 'observed', method: 'manual', code: 'chat_widget_present', value: false });
    expect(r.created).toBe(true);
    expect(String(s.evidenceQuote)).toMatch(/^Manually observed: /);
    expect(String(s.evidenceQuote)).not.toContain('08031234567');
    // The same fact on a page the crawler already recorded re-confirms that signal instead of duplicating it.
    const same = await addManualEvidence(U, ADMIN, p.coral, { ...base, sourceUrl: `https://${S2.domain}/` });
    expect(same.created).toBe(false);
  });
});

describe('sales outcomes', () => {
  it('only a ready draft can be recorded as sent; nothing is delivered and the CRM row is untouched', async () => {
    const p = await research();
    const id = await generated(p.coral);
    const r = await recordOutcome(U, ADMIN, p.coral, { type: 'sent', draftId: id, attest: true });
    expect(r.ok).toBe(false);
    expect(rows('acquisitionOutcome')).toHaveLength(0);

    approveReceptionistHypothetically();
    const b = await readyDraft(p.bluecrest);
    expect(await recordOutcome(U, ADMIN, p.bluecrest, { type: 'sent', draftId: b, attest: true })).toMatchObject({ ok: true, state: 'sent' });
    expect(draftRow(b).status).toBe('sent');
    const crm = rows('prospect').find((x) => x.id === rows('acquisitionProspect').find((a) => a.id === p.bluecrest)!.prospectId)!;
    expect(crm).toMatchObject({ stage: 'found', outreachSentAt: null });
    expect(rows('acquisitionTask').filter((t) => /draft_outreach|follow_up|classify_reply|qualify/.test(String(t.type)))).toHaveLength(0);
  });

  it('refuses outcomes that skip lifecycle steps', async () => {
    approveReceptionistHypothetically();
    const p = await research();
    const id = await readyDraft(p.coral);
    expect((await recordOutcome(U, ADMIN, p.coral, { type: 'meeting_booked' })).ok).toBe(false); // before any send
    await recordOutcome(U, ADMIN, p.coral, { type: 'sent', draftId: id, attest: true });
    expect((await recordOutcome(U, ADMIN, p.coral, { type: 'won', amount: 100, currency: 'NGN', reason: 'test' })).ok).toBe(false);
    expect((await recordOutcome(U, ADMIN, p.coral, { type: 'meeting_booked' })).ok).toBe(false); // no reply yet
    await expect(recordOutcome(U, ADMIN, p.coral, { type: 'proposal_sent' })).rejects.toThrow(); // amount required
    await expect(recordOutcome(U, ADMIN, p.coral, { type: 'reply', sentiment: 'positive', occurredAt: '2099-01-01T00:00:00Z' })).rejects.toThrow(/future/);
  });

  it('an opt-out suppresses the recipient and the clinic, blocks drafts, cancels work and prevents future outreach', async () => {
    approveReceptionistHypothetically();
    const p = await research();
    const id = await readyDraft(p.coral);
    await recordOutcome(U, ADMIN, p.coral, { type: 'sent', draftId: id, attest: true });
    const r = await recordOutcome(U, ADMIN, p.coral, { type: 'opt_out' });
    expect(r).toMatchObject({ ok: true, state: 'suppressed', suppressed: expect.arrayContaining(['email', 'domain']) });

    const dm = rows('acquisitionDecisionMaker').find((d) => d.id === draftRow(id).recipientDmId)!;
    expect(await findSuppressionHits(U, { email: String(dm.email) })).not.toHaveLength(0);
    expect(await findSuppressionHits(U, { domain: S2.domain })).toEqual([`domain:${S2.domain}`]);
    // Suppression rows are keyed hashes, never the address itself.
    expect(JSON.stringify(rows('acquisitionSuppression'))).not.toContain(String(dm.email));

    expect(rows('acquisitionTask').filter((t) => t.acqProspectId === p.coral && t.status === 'pending')).toHaveLength(0);
    const again = await generateDraft(U, ADMIN, p.coral);
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.reasons.map((x) => x.code)).toEqual(expect.arrayContaining(['prospect_state', 'recipient_suppressed']));
    expect(await storeContact({ userId: U, acqProspectId: p.coral, kind: 'role_inbox', email: `info@${S2.domain}`, sourceUrl: `https://${S2.domain}/`, confidence: 'high' } as never)).toMatchObject({ stored: false, reason: 'suppressed' });
  });

  it('an opt-out before anything was sent still blocks every active draft', async () => {
    const p = await research();
    const id = await generated(p.coral);
    expect(await recordOutcome(U, ADMIN, p.coral, { type: 'objection', reason: 'asked not to be contacted' })).toMatchObject({ ok: true, state: 'suppressed' });
    expect(draftRow(id).status).toBe('blocked');
    await expect(actOnDraft(U, ADMIN, id, { action: 'approve' })).rejects.toThrow();
  });

  it('suppressing the domain from the prospect actions blocks its drafts', async () => {
    const p = await research();
    const id = await generated(p.coral);
    await runAction(U, ADMIN, p.coral, { action: 'suppress_domain', reason: 'clinic objected by phone' });
    expect(draftRow(id).status).toBe('blocked');
  });

  it('erasing contacts erases draft text and blocks the drafts', async () => {
    const p = await research();
    const id = await generated(p.coral);
    await eraseContacts({ userId: U, acqProspectId: p.coral, reason: 'erasure', actor: ADMIN, domain: S2.domain });
    expect(draftRow(id)).toMatchObject({ status: 'invalidated', body: '[erased with contacts]', subject: '[erased with contacts]', recipientDmId: null });
  });

  it('lifecycle events produce accurate funnel metrics', async () => {
    approveReceptionistHypothetically();
    const p = await research();
    // Coral: sent → positive reply → meeting → proposal → won.
    const c = await readyDraft(p.coral);
    for (const o of [
      { type: 'sent', draftId: c, attest: true },
      { type: 'reply', sentiment: 'positive' },
      { type: 'meeting_booked' },
      { type: 'proposal_sent', amount: 450000, currency: 'NGN' },
      { type: 'won', amount: 400000, currency: 'NGN', reason: 'synthetic test deal' },
    ]) expect(await recordOutcome(U, ADMIN, p.coral, o)).toMatchObject({ ok: true });
    expect(state(p.coral)).toBe('won');
    // Bluecrest: sent → negative reply → lost.
    const b = await readyDraft(p.bluecrest);
    await recordOutcome(U, ADMIN, p.bluecrest, { type: 'sent', draftId: b, attest: true });
    await recordOutcome(U, ADMIN, p.bluecrest, { type: 'reply', sentiment: 'neutral' });
    await recordOutcome(U, ADMIN, p.bluecrest, { type: 'reply', sentiment: 'negative' }); // latest reply counts
    await recordOutcome(U, ADMIN, p.bluecrest, { type: 'lost', reason: 'not interested' });
    expect(state(p.bluecrest)).toBe('lost');
    // Glow: never drafted, opts out after contacting us.
    await recordOutcome(U, ADMIN, p.glow, { type: 'opt_out' });

    const m = await funnelMetrics(U);
    expect(m).toMatchObject({
      drafts: { generated: 2, approved: 2, markedReady: 2, currentlyReady: 0 },
      sent: 2, replied: 2, repliesBySentiment: { positive: 1, neutral: 0, negative: 1 },
      optOuts: 1, objections: 0, meetingsBooked: 1, proposalsSent: 1, proposalValue: { NGN: 450000 },
      won: 1, wonValue: { NGN: 400000 }, lost: 1,
      rates: { reply: 1, positiveReply: 0.5, optOut: 0.5, meetingPerSent: 0.5, proposalPerMeeting: 1, winPerProposal: 1 },
    });
    expect(m.prospectsByState).toMatchObject({ won: 1, lost: 1, suppressed: 1 });
  });

  it('metrics are empty-safe', async () => {
    const m = await funnelMetrics('nobody');
    expect(m.sent).toBe(0);
    expect(m.rates.reply).toBeNull();
  });
});
