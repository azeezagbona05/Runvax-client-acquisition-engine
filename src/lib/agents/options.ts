import { TEMPLATES, type TemplateId } from './templates';

/**
 * Ready-made choices for the agent forms, so owners tick options instead of typing.
 * Every list field still accepts the owner's own wording ("Add your own").
 */
const COMMON = {
  objectives: [
    'Answer enquiries accurately from the business information',
    'Capture the name and contact details of everyone who wants a follow-up',
    'Get people to book an appointment',
    'Ask every qualifying question',
    'Recommend the offer that fits, and say why',
    'Solve common questions straight away',
    'Hand difficult issues to a person with the details they need',
    'Guide them to the product or checkout page',
  ],
  behaviour: [
    'Short replies, one question at a time',
    'Warm and welcoming',
    'Consultative, never pushy',
    'Patient and empathetic',
    'Admit when you do not know',
    'Never give advice the business has not written down',
    'Reply in the language the visitor writes in',
    'Use simple words, no jargon',
  ],
  escalation: [
    'The person asks to speak to a human',
    'The person is unhappy or makes a complaint',
    'An urgent or emergency situation',
    'The person asks for a custom price or contract terms',
    'Billing, refunds or account changes',
    'Any question about one specific order',
    'The answer is not in the business information',
  ],
  questions: [
    'What can we help you with today?',
    'Have you been to us before?',
    'What day and time would suit you best?',
    'What are you hoping to achieve?',
    'Do you have a budget in mind?',
    'When would you like this in place?',
    'What is the best email or phone number to reach you?',
  ],
  audience: [
    'Local customers', 'Homeowners', 'Patients', 'Small businesses', 'Large companies', 'Online shoppers', 'Students', 'Parents', 'Professionals', 'Our staff',
  ],
} as const;
export type OptionField = keyof typeof COMMON;

/** The template's own suggestions first, then the common ones, without repeats. */
export function optionsFor(field: OptionField, template?: TemplateId): string[] {
  const t = template ? TEMPLATES[template] : undefined;
  const own = field === 'audience' ? [] : ((t?.[field] as string[] | undefined) ?? []);
  return Array.from(new Set([...own, ...COMMON[field]]));
}

/** Business types for the builder's one-click description. */
export const BUSINESS_TYPES = [
  'Dental clinic', 'Medical clinic', 'Law firm', 'Real estate agency', 'Restaurant', 'Salon or spa', 'Gym or fitness studio',
  'Online store', 'Software company', 'Marketing agency', 'Accounting firm', 'School or training', 'Hotel', 'Home services', 'Solar company',
];

/** What the agent should do. The wording carries the words the planner listens for, so each chip switches on the right skill. */
export const AGENT_TASKS: Array<{ id: string; label: string; phrase: string }> = [
  { id: 'answer', label: 'Answer questions', phrase: 'answers enquiries about our services' },
  { id: 'capture', label: 'Capture contact details', phrase: 'captures contact details of leads' },
  { id: 'qualify', label: 'Qualify leads', phrase: 'qualifies leads by budget and timeline' },
  { id: 'book', label: 'Book appointments', phrase: 'books appointments' },
  { id: 'recommend', label: 'Recommend products', phrase: 'is a shopping assistant that helps shoppers find the right products' },
  { id: 'sell', label: 'Sell and handle objections', phrase: 'recommends the right offer and handles sales objections' },
  { id: 'support', label: 'Support customers', phrase: 'gives customer support and handles complaints' },
  { id: 'orders', label: 'Delivery and returns questions', phrase: 'gives customer service for order, delivery and returns questions' },
  { id: 'crm', label: 'Send leads to my CRM', phrase: 'sends captured leads to our CRM' },
  { id: 'handoff', label: 'Hand over to a person', phrase: 'hands the chat over to a person on our team when needed' },
  { id: 'staff', label: 'Answer staff questions', phrase: "answers our employees' questions from the staff handbook" },
  { id: 'articles', label: 'Write articles for Google', phrase: 'writes blog articles about our business so we get found on Google and AI search' },
];

/** Which agent the ticked jobs point to, when no template was chosen. The most specific job wins. */
export function templateForTasks(taskIds: string[]): TemplateId | null {
  const has = (t: string) => taskIds.includes(t);
  if (!taskIds.length) return null;
  if (has('articles') && taskIds.length === 1) return 'visibility';
  if (has('staff')) return 'internal';
  if (has('recommend')) return 'shopping';
  if (has('orders')) return 'orders';
  if (has('sell')) return 'sales';
  if (has('qualify') || has('crm')) return 'qualify';
  if (has('support')) return 'support';
  if (has('book') && !has('capture') && !has('answer')) return 'appointment';
  return 'receptionist';
}

/** Tasks pre-ticked for each template. */
export const TASKS_FOR: Partial<Record<TemplateId, string[]>> = {
  receptionist: ['answer', 'capture', 'book', 'handoff'],
  sales: ['sell', 'qualify', 'capture', 'book'],
  qualify: ['qualify', 'capture', 'crm'],
  support: ['support', 'answer', 'handoff'],
  appointment: ['book', 'answer'],
  shopping: ['recommend', 'answer'],
  orders: ['orders', 'handoff'],
  internal: ['staff', 'handoff'],
  custom: ['answer'],
  visibility: ['articles'],
};

/** "I run a dental clinic. I want an AI agent that answers…, books… and …" */
export function describeJob(business: string, taskIds: string[], extra = ''): string {
  const phrases = AGENT_TASKS.filter((t) => taskIds.includes(t.id)).map((t) => t.phrase);
  const list = phrases.length > 1 ? `${phrases.slice(0, -1).join(', ')} and ${phrases[phrases.length - 1]}` : phrases[0] ?? '';
  const b = business.trim();
  const noun = b.replace(/^(?:a|an|the)\s+/i, '').toLowerCase();
  const head = b ? `I run ${/^[aeiou]/.test(noun) ? 'an' : 'a'} ${noun}.` : '';
  return [head, list ? `I want an AI agent that ${list}.` : '', extra.trim()].filter(Boolean).join(' ');
}

/** Visibility agent: topics a business usually writes about, built from its type. */
export const TOPIC_IDEAS = [
  'Frequently asked questions from customers', 'How to choose the right provider', 'Prices explained: what affects the cost',
  'Common mistakes to avoid', 'A step-by-step guide to our service', 'Seasonal tips', 'How we work, step by step', 'Industry news explained',
];
