import { describe, it, expect } from 'vitest';
import { assertAllowed, targetFor } from '@/lib/career/submit/platform';
import { bestAnswer, kindOf, planForm, type FormField } from '@/lib/career/submit/mapper';
import { CHALLENGE_TEXT, CONFIRMATION, CLOSED_TEXT } from '@/lib/career/submit/detect';
import { fromGreenhouse } from '@/lib/career/jobs/sources';
import { sanitizeProfile } from '@/lib/career/types';

describe('platform targets and the host allow-list', () => {
  it('Greenhouse needs the remembered board; Lever must be on an allowed host', () => {
    expect(targetFor({ source: 'greenhouse', externalId: 'stripe/8172510', url: 'https://stripe.com/jobs' })).toEqual({ platform: 'greenhouse', applyUrl: 'https://job-boards.greenhouse.io/stripe/jobs/8172510' });
    expect(targetFor({ source: 'greenhouse', externalId: '8172510', url: 'x' })).toBeNull();
    expect(targetFor({ source: 'lever', externalId: 'a', url: 'https://jobs.lever.co/palantir/6ed76ce8-4156-4b60-b120-403538bd66cd' })?.applyUrl).toBe('https://jobs.lever.co/palantir/6ed76ce8-4156-4b60-b120-403538bd66cd/apply');
  });
  it('never targets another host, another scheme, or a look-alike', () => {
    for (const url of ['https://evil.test/palantir/6ed76ce8-4156-4b60-b120-403538bd66cd', 'http://jobs.lever.co/p/6ed76ce8-4156-4b60-b120-403538bd66cd', 'https://jobs.lever.co.evil.test/p/6ed76ce8-4156-4b60-b120-403538bd66cd', 'https://jobs.lever.co/p/../../x'])
      expect(targetFor({ source: 'lever', externalId: 'a', url })).toBeNull();
    expect(targetFor({ source: 'remotive', externalId: 'a', url: 'https://remotive.com/x' })).toBeNull();
    expect(() => assertAllowed('https://evil.test/x')).toThrow(/not a supported/); expect(() => assertAllowed('http://jobs.lever.co/x')).toThrow();
    expect(assertAllowed('https://jobs.lever.co/x')).toBe('lever'); expect(assertAllowed('http://127.0.0.1:9/x', ['127.0.0.1:9'])).toBe('fixture');
  });
  it('discovery now keeps the Greenhouse board in the id', () => {
    expect(fromGreenhouse({ jobs: [{ id: 5, absolute_url: 'https://x.test/5', title: 'T' }] }, 'Stripe', 'stripe')[0].externalId).toBe('stripe/5');
  });
});

const f = (label: string, type: FormField['type'] = 'text', required = true, extra: Partial<FormField> = {}): FormField => ({ id: label, label, type, required, ...extra });
const cv = sanitizeProfile({ name: 'Ada Obi', email: 'ada@example.com', phone: '+234 801 234 5678', location: 'Lagos, Nigeria', experience: [{ title: 'Dev', company: 'Bright Labs', start: '2021', end: 'Present', bullets: [] }] });

describe('kindOf', () => {
  it('recognises ordinary fields', () => {
    expect(kindOf(f('First Name'))).toBe('first_name'); expect(kindOf(f('Last name'))).toBe('last_name'); expect(kindOf(f('Full name'))).toBe('full_name');
    expect(kindOf(f('Email', 'email'))).toBe('email'); expect(kindOf(f('Phone', 'tel'))).toBe('phone'); expect(kindOf(f('Resume/CV', 'file'))).toBe('resume');
    expect(kindOf(f('LinkedIn Profile'))).toBe('linkedin'); expect(kindOf(f('Current company'))).toBe('company'); expect(kindOf(f('Cover letter', 'textarea'))).toBe('cover_text');
  });
  it('treats legal, eligibility, diversity and consent as only-the-candidate', () => {
    for (const l of ['Are you legally authorized to work in the United States?', 'Will you now or in the future require visa sponsorship?', 'Gender', 'Race / Ethnicity', 'Veteran status', 'Do you have a disability?', 'Have you ever been convicted of a crime?', 'Are you related to a current employee?'])
      expect(kindOf(f(l, 'radio'))).toBe('sensitive');
    expect(kindOf(f('I have read and agree to the Privacy Notice', 'checkbox'))).toBe('consent');
  });
});

