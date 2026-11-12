import { describe, it, expect } from 'vitest';
import { campaignReady, fromDiscover, fromFinderPerson, statusOf, toLead, verificationOf } from '@/lib/acqContact';

const ctx = { company: 'Bright Smile Dental', domain: 'brightsmile.ng' };

describe('verificationOf', () => {
  it('a deliverability verdict wins over anything the source said', () => {
    expect(verificationOf({ verdict: 'valid', sourceStatus: 'not_valid' })).toBe('verified');
    expect(verificationOf({ verdict: 'invalid', sourceStatus: 'valid' })).toBe('invalid');
    expect(verificationOf({ verdict: 'unknown', sourceStatus: 'valid' })).toBe('unverified');
  });
  it('uses the source confirmation only when there is no verdict', () => {
    expect(verificationOf({ sourceStatus: 'valid' })).toBe('verified');
    expect(verificationOf({ sourceStatus: 'not_valid' })).toBe('invalid');
    expect(verificationOf({ sourceStatus: 'unknown' })).toBe('unverified');
    expect(verificationOf({})).toBe('unverified');
  });
});

describe('both routes give the same record shape', () => {
  const a = fromFinderPerson({ name: 'Ada Obi', title: 'Founder', email: 'ada@brightsmile.ng', emailStatus: 'valid' }, ctx);
  const b = fromDiscover({ firstName: 'Ada', lastName: 'Ob***', jobTitle: 'Founder', company: { name: 'Bright Smile Dental', domain: 'brightsmile.ng' } }, { name: 'Ada Obi', email: 'ada@brightsmile.ng', smtpStatus: 'valid' });
  it('has the same fields and statuses', () => {
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
    expect(a).toMatchObject({ name: 'Ada Obi', email: 'ada@brightsmile.ng', verification: 'verified' });
    expect(statusOf(a)).toEqual(statusOf(b));
    expect(a.route).toBe('business-search');
    expect(b.route).toBe('industry-discovery');
  });
  it('a hidden discovery result is a contact with no email, not a verified one', () => {
    const c = fromDiscover({ firstName: 'Ada', lastName: 'Ob***', jobTitle: 'CEO', company: { name: 'X', domain: 'x.com' } });
    expect(c.email).toBeUndefined();
    expect(c.name).toBe('Ada Ob***');
    expect(statusOf(c)).toMatchObject({ found: { label: 'No email' }, verified: null });
  });
});

describe('found and verified are separate statuses', () => {
  it('a found email is not shown as verified', () => {
    const s = statusOf(fromFinderPerson({ name: 'A', title: '', email: 'a@x.com', emailBasis: 'guess' }, ctx));
    expect(s.found.label).toBe('Found: best guess');
    expect(s.verified?.label).toBe('Not verified');
    expect(s.verified?.tone).toBe('amber');
  });
  it('an invalid email says so and is struck out of any campaign', () => {
    const c = fromFinderPerson({ name: 'A', title: '', email: 'a@x.com' }, ctx, 'invalid');
    expect(statusOf(c).verified?.label).toBe('Invalid');
    expect(campaignReady(c, { includeUnverified: true })).toBe(false);
  });
  it('never names a data provider in a label or hint', () => {
    for (const basis of ['published', 'inferred', 'guess', undefined] as const) {
      const s = statusOf(fromFinderPerson({ name: 'A', title: '', email: 'a@x.com', emailBasis: basis, emailStatus: 'Snov.io: valid' }, ctx));
      expect(JSON.stringify(s)).not.toMatch(/snov|hunter|apollo|google/i);
    }
  });
});

describe('campaign readiness', () => {
  const unverified = fromFinderPerson({ name: 'A', title: '', email: 'a@x.com', emailBasis: 'guess' }, ctx);
  const published = fromFinderPerson({ name: 'A', title: '', email: 'a@x.com', emailBasis: 'published' }, ctx);
  const verified = fromFinderPerson({ name: 'A', title: '', email: 'a@x.com', emailBasis: 'guess' }, ctx, 'valid');
  it('verified is always ready; a guess only when included', () => {
    expect(campaignReady(verified)).toBe(true);
    expect(campaignReady(unverified)).toBe(false);
    expect(campaignReady(unverified, { includeUnverified: true })).toBe(true);
  });
  it('a published address keeps counting as ready unless that rule is switched off', () => {
    expect(campaignReady(published)).toBe(true);
    expect(campaignReady(published, { publishedCounts: false })).toBe(false);
  });
  it('no email is never ready, and a lead needs an email', () => {
    const none = fromFinderPerson({ name: 'A', title: '' }, ctx);
    expect(campaignReady(none, { includeUnverified: true })).toBe(false);
    expect(toLead(none)).toBeNull();
    expect(toLead(verified)).toMatchObject({ email: 'a@x.com', business: 'Bright Smile Dental', website: 'brightsmile.ng' });
  });
});
