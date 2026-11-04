/**
 * What a reply means and what happens next. Pure: no database, no network, so the same rules drive the inbox,
 * the pipeline and the engine.
 *
 *   Contact identified → Campaign contacted → Engaged → Interested → Demo booked → Proposal sent → Customer acquired
 */

import { firstNameOf } from '@/lib/decisionMaker';
import { shortOffer, type CampaignBrief } from '@/lib/campaignBrief';

export type ReplyClass = 'interested' | 'info_request' | 'meeting_request' | 'objection' | 'not_interested' | 'out_of_office' | 'unsubscribe' | 'other';

export const REPLY_CLASSES: Array<{ id: ReplyClass; label: string; tone: 'green' | 'blue' | 'amber' | 'gray' | 'red' }> = [
  { id: 'interested', label: 'Interested', tone: 'green' },
  { id: 'info_request', label: 'Wants information', tone: 'green' },
  { id: 'meeting_request', label: 'Wants a meeting', tone: 'green' },
  { id: 'objection', label: 'Objection', tone: 'amber' },
  { id: 'not_interested', label: 'Not interested', tone: 'gray' },
  { id: 'out_of_office', label: 'Out of office', tone: 'blue' },
  { id: 'unsubscribe', label: 'Opted out', tone: 'red' },
  { id: 'other', label: 'Needs a look', tone: 'gray' },
];
export const REPLY_LABEL = Object.fromEntries(REPLY_CLASSES.map((c) => [c.id, c.label])) as Record<ReplyClass, string>;
export const REPLY_IDS = REPLY_CLASSES.map((c) => c.id);

/** Replies that mean the prospect is engaged and worth pursuing. */
export const POSITIVE: ReplyClass[] = ['interested', 'info_request', 'meeting_request'];
export const isPositive = (c?: string | null): boolean => POSITIVE.includes(c as ReplyClass);
/** Replies after which no more automatic follow-ups are sent (an out-of-office only pauses). */
export const STOPS_SEQUENCE = (c?: string | null): boolean => !!c && c !== 'out_of_office';

export interface Classification { replyClass: ReplyClass; confidence: number; reason: string }

/** The new words in a reply: quoted history ("> …", "On Tue … wrote:") is dropped so we judge what they actually wrote. */
export function freshText(raw: string): string {
  const lines: string[] = [];
  for (const l of raw.replace(/\r\n/g, '\n').split('\n')) {
    if (/^\s*>/.test(l)) continue;
    if (/^\s*(on .{5,80} wrote:|-{2,}\s*original message\s*-{2,}|from:\s.+@|sent from my )/i.test(l)) break;
    lines.push(l);
  }
  return lines.join('\n').trim() || raw.trim();
}

