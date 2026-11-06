/** The tools Client Acquisition connects to, in the owner's priority order. Whether each one is connected is read live for the signed-in user. */

export type Priority = 'Critical' | 'High' | 'Medium';
export type FieldDef = { name: string; label: string; type?: 'text' | 'password' | 'url' | 'number'; placeholder?: string; optional?: boolean };
export interface IntegrationDef {
  id: 'wa' | 'gmail' | 'smtp' | 'apollo' | 'snov' | 'gcal' | 'airtable' | 'webhooks';
  name: string; desc: string; priority: Priority;
  /** What it does for the user once connected. */
  uses: string;
  /** Inline connect form. Absent = connect elsewhere (settingsHref) or by sign-in (oauth). */
  fields?: FieldDef[];
  help?: string;
  oauth?: boolean;
  /** A multi-step setup component instead of a plain form. */
  guided?: 'whatsapp';
  settingsHref?: string;
  /** Extra buttons once connected. */
  actions?: { action: string; label: string }[];
}

export const INTEGRATIONS: IntegrationDef[] = [
  { id: 'wa', name: 'WhatsApp Business', desc: 'Chat with leads and send follow-ups on WhatsApp.', priority: 'Critical', uses: 'Send WhatsApp messages and templates to leads from your own business number.', settingsHref: '/client-acquisition/settings?tab=whatsapp-api',
    guided: 'whatsapp' },
  { id: 'gmail', name: 'Gmail / Google Workspace', desc: 'Send and receive email from your own Google mailbox.', priority: 'Critical', uses: 'Campaigns send from your Gmail and replies are read back into the Inbox automatically.',
    fields: [{ name: 'email', label: 'Gmail address', placeholder: 'you@gmail.com' }, { name: 'password', label: 'App password', type: 'password', placeholder: '16-character app password' }],
    help: 'Use a Google app password (Google Account → Security → 2-Step Verification → App passwords), and make sure IMAP is on in Gmail settings.' },
  { id: 'apollo', name: 'Apollo', desc: 'Find and enrich business contacts.', priority: 'High', uses: 'Decision-maker lookups use your own Apollo credits to find the owner and their email.',
    fields: [{ name: 'apiKey', label: 'Apollo API key', type: 'password', placeholder: 'Paste your API key' }], help: 'Apollo → Settings → Integrations → API → create a key.' },
  { id: 'snov', name: 'Snov.io', desc: 'Email discovery and verification.', priority: 'High', uses: 'Finds owners\' emails, checks addresses before sending and powers Discover with Snov, using your own credits.',
    fields: [{ name: 'clientId', label: 'API User ID', placeholder: 'API User ID' }, { name: 'clientSecret', label: 'API Secret', type: 'password', placeholder: 'API Secret' }], help: 'Snov.io → Account settings → API.' },
  { id: 'smtp', name: 'SMTP', desc: 'Send from any mailbox you own.', priority: 'High', uses: 'Campaigns send from your own mail server; replies are read from the same mailbox.',
    fields: [{ name: 'host', label: 'SMTP server', placeholder: 'smtp.yourdomain.com' }, { name: 'port', label: 'Port', type: 'number', placeholder: '587' }, { name: 'email', label: 'Login / email', placeholder: 'you@yourdomain.com' }, { name: 'password', label: 'Password', type: 'password' }] },
  { id: 'gcal', name: 'Google Calendar', desc: 'Offer times you are free and book meetings.', priority: 'High', uses: 'Finds your free working-hour times and books meetings with a Google Meet link, for the Meeting Booking agent.', oauth: true,
    actions: [{ action: 'slots', label: 'Show free times' }] },
  { id: 'airtable', name: 'Airtable', desc: 'Sync leads to an Airtable base.', priority: 'Medium', uses: 'Pushes your campaign leads, their status and reply type into an Airtable table (updates by email, never duplicates).',
    fields: [{ name: 'token', label: 'Personal access token', type: 'password', placeholder: 'pat…' }, { name: 'baseId', label: 'Base ID', placeholder: 'appXXXXXXXXXXXXXX' }, { name: 'table', label: 'Table name', placeholder: 'Leads' }],
    help: 'Create a token at airtable.com/create/tokens with data.records:read and data.records:write for this base. The table needs text columns: Email, Name, Business, Website, Campaign, Status, Reply type, Stage.',
    actions: [{ action: 'sync', label: 'Sync leads now' }] },
  { id: 'webhooks', name: 'CRM Webhooks / API', desc: 'Push leads and replies to your own CRM.', priority: 'Medium', uses: 'Posts signed JSON to your URL when a reply arrives or a lead turns interested, and can send all your leads on demand.',
    fields: [{ name: 'url', label: 'Endpoint URL', type: 'url', placeholder: 'https://your-crm.com/hooks/runvax' }],
    help: 'Each request carries X-Runvax-Signature (HMAC-SHA256 of the body with your signing secret). Events: reply.received, lead.interested, leads.sync.',
    actions: [{ action: 'sync', label: 'Send all leads' }] },
];

export const PRIORITY_ORDER: Priority[] = ['Critical', 'High', 'Medium'];
