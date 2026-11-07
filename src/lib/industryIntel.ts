/**
 * Industry intelligence for the 17 campaign industries (RUNVAX 2.0).
 *
 * One record per industry says what to investigate, who decides, what to offer and how to approach them. It is configuration, not code:
 * the shared campaign engine, the lead scoring and the outreach drafts all read it, so a new industry is a new record here.
 *
 * Honest about what exists: every intelligence item carries a status. "live" is read from data RUNVAX already has, "partial" is checked in
 * part (for example what a business's own page shows), and "planned" is not collected yet. Nothing here is a result or a statistic.
 */

export type IndustryId =
  | 'real-estate' | 'healthcare' | 'marketing' | 'legal' | 'accounting'
  | 'it-software' | 'solar' | 'logistics' | 'construction'
  | 'hospitality' | 'beauty' | 'automotive'
  | 'recruitment' | 'education' | 'wholesale' | 'manufacturing' | 'events';

export type IndustryGroup = 'Professional services' | 'Technology and infrastructure' | 'Consumer-facing businesses' | 'Business-to-business sectors';
export type Readiness = 'live' | 'partial' | 'planned';
export type OfferTag = 'website' | 'seo' | 'crm' | 'ai-assistant' | 'booking' | 'automation' | 'leads' | 'software' | 'portal' | 'integration' | 'partnership' | 'development' | 'marketing';
/** What RUNVAX can notice about a business. An opportunity is only ever recorded with evidence, never from missing data alone. */
export type OpportunityId = 'no-website' | 'outdated-website' | 'poor-mobile' | 'no-online-booking' | 'weak-visibility' | 'weak-seo' | 'no-lead-capture' | 'no-enquiry-assistant' | 'weak-followup' | 'no-crm' | 'manual-workflow';

export interface IntelItem { feature: string; identify: string; ready: Readiness }
export interface Offer { name: string; tag: OfferTag }

export interface Industry {
  id: IndustryId;
  label: string;
  group: IndustryGroup;
  highPriority?: boolean;
  /** Plural noun used in drafts: "dental clinics", "estate agencies". */
  plural: string;
  targets: string;
  intel: IntelItem[];
  offers: Offer[];
  decisionMakers: { primary: string[]; secondary: string[] };
  /** What to look at and how to word the approach. */
  angle: { gap: string; gapShort: string; reference: string; benefit: string };
  /** Business signs that a company is growing, which raise a lead's priority. */
  growthExamples: string[];
  /** Extra rules for this industry, shown beside the template. */
  compliance?: string;
  icon: 'building' | 'stethoscope' | 'megaphone' | 'scale' | 'calculator' | 'code' | 'sun' | 'truck' | 'hardhat' | 'hotel' | 'sparkles' | 'car' | 'users' | 'school' | 'boxes' | 'factory' | 'calendar';
}

const L = (feature: string, identify: string): IntelItem => ({ feature, identify, ready: 'live' });
const P = (feature: string, identify: string): IntelItem => ({ feature, identify, ready: 'partial' });
const N = (feature: string, identify: string): IntelItem => ({ feature, identify, ready: 'planned' });
const o = (name: string, tag: OfferTag): Offer => ({ name, tag });

