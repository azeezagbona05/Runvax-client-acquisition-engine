/**
 * Industry angles — the single source of what we know about a trade.
 *
 * This table exists because review evidence is rare: on real data, complaint
 * language appears in roughly 2% of businesses. Industry and workflow knowledge
 * applies to all of them, so the message is built from the trade first and the
 * review quote second, when there happens to be one.
 *
 * Each entry answers four questions in the owner's own terms:
 *   characteristic — the thing we can say we noticed, true of nearly all of them
 *   manualProcess  — what someone in that business currently does by hand
 *   outcome        — what changes, stated as work removed, never as technology
 *
 * `ceiling` is the most an AI-system opportunity in this trade can score;
 * business-specific signals decide where inside the range it actually lands.
 */

import type { SolutionPatternId } from './types';

export interface IndustryAngle {
  keys: string[];
  /** How to refer to the trade in a sentence. */
  label: string;
  /** Who in this trade actually signs off on a system like this. Trade knowledge,
   *  same as `characteristic` — never inferred per business, never model-written. */
  buyer: string;
  /** Names the recommended system: "AI {system} System". */
  system: string;
  ceiling: number;
  pattern: SolutionPatternId;
  characteristic: string;
  /** The after-hours moment where an enquiry goes cold. This is the hook: it is
   *  conditional ("when someone messages..."), never a claim that it happened. */
  scenario: string;
  manualProcess: string;
  outcome: string;
  /** Hard constraint for regulated trades. Passed to the model as a ban. */
  guardrail?: string;
}

