import type { CampaignStats, LeadStage } from '@/lib/outreachCampaign';
import type { CampaignFull } from './CampaignFormModal';

export interface LeadDto {
  id: string;
  email: string;
  name: string | null;
  business: string | null;
  website: string | null;
  status: string;
  sentAt: string | null;
  lastSentAt: string | null;
  followUpsSent: number;
  openedAt: string | null;
  openCount: number;
  clickedAt: string | null;
  clickCount: number;
  repliedAt: string | null;
  outcome: string | null;
  unsubscribedAt: string | null;
  error: string | null;
  stage: LeadStage;
  /** Set by hand once the deal moves on: demo_booked, proposal_sent, customer or lost. */
  pipelineStage: string | null;
  replyClass: string | null;
  pausedUntil: string | null;
  demoAt: string | null;
  dealValue: number | null;
  followUpDue: boolean;
  personalised: boolean;
}

export interface CampaignDetailData {
  mailboxReady: boolean;
  campaign: CampaignFull;
  stats: CampaignStats;
  /** Waiting leads whose first email was written for them by the pitch engine. */
  personalised: number;
  leads: LeadDto[];
}
