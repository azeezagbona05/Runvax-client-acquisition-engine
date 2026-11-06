import { describe, it, expect } from 'vitest';
import { INTEGRATIONS, PRIORITY_ORDER } from '@/lib/acqIntegrations';
import { seal, open } from '@/lib/integrations/crypto';

describe('integrations', () => {
  it('lists the eight integrations in the owner priority order', () => {
    expect(INTEGRATIONS.map((i) => [i.name, i.priority])).toEqual([
      ['WhatsApp Business', 'Critical'], ['Gmail / Google Workspace', 'Critical'], ['Apollo', 'High'], ['Snov.io', 'High'], ['SMTP', 'High'], ['Google Calendar', 'High'], ['Airtable', 'Medium'], ['CRM Webhooks / API', 'Medium'],
    ]);
    expect(PRIORITY_ORDER).toEqual(['Critical', 'High', 'Medium']);
  });
  it('every integration can be connected: a form, a sign-in, or a settings page', () => {
    for (const i of INTEGRATIONS) expect(Boolean(i.fields?.length || i.oauth || i.settingsHref), i.id).toBe(true);
  });
  it('encrypts stored keys and refuses tampered or foreign data', () => {
    process.env.NEXTAUTH_SECRET = 'test-secret';
    const sealed = seal({ apiKey: 'abc123' });
    expect(sealed).not.toContain('abc123');
    expect(open(sealed)).toEqual({ apiKey: 'abc123' });
    expect(open(sealed.slice(0, -3) + 'xxx')).toBeNull();
    expect(open(null)).toBeNull();
  });
});
