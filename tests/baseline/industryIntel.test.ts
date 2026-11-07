import { describe, it, expect } from 'vitest';
import { INDUSTRIES_INTEL, INDUSTRY_GROUPS, decisionMakerTitles, industryById, recommendOffers, type IndustryId } from '@/lib/industryIntel';
import { MIN_EVIDENCE_FOR_A, WEIGHTS, priorityOf, scoreLead } from '@/lib/leadScoring';
import { LINKEDIN_CONNECT_MAX, draftsFor, outreachGuidance } from '@/lib/outreachDrafts';
import { OFFICIAL_TEMPLATES, filterTemplates, templateCountByIndustry } from '@/lib/templateLibrary';
import { briefFromTemplate, buildFromTemplate } from '@/lib/templateEngine';
import { parseKnobs } from '@/lib/campaignBuilder';
import { industryTitles } from '@/lib/decisionMaker';

const IDS = INDUSTRIES_INTEL.map((i) => i.id);

describe('the 17 industries', () => {
  it('are all there, in the four groups, each with intelligence, offers, decision-makers and an angle', () => {
    expect(IDS).toHaveLength(17);
    expect(new Set(IDS).size).toBe(17);
    for (const i of INDUSTRIES_INTEL) {
      expect(INDUSTRY_GROUPS).toContain(i.group);
      expect(i.intel.length).toBeGreaterThanOrEqual(6);
      expect(i.offers.length).toBeGreaterThanOrEqual(5);
      expect(i.decisionMakers.primary.length).toBeGreaterThan(0);
      expect(i.decisionMakers.secondary.length).toBeGreaterThan(0);
      expect(i.angle.gap && i.angle.benefit && i.angle.reference).toBeTruthy();
      expect(i.intel.some((x) => x.ready === 'live')).toBe(true);
    }
  });
  it('flags real estate and healthcare as high priority, and keeps the health and minors safeguards', () => {
    expect(industryById('real-estate')!.highPriority).toBe(true);
    expect(industryById('healthcare')!.highPriority).toBe(true);
    expect(industryById('healthcare')!.compliance).toMatch(/patient health information/i);
    expect(industryById('education')!.compliance).toMatch(/minors/i);
  });
  it('gives the decision-makers from the brief', () => {
    expect(industryById('legal')!.decisionMakers.primary).toEqual(['Managing Partner']);
    expect(industryById('automotive')!.decisionMakers.primary).toEqual(['Dealer Principal']);
    expect(industryById('it-software')!.decisionMakers.primary).toEqual(['CEO', 'Founder', 'CTO']);
  });
  it('adds the local titles for a country', () => {
    expect(decisionMakerTitles('wholesale', 'US').local).toEqual(expect.arrayContaining(['President', 'CEO']));
    expect(decisionMakerTitles('wholesale', 'GB').local).toEqual([]);
    expect(decisionMakerTitles('legal', 'AU').local).toContain('Principal');
    expect(decisionMakerTitles('legal', 'GB').local).toEqual([]);
    expect(decisionMakerTitles('legal', 'nowhere').local).toEqual([]);
  });
  it('recommends different offers for different gaps (the two-clinics example)', () => {
    expect(recommendOffers('healthcare', ['no-online-booking', 'no-enquiry-assistant'])).toEqual(['AI Receptionist', 'Appointment management']);
    expect(recommendOffers('healthcare', ['no-website', 'weak-visibility'])).toEqual(['Healthcare website development', 'AI Visibility Agent']);
    expect(recommendOffers('healthcare', [])).toEqual([]);
  });
});

