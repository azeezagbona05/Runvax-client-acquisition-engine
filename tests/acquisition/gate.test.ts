import { describe, it, expect } from 'vitest';
import { evaluateDraftGate, draftHash, checkDraftForDelivery, deliverDraft, GateBlockedError, type GateInput, type GateBlockCode } from '@/lib/acquisition/gate';
import { dental } from '@/lib/acquisition/config/industries/dental';
import type { IndustryConfig } from '@/lib/acquisition/config/schema';
import { rows, seed } from '../helpers/fakePrisma';
import { addSuppression } from '@/lib/acquisition/suppression';

const BODY =
  'Hello Dr Ade, I noticed Smile Dental’s Google profile lists no opening hours and booking is by phone only. ' +
  'Would a short call next week to compare notes on how patients book be useful? ' +
  'If you would rather not hear from us, reply STOP to unsubscribe.';
const SUBJECT = 'Booking at Smile Dental';

// A hypothetical fully-configured industry, so the happy path can be proven.
// The real dental pack stays unconfigured and live-send-off.
function liveIndustry(): IndustryConfig {
  const c = JSON.parse(JSON.stringify(dental)) as IndustryConfig;
  c.compliance.liveSendingEnabled = true;
  c.compliance.dailySendCap = 20;
  c.offers[1] = { ...c.offers[1], status: 'approved', description: 'Approved description', scope: 'Approved scope', approvedClaims: ['answers enquiries within 2 hours'] };
  return c;
}

function passing(over: Partial<GateInput> = {}): GateInput {
  return {
    industry: liveIndustry(),
    businessName: 'Smile Dental',
    prospectState: 'approved',
    draft: { status: 'approved', channel: 'email', subject: SUBJECT, body: BODY, offerId: 'ai_receptionist', evidenceFindingIds: ['f1'] },
    latestApproval: { action: 'approve', bodyHashAfter: draftHash(SUBJECT, BODY) },
    recipient: { email: 'ade@smiledental.ng', verification: 'verified' },
    prospectFindingIds: ['f1', 'f2'],
    suppressionHits: [],
    senderIdentity: { name: 'Harzotech', postalAddress: '1 Test Street, Lagos' },
    sentToday: 0,
    ...over,
  };
}

const codes = (i: GateInput) => evaluateDraftGate(i).blocks.map((b) => b.code);
const withDraft = (d: Partial<GateInput['draft']>) => {
  const base = passing();
  const draft = { ...base.draft, ...d };
  return passing({ draft, latestApproval: { action: 'approve', bodyHashAfter: draftHash(draft.subject, draft.body) } });
};

