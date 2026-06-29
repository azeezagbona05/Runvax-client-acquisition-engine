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
  reviews?: Array<{
    author: string;
    rating: number;
    text: string;
    time: string;
  }>;
}

export interface SearchFormData {
  industry: string;
  location: string;
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
  | 'objection_instagram'
  | 'objection_referrals'
  | 'objection_expensive'
  | 'objection_no_time'
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
  day: number;
  channel: 'whatsapp' | 'email';
  label: string;
  dueDate: string;
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
}

export interface DailyLog {
  date: string;
  count: number;
}

export interface AppSettings {
  dailyGoal: number;
  avgDealValue: number;
  closeRatePct: number;
}
