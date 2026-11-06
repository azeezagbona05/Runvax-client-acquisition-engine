import crypto from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { parseLeadCsv, sanitizeLeads, cleanPhone } from '@/lib/outreachCampaign';
import { parseInbound, signatureOk } from '@/lib/waWebhook';
import { phoneKey } from '@/lib/waPhoneKey';

describe('WhatsApp in campaigns', () => {
  it('reads a phone column and normalises it to international digits', () => {
    const { leads } = parseLeadCsv('email,name,phone\na@x.com,Ada,0803 123 4567\nb@x.com,Bo,+44 20 7946 0958\nc@x.com,Cy,');
    expect(leads.map((l) => l.phone)).toEqual(['2348031234567', '442079460958', undefined]);
  });
  it('drops numbers that cannot be WhatsApp numbers but keeps the lead', () => {
    expect(cleanPhone('12')).toBe('');
    expect(sanitizeLeads([{ email: 'a@x.com', phone: 'abc' }]).leads).toEqual([{ email: 'a@x.com' }]);
  });
  it('matches the same person across number formats', () => {
    expect(phoneKey('2348031234567')).toBe(phoneKey('+234 803 123 4567'));
  });
  it('accepts a webhook only when the Meta signature is valid', () => {
    const body = '{"a":1}', secret = 'abcdef0123456789abcdef';
    const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(signatureOk(body, sig, secret)).toBe(true);
    expect(signatureOk(body + ' ', sig, secret)).toBe(false);
    expect(signatureOk(body, null, secret)).toBe(false);
    expect(signatureOk(body, 'sha256=00', secret)).toBe(false);
  });
  it('keeps only text messages sent to this phone number id', () => {
    const payload = { entry: [{ changes: [
      { value: { metadata: { phone_number_id: '111' }, messages: [{ from: '2348031234567', id: 'm1', timestamp: '1700000000', type: 'text', text: { body: 'Yes, interested' } }, { from: '1', id: 'm2', type: 'image' }] } },
      { value: { metadata: { phone_number_id: '999' }, messages: [{ from: '2', id: 'm3', type: 'text', text: { body: 'other number' } }] } },
    ] }] };
    const got = parseInbound(payload, '111');
    expect(got.map((m) => [m.from, m.id, m.text])).toEqual([['2348031234567', 'm1', 'Yes, interested']]);
    expect(parseInbound(null, '111')).toEqual([]);
  });
});
