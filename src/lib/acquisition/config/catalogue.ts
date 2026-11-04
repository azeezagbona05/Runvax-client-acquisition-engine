import type { Offer } from './schema';

/**
 * Harzotech's dental AI services. Names only for now: description, scope,
 * price and terms are deliberately null (status "unconfigured") until the
 * approved offer details are supplied. While an offer is unconfigured the
 * strategy agent may recommend it by name, but the delivery gate blocks any
 * draft that uses it, and no proposal can be generated from it.
 */
export const DENTAL_OFFERS: Offer[] = [
  {
    id: 'ai_visibility_agent',
    name: 'AI Visibility Agent',
    status: 'unconfigured',
    description: null,
    scope: null,
    price: null,
    terms: null,
    approvedClaims: [],
    solvesCategories: ['search_visibility', 'enquiry_conversion'],
  },
  {
    id: 'ai_receptionist',
    name: 'AI Receptionist',
    // Still not sellable: status stays 'unconfigured' and the proposal below is
    // UNAPPROVED until the business owner confirms it (docs/offer-ai-receptionist-proposal.md).
    status: 'unconfigured',
    description: null,
    scope: null,
    price: null,
    terms: null,
    approvedClaims: [],
    solvesCategories: ['enquiry_conversion', 'booking_friction', 'enquiry_handling'],
    configVersion: 1,
    proposal: {
      approvalState: 'proposed_unapproved',
      approvedBy: null,
      approvedAt: null,
      // PROPOSED wording — to be confirmed or corrected by Harzotech.
      problem: 'Patient enquiries that arrive while staff are busy or the clinic is closed may wait for a reply, and appointment requests may be hard to make outside a phone call.',
      intendedOutcomes: [
        'Routine patient enquiries receive a first response without waiting for staff to be free.',
        'Appointment requests are captured and handed to the clinic team to confirm.',
      ],
      capabilities: [
        'Answers routine questions (e.g. location, opening hours, services offered) using only information the clinic has approved.',
        'Collects the details of an appointment request and passes them to clinic staff.',
        'Hands any enquiry it cannot answer to a member of staff.',
      ],
      scopeIncluded: [
        'Set-up using the clinic’s own approved information.',
        'Written enquiries on channel(s) to be agreed with the clinic — not yet specified.',
        'Hand-off to clinic staff.',
      ],
      exclusions: [
        'No clinical, diagnostic or treatment advice.',
        'No access to or handling of patient medical records.',
        'No integration with any booking or practice-management system unless separately specified and confirmed.',
        'No phone or voice handling (see AI Voice Agent).',
        'No guaranteed response times, booking volumes, patient numbers or revenue.',
      ],
      proposedApprovedClaims: [],
      pricing: {
        status: 'unapproved',
        amountMinor: null,
        currency: null,
        billingModel: null,
        note: 'Pricing to be supplied by the business owner. Not to be quoted.',
      },
    },
    evidenceRequirement: { categories: ['enquiry_handling', 'booking_friction', 'enquiry_conversion'], minObservedWeaknesses: 1 },
    prohibitedClaims: [
      'never miss', '24/7', 'round the clock', 'guarantee', 'more patients', 'more bookings', 'fully automated',
      'replace your receptionist', 'replace your staff', 'medical advice', 'diagnos', 'ai doctor', 'compliant',
    ],
    pitch: {
      topic: 'patient enquiries and appointment requests',
      relevance: 'Harzotech is preparing an AI Receptionist for dental clinics: it would answer routine patient questions using information the clinic approves, and pass appointment requests to your team to confirm.',
      cta: 'Would a short call be useful to see whether this could fit how your clinic works?',
    },
  },
  {
    id: 'ai_voice_agent',
    name: 'AI Voice Agent',
    status: 'unconfigured',
    description: null,
    scope: null,
    price: null,
    terms: null,
    approvedClaims: [],
    solvesCategories: ['booking_friction', 'voice_handling'],
  },
  {
    id: 'ai_follow_up_agent',
    name: 'AI Follow-Up Agent',
    status: 'unconfigured',
    description: null,
    scope: null,
    price: null,
    terms: null,
    approvedClaims: [],
    solvesCategories: ['lead_follow_up'],
  },
];
