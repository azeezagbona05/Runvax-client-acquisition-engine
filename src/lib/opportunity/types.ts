import type { Signal, SignalCode } from './signals';

/** What the RUNVAX user is selling. Set at discovery, overridable per message. */
export type OfferType = 'website' | 'ai_system';

/** What the user selected in search — 'both' means rank the two together. */
export type SellerOffer = OfferType | 'both';

export type OpportunityBand = 'low' | 'possible' | 'good' | 'strong' | 'high';

/** How much of the case rests on observation vs. inference from category alone. */
export type Confidence = 'low' | 'medium' | 'high';

/** The single lens a message argues from. One per message, never two. */
export type PrimaryAngle =
  | 'missed_enquiry'
  | 'staff_workload'
  | 'speed_of_response'
  | 'customer_experience';

export type SolutionPatternId =
  | 'support'
  | 'qualification'
  | 'booking'
  | 'sales'
  | 'operations'
  | 'website_build';

export interface SolutionPattern {
  id: SolutionPatternId;
  name: string;
  components: string[];
}

export interface Opportunity {
  type: OfferType;
  /** 0-100. Category sets the ceiling; business-specific signals place it. */
  score: number;
  band: OpportunityBand;
  confidence: Confidence;
  /** Headline shown on the card, e.g. "AI Patient Enquiry & Appointment System". */
  title: string;
  /** One sentence, plain language, derived from signals — never model-written. */
  reason: string;
  /** Verbatim facts. Every one traceable to the business record. */
  evidence: string[];
  /** Stable enum codes — the join key for "which reasons close deals". */
  signalCodes: SignalCode[];
  pattern: SolutionPattern;
  /** The angle the outreach layer should lead with. */
  outreachAngle: string;
  /** Who to actually approach in a business of this kind. Trade knowledge from
   *  industryAngles.ts — carried on both lanes so the card always has an answer. */
  buyer: string;
  /** Industry workflow knowledge — what the message is actually built from.
   *  Present on AI-system opportunities; review evidence only sharpens it. */
  angle?: {
    label: string;
    primaryAngle: PrimaryAngle;
    characteristic: string;
    scenario: string;
    manualProcess: string;
    outcome: string;
    guardrail?: string;
  };
  value: { setupMin: number; setupMax: number; monthly?: number };
}

export interface OpportunityResult {
  primary: Opportunity | null;
  all: Opportunity[];
  signals: Signal[];
}
