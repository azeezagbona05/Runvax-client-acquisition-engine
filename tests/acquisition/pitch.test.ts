/**
 * Deterministic pitch generation (no model). Synthetic inputs only.
 */
import { describe, it, expect } from 'vitest';
import { buildPitch, OPT_OUT_LINE, type PitchInput, type PitchSignal } from '@/lib/acquisition/pitch';
import { evaluateDraftGate, draftHash } from '@/lib/acquisition/gate';
import { dental } from '@/lib/acquisition/config/industries/dental';
import { getOffer } from '@/lib/acquisition/config/registry';

const NOW = new Date('2026-10-14T10:00:00Z');
const DAY = 86_400_000;
const RECEPTIONIST = getOffer(dental, 'ai_receptionist')!;

const sig = (id: string, code: string, value: unknown, basis = 'observed', ageDays = 1, over: Partial<PitchSignal> = {}): PitchSignal => ({
  id, code, value, basis, confidence: 'high', sourceUrl: `https://coral-fixture.ng/${code}`, evidenceQuote: `quote for ${code}`,
  observedAt: new Date(NOW.getTime() - ageDays * DAY), lastVerifiedAt: new Date(NOW.getTime() - ageDays * DAY), ...over,
});
const finding = (id: string, category: string, signalIds: string[], basis = 'observed', polarity = 'weakness') => ({ id, category, polarity, basis, signalIds });

function input(over: Partial<PitchInput> = {}): PitchInput {
  return {
    industry: dental,
    offer: RECEPTIONIST,
    businessName: 'Coral Fixture Clinic',
    domain: 'coral-fixture.ng',
    prospectState: 'strategized',
    recommendedOfferId: 'ai_receptionist',
    signals: [
      sig('s-book', 'online_booking_present', false),
      sig('s-form', 'contact_form_present', false),
      sig('s-wa', 'whatsapp_entry_point', null, 'unknown'),
      sig('s-chat', 'chat_widget_present', false, 'inferred'),
      sig('s-appt', 'appointment_driven', true, 'inferred'),
    ],
    findings: [
      finding('f-book', 'booking_friction', ['s-book']),
      finding('f-form1', 'enquiry_conversion', ['s-form']),
      finding('f-form2', 'enquiry_handling', ['s-form']),
      finding('f-chat', 'enquiry_handling', ['s-chat'], 'inferred'),
    ],
    recipient: { id: 'dm1', kind: 'role_inbox', name: null, email: 'reception@coral-fixture.ng', flags: null },
    recipientSuppressed: false,
    now: NOW,
    ...over,
  };
}

const ok = (i: PitchInput) => {
  const r = buildPitch(i);
  if (!r.ok) throw new Error(`refused: ${JSON.stringify(r.reasons)}`);
  return r;
};
const refusalCodes = (i: PitchInput) => {
  const r = buildPitch(i);
  return r.ok ? [] : r.reasons.map((x) => x.code);
};

describe('evidence attribution', () => {
  it('cites exactly the observed signals it puts into words, with their source, quote and findings', () => {
    const r = ok(input());
    expect(r.citedSignalIds).toEqual(['s-book', 's-form']);
    expect(r.citedFindingIds.sort()).toEqual(['f-book', 'f-form1', 'f-form2']);
    expect(r.cited.map((c) => [c.code, c.value, c.basis, c.sourceUrl, c.quote])).toEqual([
      ['online_booking_present', false, 'observed', 'https://coral-fixture.ng/online_booking_present', 'quote for online_booking_present'],
      ['contact_form_present', false, 'observed', 'https://coral-fixture.ng/contact_form_present', 'quote for contact_form_present'],
    ]);
    // Every cited sentence appears verbatim in the text, and the text names the site and the date checked.
    for (const c of r.cited) expect(r.body).toContain(c.sentence);
    expect(r.body).toContain('When I looked at coral-fixture.ng on 13 October 2026');
  });

  it('separates inferred and unknown evidence for the reviewer and never states it', () => {
    const r = ok(input());
    expect(r.inferred.map((n) => n.code).sort()).toEqual(['appointment_driven', 'chat_widget_present']);
    expect(r.unknown.map((n) => n.code)).toContain('whatsapp_entry_point');
    expect(r.body).not.toMatch(/whatsapp|chat|appointment.driven/i);
  });

  it('is deterministic: the same evidence always produces the same text', () => {
    const a = ok(input());
    const b = ok(input());
    expect(draftHash(a.subject, a.body)).toBe(draftHash(b.subject, b.body));
  });

  it('opens personally: clinic team for an inbox, the person for a manually entered named contact', () => {
    expect(ok(input()).body.startsWith('Hello Coral Fixture Clinic team,')).toBe(true);
    const named = ok(input({ recipient: { id: 'dm2', kind: 'manual_named', name: 'Dr Ada Fixture', email: 'ada@coral-fixture.ng', flags: null } }));
    expect(named.body.startsWith('Dear Dr Ada Fixture,')).toBe(true);
  });

  it('has the offer relevance, one call to action and an opt-out line', () => {
    const r = ok(input());
    expect(r.body).toContain(RECEPTIONIST.pitch!.relevance);
    expect(r.body).toContain(RECEPTIONIST.pitch!.cta);
    expect(r.body.match(/\?/g)).toHaveLength(1);
    expect(r.body).toContain(OPT_OUT_LINE);
    expect(r.subject).toBe('Coral Fixture Clinic: a question about patient enquiries and appointment requests');
  });
});

