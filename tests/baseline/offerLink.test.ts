import { describe, it, expect } from 'vitest';
import { cleanOfferUrl, sanitizeBrief, emptyBrief } from '@/lib/campaignBrief';
import { buildEmail, dropLinkLines, unknownTokens } from '@/lib/outreachCampaign';
import { buildFromBrief, parseKnobs } from '@/lib/campaignBuilder';
import { sanitizeAutomation } from '@/lib/automation';

const sender = { name: 'Sam', business: 'Webco' };
const mk = (link?: string) => buildEmail({ subject: 'Offer for {{business}}', body: 'Hi {{name}},\n\nSee the details here: {{link}}\n\nBest regards,', lead: { email: 'a@b.ng', name: 'Ada', business: 'Bright' }, sender, unsubscribeUrl: 'https://app/u', trackLink: (u) => `https://app/t?u=${encodeURIComponent(u)}`, link });

describe('offer link', () => {
  it('accepts only clean https addresses', () => {
    expect(cleanOfferUrl('https://shop.ng/black-friday')).toBe('https://shop.ng/black-friday');
    expect(cleanOfferUrl('shop.ng/bf')).toBe('https://shop.ng/bf');
    for (const bad of ['http://shop.ng', 'javascript:alert(1)', 'https://u:p@shop.ng', 'https://a b.ng', 'nodots', '', 'https://' + 'a'.repeat(210) + '.ng']) expect(cleanOfferUrl(bad)).toBeUndefined();
  });
  it('is kept by sanitizeBrief and dropped when invalid', () => {
    expect(sanitizeBrief({ ...emptyBrief(), offerUrl: 'https://shop.ng' }).offerUrl).toBe('https://shop.ng/');
    expect(sanitizeBrief({ ...emptyBrief(), offerUrl: 'http://x.ng' }).offerUrl).toBeUndefined();
  });
  it('{{link}} is a known placeholder', () => expect(unknownTokens('Go to {{link}}')).toEqual([]));
  it('fills the link, and the click is tracked', () => {
    const e = mk('https://shop.ng/bf');
    expect(e.text).toContain('https://shop.ng/bf');
    expect(e.html).toContain('https://app/t?u=https%3A%2F%2Fshop.ng%2Fbf');
  });
  it('drops the whole line when the campaign has no link: nothing ships empty', () => {
    const e = mk(undefined);
    expect(e.text).not.toContain('See the details');
    expect(e.text).not.toContain('{{');
    expect(dropLinkLines('a\n\nGo: {{link}}\n\nb')).toBe('a\n\nb');
  });
  it('the built-in builder adds the link to the first and last email only, and only when the brief has one', () => {
    const brief = { ...emptyBrief(), offer: 'Growth Pack', audience: 'Dental clinics', offerUrl: 'https://shop.ng/bf' };
    const a = buildFromBrief(brief, parseKnobs('5 emails'));
    const withLink = a.emails.map((e) => e.body.includes('{{link}}'));
    expect(withLink[0]).toBe(true);
    expect(withLink[withLink.length - 1]).toBe(true);
    expect(withLink.slice(1, -1).some(Boolean)).toBe(false);
    expect(a.brief?.offerUrl).toBe('https://shop.ng/bf');
    expect(buildFromBrief({ ...brief, offerUrl: undefined }, parseKnobs('5 emails')).emails.some((e) => e.body.includes('{{link}}'))).toBe(false);
  });
  it('a raw URL written by the AI is still stripped from the sequence', () => {
    const a = sanitizeAutomation({ emails: [{ subject: 's', body: 'Hi\n\nBuy at https://evil.example/x and {{link}}' }] });
    expect(a?.emails[0].body).not.toContain('evil.example');
    expect(a?.emails[0].body).toContain('{{link}}');
  });
});
