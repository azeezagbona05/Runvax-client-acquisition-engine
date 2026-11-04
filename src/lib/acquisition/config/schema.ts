import { z } from 'zod';

/**
 * Shape of an industry pack. Packs are plain data: every object is strict (no
 * unknown keys), every leaf is a string/number/boolean, so a pack cannot carry
 * functions or override engine behaviour. Policy fields that must never be
 * relaxed by configuration are literals — a pack cannot turn off approval or
 * turn on auto-send.
 */

const id = z.string().regex(/^[a-z][a-z0-9_]*$/, 'lower_snake_case id');
const text = z.string().min(1).max(500);
const phrase = z.string().min(2).max(80);

export const OfferSchema = z.strictObject({
  id,
  name: text,
  status: z.enum(['unconfigured', 'approved']),
  // Everything commercial is null until Harzotech supplies approved details.
  description: text.nullable(),
  scope: text.nullable(),
  price: z.strictObject({ currency: z.string().length(3), amount: z.number().positive(), unit: text }).nullable(),
  terms: text.nullable(),
  // Exact phrases outreach may use about this offer (e.g. an approved price
  // line). Anything claim-like outside this list is blocked by the gate.
  approvedClaims: z.array(text),
  solvesCategories: z.array(id).min(1),
  // ── Sales-workflow configuration (optional per offer) ──
  // Bumped on every change to this offer's configuration; drafts record it.
  configVersion: z.number().int().positive().optional(),
  // PROPOSED commercial definition for the business owner to confirm. Nothing
  // here is approved until approvalState is 'approved_by_owner'; until then
  // the offer cannot be sold and drafts using it cannot become send-ready.
  proposal: z.strictObject({
    approvalState: z.enum(['proposed_unapproved', 'approved_by_owner']),
    approvedBy: text.nullable(),
    approvedAt: z.string().nullable(),
    problem: text,
    intendedOutcomes: z.array(text).min(1),
    capabilities: z.array(text).min(1),
    scopeIncluded: z.array(text).min(1),
    exclusions: z.array(text).min(1),
    // Claims proposed for approval. Only `approvedClaims` (above) is used by the gate.
    proposedApprovedClaims: z.array(text),
    pricing: z.strictObject({
      status: z.enum(['unapproved', 'approved']),
      amountMinor: z.number().int().positive().nullable(),
      currency: z.string().length(3).nullable(),
      billingModel: text.nullable(),
      note: text,
    }),
  }).optional(),
  // Evidence required before the offer may be pitched to a clinic.
  evidenceRequirement: z.strictObject({
    categories: z.array(id).min(1),
    minObservedWeaknesses: z.number().int().min(1).max(5),
  }).optional(),
  // Phrases that must never appear in a pitch for this offer (lower-case, plain text).
  prohibitedClaims: z.array(phrase).optional(),
  // Deterministic pitch template parts (no AI).
  pitch: z.strictObject({ topic: text, relevance: text, cta: text }).optional(),
}).refine(
  (o) => o.status === 'unconfigured' || (o.description !== null && o.scope !== null),
  { message: 'An approved offer needs an approved description and scope' },
).refine(
  (o) => o.status === 'unconfigured' || !o.proposal || (o.proposal.approvalState === 'approved_by_owner' && !!o.proposal.approvedBy && !!o.proposal.approvedAt),
  { message: 'An approved offer with a proposal needs owner approval (approvedBy, approvedAt)' },
).refine(
  (o) => !o.proposal || o.proposal.pricing.status === 'approved' || (o.proposal.pricing.amountMinor === null && o.proposal.pricing.currency === null),
  { message: 'Unapproved pricing must not carry an amount or currency' },
).refine(
  (o) => !o.evidenceRequirement || o.evidenceRequirement.categories.every((c) => o.solvesCategories.includes(c)),
  { message: 'evidenceRequirement categories must be among the offer\'s solvesCategories' },
).refine(
  (o) => !o.approvedClaims.some((c) => (o.prohibitedClaims ?? []).some((p) => c.toLowerCase().includes(p.toLowerCase()))),
  { message: 'an approved claim may not contain one of the offer\'s prohibited claims' },
);

/**
 * Signals a scoring rule may reference. Each is produced by a deterministic
 * extractor from an independent source (the clinic's own site, PSI, an
 * import) or, for appointment_driven, from this config itself — never from
 * Google Places content.
 */
export const RULE_SIGNALS = [
  'website_present',
  'online_booking_present',
  'booking_cta_to_form',
  'contact_form_present',
  'whatsapp_entry_point',
  'chat_widget_present',
  'click_to_call',
  'structured_data_dentist',
  'service_pages',
  'opening_hours_published',
  'mobile_viewport',
  'https',
  'pagespeed_mobile_poor',
  'appointment_driven',
] as const;
export type RuleSignal = (typeof RULE_SIGNALS)[number];

// A rule fires when the signal's boolean value equals `when`. Negative weights
// are strengths (e.g. online booking present lowers booking friction).
export const SignalRuleSchema = z.strictObject({
  signal: z.enum(RULE_SIGNALS),
  when: z.boolean(),
  weight: z.number().min(-1).max(1),
});

export const OpportunityCategorySchema = z.strictObject({
  id,
  label: text,
  description: text,
  // Observable checks that can support the category. A finding in this
  // category counts as "observed" only when one of these actually fired.
  evidenceSignals: z.array(text).min(1),
  offerIds: z.array(id).min(1),
  weight: z.number().min(0).max(1),
  weightIsProvisional: z.boolean(),
  signalRules: z.array(SignalRuleSchema).min(1),
});

