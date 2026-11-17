import { describe, it, expect } from 'vitest';
import { buildEmail, whatsappLink } from '@/lib/outreachCampaign';
import { sanitizeAutomation } from '@/lib/automation';
import { OFFICIAL_TEMPLATES } from '@/lib/templateLibrary';
import { briefFromTemplate, buildFromTemplate } from '@/lib/templateEngine';
import { parseKnobs } from '@/lib/campaignBuilder';

const lead = { email: 'a@clinic.com', name: 'Dr Ada', business: 'Sunrise Clinic' };
const actions = [{ label: 'Ask us a question', message: 'Hello, about {{business}}' }, { label: 'Get a clinic website', message: 'Website for {{business}}?' }];
const mk = (over: object = {}) => buildEmail({ subject: 's', body: 'Hello', lead, sender: { name: 'Sam', business: 'RUNVAX', whatsapp: '2348012345678' }, unsubscribeUrl: 'https://x/u', whatsappActions: actions, ...over });

describe('WhatsApp buttons in emails', () => {
  it('adds one button per action, with the chat pre-typed for this contact', () => {
    const b = mk();
    expect(b.html).toContain('https://wa.me/2348012345678?text=Hello%2C%20about%20Sunrise%20Clinic');
    expect(b.html).toContain('Ask us a question'); expect(b.html).toContain('Get a clinic website');
    expect(b.text).toContain('Ask us a question: https://wa.me/2348012345678');
  });
  it('shows no buttons when the sender has no valid WhatsApp number, or no actions', () => {
    expect(mk({ sender: { name: 'Sam', whatsapp: '' } }).html).not.toContain('wa.me');
    expect(mk({ sender: { name: 'Sam', whatsapp: 'abc' } }).html).not.toContain('wa.me');
    expect(mk({ whatsappActions: [] }).html).not.toContain('wa.me');
    expect(whatsappLink('', 'x')).toBeNull();
  });
  it('counts clicks when tracking is on, and keeps the unsubscribe link untracked', () => {
    const b = mk({ trackLink: (u: string) => `https://t/?u=${encodeURIComponent(u)}` });
    expect(b.html).toContain('https://t/?u=https%3A%2F%2Fwa.me%2F2348012345678');
    expect(b.html).toContain('href="https://x/u"');
  });
  it('sanitising keeps clean actions only and drops links', () => {
    const a = sanitizeAutomation({ emails: [{ subject: 's', body: 'b' }], whatsappActions: [{ label: 'Hi', message: 'see https://evil.com now' }, { label: '', message: 'x' }, 'junk'] });
    expect(a?.whatsappActions).toEqual([{ label: 'Hi', message: 'see now' }]);
  });
});

describe('Welcome Patients Back: Prepare for 2027 template', () => {
  const t = OFFICIAL_TEMPLATES.find((x) => x.id === 'clinic-2027-welcome-back')!;
  const auto = buildFromTemplate(t, briefFromTemplate(t), parseKnobs(''));
  it('is a five-email sequence in review mode with the three WhatsApp actions', () => {
    expect(auto.emails).toHaveLength(5); expect(auto.sendMode).toBe('review');
    expect(auto.whatsappActions?.map((a) => a.label)).toEqual(['Ask us a question', 'Get a clinic website', 'Deploy an AI agent']);
  });
  it('makes no promises: no statistics, guarantees or clinical claims', () => {
    const all = auto.emails.map((e) => `${e.subject}\n${e.body}`).join('\n');
    expect(all).not.toMatch(/\d+\s?%|guarantee|cure|treat(ment)? |increase (your )?(revenue|bookings) by/i);
    expect(all).toContain('2027'); expect(all).toContain('WhatsApp');
  });
});

describe('new campaigns get a WhatsApp button; existing ones do not', () => {
  it('a campaign built from any template or a typed goal has the default button', () => {
    const t = OFFICIAL_TEMPLATES.find((x) => x.id === 'restaurants')!;
    expect(buildFromTemplate(t, briefFromTemplate(t), parseKnobs('')).whatsappActions?.[0].label).toBe('Chat with us on WhatsApp');
  });
  it('a saved campaign without the field stays without it', () => {
    expect(sanitizeAutomation({ emails: [{ subject: 's', body: 'b' }] })?.whatsappActions).toBeUndefined();
  });
});
