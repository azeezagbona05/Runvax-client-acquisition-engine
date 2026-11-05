/** The integrations RUNVAX is working toward, in the owner's priority order, and which ones really exist today. */


export type Priority = 'Critical' | 'High' | 'Medium';
export interface RoadmapItem { id: string; name: string; desc: string; priority: Priority; status: 'available' | 'planned'; note: string }

export const INTEGRATION_ROADMAP: RoadmapItem[] = [
  { id: 'wa', name: 'WhatsApp Business', desc: 'Chat with leads and send follow-ups on WhatsApp.', priority: 'Critical', status: 'planned', note: 'The app already has a WhatsApp Business API connection in Settings. It is not yet linked to campaigns or agents.' },
  { id: 'gmail', name: 'Gmail / Google Workspace', desc: 'Send and receive email from your own Google mailbox.', priority: 'Critical', status: 'available', note: 'Works today through your own SMTP in Settings → Email (Gmail needs an app password). Sign-in with Google and inbox reading are not built yet.' },
  { id: 'apollo', name: 'Apollo', desc: 'Find and enrich business contacts.', priority: 'High', status: 'planned', note: 'Partly built: the decision-maker lookup can use Apollo when an API key is set. No account connection screen yet.' },
  { id: 'snov', name: 'Snov.io', desc: 'Email discovery and verification.', priority: 'High', status: 'planned', note: 'Partly built, for testing: the decision-maker lookup can use Snov.io to find a named owner\'s email when SNOV_CLIENT_ID and SNOV_CLIENT_SECRET are set. No account connection screen yet.' },
  { id: 'smtp', name: 'SMTP', desc: 'Send from any mailbox you own.', priority: 'High', status: 'available', note: 'Built: add your server in Settings → Email. Campaigns send only from your own SMTP.' },
  { id: 'gcal', name: 'Google Calendar', desc: 'Offer times you are free and book meetings.', priority: 'High', status: 'planned', note: 'Not built. Needed for the Meeting Booking agent.' },
  { id: 'airtable', name: 'Airtable', desc: 'Sync leads to an Airtable base.', priority: 'Medium', status: 'planned', note: 'Not built.' },
  { id: 'webhooks', name: 'CRM Webhooks / API', desc: 'Push leads and replies to your own CRM.', priority: 'Medium', status: 'planned', note: 'Not built.' },
];

export const PRIORITY_ORDER: Priority[] = ['Critical', 'High', 'Medium'];