export const INDUSTRY_ANGLES: IndustryAngle[] = [
  {
    keys: ['dentist', 'dental', 'orthodont'],
    label: 'dental clinic',
    buyer: 'Practice owner / front desk manager',
    scenario: 'someone messages after your front desk closes, asking about a treatment or wanting to book',
    system: 'Patient Enquiry & Appointment',
    ceiling: 92,
    pattern: 'booking',
    characteristic: 'you offer several treatments that all run on appointments',
    manualProcess: 'someone answering the same treatment and availability questions by hand',
    outcome: 'answer common patient questions, take their details and move them toward a booking',
    guardrail: 'Never imply the system gives clinical or medical advice. It handles enquiries and bookings only.',
  },
  {
    keys: ['clinic', 'hospital', 'medical', 'doctor', 'optician', 'physio', 'diagnostic'],
    label: 'clinic',
    buyer: 'Clinic owner / practice manager',
    scenario: 'someone messages after your front desk closes, asking about a service or wanting to book',
    system: 'Patient Enquiry & Appointment',
    ceiling: 90,
    pattern: 'booking',
    characteristic: 'you run several services that patients book into',
    manualProcess: 'staff repeating the same answers about services, hours and availability',
    outcome: 'answer common patient questions, capture their details and help with booking',
    guardrail: 'Never imply the system gives clinical or medical advice. It handles enquiries and bookings only.',
  },
  {
    keys: ['real estate', 'property', 'estate agent', 'realty', 'letting'],
    label: 'real estate business',
    buyer: 'Agency principal / lettings manager',
    scenario: 'someone asks whether a property is still available, late in the evening',
    system: 'Property Lead & Follow-up',
    ceiling: 90,
    pattern: 'qualification',
    characteristic: 'you have several properties being marketed at once',
    manualProcess: 'an agent replying by hand to every "is this still available?" message',
    outcome: 'handle the first conversation, find out budget and what the buyer wants, then pass only serious ones to your agents',
  },
  {
    keys: ['hotel', 'motel', 'resort', 'guesthouse', 'lodge', 'apartment'],
    label: 'hotel',
    buyer: 'General manager / owner',
    scenario: 'a guest asks about availability or rates long after your desk has gone quiet',
    system: 'Guest Enquiry & Booking',
    ceiling: 86,
    pattern: 'booking',
    characteristic: 'guests ask about rooms, rates and availability before they book',
    manualProcess: 'your team answering the same questions about room types, prices and check-in',
    outcome: 'answer those questions from your own information and move guests toward a reservation',
  },
  {
    keys: ['law', 'legal', 'solicitor', 'barrister', 'chambers', 'attorney'],
    label: 'firm',
    buyer: 'Managing partner / practice manager',
    scenario: 'an enquiry comes in while everyone is in court or in a meeting',
    system: 'Client Enquiry & Intake',
    ceiling: 82,
    pattern: 'qualification',
    characteristic: 'every new enquiry starts with the same intake questions',
    manualProcess: 'fee earners spending time on first-contact enquiries that may not go anywhere',
    outcome: 'handle that first step, collect the relevant details and pass a structured summary to your team',
    guardrail: 'Never imply the system gives legal advice or acts for a client. It handles intake only, and the message must say so.',
  },
  {
    keys: ['insurance', 'broker', 'underwrit'],
    label: 'insurance business',
    buyer: 'Agency principal / operations lead',
    scenario: 'someone asks what cover they need, outside working hours',
    system: 'Lead Qualification',
    ceiling: 80,
    pattern: 'qualification',
    characteristic: 'most enquiries start with the same few questions about cover and pricing',
    manualProcess: 'your sales team sorting through enquiries to find the ones that are ready',
    outcome: 'have that first conversation, work out what cover they need and pass qualified people to your team',
    guardrail: 'Never imply the system gives regulated financial or insurance advice.',
  },
  {
    keys: ['accounting', 'finance', 'audit', 'consultant', 'consulting', 'advisory', 'agency'],
    label: 'practice',
    buyer: 'Partner / practice manager',
    scenario: 'an enquiry lands while you are with a client',
    system: 'Client Enquiry & Intake',
    ceiling: 80,
    pattern: 'qualification',
    characteristic: 'new client enquiries all begin with the same qualifying questions',
    manualProcess: 'you personally handling the first conversation with everyone who gets in touch',
    outcome: 'handle that first stage, collect what you need and direct the right people toward a consultation',
  },
  {
    keys: ['school', 'college', 'university', 'academy', 'tutor', 'training', 'institute'],
    label: 'school',
    buyer: 'Proprietor / head of admissions',
    scenario: 'a parent asks about fees or entry requirements at the weekend',
    system: 'Admissions Enquiry & Follow-up',
    ceiling: 78,
    pattern: 'sales',
    characteristic: 'you run several programmes that parents and students ask about',
    manualProcess: 'admissions staff answering the same questions on fees, requirements and how to apply',
    outcome: 'answer those questions any time of day, collect applicant details and pass real enquiries to admissions',
  },
  {
    keys: ['car', 'auto', 'dealership', 'motors', 'vehicle'],
    label: 'dealership',
    buyer: 'Dealer principal / sales manager',
    scenario: 'someone asks whether a vehicle is still available, after the showroom closes',
    system: 'Vehicle Enquiry & Qualification',
    ceiling: 76,
    pattern: 'qualification',
    characteristic: 'buyers ask about availability and price before they ever visit',
    manualProcess: 'a salesperson replying by hand to every "is it still available and how much?"',
    outcome: 'answer the first round of questions, find out what the buyer actually wants and pass serious ones to sales',
  },
  {
    keys: ['event', 'catering', 'wedding', 'venue', 'party'],
    label: 'events business',
    buyer: 'Owner / bookings manager',
    scenario: 'someone asks whether you are free on their date, late at night',
    system: 'Booking Enquiry & Quote',
    ceiling: 78,
    pattern: 'sales',
    characteristic: 'every enquiry needs the same details before you can quote',
    manualProcess: 'going back and forth to collect dates, guest numbers and budget',
    outcome: 'collect those details up front so you only spend time on enquiries worth quoting',
  },
  {
    keys: ['construction', 'contractor', 'builder', 'interior', 'engineering', 'architect'],
    label: 'construction business',
    buyer: 'Managing director / business development lead',
    scenario: 'someone asks whether you take on a job like theirs, outside site hours',
    system: 'Project Enquiry & Quote',
    ceiling: 76,
    pattern: 'qualification',
    characteristic: 'every project enquiry starts with the same scope and budget questions',
    manualProcess: 'you working through enquiries that were never the right size for you',
    outcome: 'collect scope, timing and budget first so only the right projects reach you',
  },
  {
    keys: ['salon', 'spa', 'barber', 'hair', 'nail', 'beauty', 'aesthetic'],
    label: 'salon',
    buyer: 'Owner / salon manager',
    scenario: 'someone messages at night wanting to know a price or book in',
    system: 'Client Booking & Reminder',
    ceiling: 74,
    pattern: 'booking',
    characteristic: 'you offer several services that clients need to book in for',
    manualProcess: 'answering price and availability messages while you are with a client',
    outcome: 'answer service questions, take their details and help them book without interrupting you',
  },
  {
    keys: ['travel', 'tour', 'holiday', 'flight'],
    label: 'travel business',
    buyer: 'Owner / operations manager',
    scenario: 'someone asks about a trip in the evening, while they are still planning',
    system: 'Trip Enquiry & Booking',
    ceiling: 74,
    pattern: 'sales',
    characteristic: 'every enquiry needs destination, dates and budget before you can put an offer together',
    manualProcess: 'asking every customer the same set of basic questions',
    outcome: 'collect all of that first so your team only works on enquiries ready for a quote',
  },
  {
    keys: ['logistics', 'courier', 'shipping', 'transport', 'haulage', 'freight'],
    label: 'logistics business',
    buyer: 'Operations director / owner',
    scenario: 'a customer asks for a rate or where their delivery is, after hours',
    system: 'Customer Enquiry & Tracking',
    ceiling: 72,
    pattern: 'operations',
    characteristic: 'customers ask the same questions about rates, routes and where their delivery is',
    manualProcess: 'staff answering tracking and pricing questions one message at a time',
    outcome: 'answer those routine questions automatically and only escalate the real problems',
  },
  {
    keys: ['gym', 'fitness', 'yoga', 'pilates'],
    label: 'gym',
    buyer: 'Owner / membership manager',
    scenario: 'someone asks about plans and class times in the evening',
    system: 'Membership Enquiry & Follow-up',
    ceiling: 70,
    pattern: 'sales',
    characteristic: 'most enquiries are the same questions about plans, prices and class times',
    manualProcess: 'staff answering those between sessions, often hours later',
    outcome: 'answer them straight away, capture the enquiry and follow up so fewer go cold',
  },
  {
    keys: ['mechanic', 'workshop', 'repair', 'panel beat'],
    label: 'workshop',
    buyer: 'Owner / service manager',
    scenario: 'someone asks what a repair costs while you are under a car',
    system: 'Service Booking & Enquiry',
    ceiling: 70,
    pattern: 'booking',
    characteristic: 'customers ask what a job costs and when you can fit them in',
    manualProcess: 'answering the phone while you are under a car',
    outcome: 'answer the routine questions and take booking details while you keep working',
  },
  {
    keys: ['store', 'shop', 'retail', 'supermarket', 'boutique', 'fashion', 'ecommerce', 'online store'],
    label: 'shop',
    buyer: 'Owner / store manager',
    scenario: 'someone asks whether an item is in stock, after you have closed',
    system: 'Customer Enquiry & Order',
    ceiling: 66,
    pattern: 'support',
    characteristic: 'customers message about stock, prices and delivery before they buy',
    manualProcess: 'someone replying to every product and delivery question by hand',
    outcome: 'handle the repetitive questions and pass the complicated ones to your team',
  },
  {
    keys: ['restaurant', 'eatery', 'buka', 'canteen', 'lounge', 'cafe', 'bar'],
    label: 'restaurant',
    buyer: 'Owner / general manager',
    scenario: 'someone messages about a table for that evening while the floor is at full tilt',
    system: 'Customer Enquiry & Reservation',
    ceiling: 64,
    pattern: 'support',
    characteristic: 'people ask about the menu, opening hours and tables before they come',
    manualProcess: 'staff answering those messages during service',
    outcome: 'answer them automatically and take reservation requests without interrupting service',
  },
  {
    keys: ['photography', 'photo', 'studio', 'videograph'],
    label: 'studio',
    buyer: 'Owner / studio manager',
    scenario: 'someone asks about packages and dates while you are on a shoot',
    system: 'Session Booking & Enquiry',
    ceiling: 64,
    pattern: 'booking',
    characteristic: 'every enquiry starts with the same questions about packages and availability',
    manualProcess: 'answering those while you are on a shoot',
    outcome: 'answer package and availability questions and collect booking details for you',
  },
  {
    keys: ['pharmacy', 'chemist'],
    label: 'pharmacy',
    buyer: 'Superintendent pharmacist / owner',
    scenario: 'someone asks whether you have something in stock, after closing',
    system: 'Customer Enquiry',
    ceiling: 58,
    pattern: 'support',
    characteristic: 'customers call to ask about stock and opening hours',
    manualProcess: 'staff answering stock questions at the counter and on the phone at once',
    outcome: 'answer the routine stock and hours questions so your counter stays free',
    guardrail: 'Never imply the system gives medical or pharmaceutical advice. Stock and opening hours only.',
  },
];

const FALLBACK: IndustryAngle = {
  keys: [],
  label: 'business',
  buyer: 'Owner / manager',
  system: 'Customer Enquiry',
  ceiling: 52,
  pattern: 'support',
  characteristic: 'customers get in touch with the same questions before they buy',
  scenario: 'someone gets in touch outside your working hours',
  manualProcess: 'someone answering every one of those messages by hand',
  outcome: 'handle the repetitive first conversation and pass the real enquiries to you',
};

export function angleFor(category?: string, types: string[] = []): IndustryAngle {
  const text = `${category ?? ''} ${types.join(' ')}`.toLowerCase();
  return INDUSTRY_ANGLES.find((a) => a.keys.some((k) => text.includes(k))) ?? FALLBACK;
}
