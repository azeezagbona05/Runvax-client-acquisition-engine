/**
 * Agent Skills: the reusable capabilities an agent is built from. A template is only a preset combination of these,
 * so a new template never needs new engine code. A skill is either `ready` (works today), `link` (works through a link
 * the business already has, e.g. a booking page), `campaign` (RUNVAX does it, but in campaigns, not in an agent)
 * or `soon` (shown so people know it is coming, and can never be switched on).
 */
export type SkillId =
  | 'knowledge' | 'leadCapture' | 'qualify' | 'booking' | 'handoff' | 'productSearch' | 'crm'
  | 'orderLookup' | 'email' | 'whatsapp' | 'content' | 'publishing';
export type SkillStatus = 'ready' | 'link' | 'campaign' | 'soon';

export interface SkillInfo {
  label: string; does: string; status: SkillStatus;
  /** Which engine the skill belongs to: the chat agent, or the content (visibility) agent. */
  engine: 'chat' | 'content';
  /** The concrete tools the agent gets with this skill, in plain words. `soon: true` = listed but not available yet. */
  tools: Array<{ t: string; soon?: boolean }>;
}

export const SKILLS: Record<SkillId, SkillInfo> = {
  knowledge: { label: 'Knowledge Retrieval', engine: 'chat', status: 'ready', does: 'Answers questions only from your business information: what you write here, your website, documents, FAQs, catalogues and policies.', tools: [{ t: 'Search your knowledge sources' }, { t: 'Say "I don\'t know" instead of guessing' }] },
  leadCapture: { label: 'Lead Capture', engine: 'chat', status: 'ready', does: 'Collects the name, email and phone of interested people and emails each new lead to you.', tools: [{ t: 'Pick up name, email, phone and company' }, { t: 'Email you every new lead (up to 20 a day)' }] },
  qualify: { label: 'Lead Qualification', engine: 'chat', status: 'ready', does: 'Asks your qualifying questions one at a time and notes what the person needs.', tools: [{ t: 'Ask your questions, one at a time' }, { t: 'Note what they need' }] },
  booking: { label: 'Appointment Booking', engine: 'chat', status: 'link', does: 'Gets people to book a time through your booking page (Calendly, Cal.com, Google or Microsoft booking pages). Your booking tool checks availability and sends the confirmation, reschedule and cancel links.', tools: [{ t: 'Share your booking page when they are ready' }, { t: 'Availability, confirmation, reschedule and cancel: done by your booking tool' }, { t: 'Check your calendar and book directly inside the chat', soon: true }] },
  handoff: { label: 'Human Handoff', engine: 'chat', status: 'ready', does: 'Passes the conversation to a person when someone asks for one, is unhappy, or hits one of your escalation rules, and tells you straight away.', tools: [{ t: 'Spot "talk to a person", complaints and your rules' }, { t: 'Mark the conversation "Needs a person" and email you' }] },
  productSearch: { label: 'Product Search', engine: 'chat', status: 'ready', does: 'Finds products in your catalogue (upload it as a CSV in Knowledge), compares options and links to your shop.', tools: [{ t: 'Search your product catalogue' }, { t: 'Compare options' }, { t: 'Link to product and checkout pages on your shop' }] },
  crm: { label: 'CRM Update', engine: 'chat', status: 'ready', does: 'Sends every new lead to your CRM through a webhook (Zapier, Make, n8n, HubSpot or your own server).', tools: [{ t: 'Send each new lead as signed JSON' }, { t: 'Send a test from the Deploy tab' }] },
  orderLookup: { label: 'Order Lookup', engine: 'chat', status: 'soon', does: 'Looks up a customer\'s order status in your store.', tools: [{ t: 'Look up an order by number', soon: true }] },
  email: { label: 'Email Sending', engine: 'chat', status: 'campaign', does: 'Sends approved emails and follow-ups. Today this is done by RUNVAX campaigns.', tools: [{ t: 'Follow-up emails: use a campaign' }] },
  whatsapp: { label: 'WhatsApp Messaging', engine: 'chat', status: 'soon', does: 'Talks to customers on WhatsApp.', tools: [{ t: 'WhatsApp channel', soon: true }] },
  content: { label: 'Content Generation', engine: 'content', status: 'ready', does: 'Writes articles about your business on a schedule.', tools: [{ t: 'Write articles' }] },
  publishing: { label: 'Website Publishing', engine: 'content', status: 'ready', does: 'Publishes approved articles to your site, WordPress, RSS or a webhook.', tools: [{ t: 'Publish approved articles' }] },
};

export const CHAT_SKILLS = (Object.keys(SKILLS) as SkillId[]).filter((s) => SKILLS[s].engine === 'chat');
/** Skills a chat agent can actually have switched on. */
export const USABLE_CHAT_SKILLS = CHAT_SKILLS.filter((s) => SKILLS[s].status === 'ready' || SKILLS[s].status === 'link');
export const isUsableChatSkill = (v: unknown): v is SkillId => typeof v === 'string' && (USABLE_CHAT_SKILLS as string[]).includes(v);
