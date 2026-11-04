import type { AgentId } from '@/lib/acqReplies';

/** The six agents every account gets. They share one campaign execution system: each does its part and writes to the same log. */
export const WORKFORCE: Array<{ id: AgentId; name: string; role: string; does: string; idle: string }> = [
  { id: 'strategist', name: 'Campaign Strategist', role: 'Plans the campaign', does: 'Turns your goal into a plan: the objective, the offer, the five-email sequence and how many days between emails.', idle: 'Waiting for a goal to plan' },
  { id: 'audience', name: 'Audience Intelligence Agent', role: 'Understands who to reach', does: 'Reads your contacts, removes duplicates and opted-out addresses, and tells you who is worth contacting first.', idle: 'Waiting for contacts to review' },
  { id: 'content', name: 'Campaign Content Agent', role: 'Writes the messages', does: 'Writes each email in your voice and personalises the first one for each business with the RUNVAX pitch engine.', idle: 'Waiting for emails to write' },
  { id: 'outreach', name: 'Outreach Agent', role: 'Sends the first message', does: 'Sends the introduction from your own mailbox within your daily limit, with an unsubscribe link in every email.', idle: 'Waiting for a campaign to run' },
  { id: 'followup', name: 'Follow-up Agent', role: 'Keeps the conversation going', does: 'Sends the Day 3, 6, 9 and 14 follow-ups to people who have not replied, and stops the moment they reply, opt out or book a meeting.', idle: 'Waiting for follow-ups to come due' },
  { id: 'reply', name: 'Reply Intelligence Agent', role: 'Reads and answers replies', does: 'Reads each reply, works out what the person wants, alerts you, suggests an answer and tracks them to a customer.', idle: 'Waiting for replies' },
];

export const AGENT_IDS: AgentId[] = WORKFORCE.map((w) => w.id);
export const asAgentId = (v: unknown): AgentId => (AGENT_IDS.includes(v as AgentId) ? (v as AgentId) : 'reply');

export interface LogRow { id: string; agent: string; action: string; detail: string | null; createdAt: Date | string; campaignId: string | null }

/** Per agent: the latest thing it did, how many things this week, and whether it acted in the last 24 hours. */
export function summariseWorkforce(rows: LogRow[], now = Date.now()) {
  const week = now - 7 * 86_400_000, day = now - 86_400_000;
  return WORKFORCE.map((w) => {
    const mine = rows.filter((r) => r.agent === w.id).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    const latest = mine[0];
    return {
      ...w,
      latest: latest ? { action: latest.action, detail: latest.detail, at: new Date(latest.createdAt).toISOString() } : null,
      week: mine.filter((r) => +new Date(r.createdAt) >= week).length,
      active: !!latest && +new Date(latest.createdAt) >= day,
    };
  });
}
