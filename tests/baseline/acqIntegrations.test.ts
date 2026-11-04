import { describe, it, expect } from 'vitest';
import { INTEGRATION_ROADMAP, PRIORITY_ORDER } from '@/lib/acqIntegrations';
describe('integration roadmap', () => {
  it('lists the eight integrations in the owner priority order', () => {
    expect(INTEGRATION_ROADMAP.map((i) => [i.name, i.priority])).toEqual([
      ['WhatsApp Business', 'Critical'], ['Gmail / Google Workspace', 'Critical'], ['Apollo', 'High'], ['Snov.io', 'High'], ['SMTP', 'High'], ['Google Calendar', 'High'], ['Airtable', 'Medium'], ['CRM Webhooks / API', 'Medium'],
    ]);
    expect(PRIORITY_ORDER).toEqual(['Critical', 'High', 'Medium']);
  });
  it('only claims what exists: SMTP and Gmail (via SMTP) are available, the rest planned', () => {
    expect(INTEGRATION_ROADMAP.filter((i) => i.status === 'available').map((i) => i.id)).toEqual(['gmail', 'smtp']);
  });
});