describe('evaluateDraftGate', () => {
  it('allows a fully compliant, approved, evidence-backed draft (hypothetical live config)', () => {
    const r = evaluateDraftGate(passing());
    expect(r.blocks).toEqual([]);
    expect(r.allowed).toBe(true);
  });

  it('blocks everything with the real dental pack (offers unconfigured, live sending off)', () => {
    const c = codes(passing({ industry: dental }));
    expect(c).toEqual(expect.arrayContaining(['offer_unconfigured', 'live_sending_disabled']));
  });

  it.each<[string, GateInput, GateBlockCode]>([
    ['unapproved draft', passing({ draft: { ...passing().draft, status: 'pending_approval' } }), 'not_approved'],
    ['rejected draft', passing({ draft: { ...passing().draft, status: 'rejected' } }), 'not_approved'],
    ['edited after approval', passing({ draft: { ...passing().draft, body: `${BODY} Extra.` } }), 'approval_stale'],
    ['approval record missing', passing({ latestApproval: null }), 'approval_stale'],
    ['last action was a rejection', passing({ latestApproval: { action: 'reject', bodyHashAfter: draftHash(SUBJECT, BODY) } }), 'approval_stale'],
    ['WhatsApp channel', passing({ draft: { ...passing().draft, channel: 'whatsapp' } }), 'channel_not_allowed'],
    ['no recipient', passing({ recipient: null }), 'no_recipient'],
    ['bounced recipient', passing({ recipient: { email: 'a@b.ng', verification: 'bounced' } }), 'recipient_invalid'],
    ['conflicting recipient', passing({ recipient: { email: 'a@b.ng', verification: 'conflicting' } }), 'recipient_invalid'],
    ['suppressed contact', passing({ suppressionHits: ['email:ade@smiledental.ng'] }), 'contact_suppressed'],
    ['suppressed domain', passing({ suppressionHits: ['domain:smiledental.ng'] }), 'contact_suppressed'],
    ['opted-out prospect', passing({ prospectState: 'suppressed' }), 'prospect_inactive'],
    ['cancelled prospect', passing({ prospectState: 'cancelled' }), 'prospect_inactive'],
    ['no evidence', withDraft({ evidenceFindingIds: [] }), 'missing_evidence'],
    ['evidence not an array', withDraft({ evidenceFindingIds: 'f1' }), 'missing_evidence'],
    ['evidence from another prospect', withDraft({ evidenceFindingIds: ['f1', 'f999'] }), 'evidence_not_found'],
    ['unknown offer', withDraft({ offerId: 'website_redesign' }), 'offer_unknown'],
    ['unconfigured offer', withDraft({ offerId: 'ai_voice_agent' }), 'offer_unconfigured'],
    ['missing unsubscribe', withDraft({ body: 'Hello, I noticed your profile lists no hours. Would a short call help?' }), 'missing_unsubscribe'],
    ['placeholder', withDraft({ body: `Hello [OWNER NAME], ${BODY}` }), 'unfilled_placeholder'],
    ['template braces', withDraft({ body: `Hello {{first_name}}, ${BODY}` }), 'unfilled_placeholder'],
    ['too long', withDraft({ body: `${'word '.repeat(130)} reply STOP to unsubscribe` }), 'too_long'],
    ['prohibited dental phrase', withDraft({ body: `${BODY} Our approach is painless.` }), 'prohibited_phrase'],
    ['no sender identity', passing({ senderIdentity: null }), 'sender_identity_missing'],
    ['sender without address', passing({ senderIdentity: { name: 'Harzotech', postalAddress: '' } }), 'sender_identity_missing'],
    ['daily cap reached', passing({ sentToday: 20 }), 'daily_cap_reached'],
    ['existing quality gate failure', withDraft({ body: `I hope this finds you well. ${BODY}` }), 'quality_gate_failed'],
  ])('blocks: %s', (_name, input, code) => {
    const r = evaluateDraftGate(input);
    expect(r.allowed).toBe(false);
    expect(r.blocks.map((b) => b.code)).toContain(code);
  });

  it.each([
    ['naira price', 'It is only ₦150,000 to start.'],
    ['dollar price', 'Plans start at $99.'],
    ['pricing language', 'Our pricing is simple.'],
    ['guarantee', 'We guarantee a fuller diary.'],
    ['risk-free', 'Try it risk-free.'],
    ['percentage', 'Clinics see a 40% lift.'],
    ['multiplier', 'That is a 3x improvement.'],
    ['outcome promise', 'This will increase your bookings.'],
    ['more patients', 'Get more patients this quarter.'],
    ['third-party result', 'Clinics like yours saw great results.'],
    ['our clients', 'Our clients love it.'],
    ['delivery timeline', 'We can go live in 7 days.'],
  ])('blocks unsupported claim: %s', (_name, sentence) => {
    const r = evaluateDraftGate(withDraft({ body: `${BODY} ${sentence}` }));
    expect(r.blocks.map((b) => b.code)).toContain('unsupported_claim');
  });

  it('allows a claim only when it is an approved claim of an approved offer', () => {
    expect(evaluateDraftGate(withDraft({ body: `${BODY} It answers enquiries within 2 hours.` })).allowed).toBe(true);
    // Same sentence, but the offer is unconfigured → still blocked.
    const r = evaluateDraftGate(withDraft({ body: `${BODY} It answers enquiries within 2 hours.`, offerId: 'ai_voice_agent' }));
    expect(r.allowed).toBe(false);
  });

  it('an offer-level prohibited claim blocks even when the offer is approved', () => {
    const r = evaluateDraftGate(withDraft({ body: `${BODY} It answers enquiries 24/7.` }));
    expect(r.blocks).toContainEqual({ code: 'prohibited_phrase', detail: 'Prohibited for AI Receptionist: "24/7"' });
  });

  it('an approval for different evidence or offer versions is stale', () => {
    const base = passing();
    const ok = passing({ latestApproval: { ...base.latestApproval!, evidenceHash: 'e1', offerHash: 'o1' }, currentEvidenceHash: 'e1', currentOfferHash: 'o1' });
    expect(evaluateDraftGate(ok).allowed).toBe(true);
    expect(codes(passing({ latestApproval: { ...base.latestApproval!, evidenceHash: 'e1', offerHash: 'o1' }, currentEvidenceHash: 'e2', currentOfferHash: 'o1' }))).toContain('approval_stale');
    expect(codes(passing({ latestApproval: { ...base.latestApproval!, evidenceHash: 'e1', offerHash: 'o1' }, currentEvidenceHash: 'e1', currentOfferHash: 'o2' }))).toContain('approval_stale');
  });

  it('accepts a ready draft as approved, but nothing else', () => {
    expect(evaluateDraftGate(passing({ draft: { ...passing().draft, status: 'ready' } })).allowed).toBe(true);
    for (const status of ['pending_approval', 'stale', 'rejected', 'blocked', 'superseded']) {
      expect(codes(passing({ draft: { ...passing().draft, status } }))).toContain('not_approved');
    }
  });

  it('flags (but does not block) unverified and personal-provider recipients', () => {
    const r = evaluateDraftGate(passing({ recipient: { email: 'ade.smiles@gmail.com', verification: 'unverified' } }));
    expect(r.allowed).toBe(true);
    expect(r.warnings.join(' ')).toMatch(/not verified/);
    expect(r.warnings.join(' ')).toMatch(/personal email/);
  });
});

