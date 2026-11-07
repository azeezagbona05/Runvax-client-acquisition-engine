import { describe, it, expect } from 'vitest';
import { OFFICIAL_TEMPLATES, INDUSTRIES, filterTemplates, stageLabelsFor, templateById } from '@/lib/templateLibrary';
import { briefFromTemplate, buildFromTemplate, mergeBrief, strategyFor } from '@/lib/templateEngine';
import { parseKnobs } from '@/lib/campaignBuilder';
import { dayNumbers, toCampaignFields } from '@/lib/automation';
import { PIPELINE } from '@/lib/replyIntel';

const knobs = parseKnobs('');
const build = (id: string, over = {}) => { const t = templateById(id)!; return buildFromTemplate(t, mergeBrief(briefFromTemplate(t), over), knobs); };

describe('official templates', () => {
  it('keeps the original four first, followed by the industry set', () => {
    expect(OFFICIAL_TEMPLATES.slice(0, 4).map((t) => t.id)).toEqual(['dental-clinics', 'restaurants', 'hotels', 'real-estate']);
    expect(INDUSTRIES.slice(0, 4)).toEqual(['Dental Clinics', 'Restaurants', 'Hotels', 'Real Estate']);
    expect(OFFICIAL_TEMPLATES.length).toBeGreaterThan(4);
  });
  it('carries the full configuration on every record', () => {
    for (const t of OFFICIAL_TEMPLATES) {
      expect(t.audienceCriteria.length, t.id).toBeGreaterThan(2);
      expect(t.objectives.length, t.id).toBeGreaterThan(2);
      expect(t.messagingStrategy.length, t.id).toBeGreaterThan(2);
      expect(t.cta.recommended, t.id).toBeTruthy();
      expect(t.metrics.length, t.id).toBeGreaterThan(3);
      expect(Object.keys(t.stageLabels), t.id).toHaveLength(7);
      expect(Object.keys(t.agents), t.id).toHaveLength(6);
      expect(Object.keys(t.questions), t.id).toHaveLength(9);
      expect(t.channels, t.id).toContain('email');
    }
  });
  it('makes no performance claims or links', () => {
    for (const t of OFFICIAL_TEMPLATES) {
      const all = JSON.stringify(t);
      expect(all, t.id).not.toMatch(/https?:|www\.|\d+\s?%|guarantee|testimonial|proven|best-selling/i);
    }
  });
  it('real estate is property marketing with a viewing conversion', () => {
    const re = templateById('real-estate')!;
    expect(re.kind).toBe('property_marketing');
    expect(re.conversion).toBe('viewing');
    expect(re.stageLabels.demo_booked).toBe('Viewing scheduled');
    expect(re.stageLabels.customer).toBe('Buyer secured');
  });
  it('searches and filters', () => {
    expect(filterTemplates(OFFICIAL_TEMPLATES, 'restovax', '').map((t) => t.id)).toEqual(['restaurants']);
    expect(filterTemplates(OFFICIAL_TEMPLATES, '', 'Hotels')).toHaveLength(1);
    expect(filterTemplates(OFFICIAL_TEMPLATES, 'zzz', '')).toHaveLength(0);
    expect(filterTemplates(OFFICIAL_TEMPLATES, 'viewings', '').map((t) => t.id)).toEqual(['real-estate']);
  });
  it('stage names come from the template', () => {
    expect(stageLabelsFor('real-estate').interested).toBe('Enquiry received');
    expect(stageLabelsFor(undefined).customer).toBe('Customer acquired');
    expect(Object.keys(stageLabelsFor('hotels'))).toEqual(PIPELINE.map((p) => p.id));
  });
});

describe('one engine, four industries', () => {
  it.each(OFFICIAL_TEMPLATES.map((t) => t.id))('%s builds a five-touch, review-only, link-free sequence', (id) => {
    const a = build(id, { signOff: 'Azeez, Harzotech' });
    expect(a.emails).toHaveLength(5);
    expect(dayNumbers(a)).toEqual([1, 3, 6, 9, 14]);
    expect(a.sendMode).toBe('review');
    expect(a.brief?.templateId).toBe(id);
    for (const e of a.emails) { expect(e.body + e.subject).not.toMatch(/https?:|www\.|%\w+%/); expect(e.body).toContain('Azeez, Harzotech'); }
    expect(toCampaignFields(a).maxFollowUps).toBe(4);
  });
  it('dental uses the clinic wording and the demo ask', () => {
    const a = build('dental-clinics', { audience: 'Dental clinics in the UK' });
    expect(a.emails[0].body).toMatch(/patient enquiries/);
    expect(a.emails[0].body).toMatch(/Our system includes:/);
    expect(a.emails[0].body).toMatch(/dental clinics in the UK/);
    expect(a.emails[0].body).toMatch(/demonstration/);
  });
  it('restaurants and hotels speak about their own product', () => {
    expect(build('restaurants').emails[0].body).toMatch(/Point of sale|POS/);
    expect(build('hotels').emails[0].body).toMatch(/Reservation/);
  });
  it('real estate speaks to buyers: viewing ask, no software or business wording', () => {
    const a = build('real-estate', { offer: '4-bedroom house, Lekki', offerSummary: 'A four-bedroom detached house.', features: ['Price: asking price on request', 'Bedrooms: 4'], market: 'Lekki, Lagos' });
    const all = a.emails.map((e) => e.subject + e.body).join('\n');
    expect(a.emails[0].body).toMatch(/viewing/);
    expect(a.emails[0].body).toMatch(/Key details:/);
    expect(a.emails[0].subject).toMatch(/Lekki/);
    expect(all).not.toMatch(/\{\{business\}\}|demonstration|system includes|software/i);
    expect(a.emails[3].subject).toMatch(/viewing/i);
  });
  it('real estate with no details leaves the details block out instead of writing an empty one', () => {
    expect(build('real-estate').emails[0].body).not.toMatch(/Key details/);
  });
  it('a blank answer keeps the template default; a typed one wins', () => {
    const t = templateById('dental-clinics')!;
    expect(mergeBrief(briefFromTemplate(t), { offer: '' }).offer).toBe(t.product.offer);
    expect(mergeBrief(briefFromTemplate(t), { offer: 'My Clinic AI' }).offer).toBe('My Clinic AI');
  });
  it('honours the conversion the user picks', () => {
    expect(build('dental-clinics', { conversion: 'sales_enquiry' }).emails[0].body).toMatch(/send over the details/);
  });
  it('the strategy lists every touch and the template guidance', () => {
    const t = templateById('hotels')!;
    const a = build('hotels', { goal: 'Book 10 demos' });
    const s = strategyFor(t, a.brief!, a);
    expect(s.plan).toHaveLength(5);
    expect(s.plan[0]).toMatch(/^Day 1:/);
    expect(s.angles.length).toBeGreaterThan(2);
    expect(s.agents).toHaveLength(6);
    expect(s.summary).toMatch(/Book 10 demos/);
  });
});