export const INDUSTRIES_INTEL: Industry[] = [
  // ── A. Professional services ──
  {
    id: 'real-estate', label: 'Real Estate', group: 'Professional services', highPriority: true, icon: 'building', plural: 'estate agencies and property firms',
    targets: 'Estate agencies, property developers, property managers, realtors and commercial property firms.',
    intel: [
      L('Business discovery', 'Estate agencies, property firms and brokers'),
      P('Website intelligence', 'No website, outdated website, poor mobile experience'),
      N('Property intelligence', 'Number of listings, property types, locations'),
      N('Growth signals', 'New developments, new branches, hiring'),
      L('Decision-makers', 'Owner, Founder, Managing Director'),
      P('Opportunity detection', 'Poor lead capture, no booking system, weak SEO'),
    ],
    offers: [o('Real estate website development', 'website'), o('Property CRM', 'crm'), o('AI sales agents', 'ai-assistant'), o('Lead generation', 'leads'), o('SEO and GEO services', 'seo')],
    decisionMakers: { primary: ['Owner', 'Founder', 'CEO'], secondary: ['Marketing Director'] },
    angle: { gap: 'property marketing and enquiry gaps', gapShort: 'property enquiries', reference: 'their listings or property services', benefit: 'respond to property enquiries faster and more consistently' },
    growthExamples: ['New developments', 'New branches', 'Hiring agents'],
  },
  {
    id: 'healthcare', label: 'Healthcare & Dental', group: 'Professional services', highPriority: true, icon: 'stethoscope', plural: 'clinics and dental practices',
    targets: 'Dental clinics, hospitals, medical centres, dermatology clinics and specialist practices.',
    intel: [
      L('Business discovery', 'Clinics by medical specialty'),
      P('Website intelligence', 'Website quality, mobile experience'),
      N('Appointment intelligence', 'Online booking availability'),
      P('Visibility intelligence', 'Google rankings, reviews, local presence'),
      N('Social intelligence', 'Active social profiles and engagement'),
      N('Growth signals', 'New branches, new treatments, hiring'),
      L('Decision-makers', 'Clinic owner, Practice Manager, Director'),
      P('Opportunity detection', 'No online booking, weak follow-up, poor visibility'),
    ],
    offers: [o('AI Receptionist', 'ai-assistant'), o('AI Visibility Agent', 'seo'), o('Patient reactivation automation', 'automation'), o('Clinic CRM', 'crm'), o('Appointment management', 'booking'), o('Healthcare website development', 'website')],
    decisionMakers: { primary: ['Clinic Owner', 'Practice Manager'], secondary: ['Operations Manager'] },
    angle: { gap: 'enquiry handling and appointment follow-up', gapShort: 'patient enquiries', reference: 'their services or location', benefit: 'answer enquiries sooner and follow up on missed ones' },
    growthExamples: ['New branches', 'New treatments', 'Hiring clinicians'],
    compliance: 'Do not collect or process identifiable patient health information as part of prospecting. Work only from public business information.',
  },
  {
    id: 'marketing', label: 'Marketing Agencies', group: 'Professional services', icon: 'megaphone', plural: 'marketing and advertising agencies',
    targets: 'SEO agencies, advertising agencies, branding firms and digital marketing companies.',
    intel: [
      P('Agency service identification', 'The services the agency offers'),
      N('Client portfolio discovery', 'Public case studies and client logos'),
      P('Website and SEO analysis', 'Site quality and search presence'),
      N('Agency size and employee count', 'Team size where public'),
      P('Specialisation identification', 'Niche or sector focus'),
      N('Hiring and expansion signals', 'Open roles, new offices'),
      L('Founder and agency director discovery', 'Founder, CEO, directors'),
      N('White-label partnership opportunity', 'Agencies that could resell a service'),
    ],
    offers: [o('White-label AI agents', 'ai-assistant'), o('SEO automation', 'seo'), o('Website development', 'website'), o('CRM', 'crm'), o('Marketing automation', 'automation'), o('Software partnerships', 'partnership')],
    decisionMakers: { primary: ['Agency Founder', 'CEO'], secondary: ['Head of Growth'] },
    angle: { gap: 'delivery capacity and client reporting', gapShort: 'agency delivery', reference: 'their services or a client project they have published', benefit: 'add a service for clients without adding headcount' },
    growthExamples: ['New services', 'Hiring', 'New offices'],
  },
  {
    id: 'legal', label: 'Legal Services', group: 'Professional services', icon: 'scale', plural: 'law firms and legal practices',
    targets: 'Law firms, immigration firms, corporate law practices and legal consultants.',
    intel: [
      P('Legal practice area identification', 'Areas of law the firm covers'),
      N('Number of lawyers', 'Team size where available'),
      P('Website and service-page analysis', 'Clarity of services and contact routes'),
      N('Online consultation availability', 'Whether a consultation can be booked online'),
      P('Client enquiry form assessment', 'Whether an enquiry form exists and is easy to use'),
      L('Location and office discovery', 'Offices and areas served'),
      L('Managing Partner and Senior Partner identification', 'The people who run the firm'),
      P('Client intake automation opportunities', 'Manual steps between enquiry and engagement'),
    ],
    offers: [o('Legal CRM', 'crm'), o('AI enquiry assistant', 'ai-assistant'), o('Website development', 'website'), o('SEO', 'seo'), o('Consultation booking automation', 'booking')],
    decisionMakers: { primary: ['Managing Partner'], secondary: ['Senior Partner'] },
    angle: { gap: 'client intake and enquiry follow-up', gapShort: 'client enquiries', reference: 'their practice areas or office location', benefit: 'handle new client enquiries promptly and consistently' },
    growthExamples: ['New offices', 'New practice areas', 'Hiring lawyers'],
    compliance: 'Do not request or process confidential client information. Work only from public firm information.',
  },
  {
    id: 'accounting', label: 'Accounting & Finance', group: 'Professional services', icon: 'calculator', plural: 'accounting and financial services firms',
    targets: 'Accounting firms, bookkeeping companies, tax consultants and financial advisory businesses.',
    intel: [
      P('Accounting service identification', 'Accounting, tax, audit and advisory services'),
      L('Business size and location', 'Where the firm is and roughly how large'),
      N('Corporate client specialisation', 'Sectors or client types served'),
      P('Website and enquiry assessment', 'How a new client gets in touch'),
      N('Online consultation availability', 'Whether a consultation can be booked online'),
      N('Hiring and expansion signals', 'Open roles, new offices'),
      L('Partner, Founder and Finance Director discovery', 'The people who run the firm'),
      N('Workflow automation opportunities', 'Manual client onboarding and document steps'),
    ],
    offers: [o('Accounting automation', 'automation'), o('Client portals', 'portal'), o('CRM', 'crm'), o('Website development', 'website'), o('Lead generation', 'leads')],
    decisionMakers: { primary: ['Managing Partner'], secondary: ['Finance Director'] },
    angle: { gap: 'client onboarding and document collection', gapShort: 'client onboarding', reference: 'their services or the clients they serve', benefit: 'cut repeated manual steps in onboarding and reminders' },
    growthExamples: ['New offices', 'Hiring', 'New service lines'],
  },
  // ── B. Technology and infrastructure ──
  {
    id: 'it-software', label: 'IT & Software', group: 'Technology and infrastructure', icon: 'code', plural: 'software and IT companies',
    targets: 'SaaS companies, software agencies, IT consultants and managed service providers.',
    intel: [
      N('Technology stack identification', 'Languages, platforms and tools in use'),
      P('SaaS product discovery', 'Products the company sells'),
      N('Company size and growth', 'Team size and trend where public'),
      N('Product portfolio analysis', 'Product lines and pricing pages'),
      N('Hiring signals', 'Developer and sales roles'),
      N('Funding and expansion signals', 'Funding news, new markets'),
      L('CTO, CEO, Founder and Head of Engineering discovery', 'The technical and commercial decision-makers'),
      N('Technology integration opportunities', 'Where an integration or AI feature would fit'),
    ],
    offers: [o('AI integrations', 'ai-assistant'), o('Software development', 'development'), o('Automation', 'automation'), o('API integration', 'integration'), o('White-label SaaS', 'partnership')],
    decisionMakers: { primary: ['CEO', 'Founder', 'CTO'], secondary: ['IT Director', 'Head of Engineering'] },
    angle: { gap: 'integration and automation work', gapShort: 'product integrations', reference: 'their product or a recent release', benefit: 'ship an integration or AI feature without pulling the core team off the roadmap' },
    growthExamples: ['Funding', 'Hiring developers', 'New markets'],
  },
  {
    id: 'solar', label: 'Solar & Energy', group: 'Technology and infrastructure', icon: 'sun', plural: 'solar and renewable energy companies',
    targets: 'Solar installers, renewable energy companies and solar distributors.',
    intel: [
      L('Installation company discovery', 'Installers and distributors'),
      P('Residential vs commercial focus', 'Which customers they serve'),
      P('Product and service identification', 'Panels, batteries, inverters, maintenance'),
      P('Geographic coverage', 'Areas they install in'),
      N('Project portfolio analysis', 'Published projects and sizes'),
      N('Installation and expansion signals', 'New regions, new product lines'),
      L('Owner, Sales Director and Operations Manager discovery', 'The people who run sales and delivery'),
      P('Lead generation and quotation process assessment', 'How a customer asks for a quote'),
    ],
    offers: [o('Sales CRM', 'crm'), o('Quotation automation', 'automation'), o('Lead generation', 'leads'), o('AI customer support', 'ai-assistant'), o('Websites', 'website')],
    decisionMakers: { primary: ['Owner', 'CEO'], secondary: ['Sales Director', 'Operations Manager'] },
    angle: { gap: 'quotation enquiries and lead qualification', gapShort: 'quotation enquiries', reference: 'their installation services and coverage area', benefit: 'qualify quotation enquiries automatically so the sales team talks to ready buyers' },
    growthExamples: ['New regions', 'New product lines', 'Hiring installers'],
  },
  {
    id: 'logistics', label: 'Logistics & Transport', group: 'Technology and infrastructure', icon: 'truck', plural: 'logistics and transport companies',
    targets: 'Freight companies, courier companies, shipping firms and fleet operators.',
    intel: [
      P('Logistics service identification', 'Freight, courier, warehousing, last-mile'),
      P('Domestic vs international operations', 'Where they operate'),
      N('Fleet and warehouse information', 'Where publicly available'),
      P('Service coverage', 'Routes and regions'),
      P('Shipment tracking capabilities', 'Whether customers can track a shipment'),
      N('Company expansion signals', 'New routes, depots, vehicles'),
      L('Managing Director and Operations Director discovery', 'The people who run operations'),
      N('Tracking and operational automation opportunities', 'Manual dispatch and status updates'),
    ],
    offers: [o('Fleet management software', 'software'), o('Logistics CRM', 'crm'), o('AI customer support', 'ai-assistant'), o('Tracking systems', 'software'), o('Automation', 'automation')],
    decisionMakers: { primary: ['Managing Director'], secondary: ['Operations Director'] },
    angle: { gap: 'shipment status updates and customer enquiries', gapShort: 'shipment updates', reference: 'their routes or services', benefit: 'answer "where is my shipment?" automatically' },
    growthExamples: ['New routes', 'New depots', 'Fleet growth'],
  },
  {
    id: 'construction', label: 'Construction & Engineering', group: 'Technology and infrastructure', icon: 'hardhat', plural: 'construction and engineering firms',
    targets: 'Construction firms, engineering companies, architecture practices and contractors.',
    intel: [
      P('Construction specialisation', 'Building, civil, MEP, architecture'),
      P('Commercial vs residential projects', 'The market they serve'),
      N('Project portfolio', 'Published projects'),
      P('Geographic coverage', 'Where they build'),
      N('Tender and contract activity', 'Where public'),
      N('Hiring and expansion signals', 'Open roles, new offices'),
      L('Owner, Project Director and Managing Director discovery', 'The people who run the firm and its projects'),
      N('Project management and workflow gaps', 'Manual reporting and tracking'),
    ],
    offers: [o('Project management software', 'software'), o('CRM', 'crm'), o('Websites', 'website'), o('Automation', 'automation'), o('Lead generation', 'leads')],
    decisionMakers: { primary: ['CEO', 'Owner'], secondary: ['Project Director', 'Managing Director'] },
    angle: { gap: 'project tracking and tender follow-up', gapShort: 'project tracking', reference: 'their projects or specialisation', benefit: 'keep project updates and enquiries in one place' },
    growthExamples: ['New projects', 'New offices', 'Hiring'],
  },
  // ── C. Consumer-facing businesses ──
  {
    id: 'hospitality', label: 'Hospitality & Tourism', group: 'Consumer-facing businesses', icon: 'hotel', plural: 'hotels, restaurants and tourism businesses',
    targets: 'Hotels, resorts, travel agencies, tour operators, event venues and restaurants.',
    intel: [
      L('Hotel and travel business discovery', 'Hotels, resorts, agencies, tour operators'),
      N('Number of branches or properties', 'Where available'),
      P('Booking system assessment', 'Whether guests can book online'),
      P('Website and mobile experience', 'How the site works on a phone'),
      P('Review and reputation analysis', 'Public rating and review volume'),
      N('Social media presence', 'Active profiles'),
      L('General Manager and Owner discovery', 'The people who run the property'),
      P('Reservation and guest communication opportunities', 'Slow or manual replies to guests'),
    ],
    offers: [o('Booking automation', 'booking'), o('Hotel management software', 'software'), o('AI concierge', 'ai-assistant'), o('CRM', 'crm'), o('Websites', 'website')],
    decisionMakers: { primary: ['General Manager'], secondary: ['Hotel Owner'] },
    angle: { gap: 'reservation enquiries and guest messages', gapShort: 'guest enquiries', reference: 'their property, rooms or location', benefit: 'answer reservation questions at any hour and keep bookings direct' },
    growthExamples: ['New properties', 'Renovations', 'Hiring'],
  },
  {
    id: 'beauty', label: 'Beauty & Wellness', group: 'Consumer-facing businesses', icon: 'sparkles', plural: 'salons, spas and wellness businesses',
    targets: 'Salons, spas, aesthetic clinics, wellness centres and fitness studios.',
    intel: [
      P('Service and treatment identification', 'What they offer'),
      L('Branch and location discovery', 'Where they operate'),
      P('Appointment booking assessment', 'Whether clients can book online'),
      P('Reviews and online visibility', 'Public rating and review volume'),
      N('Social media activity', 'Active profiles'),
      N('New service and expansion signals', 'New treatments, new branches'),
      L('Owner, Manager and Director discovery', 'The people who run the business'),
      N('Customer retention opportunities', 'Lapsed-client reminders and rebooking'),
    ],
    offers: [o('Booking software', 'booking'), o('AI receptionist', 'ai-assistant'), o('CRM', 'crm'), o('Customer reactivation', 'automation'), o('Digital marketing', 'marketing')],
    decisionMakers: { primary: ['Owner', 'Founder'], secondary: ['Salon Manager'] },
    angle: { gap: 'bookings and rebooking reminders', gapShort: 'client bookings', reference: 'their treatments or location', benefit: 'fill the diary and bring lapsed clients back' },
    growthExamples: ['New branches', 'New treatments', 'Hiring'],
  },
  {
    id: 'automotive', label: 'Automotive', group: 'Consumer-facing businesses', icon: 'car', plural: 'car dealerships and auto businesses',
    targets: 'Car dealerships, vehicle leasing companies, auto repair shops and auto parts suppliers.',
    intel: [
      P('Vehicle sales and service identification', 'New, used, service, parts'),
      N('Inventory and listing assessment', 'Published stock'),
      P('Website and enquiry functionality', 'How a buyer gets in touch'),
      P('Online booking availability', 'Service or test-drive booking'),
      L('Branch discovery', 'Locations'),
      N('New inventory and expansion signals', 'New stock, new branches'),
      L('Dealer Principal, Owner and Sales Manager discovery', 'The people who run sales'),
      N('Sales follow-up opportunities', 'Enquiries that are not followed up'),
    ],
    offers: [o('Automotive CRM', 'crm'), o('Inventory management', 'software'), o('AI sales agents', 'ai-assistant'), o('Websites', 'website'), o('Lead generation', 'leads')],
    decisionMakers: { primary: ['Dealer Principal'], secondary: ['Sales Manager'] },
    angle: { gap: 'buyer enquiries and sales follow-up', gapShort: 'buyer enquiries', reference: 'their vehicles or services', benefit: 'follow up every buyer enquiry quickly' },
    growthExamples: ['New stock', 'New branches', 'Hiring'],
  },
  // ── D. Business-to-business sectors ──
  {
    id: 'recruitment', label: 'Recruitment & HR', group: 'Business-to-business sectors', icon: 'users', plural: 'recruitment and HR firms',
    targets: 'Recruitment agencies, staffing firms and HR consultancies.',
    intel: [
      P('Recruitment specialisation', 'Sectors and role types'),
      P('Industry focus', 'Which employers they serve'),
      N('Job listings and vacancy volume', 'Published vacancies'),
      P('Candidate application process', 'How a candidate applies'),
      N('Client portfolio', 'Employers served'),
      N('Hiring and expansion signals', 'Open roles, new offices'),
      L('Founder, Recruitment Director and HR Director discovery', 'The people who run the firm'),
      N('Recruitment workflow assessment', 'Manual screening and scheduling'),
    ],
    offers: [o('Applicant tracking systems', 'software'), o('Recruitment CRM', 'crm'), o('AI screening', 'ai-assistant'), o('Websites', 'website'), o('Automation', 'automation')],
    decisionMakers: { primary: ['Agency Founder'], secondary: ['Recruitment Director'] },
    angle: { gap: 'candidate screening and client updates', gapShort: 'candidate screening', reference: 'their specialisation or open roles', benefit: 'shortlist faster and keep clients and candidates informed' },
    growthExamples: ['New sectors', 'Hiring recruiters', 'New offices'],
  },
  {
    id: 'education', label: 'Education & Training', group: 'Business-to-business sectors', icon: 'school', plural: 'schools and training providers',
    targets: 'Private schools, universities, training institutes and online academies.',
    intel: [
      P('Institution type identification', 'School, college, academy, training centre'),
      P('Courses and programmes', 'What they teach'),
      P('Student enrolment process', 'How a family applies'),
      P('Online application availability', 'Whether an application can be made online'),
      P('Website and portal assessment', 'Site and parent or student portal'),
      L('Branch and campus discovery', 'Campuses and locations'),
      L('Principal, Founder and Admissions Director discovery', 'The people who run admissions'),
      N('Enrolment and communication automation opportunities', 'Manual enquiry replies and reminders'),
    ],
    offers: [o('School management systems', 'software'), o('Student CRM', 'crm'), o('AI admissions assistant', 'ai-assistant'), o('Websites', 'website'), o('Marketing automation', 'automation')],
    decisionMakers: { primary: ['School Owner', 'Principal'], secondary: ['Admissions Director'] },
    angle: { gap: 'admissions enquiries and parent communication', gapShort: 'admissions enquiries', reference: 'their programmes or campus', benefit: 'answer admissions questions promptly and keep applicants informed' },
    growthExamples: ['New campuses', 'New programmes', 'Hiring'],
    compliance: 'Do not collect or process information about students or minors. Work only from public institution information.',
  },
  {
    id: 'wholesale', label: 'Wholesale & Distribution', group: 'Business-to-business sectors', icon: 'boxes', plural: 'wholesalers and distributors',
    targets: 'FMCG distributors, wholesalers, importers and industrial suppliers.',
    intel: [
      P('Product category identification', 'What they distribute'),
      P('Distribution territory', 'Where they supply'),
      N('B2B customer focus', 'Retail, hospitality, industrial buyers'),
      P('Catalogue and ordering capabilities', 'Whether buyers can order online'),
      N('Warehouse and inventory information', 'Where available'),
      N('Expansion and new product signals', 'New lines, new territories'),
      L('Managing Director, Sales Director and Procurement Director discovery', 'The people who buy and sell'),
      N('Ordering and inventory automation opportunities', 'Manual orders and stock checks'),
    ],
    offers: [o('Inventory management', 'software'), o('B2B ordering portals', 'portal'), o('CRM', 'crm'), o('ERP integration', 'integration'), o('Automation', 'automation')],
    decisionMakers: { primary: ['Managing Director'], secondary: ['Sales Director'] },
    angle: { gap: 'order taking and stock visibility', gapShort: 'order taking', reference: 'their product range or territory', benefit: 'let trade customers order and check stock without phone calls' },
    growthExamples: ['New product lines', 'New territories', 'Hiring'],
  },
  {
    id: 'manufacturing', label: 'Manufacturing', group: 'Business-to-business sectors', icon: 'factory', plural: 'manufacturers',
    targets: 'Manufacturers, industrial producers, packaging companies and factory operators.',
    intel: [
      P('Manufacturing category', 'What kind of manufacturer'),
      P('Products manufactured', 'The product range'),
      N('Production capabilities', 'Capacity and processes where public'),
      N('Certifications and export markets', 'Where publicly available'),
      N('Distribution network', 'Distributors and channels'),
      N('Factory expansion and hiring signals', 'New plants, open roles'),
      L('CEO, Operations Director and Commercial Director discovery', 'The people who run operations and sales'),
      N('Digital transformation opportunities', 'Manual planning, ordering and reporting'),
    ],
    offers: [o('ERP', 'software'), o('Manufacturing automation', 'automation'), o('B2B portals', 'portal'), o('CRM', 'crm'), o('Industrial websites', 'website')],
    decisionMakers: { primary: ['CEO', 'Owner'], secondary: ['Operations Director', 'Commercial Director'] },
    angle: { gap: 'order handling and production reporting', gapShort: 'order handling', reference: 'their products or production capability', benefit: 'connect orders, stock and reporting in one place' },
    growthExamples: ['New plants', 'New export markets', 'Hiring'],
  },
  {
    id: 'events', label: 'Events & Entertainment', group: 'Business-to-business sectors', icon: 'calendar', plural: 'event and entertainment companies',
    targets: 'Event planners, event production companies, conference organisers and entertainment agencies.',
    intel: [
      P('Event specialisation', 'Weddings, corporate, concerts, conferences'),
      P('Corporate vs social events', 'The market they serve'),
      N('Portfolio and past events', 'Published events'),
      P('Booking and enquiry process', 'How a client enquires or books'),
      N('Event calendar and upcoming activities', 'Published dates'),
      N('Venue partnerships', 'Venues they work with'),
      L('Founder, Event Director and Operations Manager discovery', 'The people who run events'),
      P('Booking and client management opportunities', 'Manual quotes and follow-ups'),
    ],
    offers: [o('Event CRM', 'crm'), o('Booking automation', 'booking'), o('Ticketing software', 'software'), o('Websites', 'website'), o('Marketing automation', 'automation')],
    decisionMakers: { primary: ['Founder', 'CEO'], secondary: ['Event Director'] },
    angle: { gap: 'event enquiries and quote follow-up', gapShort: 'event enquiries', reference: 'their event types or a recent event', benefit: 'turn enquiries into confirmed bookings faster' },
    growthExamples: ['New venues', 'New event types', 'Hiring'],
  },
];

