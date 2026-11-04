import type { IndustryConfig } from '../schema';
import { DENTAL_OFFERS } from '../catalogue';

/**
 * Dental clinics, Lagos. Categories are things to assess, not assumptions:
 * a clinic is only said to have a problem when an evidence signal fired.
 * Weights are a first guess, flagged provisional, to be tuned in the pilot.
 */
export const dental: IndustryConfig = {
  id: 'dental',
  version: 2,
  displayName: 'Dental clinics',
  geography: {
    country: 'NG',
    city: 'Lagos',
    priorityAreas: ['Ikoyi', 'Victoria Island', 'Lekki', 'Ikeja GRA', 'Surulere', 'Yaba', 'Ajah', 'Gbagada'],
  },
  discovery: {
    placesQueries: ['dental clinic', 'dentist', 'dental surgery', 'orthodontist'],
    placesTypes: ['dentist'],
    excludeKeywords: ['supply', 'supplies', 'laboratory', 'dental lab', 'equipment', 'college', 'school'],
    includeBusinessesWithWebsites: true,
  },
  businessTypes: [
    'General dental practice',
    'Orthodontic practice',
    'Cosmetic dentistry',
    'Paediatric dentistry',
    'Multi-branch dental group',
  ],
  decisionMakerRoles: ['Owner / Principal Dentist', 'Medical Director', 'Practice Manager', 'Clinic Administrator', 'Marketing Lead'],
  opportunityCategories: [
    {
      id: 'search_visibility',
      label: 'Search and AI-search visibility',
      description: 'How easily patients find the clinic on Google, Maps and AI assistants.',
      evidenceSignals: [
        'No website, or a website with no service pages',
        'Incomplete Google Business Profile (hours, categories, photos)',
        'No Dentist/LocalBusiness structured data on the website',
        'Fewer reviews than nearby competitors',
        'Poor mobile PageSpeed score',
      ],
      offerIds: ['ai_visibility_agent'],
      weight: 0.25,
      weightIsProvisional: true,
      signalRules: [
        { signal: 'website_present', when: false, weight: 0.6 },
        { signal: 'structured_data_dentist', when: false, weight: 0.35 },
        { signal: 'service_pages', when: false, weight: 0.25 },
        { signal: 'pagespeed_mobile_poor', when: true, weight: 0.25 },
        { signal: 'mobile_viewport', when: false, weight: 0.15 },
        { signal: 'https', when: false, weight: 0.1 },
        { signal: 'structured_data_dentist', when: true, weight: -0.2 },
      ],
    },
    {
      id: 'enquiry_conversion',
      label: 'Website enquiry conversion',
      description: 'Whether a visitor can quickly understand services and get in touch.',
      evidenceSignals: [
        'No visible phone number or call to action above the fold',
        'No contact or enquiry form',
        'Slow mobile load time',
      ],
      offerIds: ['ai_receptionist', 'ai_visibility_agent'],
      weight: 0.15,
      weightIsProvisional: true,
      signalRules: [
        { signal: 'contact_form_present', when: false, weight: 0.4 },
        { signal: 'click_to_call', when: false, weight: 0.3 },
        { signal: 'whatsapp_entry_point', when: false, weight: 0.2 },
        { signal: 'mobile_viewport', when: false, weight: 0.1 },
      ],
    },
    {
      id: 'booking_friction',
      label: 'Appointment booking friction',
      description: 'How many steps a patient needs to book an appointment.',
      evidenceSignals: [
        'No online booking option',
        'Booking only possible by phone call',
        'Opening hours missing or inconsistent',
      ],
      offerIds: ['ai_receptionist', 'ai_voice_agent'],
      weight: 0.2,
      weightIsProvisional: true,
      signalRules: [
        { signal: 'online_booking_present', when: false, weight: 0.7 },
        { signal: 'click_to_call', when: true, weight: 0.2 },
        { signal: 'booking_cta_to_form', when: true, weight: -0.3 },
        { signal: 'online_booking_present', when: true, weight: -1 },
      ],
    },
    {
      id: 'enquiry_handling',
      label: 'Enquiry handling (AI Receptionist)',
      description: 'How enquiries are answered, including outside opening hours.',
      evidenceSignals: [
        'No chat or WhatsApp entry point on the website or profile',
        'No after-hours enquiry path',
        'Public reviews mentioning slow or missed replies',
      ],
      offerIds: ['ai_receptionist'],
      weight: 0.15,
      weightIsProvisional: true,
      signalRules: [
        { signal: 'chat_widget_present', when: false, weight: 0.35 },
        { signal: 'whatsapp_entry_point', when: false, weight: 0.35 },
        { signal: 'contact_form_present', when: false, weight: 0.15 },
        { signal: 'opening_hours_published', when: false, weight: 0.15 },
        { signal: 'whatsapp_entry_point', when: true, weight: -0.2 },
      ],
    },
    {
      id: 'voice_handling',
      label: 'Phone and voice handling (AI Voice Agent)',
      description: 'Whether phone demand appears to exceed the clinic’s ability to answer.',
      evidenceSignals: [
        'Phone is the main or only contact channel',
        'Public reviews mentioning unanswered or hard-to-reach phone lines',
      ],
      offerIds: ['ai_voice_agent'],
      weight: 0.1,
      weightIsProvisional: true,
      signalRules: [
        { signal: 'click_to_call', when: true, weight: 0.3 },
        { signal: 'online_booking_present', when: false, weight: 0.3 },
        { signal: 'whatsapp_entry_point', when: false, weight: 0.2 },
        { signal: 'contact_form_present', when: false, weight: 0.2 },
      ],
    },
    {
      id: 'lead_follow_up',
      label: 'Lead follow-up and recall',
      description: 'Whether enquiries and past patients are followed up. Rarely visible from outside — usually a validation question.',
      evidenceSignals: [
        'Enquiry form with no confirmation or follow-up message',
        'No recall or reminder process mentioned anywhere public',
      ],
      offerIds: ['ai_follow_up_agent'],
      weight: 0.15,
      weightIsProvisional: true,
      signalRules: [
        { signal: 'appointment_driven', when: true, weight: 0.3 },
        { signal: 'contact_form_present', when: true, weight: 0.3 },
        { signal: 'online_booking_present', when: true, weight: 0.2 },
      ],
    },
  ],
  offers: DENTAL_OFFERS,
  outreach: {
    channels: ['email'],
    maxWords: 120,
    guidance: [
      'Professional, concise British/Nigerian English; respectful of a clinical practice.',
      'Lead with one specific, verifiable observation about this clinic.',
      'One clear, low-pressure call to action.',
      'No claims about clinical or patient outcomes, and no fear-based messaging.',
      'Never imply results achieved for other clinics.',
    ],
    prohibitedPhrases: ['pain-free', 'painless', 'cure', 'best dentist', 'guaranteed results', 'more patients guaranteed'],
  },
  qualificationQuestions: [
    'How do patients book appointments today?',
    'Roughly how many enquiries arrive per week, and through which channels?',
    'What happens to enquiries that arrive outside opening hours?',
    'Who answers the phone and WhatsApp, and how busy are they?',
    'Which practice-management or booking software do you use?',
    'Who else would be involved in deciding on a new system?',
    'Is there a timeline or event driving this decision?',
  ],
  research: {
    maxPagesPerSite: 4,
    contactPathHints: ['/contact', '/contact-us', '/about', '/about-us', '/book', '/appointment', '/appointments', '/services'],
    serviceKeywords: [
      'scaling', 'polishing', 'teeth whitening', 'whitening', 'braces', 'orthodontic', 'invisalign', 'aligners',
      'dental implant', 'implants', 'root canal', 'crown', 'bridge', 'veneers', 'dentures', 'extraction', 'filling',
    ],
    bookingProviderHosts: [
      'calendly.com', 'setmore.com', 'simplybook.me', 'acuityscheduling.com', 'squareup.com',
      'youcanbook.me', 'zcal.co', 'cal.com', 'appointlet.com', 'booksy.com', 'fresha.com', 'docplanner.com',
    ],
    chatWidgetHosts: [
      'tawk.to', 'embed.tawk.to', 'widget.intercom.io', 'js.intercomcdn.com', 'client.crisp.chat',
      'static.zdassets.com', 'code.jivosite.com', 'js.driftt.com', 'wchat.freshchat.com',
    ],
    roleInboxLocalParts: [
      'info', 'contact', 'hello', 'enquiries', 'enquiry', 'inquiries', 'inquiry', 'reception', 'frontdesk',
      'admin', 'appointments', 'appointment', 'bookings', 'booking', 'office', 'care', 'support', 'clinic', 'dental', 'mail',
    ],
  },
  bands: [
    { band: 'insufficient_evidence', maxCoverageExclusive: 0.34 },
    { band: 'high', minScore: 50, minCoverage: 0.5, minContactability: 'role_inbox' },
    { band: 'medium', minScore: 30, minCoverage: 0.34 },
  ],
  imports: {
    prohibitedSourcePhrases: ['google', 'maps', 'places', 'gmb', 'business profile'],
    maxRows: 1000,
    maxBytes: 2 * 1024 * 1024,
  },
  retention: {
    provisional: true,
    signalReverifyDays: 90,
    signalStaleDays: 180,
    inactiveContactDays: 180,
    pageCacheHours: 24,
  },
  compliance: {
    approvalRequired: true,
    autoSend: false,
    liveSendingEnabled: false,
    dailySendCap: 0,
    unsubscribeRequired: true,
    senderAddressRequired: true,
    personalEmailNeedsReview: true,
    notes: [
      'Nigeria Data Protection Act 2023: B2B outreach relies on legitimate interest; record the basis per contact.',
      'Every email must identify the sender, include a postal address and an unsubscribe option.',
      'Do not collect or process patient data.',
    ],
  },
};