describe('planForm: nothing is invented', () => {
  const answers = [{ question: 'Why do you want this role?', answer: 'I build React dashboards.' }, { question: 'What are your salary expectations?', answer: 'USD 3000 per month.' }];
  const fields = [f('First Name'), f('Last Name'), f('Email', 'email'), f('Phone', 'tel', false), f('Resume/CV', 'file'), f('LinkedIn Profile', 'text', false), f('Why do you want this role at Acme?', 'textarea'), f('What are your salary expectations?', 'text')];
  it('fills only from the profile and approved answers', () => {
    const p = planForm(fields, cv, { coverLetter: 'Dear team', answers });
    expect(p.unresolved).toEqual([]);
    expect(Object.fromEntries(p.fill.map((x) => [x.field.label, x.value]))).toMatchObject({ 'First Name': 'Ada', 'Last Name': 'Obi', Email: 'ada@example.com', 'What are your salary expectations?': 'USD 3000 per month.' });
    expect(p.fill.find((x) => x.field.label.startsWith('Why'))!.source).toBe('approved answer');
    expect(p.skipped.map((s) => s.label)).toContain('LinkedIn Profile');   // optional + no data: left blank, not made up
  });
  it('STOPS on a required question it cannot answer, and on every legal/consent question', () => {
    const p = planForm([...fields, f('Describe your experience with Kubernetes', 'textarea'), f('Are you legally authorized to work in the US?', 'radio', true, { options: ['Yes', 'No'] }), f('I agree to the Privacy Policy', 'checkbox'), f('Gender', 'select', false)], cv, { coverLetter: '', answers });
    expect(p.unresolved.map((u) => u.label)).toEqual(expect.arrayContaining(['Describe your experience with Kubernetes', 'Are you legally authorized to work in the US?', 'I agree to the Privacy Policy']));
    expect(p.skipped.map((s) => s.label)).toContain('Gender');             // optional diversity question: skipped, never answered
    expect(p.fill.some((x) => /authorized|Gender|Privacy|Kubernetes/.test(x.field.label))).toBe(false);
  });
  it('a missing email or phone on the profile is a stop, not a guess', () => {
    const bare = sanitizeProfile({ name: 'Ada Obi' }); const p = planForm([f('Email', 'email'), f('Phone', 'tel')], bare, { coverLetter: '', answers: [] });
    expect(p.unresolved).toHaveLength(2); expect(p.fill).toEqual([]);
  });
  it('an approved answer must really fit: choices must match, and vague overlap is not enough', () => {
    expect(planForm([f('Why do you want this role?', 'select', true, { options: ['Money', 'Fun'] })], cv, { coverLetter: '', answers }).unresolved).toHaveLength(1);
    expect(bestAnswer('How did you hear about us?', answers)).toBeNull(); expect(bestAnswer('Why do you want this role at Acme?', answers)?.answer).toMatch(/React/);
  });
});

describe('page detection words', () => {
  it('confirmation and challenge text', () => {
    expect(CONFIRMATION.greenhouse.test('Thank you for applying to Stripe!')).toBe(true); expect(CONFIRMATION.lever.test('Application submitted! We will be in touch.')).toBe(true);
    expect(CONFIRMATION.greenhouse.test('Please fill in the form')).toBe(false);
    expect(CHALLENGE_TEXT.test('Please verify you are human')).toBe(true); expect(CHALLENGE_TEXT.test('Enter the security code we emailed you')).toBe(true);
    expect(CLOSED_TEXT.test('This job is no longer accepting applications')).toBe(true);
  });
});