const RX = {
  unsub: /\b(unsubscribe|remove me|take me off|stop (?:emailing|sending|contacting|messaging)|do not (?:email|contact|message)|don'?t (?:email|contact|message) me)\b/,
  ooo: /(out of (?:the )?office|auto-?reply|automatic reply|autoreply|on (?:annual |maternity |paternity )?leave|on vacation|on holiday|away (?:until|from|on)|will (?:be )?(?:back|return|out)\b|currently (?:away|travelling|traveling))/,
  no: /\b(not interested|no,? thanks|no thank you|not for us|not a fit|not a good fit|we(?:'|’)?re not|decline|pass on this|no need)\b/,
  meeting: /\b(demo|demonstration|meeting|schedule|let'?s (?:talk|chat|speak|meet|connect|book|set up)|set up a (?:call|meeting)|book (?:a|the|me)|appointment|zoom|google meet|teams call|are you free|when (?:can|could|are)|available (?:on|at|this|next|tomorrow)|calendar|a call\b|jump on a call)/,
  info: /\b(price|pricing|prices|cost|costs|how much|quote|rates?|fees?|brochure|more (?:info|information|details)|send (?:me |us )?(?:the |some |your )?(?:info|information|details|proposal|deck|brochure)|tell me more|what does it include|how does (?:it|this) work|how it works|what is included|features)\b/,
  objection: /\b(too expensive|too costly|can'?t afford|budget|not now|maybe later|not (?:right )?now|next (?:quarter|year|month)|we(?:'|’)?re busy|too busy|already (?:have|use|using|work with|got)|we (?:use|have|work with) (?:a|an|our|another)|how is (?:this|it) different|not sure (?:it|this|we)|concerned?|worried|trust|security|data protection|send (?:me )?(?:proof|case stud(?:y|ies)|references)|who else uses)\b/,
  yes: /\b(interested|interesting|sounds (?:good|great|interesting|useful)|please do|go ahead|love to|happy to|keen|yes\b|sure\b|that would be (?:great|good|helpful)|i(?:'|’)?d like)\b/,
};

/** Reads a reply with plain rules. Fast, free and predictable; the AI is only asked when this is unsure. */
export function classifyReplyRules(raw: string, subject = ''): Classification {
  const t = `${subject}\n${freshText(raw)}`.toLowerCase();
  const hit = (rx: RegExp) => rx.test(t);
  if (hit(RX.unsub)) return { replyClass: 'unsubscribe', confidence: 0.95, reason: 'They asked not to be contacted again.' };
  if (hit(RX.ooo)) return { replyClass: 'out_of_office', confidence: 0.9, reason: 'This is an automatic out-of-office reply.' };
  if (hit(RX.no) && !hit(RX.info)) return { replyClass: 'not_interested', confidence: 0.85, reason: 'They said they are not interested.' };
  if (hit(RX.meeting)) return { replyClass: 'meeting_request', confidence: 0.8, reason: 'They asked about a demo, call or meeting.' };
  if (hit(RX.info)) return { replyClass: 'info_request', confidence: 0.85, reason: /price|pricing|cost|how much|quote|rate|fee/.test(t) ? 'They asked about pricing or cost.' : 'They asked for more information.' };
  if (hit(RX.objection)) return { replyClass: 'objection', confidence: 0.75, reason: 'They raised a concern or a reason to wait.' };
  if (hit(RX.yes)) return { replyClass: 'interested', confidence: 0.7, reason: 'The reply is positive.' };
  return { replyClass: 'other', confidence: 0.4, reason: 'The intent is not clear from the words.' };
}

/** Whether rules alone are enough, or the AI should look too. */
export const needsSecondLook = (c: Classification): boolean => c.confidence < 0.75;

/** Validates a class from any source (the AI, the URL, the database) and falls back to 'other'. */
export const asReplyClass = (v: unknown): ReplyClass => (REPLY_IDS.includes(v as ReplyClass) ? (v as ReplyClass) : 'other');

// ── The suggested response ───────────────────────────────────────────────────

export interface SuggestInput { replyClass: ReplyClass; replyText: string; leadName?: string | null; business?: string | null; brief?: CampaignBrief | null }

/**
 * A draft reply for the sender to check and send. It never states a price or a result that the user has not
 * given us: a pricing question gets an honest answer about how pricing works and an offer of a walkthrough.
 */
export function suggestReplyRules(i: SuggestInput): string {
  const first = i.leadName?.trim() ? firstNameOf(i.leadName) : 'there';
  const biz = i.business?.trim() || 'your business';
  const short = shortOffer(i.brief?.offer || '') || 'our solution';
  const sign = `Best regards,${i.brief?.signOff ? `\n\n${i.brief.signOff}` : ''}`;
  const asksPrice = /price|pricing|cost|how much|quote|rate|fee/i.test(freshText(i.replyText));
  const hi = `Hello ${first},`;
  switch (i.replyClass) {
    case 'info_request':
      return [hi, 'Thank you for coming back to me.',
        asksPrice
          ? `Pricing for ${short} depends on the size of ${biz} and which parts of the system you need, so rather than quote a figure that does not fit, the most useful next step is a short walkthrough. I will show you how it would work for ${biz}, and then send a clear proposal with the pricing.`
          : `${i.brief?.offerSummary ? `${i.brief.offerSummary.replace(/\.$/, '')}. ` : ''}The quickest way to see how ${short} would work for ${biz} is a short walkthrough, and I can send a written summary afterwards.`,
        'Would a 15-minute call this week suit you? Tell me a day and time that works and I will send an invite.', sign].join('\n\n');
    case 'meeting_request':
      return [hi, 'Thank you, I would be glad to set that up.', `What day and time this week suits you best? Once we agree, I will send a calendar invite and a short agenda so the session is useful for ${biz}.`, sign].join('\n\n');
    case 'interested':
      return [hi, 'Thank you for your reply, I am glad this caught your attention.', `To make the next step as useful as possible: what matters most to ${biz} right now? I can then show you the parts of ${short} that are most relevant, in a short walkthrough.`, 'Would a 15-minute call this week work for you?', sign].join('\n\n');
    case 'objection':
      return [hi, 'Thank you for being open about that, it is a fair point.', `I do not want to push ${short} if the timing or the fit is not right for ${biz}. If it helps, I can share a short summary so you can look at it in your own time, and we can come back to it when it suits you.`, 'Would that be useful?', sign].join('\n\n');
    case 'not_interested':
      return [hi, 'Understood, and thank you for letting me know.', 'I will not follow up again. If things change, you are always welcome to get in touch.', sign].join('\n\n');
    case 'out_of_office':
      return 'No reply needed. This is an automatic out-of-office message. Follow-ups are paused and will carry on after a few days.';
    case 'unsubscribe':
      return 'No reply needed. This contact has asked not to be contacted again and has been removed from your campaigns.';
    default:
      return [hi, 'Thank you for your reply.', `Could you tell me a little more about what you would like to know about ${short}? I will gladly help.`, sign].join('\n\n');
  }
}

// ── The acquisition pipeline ─────────────────────────────────────────────────

export type StageId = 'identified' | 'contacted' | 'engaged' | 'interested' | 'demo_booked' | 'proposal_sent' | 'customer';

export const PIPELINE: Array<{ id: StageId; label: string; hint: string }> = [
  { id: 'identified', label: 'Contact identified', hint: 'Added to the campaign audience' },
  { id: 'contacted', label: 'Campaign contacted', hint: 'Initial outreach delivered' },
  { id: 'engaged', label: 'Engaged', hint: 'Opened, clicked or replied' },
  { id: 'interested', label: 'Interested', hint: 'Positive reply or pricing request' },
  { id: 'demo_booked', label: 'Demo booked', hint: 'Meeting scheduled' },
  { id: 'proposal_sent', label: 'Proposal sent', hint: 'Commercial offer presented' },
  { id: 'customer', label: 'Customer acquired', hint: 'Deal closed' },
];
export const STAGE_INDEX = Object.fromEntries(PIPELINE.map((p, i) => [p.id, i])) as Record<StageId, number>;

/** What the engine and the sender may set by hand once a prospect is past 'interested'. */
export const MANUAL_STAGES = ['demo_booked', 'proposal_sent', 'customer', 'lost'] as const;
export type ManualStage = (typeof MANUAL_STAGES)[number];

/** Stages after which automatic follow-ups must stop (a booked meeting, a proposal, a closed deal, or a lost one). */
export const STOPS_FOLLOW_UPS: string[] = ['demo_booked', 'proposal_sent', 'customer', 'lost'];

export interface PipelineLead {
  sentAt?: Date | string | null; openedAt?: Date | string | null; clickedAt?: Date | string | null; repliedAt?: Date | string | null;
  replyClass?: string | null; outcome?: string | null; stage?: string | null;
}

const has = (v: Date | string | null | undefined) => !!v && Number.isFinite(new Date(v).getTime());

/** Where a prospect is in the pipeline. The sender's manual stage wins once set; before that it is read from what happened. */
export function acquisitionStage(l: PipelineLead): { stage: StageId; lost: boolean } {
  const lost = l.stage === 'lost';
  if (l.stage === 'customer' || l.stage === 'proposal_sent' || l.stage === 'demo_booked') return { stage: l.stage, lost: false };
  let stage: StageId = 'identified';
  if (has(l.sentAt)) stage = 'contacted';
  if (has(l.openedAt) || has(l.clickedAt) || has(l.repliedAt)) stage = 'engaged';
  if (isPositive(l.replyClass) || l.outcome === 'interested') stage = 'interested';
  return { stage, lost };
}

/** How many prospects are at each stage, how many have reached it (at or past it), and how many were lost. */
export function pipelineCounts(leads: PipelineLead[]): { at: Record<StageId, number>; reached: Record<StageId, number>; lost: number } {
  const at = Object.fromEntries(PIPELINE.map((p) => [p.id, 0])) as Record<StageId, number>;
  let lost = 0;
  for (const l of leads) { const s = acquisitionStage(l); if (s.lost) lost++; else at[s.stage]++; }
  const reached = Object.fromEntries(PIPELINE.map((p, i) => [p.id, PIPELINE.slice(i).reduce((n, q) => n + at[q.id], 0)])) as Record<StageId, number>;
  return { at, reached, lost };
}
