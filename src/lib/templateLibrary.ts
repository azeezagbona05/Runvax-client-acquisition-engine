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
import { industryById, type Industry, type IndustryId } from '@/lib/industryIntel';

export type TouchId = 'intro' | 'review' | 'educate' | 'demo' | 'final';
export type Channel = 'email' | 'whatsapp' | 'sms' | 'linkedin';
export type QuestionKey = 'offer' | 'summary' | 'features' | 'market' | 'audience' | 'objective' | 'contacts' | 'channels' | 'conversion';

export interface Question { label: string; placeholder?: string; help?: string }

export interface TemplateConfig {
  id: string;
  /** 'official' ones are managed by RUNVAX; 'user' ones are saved by an account. */
  source: 'official' | 'user';
  industry: string;
  /** Which of the 17 campaign industries this belongs to (drives the picker, the intelligence panel and the scoring). */
  industryId?: IndustryId;
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
  art: { icon: 'dental' | 'restaurant' | 'hotel' | 'property' | 'custom' | Industry['icon']; from: string; to: string };
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

const BASE_TEMPLATES: TemplateConfig[] = [
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


// ── Industry templates for the 17 campaign industries ───────────────────────

interface IndustrySpec {
  id: string; ind: IndustryId; name: string; category: string; description: string;
  product: { name: string; summary: string; features: string[] };
  ideal: string; audience: string[]; angle: string; educate: string; strategy: string[]; tint: [string, string]; note?: string;
}

/** One record in, one full template out. Every template shares the same engine, stages, five-touch rhythm and opt-out handling. */
function industryTemplate(x: IndustrySpec): TemplateConfig {
  const ind = industryById(x.ind)!;
  const titles = [...ind.decisionMakers.primary, ...ind.decisionMakers.secondary].join(', ');
  const noun = ind.plural.replace(/^(.*?) and .*$/, '$1');
  return {
    id: x.id, source: 'official', industry: ind.label, industryId: x.ind, name: x.name, category: x.category, description: x.description, kind: 'b2b_software',
    product: { name: x.product.name, offer: `${x.product.name} for ${ind.plural}`, summary: x.product.summary, features: x.product.features, featuresHeading: 'What is included' },
    idealCustomer: x.ideal, audienceCriteria: x.audience,
    objectives: [`Introduce ${x.product.name}`, 'Generate qualified interest', 'Book short walkthroughs', `Acquire paying ${noun} customers`],
    primaryObjective: 'book_meetings', conversion: 'demo_booking', channels: ['email', 'linkedin', 'whatsapp'],
    messagingStrategy: [...x.strategy, 'One soft ask per email: a short walkthrough', 'No promised results, statistics or invented urgency'],
    copy: B2B_COPY(x.angle, x.educate),
    subjects: { intro: '%short% for {{business}}', review: 'Re: {{subject}}', educate: `A thought on ${ind.angle.gapShort} at {{business}}`, demo: 'A short walkthrough of %short%', final: 'Last note about {{business}}' },
    cta: { recommended: 'Book a 15-minute walkthrough', alternatives: ['Reply "interested" for more information', 'Ask for a written overview'] },
    stageLabels: B2B_STAGES,
    metrics: [...STD_METRICS, { id: 'demo_booked', label: 'Walkthroughs booked' }, { id: 'customer', label: 'Customers acquired' }],
    agents: {
      strategist: `Plan around ${ind.angle.gap}, and match the offer to what was observed about each business.`,
      audience: `Prefer ${titles} addresses; skip generic info@ inboxes when a named contact exists.`,
      content: `Write plainly for a busy owner. Refer to ${ind.angle.reference}. No promised results and no AI hype.`,
      outreach: 'Send the introduction within the daily limit, in local business hours, and respect every opt-out.',
      followup: 'Follow the five-touch rhythm and stop at the first reply, opt-out or booked walkthrough.',
      reply: 'Treat pricing questions as interest. Suggest a short walkthrough rather than quoting a price.',
    },
    questions: B2B_QUESTIONS(`e.g. ${x.product.name}`, `e.g. ${titles}`, x.product.features.slice(0, 3).join('\n')),
    contactNote: x.note ? `${B2B_NOTE} ${x.note}` : B2B_NOTE,
    art: { icon: ind.icon, from: x.tint[0], to: x.tint[1] },
  };
}

const T = (a: string, b: string): [string, string] => [a, b];
const INDUSTRY_TEMPLATES: TemplateConfig[] = ([
  { id: 'real-estate-website', ind: 'real-estate', name: 'Real Estate Website & Lead Capture', category: 'Property marketing services', description: 'Offer estate agencies a mobile-friendly property website that captures every enquiry.',
    product: { name: 'Property website with lead capture', summary: 'A fast, mobile-friendly property website with listing pages and enquiry forms, so every enquiry reaches your team.', features: ['Listing pages that work well on a phone', 'Enquiry forms with instant notification', 'Search-friendly pages for each area served', 'Easy updates by your own team'] },
    ideal: 'An estate agency or property firm with a dated website, or none, where enquiries arrive by phone and social media.', audience: ['Estate agency owners', 'Founders and CEOs', 'Property developers', 'Agencies with a dated or missing website'],
    angle: 'The idea is to give {{business}} a website that makes it easy for a buyer or tenant to enquire.', educate: 'A buyer searching for a property will usually message several agencies. A clear listing page with a simple enquiry form makes it easy to be one of them.',
    strategy: ['Lead with how easy it is to enquire, not with technology', 'Refer to their listings or the areas they cover'], tint: T('#dcfce7', '#bbf7d0') },
  { id: 'real-estate-crm', ind: 'real-estate', name: 'Property CRM & AI Sales Agent', category: 'Property sales software', description: 'Offer a property CRM with an AI agent that replies to and follows up every enquiry.',
    product: { name: 'Property CRM with an AI sales agent', summary: 'A CRM that keeps every property enquiry in one place, with an AI agent that replies to new enquiries and follows up automatically.', features: ['One inbox for every enquiry', 'Instant first replies to new enquiries', 'Automatic follow-up when an enquiry goes quiet', 'A view of every buyer and viewing'] },
    ideal: 'An agency that gets enquiries from several channels and replies to them by hand.', audience: ['Agency owners and CEOs', 'Founders', 'Marketing directors', 'Agencies with several branches'],
    angle: 'The idea is to help {{business}} reply to every property enquiry quickly without adding to your team\'s workload.', educate: 'When enquiries come in from a portal, a website and social media, it is easy for one to wait too long for a reply.',
    strategy: ['Lead with slow or missed enquiries', 'Speak to the owner about team workload'], tint: T('#dcfce7', '#bbf7d0') },
  { id: 'real-estate-seo', ind: 'real-estate', name: 'SEO & GEO for Estate Agents', category: 'Property marketing services', description: 'Offer local SEO and AI-search visibility to agencies who want more enquiries from search.',
    product: { name: 'Local SEO and AI-search visibility', summary: 'Helps an agency show up when people search for property in its area, in search engines and in AI assistants.', features: ['Local pages for each area served', 'Google Business Profile tidy-up', 'Content that answers common buyer questions', 'Tracking of enquiries that come from search'] },
    ideal: 'An agency whose name does not appear when people search for property in its area.', audience: ['Agency owners', 'Founders and CEOs', 'Marketing directors', 'Agencies with a website but little search traffic'],
    angle: 'The idea is to help {{business}} appear when people search for property in the areas you cover.', educate: 'More people now ask an AI assistant or a search engine where to find an agent. Clear local pages and an accurate business profile help an agency be found.',
    strategy: ['Lead with being found in the areas they cover', 'Keep it factual, with no ranking promises'], tint: T('#dcfce7', '#bbf7d0') },
  { id: 'clinic-ai-receptionist', ind: 'healthcare', name: 'AI Receptionist for Clinics', category: 'Healthcare software', description: 'Offer an AI receptionist that answers patient enquiries at any hour and passes bookings to your team.',
    product: { name: 'AI Receptionist', summary: 'An assistant that answers patient enquiries by chat or message at any hour and passes booking requests to your team.', features: ['Instant replies to common enquiries such as hours, services and location', 'Booking requests passed to reception', 'Follow-up on enquiries that were not answered', 'A shared view of every conversation'] },
    ideal: 'A clinic whose reception team is busy and where enquiries sometimes wait for a reply.', audience: ['Clinic owners', 'Practice managers', 'Operations managers', 'Specialist practices and medical centres'],
    angle: 'The idea is to help {{business}} answer enquiries sooner without adding to your reception team\'s workload.', educate: 'When an enquiry is answered late, the person often contacts whichever clinic replied first.',
    strategy: ['Lead with enquiry handling, not technology', 'No clinical claims and no medical advice'], tint: T('#e0f2fe', '#bae6fd'), note: 'Do not collect or process identifiable patient health information as part of prospecting.' },
  { id: 'clinic-reactivation', ind: 'healthcare', name: 'Patient Reactivation & Appointment Automation', category: 'Healthcare software', description: 'Offer reminders and rebooking for existing patients who are due a visit.',
    product: { name: 'Patient reactivation automation', summary: 'Reminds existing patients when a check-up or follow-up is due and makes it easy to rebook, using the clinic\'s own contact list.', features: ['Reminders for patients who are due a visit', 'Simple rebooking requests', 'Follow-up after missed appointments', 'A summary of rebooking activity'] },
    ideal: 'A clinic with a patient list and a diary that is not always full.', audience: ['Clinic owners', 'Practice managers', 'Operations managers', 'Multi-branch practices'],
    angle: 'The idea is to help {{business}} bring existing patients back for the care they are due, with less manual chasing.', educate: 'Patients who are due a visit often just need a timely reminder and an easy way to book.',
    strategy: ['Lead with a fuller diary and less manual chasing', 'Use only the clinic\'s own patient relationships'], tint: T('#e0f2fe', '#bae6fd'), note: 'Do not collect or process identifiable patient health information as part of prospecting.' },
  { id: 'agency-white-label', ind: 'marketing', name: 'White-label AI Agents for Agencies', category: 'Agency services', description: 'Offer agencies AI agents they can resell to their own clients under their own brand.',
    product: { name: 'White-label AI agents', summary: 'AI agents an agency can offer under its own brand to handle client enquiries and follow-up.', features: ['Agents branded as the agency\'s own', 'Setup for each client from a template', 'Shared reporting for the agency', 'No extra hires needed'] },
    ideal: 'A digital agency that wants to add an AI service for clients without building it.', audience: ['Agency founders', 'CEOs', 'Heads of growth', 'SEO, branding and advertising agencies'],
    angle: 'The idea is to let {{business}} add an AI service for your clients under your own brand, without building it yourselves.', educate: 'Many clients now ask their agency about AI. A ready-made, white-label service lets an agency answer without a new development project.',
    strategy: ['Lead with a new service line for their clients', 'Speak as a partner, not a competitor'], tint: T('#fae8ff', '#f5d0fe') },
  { id: 'agency-seo-automation', ind: 'marketing', name: 'SEO Automation for Agencies', category: 'Agency software', description: 'Offer SEO automation that saves delivery time on audits and reporting.',
    product: { name: 'SEO automation', summary: 'Automates the repetitive parts of SEO delivery, such as audits, reporting and content briefs, so an agency can serve more clients with the same team.', features: ['Scheduled site audits', 'Client-ready reports', 'Content brief drafts', 'Rank and traffic tracking'] },
    ideal: 'An SEO or digital agency whose team spends a lot of time on audits and reports.', audience: ['Agency founders', 'CEOs', 'Heads of growth', 'SEO and content agencies'],
    angle: 'The idea is to give {{business}} back the time your team spends on audits and reports, so it can serve more clients.', educate: 'Audits and monthly reports are necessary but repetitive. Automating the routine parts leaves more time for strategy.',
    strategy: ['Lead with team time saved', 'Refer to the services they publish'], tint: T('#fae8ff', '#f5d0fe') },
  { id: 'solar-crm-quotes', ind: 'solar', name: 'Sales CRM & Quotation Automation', category: 'Energy sales software', description: 'Offer solar installers a sales CRM that speeds up quotations.',
    product: { name: 'Solar sales CRM with quotation automation', summary: 'Keeps every solar enquiry in one place and prepares quotations faster from a few details the customer provides.', features: ['Enquiries captured from the website and messages', 'Quotation drafts from site details', 'Follow-up reminders for open quotes', 'A pipeline view for the sales team'] },
    ideal: 'An installer that prepares quotations by hand and sometimes loses track of open enquiries.', audience: ['Installer owners', 'CEOs', 'Sales directors', 'Operations managers'],
    angle: 'The idea is to help {{business}} turn quotation enquiries into signed projects with less manual work.', educate: 'A customer asking for a solar quotation is often comparing a few installers, so a prompt, clear quote matters.',
    strategy: ['Lead with faster quotations', 'Refer to their services and coverage area'], tint: T('#fef9c3', '#fde68a') },
  { id: 'solar-leads-support', ind: 'solar', name: 'Lead Qualification & AI Customer Support', category: 'Energy sales software', description: 'Offer automatic lead qualification and customer support for solar companies.',
    product: { name: 'AI lead qualification', summary: 'Qualifies solar enquiries automatically, asking about the property, usage and timeline, and hands ready buyers to your sales team.', features: ['Automatic first reply to enquiries', 'Qualifying questions about property type, bills and timeline', 'Ready buyers passed to the sales team', 'Answers to common questions from existing customers'] },
    ideal: 'A solar company whose sales team spends time on enquiries that are not ready to buy.', audience: ['Installer owners', 'CEOs', 'Sales directors', 'Distributors with a sales team'],
    angle: 'The idea is to help {{business}} spend sales time on buyers who are ready, by qualifying enquiries automatically.', educate: 'Not every enquiry is ready for a site visit. A few simple questions at the start help the sales team focus.',
    strategy: ['Lead with sales time spent on the right buyers', 'Refer to the services they offer'], tint: T('#fef9c3', '#fde68a') },
  { id: 'software-ai-integration', ind: 'it-software', name: 'AI Integrations for Software Companies', category: 'Software services', description: 'Offer to add AI features to a software product without pulling the core team off its roadmap.',
    product: { name: 'AI integration service', summary: 'Adds AI features, such as assistants and automated workflows, to an existing software product without pulling the core team off its roadmap.', features: ['Scoping of one AI feature', 'Integration into the existing product', 'Handover with documentation', 'An ongoing support option'] },
    ideal: 'A software company that wants to add AI features but has a full roadmap.', audience: ['CEOs and founders', 'CTOs', 'Heads of engineering', 'SaaS companies and software agencies'],
    angle: 'The idea is to help {{business}} add an AI feature to your product without moving your core team off the roadmap.', educate: 'Customers increasingly ask for AI features, but building them can compete with planned work for the same engineers.',
    strategy: ['Lead with protecting the roadmap', 'Refer to their product or a recent release'], tint: T('#e0e7ff', '#c7d2fe') },
  { id: 'software-white-label-api', ind: 'it-software', name: 'White-label SaaS & API Integration', category: 'Software services', description: 'Offer white-label modules and API integrations to software companies and IT firms.',
    product: { name: 'White-label SaaS and API integrations', summary: 'Ready-made modules and API integrations a software company can offer under its own brand.', features: ['Modules offered under your own brand', 'API integration with existing tools', 'Documentation for your team', 'A shared roadmap'] },
    ideal: 'A software or managed-services company that wants to extend its offer without building every module.', audience: ['CEOs and founders', 'CTOs', 'IT directors', 'Managed service providers'],
    angle: 'The idea is to let {{business}} offer more to your customers through ready-made, white-label modules.', educate: 'Extending a product with a ready-made module can be quicker than building it, and keeps the customer relationship with you.',
    strategy: ['Lead with extending their offer', 'Speak as a technology partner'], tint: T('#e0e7ff', '#c7d2fe') },
  { id: 'legal-intake', ind: 'legal', name: 'Legal Client Intake & Enquiry Assistant', category: 'Legal software', description: 'Offer law firms prompt enquiry handling and consultation booking.',
    product: { name: 'AI enquiry assistant and legal CRM', summary: 'Responds to new client enquiries promptly, collects the first details and books consultations, with enquiries tracked in a simple CRM.', features: ['Prompt replies to new enquiries', 'Intake questions before a consultation', 'Consultation booking', 'A CRM for enquiries and follow-up'] },
    ideal: 'A law firm where new enquiries are answered by hand and sometimes wait.', audience: ['Managing partners', 'Senior partners', 'Immigration and corporate practices', 'Legal consultants'],
    angle: 'The idea is to help {{business}} respond to new client enquiries promptly and book consultations with less administration.', educate: 'Someone looking for a lawyer usually contacts more than one firm, and the firm that replies first often gets the consultation.',
    strategy: ['Lead with prompt, professional enquiry handling', 'Never ask for or process client information'], tint: T('#e2e8f0', '#cbd5e1'), note: 'Do not request or process confidential client information.' },
  { id: 'accounting-portal', ind: 'accounting', name: 'Accounting Workflow & Client Portal', category: 'Accounting software', description: 'Offer accounting firms a client portal and automatic reminders for missing documents.',
    product: { name: 'Client portal with accounting workflow automation', summary: 'A client portal for documents and requests, with automatic reminders for missing information.', features: ['Secure document requests', 'Automatic reminders for missing items', 'Onboarding checklists', 'A status view for each client'] },
    ideal: 'A firm that chases clients for documents by email and phone.', audience: ['Managing partners', 'Finance directors', 'Accounting and bookkeeping firms', 'Tax consultants'],
    angle: 'The idea is to help {{business}} collect documents and onboard clients with less chasing.', educate: 'Much of a busy season goes on asking clients for the same missing documents. A portal with reminders takes most of that away.',
    strategy: ['Lead with less chasing and faster onboarding', 'Refer to the services they publish'], tint: T('#e2e8f0', '#cbd5e1') },
  { id: 'logistics-tracking', ind: 'logistics', name: 'Logistics Tracking & Customer Support Automation', category: 'Logistics software', description: 'Offer shipment tracking and automatic customer support to logistics companies.',
    product: { name: 'Shipment tracking and AI customer support', summary: 'Lets customers check shipment status themselves and answers common questions automatically.', features: ['Shipment status look-up for customers', 'Automatic status messages', 'Answers to common questions', 'The dispatch team sees every conversation'] },
    ideal: 'A logistics company whose team spends time answering "where is my shipment?"', audience: ['Managing directors', 'Operations directors', 'Courier and freight companies', 'Fleet operators'],
    angle: 'The idea is to help {{business}} answer "where is my shipment?" automatically, so your team can focus on moving freight.', educate: 'A large share of customer contact is simply asking for a status update, which can be answered without a person.',
    strategy: ['Lead with fewer status calls', 'Refer to their routes or services'], tint: T('#fee2e2', '#fecaca') },
  { id: 'construction-pm', ind: 'construction', name: 'Construction Project Management & CRM', category: 'Construction software', description: 'Offer project tracking and a tender pipeline to construction and engineering firms.',
    product: { name: 'Project management and CRM for contractors', summary: 'Tracks projects, tenders and client enquiries in one place so nothing is lost between site and office.', features: ['Project and task tracking', 'A tender and enquiry pipeline', 'Progress updates for clients', 'Reports for directors'] },
    ideal: 'A contractor that tracks projects and tenders across spreadsheets and messages.', audience: ['CEOs and owners', 'Project directors', 'Managing directors', 'Contractors and engineering firms'],
    angle: 'The idea is to help {{business}} keep projects, tenders and client updates in one place.', educate: 'When information lives in spreadsheets and messages, it is easy for a tender follow-up or a project update to be missed.',
    strategy: ['Lead with one place for projects and tenders', 'Refer to their specialisation or a published project'], tint: T('#ffedd5', '#fed7aa') },
  { id: 'hospitality-booking-concierge', ind: 'hospitality', name: 'Booking Automation & AI Concierge', category: 'Hospitality software', description: 'Offer hotels, venues and tour operators automatic guest replies and direct booking.',
    product: { name: 'Booking automation and AI concierge', summary: 'Answers guest questions at any hour and turns reservation requests into confirmed direct bookings.', features: ['Instant replies to guest questions', 'Direct booking requests', 'Follow-up on unconfirmed enquiries', 'A shared view of guest messages'] },
    ideal: 'A hotel, venue or tour operator that gets reservation questions outside office hours.', audience: ['General managers', 'Hotel and venue owners', 'Travel agencies and tour operators', 'Resorts'],
    angle: 'The idea is to help {{business}} answer reservation questions at any hour and keep more bookings direct.', educate: 'A traveller choosing where to stay will often book with whoever answers first, including outside office hours.',
    strategy: ['Lead with after-hours enquiries and direct bookings', 'Refer to their property or location'], tint: T('#cffafe', '#a5f3fc') },
  { id: 'beauty-booking-reactivation', ind: 'beauty', name: 'Booking & Client Reactivation for Salons and Spas', category: 'Wellness software', description: 'Offer online booking and lapsed-client reminders to salons, spas and studios.',
    product: { name: 'Booking software with client reactivation', summary: 'Online booking and an assistant that brings lapsed clients back with reminders and rebooking links.', features: ['An online booking page', 'Appointment reminders', 'Reminders for clients who have not been in for a while', 'Simple client records'] },
    ideal: 'A salon, spa or studio that takes bookings by phone or message and wants fuller diaries.', audience: ['Owners and founders', 'Salon managers', 'Spas and aesthetic clinics', 'Fitness and wellness studios'],
    angle: 'The idea is to help {{business}} fill the diary and bring lapsed clients back, with less time on the phone.', educate: 'Many regulars simply forget to rebook. A timely reminder with an easy booking link often does the job.',
    strategy: ['Lead with a fuller diary', 'Refer to their treatments or location'], tint: T('#fce7f3', '#fbcfe8') },
  { id: 'automotive-crm-sales', ind: 'automotive', name: 'Automotive CRM & AI Sales Agent', category: 'Automotive software', description: 'Offer dealerships a CRM and AI agent that follows up every buyer enquiry.',
    product: { name: 'Automotive CRM with an AI sales agent', summary: 'Captures buyer enquiries from every channel, replies promptly and keeps follow-up on track until the buyer visits.', features: ['Enquiries from the website and messages in one place', 'Prompt first replies', 'Follow-up reminders', 'Test-drive and service booking'] },
    ideal: 'A dealership or garage where buyer enquiries come in from several places and follow-up depends on who is free.', audience: ['Dealer principals', 'Owners', 'Sales managers', 'Dealerships, leasing firms and garages'],
    angle: 'The idea is to help {{business}} follow up every buyer enquiry promptly, from first message to showroom visit.', educate: 'A buyer will often enquire with a few dealers at once, so a quick, helpful reply makes a difference.',
    strategy: ['Lead with prompt follow-up of every enquiry', 'Refer to their vehicles or services'], tint: T('#e5e7eb', '#d1d5db') },
  { id: 'recruitment-ats-screening', ind: 'recruitment', name: 'Recruitment CRM & AI Screening', category: 'Recruitment software', description: 'Offer recruitment firms a CRM and AI-assisted screening.',
    product: { name: 'Applicant tracking with AI screening', summary: 'Tracks candidates and clients in one system and helps shortlist applicants against the role, with a person making every decision.', features: ['Candidate and client tracking', 'Screening of applicants against the job brief', 'Interview scheduling', 'Update summaries for clients'] },
    ideal: 'A recruitment firm that screens a high number of applications by hand.', audience: ['Agency founders', 'Recruitment directors', 'HR directors', 'Staffing firms and HR consultancies'],
    angle: 'The idea is to help {{business}} shortlist faster and keep clients and candidates informed.', educate: 'Reading every application takes time. Screening against the job brief gives recruiters a shortlist to review, while the decision stays with them.',
    strategy: ['Lead with time saved on screening', 'Stress that a person makes every decision'], tint: T('#ede9fe', '#ddd6fe') },
  { id: 'education-admissions', ind: 'education', name: 'AI Admissions Assistant & School CRM', category: 'Education software', description: 'Offer schools and training providers prompt admissions replies and enquiry tracking.',
    product: { name: 'AI admissions assistant', summary: 'Answers admissions enquiries promptly, keeps applicants informed and tracks every enquiry through to enrolment.', features: ['Instant replies to admissions questions', 'Reminders to complete an application', 'Enquiry-to-enrolment tracking', 'A shared view for the admissions team'] },
    ideal: 'A school or training provider that answers admissions enquiries by phone and message.', audience: ['School owners', 'Principals', 'Admissions directors', 'Training institutes and online academies'],
    angle: 'The idea is to help {{business}} answer admissions questions promptly and keep applicants informed through to enrolment.', educate: 'Families often ask several schools the same questions, and a prompt, clear answer helps them move forward.',
    strategy: ['Lead with prompt admissions replies', 'Never collect information about students or minors'], tint: T('#dbeafe', '#bfdbfe'), note: 'Do not collect or process information about students or minors.' },
  { id: 'wholesale-portal-inventory', ind: 'wholesale', name: 'B2B Ordering Portal & Inventory Management', category: 'Distribution software', description: 'Offer wholesalers and distributors online trade ordering linked to stock.',
    product: { name: 'B2B ordering portal', summary: 'Lets trade customers browse the catalogue, check stock and place orders online, linked to your inventory.', features: ['Catalogue and trade pricing for each customer', 'Online ordering', 'Stock visibility', 'Order history and easy reorders'] },
    ideal: 'A distributor that takes most orders by phone, message or email.', audience: ['Managing directors', 'Sales directors', 'Procurement directors', 'FMCG distributors, importers and industrial suppliers'],
    angle: 'The idea is to let {{business}} take trade orders online and show customers what is in stock, without phone calls.', educate: 'Trade customers reorder the same items again and again, so an easy online reorder saves time on both sides.',
    strategy: ['Lead with fewer phone orders and clearer stock', 'Refer to their product range or territory'], tint: T('#fef3c7', '#fde68a') },
  { id: 'manufacturing-automation-portal', ind: 'manufacturing', name: 'Manufacturing Automation & B2B Portal', category: 'Manufacturing software', description: 'Offer manufacturers connected orders, stock and reporting with a distributor portal.',
    product: { name: 'Manufacturing automation and B2B portal', summary: 'Connects orders, stock and production reporting, with a portal for distributors and trade buyers.', features: ['Orders and stock in one system', 'Production reporting', 'A distributor ordering portal', 'Integration with your existing ERP'] },
    ideal: 'A manufacturer that handles orders, stock and reporting in separate systems.', audience: ['CEOs and owners', 'Operations directors', 'Commercial directors', 'Manufacturers and packaging companies'],
    angle: 'The idea is to help {{business}} connect orders, stock and production reporting in one place.', educate: 'When orders, stock and production data sit in different tools, planning takes more manual effort than it should.',
    strategy: ['Lead with connected orders and reporting', 'Refer to their products or production capability'], tint: T('#e2e8f0', '#cbd5e1') },
  { id: 'events-crm-booking', ind: 'events', name: 'Event CRM & Booking Automation', category: 'Events software', description: 'Offer event companies enquiry tracking, quotes and booking confirmation.',
    product: { name: 'Event CRM with booking automation', summary: 'Tracks every event enquiry, sends quotes and follow-ups and confirms bookings.', features: ['Enquiry capture', 'Quote and follow-up automation', 'Booking confirmation', 'An event pipeline view'] },
    ideal: 'An event company that handles enquiries, quotes and bookings across messages and spreadsheets.', audience: ['Founders and CEOs', 'Event directors', 'Operations managers', 'Planners, producers and entertainment agencies'],
    angle: 'The idea is to help {{business}} turn event enquiries into confirmed bookings with less back-and-forth.', educate: 'A client planning an event usually asks several companies for a quote, and the one that responds clearly and quickly is easier to choose.',
    strategy: ['Lead with faster quotes and confirmed bookings', 'Refer to their event types or a recent event'], tint: T('#fae8ff', '#f5d0fe') },
] as IndustrySpec[]).map(industryTemplate);

/** The templates that existed before the industry set, tagged with the industry they belong to. */
const EXISTING_INDUSTRY: Record<string, IndustryId> = { 'dental-clinics': 'healthcare', restaurants: 'hospitality', hotels: 'hospitality', 'real-estate': 'real-estate' };

export const OFFICIAL_TEMPLATES: TemplateConfig[] = [
  ...BASE_TEMPLATES.map((t) => ({ ...t, industryId: t.industryId ?? EXISTING_INDUSTRY[t.id] })),
  ...INDUSTRY_TEMPLATES,
];

/** How many campaign templates each industry has, for the "What do you sell?" picker. */
export function templateCountByIndustry(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of OFFICIAL_TEMPLATES) if (t.industryId) out[t.industryId] = (out[t.industryId] ?? 0) + 1;
  return out;
}

export const INDUSTRIES = Array.from(new Set(OFFICIAL_TEMPLATES.map((t) => t.industry)));
export const templateById = (id: string | undefined | null, mine: TemplateConfig[] = []): TemplateConfig | undefined =>
  OFFICIAL_TEMPLATES.find((t) => t.id === id) ?? mine.find((t) => t.id === id);

/** Search by name, industry, category, description or objective. */
export function filterTemplates(list: TemplateConfig[], q: string, industry: string): TemplateConfig[] {
  const needle = q.trim().toLowerCase();
  return list.filter((t) => (!industry || t.industryId === industry || t.industry === industry)
    && (!needle || [t.name, t.industry, t.category, t.description, ...t.objectives].join(' ').toLowerCase().includes(needle)));
}

/** The stage names for a campaign: its template's own wording, else the standard one. */
export function stageLabelsFor(templateId: string | undefined | null): Record<StageId, string> {
  return templateById(templateId)?.stageLabels ?? B2B_STAGES;
}
