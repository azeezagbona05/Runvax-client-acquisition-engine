import { describe, it, expect } from 'vitest';
import { buildFromBrief, parseKnobs, planFromGoal } from '@/lib/campaignBuilder';
import { sanitizeBrief, goalTarget, shortOffer, emptyBrief } from '@/lib/campaignBrief';
import { canonTokens } from '@/lib/outreachCampaign';
import { dayNumbers, sanitizeAutomation, toCampaignFields } from '@/lib/automation';

const brief = sanitizeBrief({
  name: 'Dental AI Hub – Clinic Outreach',
  objective: 'book_meetings',
  offer: 'Dental AI Hub – AI enquiry and appointment assistant',
  offerSummary: 'An AI assistant that answers patient enquiries and follows up automatically.',
  features: ['Instant replies to patient enquiries', 'Automated follow-ups', 'Appointment booking'],
  audience: 'Dental clinics in the UK',
  goal: 'Book 20 demos',
  signOff: 'Azeez, Harzotech Innovative Solutions',
});

describe('five-touch default sequence', () => {
  const a = buildFromBrief(brief, parseKnobs(''));
  it('builds Day 1, 3, 6, 9 and 14', () => {
    expect(a.emails).toHaveLength(5);
    expect(dayNumbers(a)).toEqual([1, 3, 6, 9, 14]);
  });
  it('never auto-sends and stops on reply', () => {
    expect(a.sendMode).toBe('review');
    expect(a.stopOnReply).toBe(true);
  });
  it('writes each touch for its purpose', () => {
    expect(a.emails[0].body).toMatch(/Our system includes:/);
    expect(a.emails[0].body).toMatch(/Appointment booking/);
    expect(a.emails[1].subject).toBe('Re: {{subject}}');
    expect(a.emails[2].subject).toMatch(/follow-up/i);
    expect(a.emails[3].body).toMatch(/walkthrough|dashboard|journey/i);
    expect(a.emails[4].body).toMatch(/no thanks|interested/i);
  });
  it('contains no links and only known tokens', () => {
    for (const e of a.emails) {
      expect(e.body + e.subject).not.toMatch(/https?:|www\./i);
      const tokens = (e.body + e.subject).match(/\{\{[^}]+\}\}/g) ?? [];
      for (const t of tokens) expect(['{{name}}', '{{business}}', '{{website}}', '{{subject}}']).toContain(canonTokens(t));
    }
  });
  it('survives sanitising unchanged in shape and maps to engine fields', () => {
    const s = sanitizeAutomation(a);
    if (!s) throw new Error('sanitised to null');
    expect(s.emails).toHaveLength(5);
    expect(s.brief?.offer).toBe(brief.offer);
    expect(toCampaignFields(s).maxFollowUps).toBe(4);
  });
});

describe('knobs and subsets', () => {
  it('honours a requested count', () => {
    for (const n of [1, 2, 3, 4]) expect(buildFromBrief(brief, parseKnobs(`${n} emails`)).emails).toHaveLength(n);
  });
  it('uses a uniform gap when the user states one', () => {
    const a = buildFromBrief(brief, parseKnobs('4 emails, follow up after 5 days'));
    expect(a.emails.slice(1).every((e) => e.waitDays === 5)).toBe(true);
  });
});

describe('planFromGoal', () => {
  it('builds a complete campaign from a typed goal alone', () => {
    const { automation, brief: b } = planFromGoal('Book demos for my AI receptionist with UK dental clinics');
    expect(automation.emails.length).toBeGreaterThanOrEqual(1);
    expect(b.audience.toLowerCase()).toMatch(/dental/);
  });
  it('lets filled-in fields win over typed text', () => {
    const { brief: b } = planFromGoal('pitch dentists', brief);
    expect(b.offer).toBe(brief.offer);
    expect(b.audience).toBe('Dental clinics in the UK');
  });
  it('copes with empty input', () => {
    expect(() => planFromGoal('')).not.toThrow();
  });
});

describe('brief helpers', () => {
  it('reads a numeric target from the goal', () => {
    expect(goalTarget('Book 20 demos')).toBe(20);
    expect(goalTarget('')).toBeNull();
  });
  it('shortens an offer at the dash', () => {
    expect(shortOffer('Dental AI Hub – AI enquiry and appointment assistant')).toBe('Dental AI Hub');
  });
  it('sanitises junk', () => {
    const b = sanitizeBrief({ objective: 'nonsense', features: 'x', offer: 5 });
    expect(b.objective).toBe(emptyBrief().objective);
    expect(Array.isArray(b.features)).toBe(true);
  });
});

import { describeOffer } from '@/lib/campaignBrief';
describe('describeOffer', () => {
  it('turns a noun phrase into a full sentence, never "At X, an …"', () => {
    expect(describeOffer('Dental AI Hub', 'An AI assistant that answers patient enquiries.')).toBe('Dental AI Hub is an AI assistant that answers patient enquiries.');
    expect(describeOffer('RESTOVAX', 'Restaurant management software for POS and stock')).toBe('RESTOVAX is restaurant management software for POS and stock.');
  });
  it('keeps "we" sentences, verb starts and summaries that already name the offer', () => {
    expect(describeOffer('Acme', 'We build websites for clinics.')).toBe('At Acme, we build websites for clinics.');
    expect(describeOffer('Acme', 'Helps clinics win patients')).toBe('Acme helps clinics win patients.');
    expect(describeOffer('Acme', 'Acme is a booking tool.')).toBe('Acme is a booking tool.');
    expect(describeOffer('Acme', '')).toBe('');
  });
});