export const industryById = (id: string | undefined | null): Industry | undefined => INDUSTRIES_INTEL.find((i) => i.id === id);
export const INDUSTRY_GROUPS: IndustryGroup[] = ['Professional services', 'Technology and infrastructure', 'Consumer-facing businesses', 'Business-to-business sectors'];

// ── Decision-makers by country ──────────────────────────────────────────────
/** The same role goes by different names in different places. Each entry adds the local names to look for. */
const LOCAL_TITLES: Record<string, Record<string, string[]>> = {
  US: { 'Managing Director': ['President', 'CEO'], 'Managing Partner': ['Managing Partner', 'Founding Partner'], Principal: ['Owner', 'President'], 'General Manager': ['General Manager', 'Managing Director'] },
  CA: { 'Managing Director': ['President', 'CEO'], 'Managing Partner': ['Managing Partner', 'Founding Partner'], Principal: ['Owner', 'President'] },
  GB: { 'Managing Director': ['Managing Director'], 'Managing Partner': ['Senior Partner', 'Managing Partner'], 'Dealer Principal': ['Dealer Principal', 'Managing Director'] },
  IE: { 'Managing Director': ['Managing Director'], 'Managing Partner': ['Managing Partner', 'Senior Partner'] },
  AU: { 'Managing Director': ['Managing Director', 'Director'], 'Managing Partner': ['Managing Partner', 'Principal'] },
  NG: { 'Managing Director': ['Managing Director', 'CEO'], 'Managing Partner': ['Managing Partner', 'Senior Partner'], 'School Owner': ['Proprietor', 'School Owner'], Principal: ['Principal', 'Proprietor'] },
  GH: { 'Managing Director': ['Managing Director', 'CEO'], 'School Owner': ['Proprietor', 'School Owner'] },
  KE: { 'Managing Director': ['Managing Director', 'CEO'], 'School Owner': ['Proprietor', 'School Owner'] },
  ZA: { 'Managing Director': ['Managing Director', 'CEO'], 'Managing Partner': ['Managing Partner', 'Senior Partner'] },
};

