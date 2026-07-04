export type Channel = 'whatsapp' | 'email' | 'dm';
export type ProspectTemperature = 'cold' | 'warm' | 'hot';
export type PipelineStage =
  | 'found' | 'contacted' | 'interested' | 'proposal' | 'won' | 'lost';

export type OutreachIntent =
  | 'cold_first_touch'
  | 'audit_outreach'
  | 'reply_interested'
  | 'reply_objection'
  | 'proposal'
  | 'weakness_report'
  | 'presence_audit'
  | 'followup'
  | 'breakup';

export type FrameworkCategory =
  | 'copywriting' | 'structure' | 'qualification'
  | 'pitch' | 'objection' | 'followup';

export type PersuasionPrinciple =
  | 'reciprocity' | 'commitment' | 'social_proof'
  | 'authority' | 'liking' | 'scarcity' | 'unity';

export type CtaLevel =
  | 'micro' | 'soft_call' | 'direct_close' | 'interest' | 'two_option';

export interface Framework {
  id: string;
  name: string;
  category: FrameworkCategory;
  structure: string[];
  whenToUse: string;
  template: string;
  example?: string;
  bestChannels?: Channel[];
  bestTemperature?: ProspectTemperature[];
}

export interface ProspectContext {
  businessName: string;
  industry: string;
  city: string;
  country: string;
  hasWebsite: boolean;
  socialOnly: boolean;
  leadScore: number;
  temperature: ProspectTemperature;
  stage: PipelineStage;
  channel: Channel;
  intent: OutreachIntent;
  objectionText?: string;
  rating?: number;
  reviewCount?: number;
  competitorWithSite?: string;
  followupStep?: 1 | 2 | 3;
  forceFrameworkId?: string;
  timeOfDay?: 'morning' | 'afternoon' | 'evening';
  // nullable — outreach often runs on unsaved search results
  prospectId?: string;
  userId?: string;
}

// Channel-aware output so generate() can feed multi-part endpoints.
export interface OutreachOutput {
  whatsapp?: string;
  emailSubject?: string;
  emailBody?: string;
  dm?: string;
  message?: string; // single-channel intents (reply, etc.)
}

export interface GenerationMeta {
  frameworkId: string;
  secondaryFrameworkId?: string;
  persuasionPrinciple: PersuasionPrinciple;
  ctaLevel: CtaLevel;
  channel: Channel;
  intent: OutreachIntent;
  passedQualityGate: boolean;
  qualityNotes?: string[];
  priceBand?: string;
  provider: string;
  model?: string;
}

// meta is additive and ignored by the existing frontend.
export interface GenerationResult {
  output: OutreachOutput;
  meta: GenerationMeta;
}

export interface SenderProfile {
  senderName: string;
  businessName: string;
  whatsapp: string;
  replyEmail: string;
  city: string;
  tagline: string;
  services: string;
  jobTitle?: string;
  website?: string;
  rateCardSummary?: string; // pre-formatted text from rateCardSummary()
}

export interface RouterSelection {
  primary: Framework;
  secondary?: Framework;
  principle: PersuasionPrinciple;
  ctaLevel: CtaLevel;
  objectionReframe?: string;
}
