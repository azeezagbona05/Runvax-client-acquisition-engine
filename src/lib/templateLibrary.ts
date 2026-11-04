/**
 * Industry Campaign Template Library (RUNVAX 2.0 only).
 *
 * A template is configuration, not code: one shared campaign engine (templateEngine.ts, the sender, the reply
 * pipeline) runs every industry, and a template only says who it is for, what to ask, how to word each touch,
 * which stages and metrics matter and what each agent should focus on. New industries are new records here.
 *
 * Nothing in a template is a result: no statistics, testimonials or performance claims.
 */

import type { AgentId } from '@/lib/acqReplies';
import type { Automation } from '@/lib/automation';
import type { Conversion, Objective } from '@/lib/campaignBrief';
import type { StageId } from '@/lib/replyIntel';

export type TouchId = 'intro' | 'review' | 'educate' | 'demo' | 'final';
export type Channel = 'email' | 'whatsapp' | 'sms' | 'linkedin';
export type QuestionKey = 'offer' | 'summary' | 'features' | 'market' | 'audience' | 'objective' | 'contacts' | 'channels' | 'conversion';

export interface Question { label: string; placeholder?: string; help?: string }

export interface TemplateConfig {
  id: string;
  /** 'official' ones are managed by RUNVAX; 'user' ones are saved by an account. */
  source: 'official' | 'user';
  industry: string;
  name: string;
  /** Product or service category shown on the card. */
  category: string;
  description: string;
  /** The kind of campaign. Property marketing speaks to buyers, not businesses. */
  kind: 'b2b_software' | 'property_marketing';
  product: { name: string; offer: string; summary: string; features: string[]; featuresHeading: string };
  idealCustomer: string;
  audienceCriteria: string[];
  objectives: string[];
  primaryObjective: Objective;
  conversion: Conversion;
  channels: Channel[];
  messagingStrategy: string[];
  /** Paragraphs per touch. %slots% are filled from the brief; a paragraph whose slot is empty is left out. */
  copy: Record<TouchId, string[]>;
  subjects: Record<TouchId, string>;
  cta: { recommended: string; alternatives: string[] };
  /** Names for the seven pipeline stages in this industry. */
  stageLabels: Record<StageId, string>;
  metrics: Array<{ id: string; label: string }>;
  /** What each agent should focus on for this industry. */
  agents: Record<AgentId, string>;
  /** The guided-setup questions, worded for this industry. */
  questions: Record<QuestionKey, Question>;
  /** What to tell people about contacting this audience. */
  contactNote: string;
  art: { icon: 'dental' | 'restaurant' | 'hotel' | 'property' | 'custom'; from: string; to: string };
  /** Saved templates only: the exact sequence the user saved, which loads as it is. */
  savedAutomation?: Automation;
}

const STD_METRICS = [
  { id: 'sent', label: 'Emails sent' }, { id: 'opened', label: 'Opens (estimate)' }, { id: 'replied', label: 'Replies' },
  { id: 'interested', label: 'Interested' },
];

const B2B_COPY = (angle: string, educate: string): Record<TouchId, string[]> => ({
  intro: [
    'I came across {{business}} and wanted to introduce something %forAudience%.',
    '%summary%', '%features%', angle, '%ask%',
  ],
  review: [
    'I wanted to check whether you had a chance to look at my earlier note about %short% for {{business}}.',
    'The main benefit is simple: %benefit%.', '%followAsk%',
  ],
  educate: [educate, 'That is exactly what %short% is built to help with. If it is useful, I can show you what that looks like for {{business}}.'],
  demo: [
    'I would like to invite you to a short walkthrough of %short%, so you can see how it works in practice for {{business}}.',
    'It takes about 15 minutes. Would you be open to that?',
  ],
  final: [
    'I will keep this short, since this is my last note about %short%.',
    'If it is something {{business}} would like to explore, just reply with "interested" and I will take it from there. If not, reply with "no thanks" and I will not contact you again. Either answer is completely fine.',
  ],
});