describe('no unsupported claims', () => {
  it('passes every content rule of the delivery gate (claims, prohibited phrases, placeholders, length, opt-out, quality gate)', () => {
    const r = ok(input());
    const gate = evaluateDraftGate({
      industry: dental, businessName: 'Coral Fixture Clinic', prospectState: 'approved',
      draft: { status: 'approved', channel: 'email', subject: r.subject, body: r.body, offerId: 'ai_receptionist', evidenceFindingIds: r.citedFindingIds },
      latestApproval: { action: 'approve', bodyHashAfter: draftHash(r.subject, r.body) },
      recipient: { email: 'reception@coral-fixture.ng', verification: 'unverified' },
      prospectFindingIds: r.citedFindingIds, suppressionHits: [], senderIdentity: null, sentToday: 0,
    });
    // Only "the offer isn't approved" and the delivery-time rules remain.
    expect(gate.blocks.map((b) => b.code).sort()).toEqual(['live_sending_disabled', 'offer_unconfigured', 'sender_identity_missing']);
  });

  it('states absences as what we could not find, never as a fact about the clinic or a promised result', () => {
    const r = ok(input());
    const lower = r.body.toLowerCase();
    for (const p of [...(RECEPTIONIST.prohibitedClaims ?? []), ...dental.outreach.prohibitedPhrases]) expect(lower).not.toContain(p.toLowerCase());
    expect(r.body).not.toMatch(/you (don't|do not|have no|lack)|you're losing|missing out|\d+%|₦|naira|price|guarantee/i);
    expect(r.body).toMatch(/I couldn't find/);
  });

  it('never phrases strengths, inferred or unknown signals as observations', () => {
    const r = buildPitch(input({
      signals: [sig('s-book', 'online_booking_present', true), sig('s-form', 'contact_form_present', false, 'inferred')],
      findings: [finding('f-book', 'booking_friction', ['s-book'], 'observed', 'strength'), finding('f-form', 'enquiry_conversion', ['s-form'], 'inferred')],
    }));
    expect(r.ok).toBe(false);
  });
});

describe('refusals (no draft, with reasons)', () => {
  it('insufficient evidence: only inferred / unknown signals', () => {
    expect(refusalCodes(input({ findings: [finding('f-chat', 'enquiry_handling', ['s-chat'], 'inferred')] }))).toEqual(['insufficient_evidence']);
  });

  it('insufficient evidence: an observation past the 180-day freshness limit', () => {
    const old = input({ signals: [sig('s-book', 'online_booking_present', false, 'observed', 200)], findings: [finding('f-book', 'booking_friction', ['s-book'])] });
    expect(refusalCodes(old)).toEqual(['insufficient_evidence']);
    // 90–180 days: still usable, but flagged for re-verification.
    const ageing = ok(input({ signals: [sig('s-book', 'online_booking_present', false, 'observed', 120)], findings: [finding('f-book', 'booking_friction', ['s-book'])] }));
    expect(ageing.cited[0].needsReverify).toBe(true);
    expect(ageing.warnings.join(' ')).toMatch(/re-verification/);
  });

  it('insufficient evidence: observations outside the offer\'s evidence categories', () => {
    const r = input({ signals: [sig('s-sd', 'structured_data_dentist', false)], findings: [finding('f-sd', 'search_visibility', ['s-sd'])] });
    expect(refusalCodes(r)).toEqual(['insufficient_evidence']);
  });

  it('no website domain to attribute observations to', () => {
    expect(refusalCodes(input({ domain: null }))).toContain('insufficient_evidence');
  });

  it('no recipient, a shared recipient, or a suppressed recipient', () => {
    expect(refusalCodes(input({ recipient: null }))).toEqual(['no_recipient']);
    expect(refusalCodes(input({ recipient: { id: 'dm1', kind: 'business_phone', name: null, email: null, flags: null } }))).toEqual(['no_recipient']);
    expect(refusalCodes(input({ recipient: { id: 'dm1', kind: 'role_inbox', name: null, email: 'info@coral-fixture.ng', flags: { duplicateOf: 'other' } } }))).toEqual(['no_recipient']);
    expect(refusalCodes(input({ recipientSuppressed: true }))).toEqual(['recipient_suppressed']);
  });

  it('a prospect that is not strategized, no recommendation, or a different recommended offer', () => {
    expect(refusalCodes(input({ prospectState: 'audited' }))).toEqual(['prospect_state']);
    expect(refusalCodes(input({ prospectState: 'suppressed' }))).toEqual(['prospect_state']);
    expect(refusalCodes(input({ recommendedOfferId: 'none' }))).toEqual(['no_recommendation']);
    expect(refusalCodes(input({ recommendedOfferId: 'ai_voice_agent' }))).toEqual(['offer_not_recommended']);
  });

  it('an offer without a pitch template or evidence requirement', () => {
    expect(refusalCodes(input({ offer: getOffer(dental, 'ai_voice_agent'), recommendedOfferId: 'ai_voice_agent' }))).toContain('no_pitch_template');
  });

  it('an unapproved offer still yields a reviewable draft, explicitly flagged as not sellable', () => {
    expect(RECEPTIONIST.status).toBe('unconfigured');
    expect(ok(input()).warnings[0]).toMatch(/not approved for sale.*cannot be marked ready/);
  });
});