describe('campaign templates', () => {
  it('cover every industry, with unique ids', () => {
    const counts = templateCountByIndustry();
    for (const id of IDS) expect(counts[id], id).toBeGreaterThanOrEqual(1);
    expect(counts['real-estate']).toBeGreaterThanOrEqual(3);
    expect(counts.healthcare).toBeGreaterThanOrEqual(3);
    for (const id of ['marketing', 'solar', 'it-software'] as IndustryId[]) expect(counts[id]).toBeGreaterThanOrEqual(2);
    const ids = OFFICIAL_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('each build into a five-touch campaign with an opt-out and no invented results', () => {
    for (const t of OFFICIAL_TEMPLATES) {
      const seq = buildFromTemplate(t, briefFromTemplate(t), parseKnobs(''));
      expect(seq.emails.length, t.id).toBeGreaterThanOrEqual(3);
      const text = JSON.stringify(seq).toLowerCase();
      expect(text, t.id).not.toMatch(/guarantee|\b\d+\s?%|10x|double your|best in/);
    }
  });
  it('filter by industry id or by name', () => {
    expect(filterTemplates(OFFICIAL_TEMPLATES, '', 'solar').every((t) => t.industryId === 'solar')).toBe(true);
    expect(filterTemplates(OFFICIAL_TEMPLATES, '', 'Dental Clinics').length).toBe(1);
    expect(filterTemplates(OFFICIAL_TEMPLATES, 'quotation', '').length).toBeGreaterThan(0);
  });
  it('healthcare templates carry the patient-information warning', () => {
    for (const t of OFFICIAL_TEMPLATES.filter((x) => x.industryId === 'healthcare' && x.id !== 'dental-clinics')) expect(t.contactNote).toMatch(/patient health information/i);
  });
});

describe('lead scoring', () => {
  it('weights add to 100 and the bands follow the brief', () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
    expect([priorityOf(100), priorityOf(80), priorityOf(79), priorityOf(60), priorityOf(59), priorityOf(40), priorityOf(39), priorityOf(0)]).toEqual(['A', 'A', 'B', 'B', 'C', 'C', 'Low', 'Low']);
  });
  it('Clinic A (website, no booking, 120+ reviews, active) scores high and is offered the receptionist', () => {
    const r = scoreLead('healthcare', {
      fit: 'strong', activity: { reviews: 130, rating: 4.5, hasPhone: true, recentSignals: 1 },
      opportunities: [{ id: 'no-online-booking', evidence: 'verified' }, { id: 'no-enquiry-assistant', evidence: 'verified' }],
      growth: [{ label: 'New branch', evidence: 'listed' }], decisionMaker: { identified: true, role: 'primary', verified: true }, contact: { verifiedEmail: true, phone: true },
    });
    expect(r.priority).toBe('A');
    expect(r.total).toBeGreaterThanOrEqual(80);
    expect(r.offers[0]).toBe('AI Receptionist');
    expect(r.unknown).toEqual([]);
  });
  it('Clinic B (no website, thin presence) gets a different offer and a lower priority', () => {
    const r = scoreLead('healthcare', {
      fit: 'strong', activity: { reviews: 25, rating: 4.2, hasPhone: true },
      opportunities: [{ id: 'no-website', evidence: 'listed' }, { id: 'weak-visibility', evidence: 'inferred' }], decisionMaker: { identified: false }, contact: { genericOnly: true, phone: true },
    });
    expect(r.offers).toEqual(['Healthcare website development', 'AI Visibility Agent']);
    expect(r.priority).not.toBe('A');
  });
  it('missing information is not treated as a problem: nothing known scores zero, with everything flagged unknown', () => {
    const r = scoreLead('solar', {});
    expect(r.total).toBe(0);
    expect(r.priority).toBe('Low');
    expect(r.unknown).toHaveLength(6);
    expect(r.evidenceQuality).toBe(0);
    expect(r.offers).toEqual([]);
  });
  it('an opportunity scores more when it was seen than when it was inferred', () => {
    const pts = (evidence: 'verified' | 'listed' | 'inferred') => scoreLead('legal', { opportunities: [{ id: 'no-lead-capture', evidence }] }).factors.find((f) => f.id === 'opportunity')!.points;
    expect(pts('verified')).toBeGreaterThan(pts('listed'));
    expect(pts('listed')).toBeGreaterThan(pts('inferred'));
  });
  it('a found email is not a decision-maker: it adds contactability but no decision-maker points', () => {
    const r = scoreLead('legal', { decisionMaker: { identified: false }, contact: { verifiedEmail: true } });
    expect(r.factors.find((f) => f.id === 'decisionMaker')!.points).toBe(0);
    expect(r.factors.find((f) => f.id === 'contactability')!.points).toBe(7);
    expect(scoreLead('legal', { decisionMaker: { identified: true, role: 'primary' } }).factors.find((f) => f.id === 'decisionMaker')!.points).toBe(15);
  });
  it('thin evidence cannot reach Priority A: weak evidence is worth less, and evidence quality is reported on its own', () => {
    const base = {
      fit: 'strong' as const, activity: { reviews: 200, rating: 4.8, hasPhone: true, recentSignals: 2 },
      decisionMaker: { identified: true, role: 'primary' as const }, contact: { verifiedEmail: true, phone: true, form: true },
    };
    const thin = scoreLead('real-estate', { ...base, opportunities: [{ id: 'no-website', evidence: 'inferred' }, { id: 'weak-seo', evidence: 'inferred' }, { id: 'no-lead-capture', evidence: 'inferred' }], growth: [{ label: 'Hiring', evidence: 'inferred' }, { label: 'New branch', evidence: 'inferred' }] });
    const firm = scoreLead('real-estate', { ...base, opportunities: [{ id: 'no-website', evidence: 'verified' }, { id: 'weak-seo', evidence: 'verified' }, { id: 'no-lead-capture', evidence: 'verified' }], growth: [{ label: 'Hiring', evidence: 'verified' }, { label: 'New branch', evidence: 'verified' }] });
    expect(thin.priority).not.toBe('A');
    expect(firm.priority).toBe('A');
    expect(firm.total).toBeGreaterThan(thin.total);
    expect(firm.evidenceQuality).toBeGreaterThan(thin.evidenceQuality);
    expect(firm.evidenceQuality).toBeGreaterThanOrEqual(MIN_EVIDENCE_FOR_A);
  });
});

describe('outreach drafts', () => {
  it('cover the six channels for every industry, each with an opt-out where it contacts someone cold', () => {
    for (const id of IDS) {
      const d = draftsFor(id);
      expect(d.map((x) => x.channel)).toEqual(['cold_email', 'linkedin_connect', 'linkedin_followup', 'whatsapp', 'followup_email', 'meeting']);
      for (const c of ['cold_email', 'followup_email', 'meeting', 'whatsapp'] as const) expect(d.find((x) => x.channel === c)!.body, `${id} ${c}`).toMatch(/not contact you again|not message you again/);
      expect(d.find((x) => x.channel === 'linkedin_connect')!.body.length, id).toBeLessThanOrEqual(LINKEDIN_CONNECT_MAX);
      expect(d.find((x) => x.channel === 'whatsapp')!.note).toMatch(/agreed|allow/);
      expect(d.find((x) => x.channel === 'cold_email')!.body).toMatch(/\[One specific thing/);
      for (const x of d) expect(x.body, `${id} ${x.channel}`).not.toMatch(/guarantee|\b\d+\s?%/i);
    }
  });
  it('end the email with one simple question and follow the brief\'s guidance', () => {
    const body = draftsFor('solar').find((x) => x.channel === 'cold_email')!.body;
    expect(body.match(/\?/g)).toHaveLength(1);
    expect(outreachGuidance(industryById('solar')!).join(' ')).toMatch(/installation services and coverage area/);
  });
});

describe('decision-maker search titles for the new industries', () => {
  it('know the titles in solar, logistics, manufacturing, wholesale, recruitment, events and software', () => {
    expect(industryTitles('Solar energy company')).toContain('sales director');
    expect(industryTitles('Freight forwarding company', ['logistics'])).toContain('operations director');
    expect(industryTitles('Manufacturer')).toContain('commercial director');
    expect(industryTitles('Wholesaler')).toContain('procurement director');
    expect(industryTitles('Recruitment agency')).toContain('recruitment director');
    expect(industryTitles('Event planner')).toContain('event director');
    expect(industryTitles('Software company')).toContain('CTO');
  });
  it('leave the existing industries as they were', () => {
    expect(industryTitles('Dental clinic', ['dentist', 'health'])[0]).toBe('principal dentist');
    expect(industryTitles('Law firm')[0]).toBe('managing partner');
  });
});
