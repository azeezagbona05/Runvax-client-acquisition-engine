/**
 * The reply playbook: for each kind of reply a prospect can send, what happens to the sequence and what to say back.
 * Saved with the campaign's automation. When a reply arrives, its class picks the play, and the play's answer becomes
 * the suggested reply in the inbox. Nothing here sends anything: the sender reviews and sends.
 */

import { shortOffer, type CampaignBrief } from '@/lib/campaignBrief';
import type { ReplyClass } from '@/lib/replyIntel';
import { firstNameOf } from '@/lib/decisionMaker';

export type PlayAction = 'notify_and_answer' | 'answer' | 'pause' | 'stop_and_answer' | 'stop';

export interface ReplyPlay {
  replyClass: ReplyClass;
  /** What happens to the sequence, decided by the engine's safety rules (shown, not chosen freely). */
  action: PlayAction;
  /** The answer to suggest. Placeholders: {{name}} and {{business}}. Empty for plays with nothing to send. */
  response: string;
}

export const PLAY_ORDER: ReplyClass[] = ['interested', 'meeting_request', 'info_request', 'objection', 'not_interested', 'out_of_office', 'unsubscribe', 'other'];

/** The fixed consequence of each reply class. These match ingestReply and nextAction, so the playbook never promises anything else. */
export const PLAY_ACTION: Record<ReplyClass, PlayAction> = {
  interested: 'notify_and_answer', meeting_request: 'notify_and_answer', info_request: 'notify_and_answer',
  objection: 'stop_and_answer', not_interested: 'stop_and_answer', other: 'stop_and_answer',
  out_of_office: 'pause', unsubscribe: 'stop',
};

export const PLAY_LABEL: Record<ReplyClass, string> = {
  interested: 'Replies: interested', meeting_request: 'Asks for a meeting', info_request: 'Asks a question or the price',
  objection: 'Raises an objection', not_interested: 'Says no', out_of_office: 'Out-of-office reply', unsubscribe: 'Asks to unsubscribe', other: 'Any other reply',
};

export const ACTION_LABEL: Record<PlayAction, string> = {
  notify_and_answer: 'Follow-ups stop, you are alerted straight away, the answer below is drafted',
  answer: 'The answer below is drafted',
  pause: 'Follow-ups pause, then carry on automatically',
  stop_and_answer: 'Follow-ups stop, the answer below is drafted',
  stop: 'Removed from every campaign. Never contacted again',
};

const MAX_RESPONSE = 2000;
const URL_RE = /https?:\/\/\S+|www\.\S+/gi;
const ALLOWED = new Set(['name', 'business']);

/** Links and unknown placeholders are removed, as in the emails. */
function cleanResponse(s: unknown): string {
  if (typeof s !== 'string') return '';
  return s.replace(/\r\n/g, '\n').replace(URL_RE, '')
    .replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (m, k: string) => (ALLOWED.has(k) ? `{{${k}}}` : k === 'firstName' ? '{{name}}' : ''))
    .replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_RESPONSE);
}

/** Any input becomes a complete, ordered playbook. Missing plays come from `fallback`; actions are always the fixed ones. */
export function sanitizePlaybook(raw: unknown, fallback: ReplyPlay[] = []): ReplyPlay[] {
  const given = new Map<string, unknown>();
  if (Array.isArray(raw)) {
    for (const p of raw) if (p && typeof p === 'object') given.set(String((p as Record<string, unknown>).replyClass), (p as Record<string, unknown>).response);
  } else if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) given.set(k, v);
  }
  const fb = new Map(fallback.map((p) => [p.replyClass, p.response]));
  return PLAY_ORDER.map((c) => {
    const action = PLAY_ACTION[c];
    if (action === 'pause' || action === 'stop') return { replyClass: c, action, response: '' };
    return { replyClass: c, action, response: cleanResponse(given.get(c)) || fb.get(c) || '' };
  });
}

/** A sensible playbook for this campaign, written from the brief. Used when the AI gives none, and by the built-in planner. */
export function defaultPlaybook(brief?: CampaignBrief | null, sign = 'Best regards,'): ReplyPlay[] {
  const short = shortOffer(brief?.offer || '') || 'what we do';
  const end = `${sign}${brief?.signOff ? `\n\n${brief.signOff}` : ''}`;
  const hi = 'Hello {{name}},';
  const r: Partial<Record<ReplyClass, string>> = {
    interested: [hi, 'Thank you for getting back to me, I am glad this caught your attention.', `So I can show you the parts of ${short} that matter most to {{business}}: what is the biggest priority for you right now?`, 'Would a 15-minute call this week suit you? Tell me a day and time and I will send an invite.', end].join('\n\n'),
    meeting_request: [hi, 'Thank you, I would be glad to set that up.', 'What day and time this week works best for you? I will send a calendar invite with a short agenda so the session is useful for {{business}}.', end].join('\n\n'),
    info_request: [hi, 'Thank you for your question.', `${brief?.offerSummary ? `${brief.offerSummary.replace(/\.$/, '')}. ` : ''}Pricing depends on the size of {{business}} and which parts you need, so the most useful next step is a short walkthrough, after which I will send a clear proposal with the pricing.`, 'Would a 15-minute call this week work for you?', end].join('\n\n'),
    objection: [hi, 'Thank you for being open about that, it is a fair point.', `I do not want to push ${short} if the timing or fit is not right for {{business}}. I can send a short summary for you to look at in your own time, and we can pick it up whenever it suits you.`, 'Would that be useful?', end].join('\n\n'),
    not_interested: [hi, 'Understood, and thank you for letting me know. I will not follow up again.', 'If you have a moment, could you tell me in one line what made it not a fit (timing, budget, or already covered)? It helps me improve, and no answer is needed if you are busy.', end].join('\n\n'),
    other: [hi, 'Thank you for your reply.', `Could you tell me a little more about what you would like to know about ${short}? I will gladly help.`, end].join('\n\n'),
  };
  return sanitizePlaybook(r);
}

/** The play's answer filled in for one contact, or null when this play sends nothing. */
export function renderPlay(playbook: ReplyPlay[] | undefined | null, replyClass: ReplyClass, lead: { name?: string | null; business?: string | null }): string | null {
  const play = playbook?.find((p) => p.replyClass === replyClass);
  if (!play || !play.response.trim()) return null;
  const first = lead.name?.trim() ? firstNameOf(lead.name) : 'there';
  return play.response.replace(/\{\{name\}\}/g, first).replace(/\{\{business\}\}/g, lead.business?.trim() || 'your business');
}