const CONTACTABILITY = ['none', 'business_phone', 'role_inbox', 'named_manual'] as const;
export type Contactability = (typeof CONTACTABILITY)[number];
export const CONTACTABILITY_ORDER: readonly Contactability[] = CONTACTABILITY;

export const BandRuleSchema = z.strictObject({
  band: z.enum(['high', 'medium', 'insufficient_evidence', 'low']),
  minScore: z.number().min(0).max(100).optional(),
  minCoverage: z.number().min(0).max(1).optional(),
  maxCoverageExclusive: z.number().min(0).max(1).optional(),
  minContactability: z.enum(CONTACTABILITY).optional(),
});

export const IndustryConfigSchema = z.strictObject({
  id,
  version: z.number().int().positive(),
  displayName: text,
  geography: z.strictObject({
    country: z.string().length(2),
    city: text,
    priorityAreas: z.array(text),
  }),
  discovery: z.strictObject({
    placesQueries: z.array(text).min(1),
    placesTypes: z.array(id),
    excludeKeywords: z.array(phrase),
    includeBusinessesWithWebsites: z.literal(true),
  }),
  businessTypes: z.array(text).min(1),
  decisionMakerRoles: z.array(text).min(1), // priority order
  opportunityCategories: z.array(OpportunityCategorySchema).min(1),
  offers: z.array(OfferSchema).min(1),
  outreach: z.strictObject({
    channels: z.array(z.literal('email')).min(1),
    maxWords: z.number().int().min(40).max(300),
    guidance: z.array(text).min(1),
    // Plain lower-case phrases (never regex, so config can't introduce
    // catastrophic patterns) that the gate blocks in this industry.
    prohibitedPhrases: z.array(phrase),
  }),
  qualificationQuestions: z.array(text).min(1),
  // Phase 2 research: what the website extractors look for. Host lists are
  // plain lower-case hostnames (suffix match), never patterns.
  research: z.strictObject({
    maxPagesPerSite: z.number().int().min(1).max(5),
    contactPathHints: z.array(z.string().regex(/^\/[a-z0-9\-\/]*$/)).max(20),
    serviceKeywords: z.array(phrase).min(1),
    bookingProviderHosts: z.array(z.string().regex(/^[a-z0-9.-]+$/)),
    chatWidgetHosts: z.array(z.string().regex(/^[a-z0-9.-]+$/)),
    roleInboxLocalParts: z.array(z.string().regex(/^[a-z0-9._-]+$/)).min(1),
  }),
  // Evaluated in order; the first matching band wins; "low" is the fallback.
  bands: z.array(BandRuleSchema).min(1),
  imports: z.strictObject({
    // Any row whose `source` contains one of these (case-insensitive) is
    // rejected, so Google Maps content can't be brought in through a CSV.
    prohibitedSourcePhrases: z.array(phrase).min(1),
    maxRows: z.number().int().min(1).max(1000),
    maxBytes: z.number().int().min(1024).max(2 * 1024 * 1024),
  }),
  // Provisional until legal / provider-term review (see docs/phase-2-plan.md §2).
  retention: z.strictObject({
    provisional: z.boolean(),
    signalReverifyDays: z.number().int().min(1),
    signalStaleDays: z.number().int().min(1),
    inactiveContactDays: z.number().int().min(1),
    pageCacheHours: z.number().int().min(1).max(24),
  }),
  compliance: z.strictObject({
    approvalRequired: z.literal(true),
    autoSend: z.literal(false),
    liveSendingEnabled: z.boolean(),
    dailySendCap: z.number().int().min(0).max(200),
    unsubscribeRequired: z.literal(true),
    senderAddressRequired: z.literal(true),
    personalEmailNeedsReview: z.literal(true),
    notes: z.array(text),
  }),
}).superRefine((cfg, ctx) => {
  const total = cfg.opportunityCategories.reduce((s, c) => s + c.weight, 0);
  if (Math.abs(total - 1) > 1e-6) {
    ctx.addIssue({ code: 'custom', message: `Category weights must sum to 1 (got ${total})`, path: ['opportunityCategories'] });
  }
  const offerIds = new Set(cfg.offers.map((o) => o.id));
  const categoryIds = new Set(cfg.opportunityCategories.map((c) => c.id));
  if (offerIds.size !== cfg.offers.length) ctx.addIssue({ code: 'custom', message: 'Duplicate offer id', path: ['offers'] });
  if (categoryIds.size !== cfg.opportunityCategories.length) ctx.addIssue({ code: 'custom', message: 'Duplicate category id', path: ['opportunityCategories'] });
  for (const c of cfg.opportunityCategories) {
    for (const o of c.offerIds) {
      if (!offerIds.has(o)) ctx.addIssue({ code: 'custom', message: `Category "${c.id}" maps to unknown offer "${o}"`, path: ['opportunityCategories'] });
    }
  }
  for (const o of cfg.offers) {
    for (const c of o.solvesCategories) {
      if (!categoryIds.has(c)) ctx.addIssue({ code: 'custom', message: `Offer "${o.id}" lists unknown category "${c}"`, path: ['offers'] });
    }
  }
  if (cfg.retention.signalStaleDays <= cfg.retention.signalReverifyDays) {
    ctx.addIssue({ code: 'custom', message: 'signalStaleDays must exceed signalReverifyDays', path: ['retention'] });
  }
  if (!cfg.compliance.liveSendingEnabled && cfg.compliance.dailySendCap !== 0) {
    ctx.addIssue({ code: 'custom', message: 'dailySendCap must be 0 while live sending is disabled', path: ['compliance'] });
  }
});

export type Offer = z.infer<typeof OfferSchema>;
export type OpportunityCategory = z.infer<typeof OpportunityCategorySchema>;
export type IndustryConfig = z.infer<typeof IndustryConfigSchema>;