export interface DecisionMakerTitles { primary: string[]; secondary: string[]; local: string[] }

/** Primary and secondary titles for an industry, plus the local names for those roles in a country (ISO code such as NG, GB, US). */
export function decisionMakerTitles(id: IndustryId, countryCode?: string): DecisionMakerTitles {
  const ind = industryById(id);
  if (!ind) return { primary: [], secondary: [], local: [] };
  const local = LOCAL_TITLES[(countryCode ?? '').toUpperCase()] ?? {};
  const known = new Set([...ind.decisionMakers.primary, ...ind.decisionMakers.secondary].map((t) => t.toLowerCase()));
  const extra: string[] = [];
  for (const role of [...ind.decisionMakers.primary, ...ind.decisionMakers.secondary]) {
    for (const t of local[role] ?? []) if (!known.has(t.toLowerCase()) && !extra.some((e) => e.toLowerCase() === t.toLowerCase())) extra.push(t);
  }
  return { primary: ind.decisionMakers.primary, secondary: ind.decisionMakers.secondary, local: extra };
}

// ── Opportunities and offers ────────────────────────────────────────────────
export const OPPORTUNITY_LABEL: Record<OpportunityId, string> = {
  'no-website': 'No identifiable website', 'outdated-website': 'Outdated website', 'poor-mobile': 'Poor mobile experience',
  'no-online-booking': 'No online booking', 'weak-visibility': 'Limited online visibility', 'weak-seo': 'Weak search presence',
  'no-lead-capture': 'No clear way to capture enquiries', 'no-enquiry-assistant': 'No automated enquiry assistant',
  'weak-followup': 'Weak follow-up', 'no-crm': 'No visible customer system', 'manual-workflow': 'Manual workflow',
};
const OPPORTUNITY_TAGS: Record<OpportunityId, OfferTag[]> = {
  'no-website': ['website', 'seo'], 'outdated-website': ['website'], 'poor-mobile': ['website'],
  'no-online-booking': ['ai-assistant', 'booking'], 'weak-visibility': ['seo', 'marketing'], 'weak-seo': ['seo'],
  'no-lead-capture': ['ai-assistant', 'leads', 'crm'], 'no-enquiry-assistant': ['ai-assistant'],
  'weak-followup': ['automation', 'crm'], 'no-crm': ['crm'], 'manual-workflow': ['automation', 'software'],
};

