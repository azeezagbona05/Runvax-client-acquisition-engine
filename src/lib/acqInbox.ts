import { needsFollowUp } from '@/lib/outreachCampaign';
import type { OvLead } from '@/lib/acqOverview';

export const ms = (d: Date | string | null | undefined): number => (d ? new Date(d).getTime() : 0);

export function needsFollowUpLead(l: OvLead, rule: { followUpAfterDays: number; maxFollowUps: number; waits?: number[] }): boolean {
  return needsFollowUp({
    status: l.status, sentAt: l.sentAt, lastSentAt: l.lastSentAt, repliedAt: l.repliedAt,
    unsubscribedAt: l.unsubscribedAt, followUpsSent: l.followUpsSent ?? 0,
    stage: l.stage, pausedUntil: l.pausedUntil,
  }, rule);
}