const B2B_QUESTIONS = (what: string, audience: string, features: string): Record<QuestionKey, Question> => ({
  offer: { label: 'Business or product name', placeholder: what },
  summary: { label: 'Product description', placeholder: 'One or two sentences on what it does for the customer.' },
  features: { label: 'Main offer: what is included (one per line)', placeholder: features },
  market: { label: 'Target geographical market', placeholder: 'e.g. United Kingdom, or Lagos and Abuja' },
  audience: { label: 'Ideal audience', placeholder: audience },
  objective: { label: 'Campaign objective and goal', placeholder: 'e.g. Book 20 demos' },
  contacts: { label: 'Contact audience you have', help: 'Upload a CSV or paste addresses in the next step. You can also add contacts later.' },
  channels: { label: 'Communication channels', help: 'Email sends today. Other channels are shown so you can see what is planned.' },
  conversion: { label: 'Desired conversion action' },
});

const B2B_STAGES: Record<StageId, string> = {
  identified: 'Contact identified', contacted: 'Campaign contacted', engaged: 'Engaged', interested: 'Interested',
  demo_booked: 'Demo booked', proposal_sent: 'Proposal sent', customer: 'Customer acquired',
};

const B2B_NOTE = 'Business contacts: use work addresses for decision-makers. Every email carries a one-click unsubscribe, and anyone who opts out is never emailed again.';