/** The offers that fit the opportunities found (at most two), in this industry's own wording. Two clinics with different gaps get different offers. */
export function recommendOffers(id: IndustryId, found: OpportunityId[]): string[] {
  const ind = industryById(id);
  if (!ind) return [];
  const out: string[] = [];
  for (const opp of found) {
    for (const tag of OPPORTUNITY_TAGS[opp] ?? []) {
      const offer = ind.offers.find((x) => x.tag === tag);
      if (offer && !out.includes(offer.name)) out.push(offer.name);
      if (out.length >= 2) return out;
    }
  }
  return out;
}

// ── Country compliance reminders (general guidance, not legal advice) ───────
export const COMPLIANCE_BY_COUNTRY: Record<string, { law: string; note: string }> = {
  NG: { law: 'Nigeria Data Protection Act', note: 'Say who you are, why you are writing, and honour opt-outs straight away. Keep to business contacts and work addresses.' },
  GB: { law: 'UK GDPR and PECR', note: 'Corporate email addresses can be contacted for relevant offers with a clear opt-out. Take more care with sole traders and personal addresses.' },
  US: { law: 'CAN-SPAM', note: 'Use an accurate sender and subject, include a postal address, and honour opt-outs within ten business days.' },
  CA: { law: 'CASL', note: 'Canada is strict about consent. Contact only people who have agreed, or where the rules allow implied consent, and include an opt-out.' },
  ZA: { law: 'POPIA', note: 'Contact only where there is a lawful basis, identify yourself and offer a free way to opt out.' },
  GH: { law: 'Data Protection Act, 2012', note: 'Be clear who you are, keep to business contacts and honour opt-outs.' },
  KE: { law: 'Data Protection Act, 2019', note: 'Be clear who you are, keep to business contacts and honour opt-outs.' },
  EU: { law: 'GDPR and ePrivacy', note: 'Rely on a documented lawful basis, keep messages relevant to the person\'s role and offer an easy opt-out.' },
};
export const GENERAL_COMPLIANCE = 'General guidance, not legal advice. Every message carries a one-click opt-out, anyone who opts out is suppressed and never contacted again, and WhatsApp is used only where the person has agreed or the law of their country allows it.';
