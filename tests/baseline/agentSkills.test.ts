import { afterEach, describe, expect, it, vi } from 'vitest';
import { configIssues, disclosureText, sanitizeConfig, type AssistantConfig } from '@/lib/agents/kinds';
import { allowedLinks, chatStatus, needsHandoff, ruleReply, scrubReply } from '@/lib/agents/chat';
import { classifyByRules, templateFor } from '@/lib/agents/classify';
import { planAgent, skillsFor } from '@/lib/agents/write';
import { SKILLS, USABLE_CHAT_SKILLS } from '@/lib/agents/skills';
import { TEMPLATES, CHAT_TEMPLATES } from '@/lib/agents/templates';

afterEach(() => vi.unstubAllEnvs());
const noAi = () => { for (const k of ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'GROQ_API_KEY']) vi.stubEnv(k, ''); };
const chat = (c: Record<string, unknown>) => sanitizeConfig('assistant', { business: { name: 'Bright Smile', about: 'A dental clinic in Lagos offering check-ups, whitening and implants.' }, ...c }) as AssistantConfig;
const DENTAL = "I'm a dental clinic. I want an AI employee that answers patient enquiries, explains our dental procedures, captures patient details and books appointments.";

describe('skills and templates catalogue', () => {
  it('every chat template only uses skills that work today', () => {
    for (const t of CHAT_TEMPLATES) for (const s of TEMPLATES[t].skills ?? []) expect(USABLE_CHAT_SKILLS, `${t}:${s}`).toContain(s);
  });
  it('coming-soon and campaign skills can never be switched on', () => {
    const c = chat({ template: 'custom', skills: ['orderLookup', 'whatsapp', 'email', 'content', 'booking', 'nonsense'] });
    expect(c.skills).toEqual(['knowledge', 'booking']);
    expect(SKILLS.orderLookup.status).toBe('soon');
  });
  it('knowledge is always on', () => { expect(chat({ template: 'custom', skills: [] }).skills).toEqual(['knowledge']); });
  it('agents saved before skills existed keep what they did', () => {
    const old = sanitizeConfig('assistant', { business: { name: 'X', about: 'y' }, questions: ['Size?'], calendarUrl: 'https://cal.com/x' }) as AssistantConfig;
    expect(old.template).toBe('receptionist');
    expect(old.skills).toEqual(['knowledge', 'leadCapture', 'qualify', 'booking']);
  });
  it('a template with no saved skills gets its preset', () => {
    expect(chat({ template: 'shopping' }).skills).toEqual(['knowledge', 'productSearch', 'handoff']);
  });
});

describe('step 2: plain English to a configured agent', () => {
  it('the dental clinic request becomes an AI Receptionist with booking, lead capture and handoff', async () => {
    noAi();
    const seen = classifyByRules(DENTAL); expect(seen).toEqual({ kind: 'assistant', template: 'receptionist' });
    const p = await planAgent('assistant', DENTAL, { site: null, template: 'receptionist' }); const c = p.config as AssistantConfig;
    expect(p.name).toMatch(/Receptionist/);
    expect(c.skills).toEqual(expect.arrayContaining(['knowledge', 'leadCapture', 'booking', 'handoff']));
    expect(c.skills).not.toContain('productSearch'); expect(c.skills).not.toContain('crm');
    expect(c.instructions.length).toBeGreaterThan(20); expect(c.objectives.length).toBeGreaterThan(0); expect(c.escalation.length).toBeGreaterThan(0); expect(c.knowledgeNeeded.length).toBeGreaterThan(0);
  });
  it('takes a name given as "called X"', async () => {
    noAi();
    const p = await planAgent('assistant', "I'm a dental clinic called Bright Smile. Answer patient enquiries and book appointments.", { site: null, template: 'receptionist' });
    expect(p.config.business.name).toBe('Bright Smile'); expect(p.name).toBe('Bright Smile Receptionist');
  });
  it('picks the template that fits the job', () => {
    expect(templateFor('Help shoppers on our online store compare running shoes')).toBe('shopping');
    expect(templateFor('Answer our employees\' questions about HR policies from the handbook')).toBe('internal');
    expect(templateFor('Answer delivery questions and where is my order')).toBe('orders');
    expect(templateFor('Help customers book and reschedule appointments')).toBe('appointment');
    expect(templateFor('Customer support for our app, escalate complaints')).toBe('support');
    expect(templateFor('An AI employee that answers patient enquiries')).toBe('receptionist');
  });
  it('a Custom Agent only gets the skills the request calls for', () => {
    expect(skillsFor('custom', 'Answer questions about our venue')).toEqual(['knowledge']);
    expect(skillsFor('custom', 'Answer questions, book a viewing and send leads to HubSpot')).toEqual(expect.arrayContaining(['knowledge', 'booking', 'crm', 'leadCapture']));
    expect(skillsFor('custom', 'x', ['booking', 'whatsapp'])).toEqual(['knowledge', 'booking']);
  });
  it('reactivation, newsletters and invoices are not chat agents', () => {
    expect(classifyByRules('Win back inactive customers with an email')).toEqual({ kind: 'campaign' });
    expect(classifyByRules('Send our monthly newsletter')).toEqual({ kind: 'campaign' });
    expect(classifyByRules('A chatbot that sends invoices and payment reminders')).toEqual({ kind: 'unsupported' });
  });
});

