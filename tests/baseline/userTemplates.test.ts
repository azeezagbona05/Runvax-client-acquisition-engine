import { describe, it, expect } from 'vitest';
import { templateDataFromCampaign, sanitizeTemplateMeta, toConfig } from '@/lib/userTemplates';
import { buildFromTemplate, briefFromTemplate } from '@/lib/templateEngine';
import { parseKnobs } from '@/lib/campaignBuilder';
import { templateById } from '@/lib/templateLibrary';

const t = templateById('dental-clinics')!;
const auto = buildFromTemplate(t, { ...briefFromTemplate(t), signOff: 'Azeez' }, parseKnobs(''));

describe('saving a campaign as a template', () => {
  it('keeps the brief and the five emails', () => {
    const d = templateDataFromCampaign(auto)!;
    expect(d.automation.emails).toHaveLength(5);
    expect(d.brief.templateId).toBe('dental-clinics');
    expect(d.automation.sendMode).toBe('review');
  });
  it('drops contacts, history and anything unexpected', () => {
    const dirty = { ...auto, leads: [{ email: 'a@b.com' }], replies: ['hi'], stats: { sent: 40 }, token: 'secret', emails: auto.emails.map((e) => ({ ...e, sentTo: 'a@b.com' })) };
    const json = JSON.stringify(templateDataFromCampaign(dirty));
    expect(json).not.toMatch(/a@b\.com|secret|"stats"|"leads"|"replies"|sentTo/);
  });
  it('refuses an empty or invalid automation', () => {
    expect(templateDataFromCampaign(null)).toBeNull();
    expect(templateDataFromCampaign({ emails: [] })).toBeNull();
  });
  it('cleans the name and description', () => {
    expect(sanitizeTemplateMeta({ name: '  My   dental\n template ', description: 'x'.repeat(900), industry: '' })).toEqual({ name: 'My dental template', description: 'x'.repeat(500), industry: 'Custom' });
  });
  it('turns a saved row into a card that loads the saved sequence', () => {
    const c = toConfig({ id: 'u1', name: 'Mine', industry: 'Dental Clinics', description: null, baseTemplateId: 'dental-clinics', data: templateDataFromCampaign(auto), createdAt: new Date() })!;
    expect(c.source).toBe('user');
    expect(c.savedAutomation?.emails).toHaveLength(5);
    expect(c.stageLabels.customer).toBe('Customer acquired');
  });
  it('skips a corrupt row instead of crashing', () => {
    expect(toConfig({ id: 'u2', name: 'x', industry: 'x', description: null, baseTemplateId: null, data: { nope: 1 }, createdAt: new Date() })).toBeNull();
  });
});
