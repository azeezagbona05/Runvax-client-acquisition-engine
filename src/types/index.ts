export interface PsiAuditItem { id: string; title: string; savings?: string; }

// ── AI Agent types ────────────────────────────────────────────────────────────
export type AgentType = 'researcher' | 'strategist' | 'marketer' | 'copywriter' | 'builder';

export interface ResearcherOutput {
  ownerName: string | null;
  businessAge: string;
  socialMedia: { instagram?: string; facebook?: string; twitter?: string };
  reviewSentiment: 'positive' | 'mixed' | 'negative' | 'unknown';
  keyThemes: string[];
  painPoints: string[];
  opportunities: string[];
  quickInsight: string;
}

export interface StrategistOutput {
  recommendedChannel: 'whatsapp' | 'email' | 'call';
  leadWith: string;
  recommendedOffer: string;
  expectedObjections: string[];
  approachAngle: string;
  urgencyTrigger: string;
  winProbability: 'high' | 'medium' | 'low';
}

export interface MarketerOutput {
  valueProposition: string;
  keyBenefits: string[];
  costOfInaction: string;
  estimatedRoi: string;
  positioning: string;
}

export interface CopywriterOutput {
  whatsappOpener: string;
  emailSubject: string;
  emailBody: string;
  followUp1: string;
  followUp2: string;
}

export interface BuilderOutput {
  pageStructure: string[];
  keyFeatures: string[];
  designStyle: string;
  contentBrief: string;
  websitePrompt: string;
}

export type AgentOutput = ResearcherOutput | StrategistOutput | MarketerOutput | CopywriterOutput | BuilderOutput;

export interface PsiDetails {
  categories: { performance: number; accessibility: number; bestPractices: number; seo: number };
  opportunities: PsiAuditItem[];
  failedAudits: PsiAuditItem[];
  passedCount: number;
}

export interface Business {
  id: string;
  name: string;
  address: string;
  phone?: string;
  phoneIntl?: string;
  email?: string;
  emailVerified?: 'valid' | 'invalid' | 'unknown';
  website?: string;
  hasWebsite: boolean;
  category: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  reviewCount?: number;
  status?: string;
  categoryTypes?: string[];
  description?: string;
  openingHours?: string[];
  lastReviewDate?: string;
  hoursComplete?: boolean;
  competitors?: string[];
  psiScore?: number;
  psiDesktopScore?: number;
  psiDetails?: PsiDetails;
  reviews?: Array<{
    author: string;
    rating: number;
    text: string;
    time: string;
  }>;
  source?: 'google' | 'osm';
}

export interface SearchFormData {
  industry: string;
  location: string;
  country?: string;
  lat?: number;
  lng?: number;
  radius: number;
  query: string;
}

export type ProspectStage = 'found' | 'contacted' | 'interested' | 'proposal' | 'won' | 'lost';

export type ConversationChannel = 'whatsapp' | 'email' | 'call' | 'note';

export type ReplyType =
  | 'interested'
  | 'asked_price'
  | 'asked_examples'
  | 'said_think_about_it'
  | 'said_okay_thanks'
  | 'said_send_info'
  | 'said_call_me'
  | 'objection_instagram'
  | 'objection_referrals'
  | 'objection_expensive'
  | 'objection_no_time'
  | 'objection_already_has_website'
  | 'objection_who_are_you'
  | 'not_interested'
  | 'no_reply'
  | 'custom';

export interface ConversationEntry {
  id: string;
  type: 'sent' | 'received' | 'ai_response' | 'note';
  channel: ConversationChannel;
  content: string;
  replyType?: ReplyType;
  framework?: string;
  timestamp: string;
}

export interface FollowUpStep {
  id: string;
  day: number;
  channel: 'whatsapp' | 'email';
  label: string;
  message: string;
  dueDate: string;
  status: 'pending' | 'sent' | 'skipped';
  sentAt?: string;
}

export interface SavedProspect {
  business: Business;
  stage: ProspectStage;
  savedAt: string;
  notes: string;
  reminderDate?: string;
  reminderNote?: string;
  estimatedPrice?: { min: number; max: number };
  score: number;
  outreachSentAt?: string;
  followUpSequence?: FollowUpStep[];
  conversations: ConversationEntry[];
  source?: 'manual' | 'auto-prospect';
}

export interface DailyLog {
  date: string;
  count: number;
}

export interface AppSettings {
  dailyGoal: number;
  avgDealValue: number;
  closeRatePct: number;
  waPhoneNumberId?: string;
  waTemplateName?: string;
  waTemplateStatus?: string;
  waDisplayPhone?: string;
  wabaId?: string;
}