describe('checkDraftForDelivery / deliverDraft', () => {
  function seedDraft(status = 'approved') {
    seed('prospect', { id: 'p1', userId: 'u1', businessName: 'Smile Dental' });
    seed('acquisitionProspect', { id: 'ap1', userId: 'u1', prospectId: 'p1', industryKey: 'dental', state: 'approved', prospect: { businessName: 'Smile Dental' } });
    seed('acquisitionFinding', { id: 'f1', userId: 'u1', acqProspectId: 'ap1' });
    seed('acquisitionDecisionMaker', { id: 'dm1', userId: 'u1', acqProspectId: 'ap1', email: 'ade@smiledental.ng', verification: 'verified' });
    seed('acquisitionDraft', { id: 'd1', userId: 'u1', acqProspectId: 'ap1', recipientDmId: 'dm1', channel: 'email', subject: SUBJECT, body: BODY, offerId: 'ai_receptionist', evidenceFindingIds: ['f1'], status });
    seed('acquisitionApproval', { id: 'a1', userId: 'u1', draftId: 'd1', action: 'approve', bodyHashAfter: draftHash(SUBJECT, BODY) });
  }

  it('loads facts, blocks under the real dental pack, and stores the result on the draft', async () => {
    seedDraft();
    const r = await checkDraftForDelivery('u1', 'd1');
    expect(r.allowed).toBe(false);
    expect(r.blocks.map((b) => b.code)).toEqual(expect.arrayContaining(['offer_unconfigured', 'sender_identity_missing', 'live_sending_disabled']));
    expect(rows('acquisitionDraft')[0].gateResult).toEqual(r);
  });

  it('honours suppression entries', async () => {
    seedDraft();
    await addSuppression({ userId: 'u1', kind: 'domain', value: 'smiledental.ng', reason: 'manual', source: 'test' });
    const r = await checkDraftForDelivery('u1', 'd1');
    expect(r.blocks.map((b) => b.code)).toContain('contact_suppressed');
  });

  it('will not load another user’s draft', async () => {
    seedDraft();
    await expect(checkDraftForDelivery('someone_else', 'd1')).rejects.toThrow(/not found/);
  });

  it('deliverDraft refuses through the gate and never sends', async () => {
    seedDraft('pending_approval');
    await expect(deliverDraft('u1', 'd1')).rejects.toBeInstanceOf(GateBlockedError);
    expect(rows('acquisitionDraft')[0].status).toBe('pending_approval');
  });
});