describe('regression: found on real forms (GitLab / Figma / Lever)', () => {
  it('a legal question that mentions "employer" is NOT the current-company field', () => {
    const q = 'Are you subject to any employment agreements and/or post-employment restrictions with your current employer or a past employer that may impact your ability to perform this role?';
    expect(kindOf(f(q, 'radio'))).toBe('sensitive'); expect(kindOf(f(q, 'text'))).toBe('sensitive'); expect(kindOf(f(q, 'textarea'))).toBe('sensitive');
    const p = planForm([f(q, 'text')], cv, { coverLetter: '', answers: [] }); expect(p.fill).toEqual([]); expect(p.unresolved).toHaveLength(1);
  });
  it('long, question-like labels never become contact fields', () => {
    for (const l of ['What is your current location and are you willing to relocate?', 'Please share a link to your best work and explain why', 'What phone number may we use to reach you, and when is best?'])
      expect(['question', 'sensitive']).toContain(kindOf(f(l, 'text')));
  });
  it('previous-employment, referral and notice-period questions are the candidate\'s to answer', () => {
    for (const l of ['Have you previously worked at or consulted for GitLab?', 'Have you ever worked for Figma before, as an employee or a contractor/consultant?', 'Were you referred by an employee?', 'What is your notice period?']) expect(kindOf(f(l, 'text'))).toBe('sensitive');
  });
  it('real labels still map', () => {
    expect(kindOf(f('Current company'))).toBe('company'); expect(kindOf(f('Location (City)'))).toBe('location'); expect(kindOf(f('Preferred First Name'))).toBe('first_name');
    expect(kindOf(f('Phone', 'tel'))).toBe('phone'); expect(kindOf(f('LinkedIn Profile'))).toBe('linkedin'); expect(kindOf(f('Website', 'url'))).toBe('website');
  });
});

import { sanitizePreferences } from '@/lib/career/types';
describe('saved details (standing answers)', () => {
  const st = sanitizePreferences({ standing: { linkedin: 'https://www.linkedin.com/in/ada', authorizedToWork: 'yes', needsSponsorship: 'no', residenceCountry: 'Nigeria', howHeard: 'Job board' } }).standing;
  const yn = (label: string) => f(label, 'radio', true, { options: ['Yes', 'No'] });
  it('sanitizer only keeps real links and yes/no', () => {
    const s = sanitizePreferences({ standing: { linkedin: 'javascript:alert(1)', github: 'not a url', website: 'https://ada.dev', authorizedToWork: 'maybe', needsSponsorship: 'no' } }).standing;
    expect(s).toMatchObject({ linkedin: '', github: '', website: 'https://ada.dev/', authorizedToWork: '', needsSponsorship: 'no' });
  });
  it('answers ONLY work authorization and sponsorship, from what the candidate saved', () => {
    const p = planForm([yn('Are you legally authorized to work in the country for which you are applying?'), yn('Will you now or in the future require sponsorship for a visa?'), f('LinkedIn Profile'), f('What is your current country of residence?', 'select', true, { options: ['Ghana', 'Nigeria'] }), f('How did you hear about this role?')], cv, { coverLetter: '', answers: [], standing: st });
    expect(p.unresolved).toEqual([]);
    expect(Object.fromEntries(p.fill.map((x) => [x.field.label.slice(0, 12), x.value]))).toMatchObject({ 'Are you lega': 'Yes', 'Will you now': 'No', 'LinkedIn Pro': 'https://www.linkedin.com/in/ada', 'What is your': 'Nigeria', 'How did you ': 'Job board' });
    expect(p.fill.every((x) => x.source === 'your saved details')).toBe(true);
  });
  it('still stops on every other legal question, and on authorization when nothing was saved', () => {
    const p = planForm([yn('Are you a Singapore citizen?'), yn('Do you require a security clearance?'), yn('Have you previously worked at Acme?'), f('Gender', 'select', true, { options: ['Male', 'Female'] }), yn('Are you legally authorized to work in the US?')], cv, { coverLetter: '', answers: [], standing: { ...st, authorizedToWork: '' } });
    expect(p.unresolved).toHaveLength(5); expect(p.fill).toEqual([]);
  });
  it('a saved answer is never typed into a free-text legal field', () => {
    expect(planForm([f('Are you legally authorized to work in the US?', 'text')], cv, { coverLetter: '', answers: [], standing: st }).unresolved).toHaveLength(1);
  });
});