export const OFFICIAL_TEMPLATES: TemplateConfig[] = [
  {
    id: 'dental-clinics', source: 'official', industry: 'Dental Clinics', name: 'Dental AI Hub – Clinic Outreach', category: 'Healthcare software',
    description: 'Introduce Dental AI Hub to clinic owners and practice managers and book product demonstrations.',
    kind: 'b2b_software',
    product: {
      name: 'Dental AI Hub', offer: 'Dental AI Hub – AI patient acquisition and clinic automation',
      summary: 'An AI assistant that answers patient enquiries instantly, follows up automatically and helps clinics turn more enquiries into booked appointments.',
      features: ['Instant replies to patient enquiries', 'Automated follow-ups for missed or unanswered enquiries', 'Appointment booking support', 'A console to see every conversation and patient journey'],
      featuresHeading: 'Our system includes',
    },
    idealCustomer: 'A dental clinic that receives patient enquiries by phone, web form or social media and wants them answered and followed up consistently.',
    audienceCriteria: ['Dental clinic owners', 'Clinic directors', 'Practice managers', 'Multi-branch dental groups', 'Clinics with a website and a public contact email'],
    objectives: ['Introduce Dental AI Hub', 'Generate qualified interest', 'Book product demonstrations', 'Acquire paying dental clinic customers'],
    primaryObjective: 'book_meetings', conversion: 'demo_booking', channels: ['email', 'whatsapp'],
    messagingStrategy: ['Lead with missed enquiries, not technology', 'Speak to the owner or practice manager about workload and patient experience', 'One soft ask per email: a short demonstration', 'Show the patient journey, from first enquiry to booked appointment'],
    copy: B2B_COPY(
      'The idea is to help {{business}} turn more patient enquiries into booked appointments without adding to your reception team\'s workload.',
      'One thing I keep seeing with dental clinics: when a patient enquiry is answered late, or a follow-up is forgotten, the patient often books with whichever clinic replied first.',
    ),
    subjects: { intro: '%short% for {{business}}', review: 'Re: {{subject}}', educate: 'How faster follow-up helps {{business}}', demo: 'See %short% in action', final: 'Last note about {{business}}' },
    cta: { recommended: 'Book a 15-minute demonstration', alternatives: ['Reply "interested" for more information', 'Ask for a written overview'] },
    stageLabels: B2B_STAGES,
    metrics: [...STD_METRICS, { id: 'demo_booked', label: 'Demos booked' }, { id: 'customer', label: 'Clinics acquired' }],
    agents: {
      strategist: 'Plan around missed patient enquiries and the clinic owner\'s time.',
      audience: 'Prefer owner, director and practice-manager addresses; skip generic info@ inboxes when a named contact exists.',
      content: 'Write plainly for a busy clinic. No clinical claims and no promised results.',
      outreach: 'Send the introduction within the daily limit, in clinic business hours.',
      followup: 'Follow the five-touch rhythm and stop at the first reply, opt-out or booked demo.',
      reply: 'Treat pricing questions as interest. Suggest a short demonstration rather than quoting a price.',
    },
    questions: B2B_QUESTIONS('e.g. Dental AI Hub', 'e.g. Dental clinic owners and practice managers', 'Instant replies to patient enquiries\nAutomated follow-ups\nAppointment booking support'),
    contactNote: B2B_NOTE,
    art: { icon: 'dental', from: '#e0f2fe', to: '#bae6fd' },
  },
  {
    id: 'restaurants', source: 'official', industry: 'Restaurants', name: 'RESTOVAX – Restaurant Management', category: 'Hospitality software',
    description: 'Promote RESTOVAX POS, inventory and reporting to restaurant owners and managers and book demonstrations.',
    kind: 'b2b_software',
    product: {
      name: 'RESTOVAX', offer: 'RESTOVAX – restaurant management software',
      summary: 'Restaurant management software that brings point of sale, inventory and sales reporting into one place.',
      features: ['Point of sale (POS) for taking orders and payments', 'Inventory management to track stock', 'Sales and operational reporting'],
      featuresHeading: 'RESTOVAX includes',
    },
    idealCustomer: 'A restaurant that runs orders, stock and sales reporting through separate tools or by hand and wants one clear view of the business.',
    audienceCriteria: ['Restaurant owners', 'Restaurant managers', 'Multi-location restaurant operators', 'Restaurants with a public contact email'],
    objectives: ['Promote restaurant POS', 'Promote inventory management', 'Promote sales and operational reporting', 'Generate software demonstrations', 'Acquire restaurant customers'],
    primaryObjective: 'book_meetings', conversion: 'demo_booking', channels: ['email', 'whatsapp'],
    messagingStrategy: ['Rotate the angle by touch: POS, then inventory, then reporting', 'Speak to owners about control and managers about daily workload', 'Offer a demonstration on the restaurant\'s own routine', 'Multi-location operators: lead with one view across locations'],
    copy: B2B_COPY(
      'The idea is to give {{business}} one place to take orders, keep track of stock and see how the restaurant is performing.',
      'One thing I keep seeing with restaurants: orders, stock and sales figures live in different places, so it is hard to see what is actually working until the end of the month.',
    ),
    subjects: { intro: '%short% for {{business}}', review: 'Re: {{subject}}', educate: 'One view of orders, stock and sales at {{business}}', demo: 'See %short% in action', final: 'Last note about {{business}}' },
    cta: { recommended: 'Book a software demonstration', alternatives: ['Reply "interested" for the POS overview', 'Ask about inventory or reporting only'] },
    stageLabels: B2B_STAGES,
    metrics: [...STD_METRICS, { id: 'demo_booked', label: 'Demos booked' }, { id: 'customer', label: 'Restaurants acquired' }],
    agents: {
      strategist: 'Plan three angles (POS, inventory, reporting) and rotate them across the touches.',
      audience: 'Separate single restaurants from multi-location operators and suggest a different angle for each.',
      content: 'Write plainly for a busy restaurant. No invented savings or figures.',
      outreach: 'Send mid-morning, outside service rush, within the daily limit.',
      followup: 'Follow the five-touch rhythm and stop at the first reply, opt-out or booked demo.',
      reply: 'Ask which part matters most (POS, stock or reporting) before suggesting a demonstration.',
    },
    questions: B2B_QUESTIONS('e.g. RESTOVAX', 'e.g. Restaurant owners and managers', 'Point of sale (POS)\nInventory management\nSales and operational reporting'),
    contactNote: B2B_NOTE,
    art: { icon: 'restaurant', from: '#ffedd5', to: '#fed7aa' },
  },
  {
    id: 'hotels', source: 'official', industry: 'Hotels', name: 'Hotel Management Application', category: 'Hospitality software',
    description: 'Introduce hotel management software to owners and general managers and book demonstrations.',
    kind: 'b2b_software',
    product: {
      name: 'Hotel Management Application', offer: 'Hotel Management Application – hotel management software',
      summary: 'Hotel management software for reservations and bookings, guest management and day-to-day operations.',
      features: ['Reservation and booking management', 'Guest management', 'Daily operations in one place'],
      featuresHeading: 'The application includes',
    },
    idealCustomer: 'A hotel that handles bookings and guest details across calls, messages and spreadsheets and wants them managed in one system.',
    audienceCriteria: ['Hotel owners', 'General managers', 'Hotel operators', 'Hotels with a public contact email'],
    objectives: ['Introduce hotel management capabilities', 'Promote reservation and booking management', 'Promote guest management', 'Book demonstrations', 'Acquire hotel customers'],
    primaryObjective: 'book_meetings', conversion: 'demo_booking', channels: ['email', 'whatsapp'],
    messagingStrategy: ['Lead with bookings that are easy to lose track of', 'Speak to general managers about daily operations and owners about control', 'Offer a walkthrough of a booking from enquiry to check-in', 'Keep the ask to one short demonstration'],
    copy: B2B_COPY(
      'The idea is to help {{business}} keep reservations and guest details in one place, so the team spends less time chasing information.',
      'One thing I keep seeing with hotels: bookings and guest details end up spread across calls, messages and spreadsheets, which makes mistakes and missed follow-ups easy.',
    ),
    subjects: { intro: '%short% for {{business}}', review: 'Re: {{subject}}', educate: 'Keeping bookings and guests in one place at {{business}}', demo: 'See %short% in action', final: 'Last note about {{business}}' },
    cta: { recommended: 'Book a 15-minute demonstration', alternatives: ['Reply "interested" for an overview', 'Ask about reservations or guest management only'] },
    stageLabels: B2B_STAGES,
    metrics: [...STD_METRICS, { id: 'demo_booked', label: 'Demos booked' }, { id: 'customer', label: 'Hotels acquired' }],
    agents: {
      strategist: 'Plan around reservations first, then guest management, then operations.',
      audience: 'Prefer general-manager and owner addresses; note hotels that are part of a group.',
      content: 'Write plainly for a busy front desk team. No invented occupancy or revenue claims.',
      outreach: 'Send outside check-in and check-out peaks, within the daily limit.',
      followup: 'Follow the five-touch rhythm and stop at the first reply, opt-out or booked demo.',
      reply: 'Ask how they manage reservations today, then suggest a demonstration.',
    },
    questions: B2B_QUESTIONS('e.g. Your hotel management application', 'e.g. Hotel owners and general managers', 'Reservation and booking management\nGuest management\nDaily operations in one place'),
    contactNote: B2B_NOTE,
    art: { icon: 'hotel', from: '#ede9fe', to: '#ddd6fe' },
  },
  {
    id: 'real-estate', source: 'official', industry: 'Real Estate', name: 'Property for Sale – Buyer Enquiries', category: 'Property marketing',
    description: 'Present a property to qualified buyers and investors, collect enquiries and schedule viewings.',
    kind: 'property_marketing',
    product: {
      name: 'Property for sale', offer: 'Property for sale',
      summary: 'A property that may suit buyers and investors who are looking in this area.',
      features: [], featuresHeading: 'Key details',
    },
    idealCustomer: 'A buyer or investor actively looking for a property in a specific area and price range, who has agreed to be contacted or whose contact details are public for that purpose.',
    audienceCriteria: ['Potential property buyers', 'Investors', 'Qualified property seekers', 'People who have asked for property updates'],
    objectives: ['Generate qualified buyer enquiries', 'Present available property information', 'Schedule property viewings', 'Convert interested prospects into buyers'],
    primaryObjective: 'generate_leads', conversion: 'viewing', channels: ['email', 'whatsapp'],
    messagingStrategy: ['Lead with the property: location, type and the details a buyer filters on', 'State only facts you can stand behind: no invented prices, yields or scarcity', 'Make the next step easy: a viewing at a day and time they choose', 'Respect buyers: one clear opt-out in every message'],
    copy: {
      intro: ['I am getting in touch because you may be looking for a property%inMarket%.', '%summary%', '%features%', 'If it sounds like what you are looking for, I would be glad to share more information.', '%ask%'],
      review: ['I wanted to check whether you had a chance to look at the details I sent about %short%.', '%followAsk%'],
      educate: ['A viewing is the best way to judge the space, the light, the condition and the surroundings, and it comes with no obligation.', 'If it helps, I can also send the details of %short% in writing so you can look at them in your own time.'],
      demo: ['I would be glad to arrange a viewing of %short% at a time that suits you.', 'Let me know a day and time that works and I will confirm it.'],
      final: ['I will keep this short, since this is my last note about %short%.', 'If you would like to know more or arrange a viewing, just reply with "interested". If not, reply with "no thanks" and I will not contact you again. Either answer is completely fine.'],
    },
    subjects: { intro: '%short%%inMarket%', review: 'Re: {{subject}}', educate: 'Before you view %short%', demo: 'Arrange a viewing of %short%', final: 'Last note about %short%' },
    cta: { recommended: 'Arrange a viewing', alternatives: ['Reply "interested" for the full details', 'Ask for a written property summary'] },
    stageLabels: { identified: 'Buyer identified', contacted: 'Buyer contacted', engaged: 'Engaged', interested: 'Enquiry received', demo_booked: 'Viewing scheduled', proposal_sent: 'Offer made', customer: 'Buyer secured' },
    metrics: [...STD_METRICS.slice(0, 2), { id: 'replied', label: 'Enquiries' }, { id: 'demo_booked', label: 'Viewings scheduled' }, { id: 'customer', label: 'Buyers secured' }],
    agents: {
      strategist: 'Plan around the property and one viewing as the conversion; this is property marketing, not software sales.',
      audience: 'Match buyers to the property by area and budget where the list has it; flag contacts without a lawful basis to be contacted.',
      content: 'State only the facts the user gave. No invented price, yield, demand or urgency.',
      outreach: 'Send individually, within the daily limit, to people the user is entitled to contact.',
      followup: 'Follow the five-touch rhythm and stop at the first reply, opt-out or scheduled viewing.',
      reply: 'Offer viewing times, answer only with facts provided, and record enquiries, viewings, offers and the sale.',
    },
    questions: {
      offer: { label: 'Property title or name', placeholder: 'e.g. 4-bedroom detached house, Lekki Phase 1' },
      summary: { label: 'Property description', placeholder: 'A short, factual description of the property.' },
      features: { label: 'Property details: price, size, features, viewing availability (one per line)', placeholder: 'Price: (your asking price)\nBedrooms: 4\nViewings: weekdays after 3pm' },
      market: { label: 'Location or area', placeholder: 'e.g. Lekki, Lagos' },
      audience: { label: 'Ideal buyer', placeholder: 'e.g. Families and investors looking in Lekki' },
      objective: { label: 'Campaign objective and goal', placeholder: 'e.g. Schedule 10 viewings' },
      contacts: { label: 'Buyer contacts you have', help: 'Only contact people you are entitled to contact. Upload a CSV or paste addresses in the next step.' },
      channels: { label: 'Communication channels', help: 'Email sends today. Other channels are shown so you can see what is planned.' },
      conversion: { label: 'Desired conversion action' },
    },
    contactNote: 'Property buyers are usually individuals. Only contact people who have asked to hear from you or whose details you may lawfully use for this purpose, and check the rules where they live. Every email carries a one-click unsubscribe.',
    art: { icon: 'property', from: '#dcfce7', to: '#bbf7d0' },
  },
];

export const INDUSTRIES = Array.from(new Set(OFFICIAL_TEMPLATES.map((t) => t.industry)));
export const templateById = (id: string | undefined | null, mine: TemplateConfig[] = []): TemplateConfig | undefined =>
  OFFICIAL_TEMPLATES.find((t) => t.id === id) ?? mine.find((t) => t.id === id);

/** Search by name, industry, category, description or objective. */
export function filterTemplates(list: TemplateConfig[], q: string, industry: string): TemplateConfig[] {
  const needle = q.trim().toLowerCase();
  return list.filter((t) => (!industry || t.industry === industry)
    && (!needle || [t.name, t.industry, t.category, t.description, ...t.objectives].join(' ').toLowerCase().includes(needle)));
}

/** The stage names for a campaign: its template's own wording, else the standard one. */
export function stageLabelsFor(templateId: string | undefined | null): Record<StageId, string> {
  return templateById(templateId)?.stageLabels ?? B2B_STAGES;
}