describe('human handoff', () => {
  const c = chat({ template: 'support', escalation: ['Billing, refunds or account changes'] });
  it('spots a request for a person, a complaint, or an owner rule', () => {
    expect(needsHandoff(c, 'Can I speak to a real person please')).toBe(true);
    expect(needsHandoff(c, 'I want to make a complaint')).toBe(true);
    expect(needsHandoff(c, 'There is a problem with my billing')).toBe(true);
    expect(needsHandoff(c, 'What are your opening hours?')).toBe(false);
  });
  it('does nothing when the skill is off', () => { expect(needsHandoff(chat({ template: 'custom', skills: ['knowledge'] }), 'speak to a human')).toBe(false); });
  it('the built-in reply hands over and asks how to reach them', () => {
    expect(ruleReply(c, [], 'I want to talk to a human', {})).toMatch(/person on the team/);
  });
  it('a handed-off conversation stays handed off; staff agents never make leads', () => {
    expect(chatStatus(c, 'open', {}, true)).toBe('handoff');
    expect(chatStatus(c, 'handoff', { email: 'a@b.co' }, false)).toBe('handoff');
    expect(chatStatus(chat({ template: 'receptionist' }), 'open', { email: 'a@b.co' }, false)).toBe('lead');
    expect(chatStatus(chat({ template: 'internal', accessCode: 'abcd' }), 'open', { email: 'a@b.co' }, false)).toBe('open');
    expect(chatStatus(chat({ template: 'custom', skills: ['knowledge'] }), 'open', { email: 'a@b.co' }, false)).toBe('open');
  });
});

describe('links the agent may share', () => {
  it('booking page only with booking on; shop links only with Product Search on', () => {
    const shop = chat({ template: 'shopping', shopUrl: 'https://shop.example.com', calendarUrl: 'https://cal.com/x' });
    expect(allowedLinks(shop)).toEqual(['https://shop.example.com']);
    expect(scrubReply('See https://shop.example.com/p/1 or https://evil.com/x', allowedLinks(shop))).toBe('See https://shop.example.com/p/1 or');
    const rec = chat({ template: 'receptionist', calendarUrl: 'https://cal.com/bright' });
    expect(scrubReply('Book: https://cal.com/bright and https://shop.example.com', allowedLinks(rec))).toBe('Book: https://cal.com/bright and');
  });
  it('the built-in reply shares the booking page when they ask to book', () => {
    const rec = chat({ template: 'receptionist', calendarUrl: 'https://cal.com/bright' });
    expect(ruleReply(rec, [{ r: 'v', t: 'hi', at: 0 }, { r: 'a', t: 'hello', at: 0 }], 'Can I book an appointment?', {})).toContain('https://cal.com/bright');
  });
});

describe('setup checks and the staff agent', () => {
  it('asks for what the switched-on skills need', () => {
    const i = configIssues('assistant', chat({ template: 'custom', skills: ['booking', 'crm'] }));
    expect(i.join(' ')).toMatch(/booking page/); expect(i.join(' ')).toMatch(/webhook/);
  });
  it('a staff agent needs an access code, has no Telegram, and says who reads the messages', () => {
    const c = chat({ template: 'internal', channels: { web: true, telegram: true } });
    expect(c.channels.telegram).toBe(false);
    expect(configIssues('assistant', c).join(' ')).toMatch(/access code/);
    expect(disclosureText(c)).toMatch(/staff/);
    expect(chat({ template: 'receptionist', accessCode: 'secret' }).accessCode).toBe('');
  });
});
