/**
 * Writes a whole campaign (the sequence, the follow-ups and the settings) from a brief. No network: this is the
 * built-in strategist and content writer. The AI planner does the same job with OpenAI and falls back to this.
 *
 * The pitch follows one structure: greeting, why we are writing, what the product does for this audience, what it
 * includes, the idea, one soft question, sign-off. It never invents results, numbers or relationships.
 */

import { HARD_DAILY_MAX } from '@/lib/outreachCampaign';
import { MAX_EMAILS, MAX_WAIT_DAYS, sanitizeAutomation, type Automation, type AutoEmail, type SendIf } from '@/lib/automation';
import { briefFromText, shortOffer, type CampaignBrief, type Objective } from '@/lib/campaignBrief';
import { defaultPlaybook } from '@/lib/replyPlaybook';

export interface Knobs {
  count: number;
  /** Null means the default rhythm (Day 1, 3, 6, 9, 14). A number means the same gap between every email. */
  gapDays: number | null;
  dailyCap: number;
  sendIf: SendIf;
  stopOnReply: boolean;
  /** null when the request did not say; the default greeting is then "Hello". */
  tone: 'friendly' | 'formal' | 'direct' | null;
}

const clamp = (n: number, lo: number, hi: number, d: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d);
const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };

/** The sequence settings a request names: how many emails, the gap, the daily limit, conditions, tone. */
export function parseKnobs(prompt: string): Knobs {
  const p = prompt;
  const c = p.match(/(\d)\s*[- ]?\s*(?:emails?|touch(?:es)?|steps?|messages?)/i) ?? p.match(/\b(one|two|three|four|five)\s+(?:emails?|touch(?:es)?|steps?|messages?)/i);
  const g = p.match(/(?:after|every|wait(?:ing)?|gap of)\s*(\d{1,2})\s*days?/i) ?? p.match(/(\d{1,2})\s*days?\s*(?:apart|between|later|gap)/i);
  const cap = p.match(/(\d{1,3})\s*(?:emails?\s*)?(?:a|per|\/)\s*day/i) ?? p.match(/(?:limit|cap)\s*(?:of)?\s*(\d{1,3})/i);
  const onlyOpened = /only (?:if|to those who|to people who) (?:they )?opened|if (?:they )?opened/i.test(p);
  const notOpened = /(?:did ?n[o']t|not|haven'?t) open/i.test(p);
  return {
    // One email is not a campaign: the default is a five-touch sequence.
    count: clamp(c ? (WORDS[c[1].toLowerCase()] ?? Number(c[1])) : 5, 1, MAX_EMAILS, 5),
    gapDays: g ? clamp(Number(g[1]), 1, MAX_WAIT_DAYS, 3) : null,
    dailyCap: clamp(cap ? Number(cap[1]) : 20, 1, HARD_DAILY_MAX, 20),
    sendIf: onlyOpened ? 'opened' : notOpened ? 'not_opened' : 'no_reply',
    stopOnReply: !/(?:don'?t|do not|keep going|continue) (?:stop )?(?:when|if|after) (?:they )?repl/i.test(p),
    tone: /formal|professional|polite/i.test(p) ? 'formal' : /direct|short|concise|brief/i.test(p) ? 'direct' : /friendly|casual|warm/i.test(p) ? 'friendly' : null,
  };
}

const ASK: Record<Objective, string> = {
  book_meetings: 'Would you be open to a brief demonstration of how this could work for {{business}}?',
  get_replies: 'Would it be worth a short conversation to see whether this fits {{business}}?',
  generate_leads: 'Would you like me to send over more information for {{business}}?',
  promote_offer: 'Would you like me to share the details with you?',
  reactivate: 'Would it be worth picking this conversation back up?',
};
const FOLLOW_ASK: Record<Objective, string> = {
  book_meetings: 'If it would help, I would be glad to show you a short demonstration for {{business}}.',
  get_replies: 'If it is useful, I would be glad to have a short conversation about {{business}}.',
  generate_leads: 'If it is useful, just reply and I will send the details for {{business}}.',
  promote_offer: 'If you would like the details, just reply and I will send them over.',
  reactivate: 'If now is a better time, I would be glad to pick this back up.',
};

/** The audience as a phrase for a sentence: "dental clinics in Nigeria". */
const audiencePhrase = (a: string) => (a ? a.charAt(0).toLowerCase() + a.slice(1) : 'businesses like yours');
/** Just the kind of business: "dental clinics". */
const audienceKind = (a: string) => audiencePhrase(a).replace(/\s+in\s+.+$/i, '') || 'businesses like yours';

/**
 * Builds the campaign from a brief. Missing fields get honest, generic wording instead of invented specifics.
 * The result always passes sanitizeAutomation and always sends in "review" mode.
 */
export function buildFromBrief(brief: CampaignBrief, knobs: Knobs): Automation {
  const short = shortOffer(brief.offer) || 'our product';
  const hi = knobs.tone === 'formal' ? 'Dear {{name}},' : knobs.tone === 'direct' ? '{{name}},' : knobs.tone === 'friendly' ? 'Hi {{name}},' : 'Hello {{name}},';
  const bye = knobs.tone === 'formal' ? 'Kind regards,' : 'Best regards,';
  const sign = `${bye}${brief.signOff ? `\n\n${brief.signOff}` : ''}`;
  const aud = audiencePhrase(brief.audience);
  const kind = audienceKind(brief.audience);

  const parts: string[] = [hi];
  parts.push(`I came across {{business}} and wanted to introduce something${brief.audience ? ` we are building specifically for ${aud}` : ' that may be relevant to you'}.`);
  const startsWithOffer = brief.offerSummary.toLowerCase().startsWith(short.toLowerCase());
  parts.push(brief.offerSummary
    ? `${startsWithOffer ? brief.offerSummary : `At ${short}, ${/^we\b/i.test(brief.offerSummary) ? brief.offerSummary : brief.offerSummary.charAt(0).toLowerCase() + brief.offerSummary.slice(1)}`}${/[.!?]$/.test(brief.offerSummary) ? '' : '.'}`
    : `${short} is designed to help ${kind} reach, engage and win more customers.`);
  if (brief.features.length) parts.push(`${brief.features.length > 1 ? 'Our system includes' : 'It includes'}:\n\n${brief.features.map((f) => `- ${f.replace(/^[-•*\d.)\s]+/, '')}`).join('\n')}`);
  if (brief.features.length) parts.push('The idea is to help {{business}} attract, engage and convert more customers without depending entirely on manual processes.');
  parts.push(ASK[brief.objective]);
  parts.push(sign);

  const benefit = brief.offerSummary ? shortSummary(brief.offerSummary) : `${short} helps ${kind} respond to enquiries and follow up consistently`;
  const first: AutoEmail = { subject: `${short} for {{business}}`, body: parts.join('\n\n'), waitDays: 0, sendIf: 'no_reply' };

  // The follow-ups, each with its own job. Waits are the days since the previous email: Day 1, 3, 6, 9 and 14.
  const touches: Record<'review' | 'educate' | 'demo' | 'final', AutoEmail> = {
    review: {
      subject: 'Re: {{subject}}', waitDays: 2, sendIf: knobs.sendIf,
      body: [hi, `I wanted to check whether you had a chance to look at my earlier note about ${short} for {{business}}.`, `The main benefit is simple: ${benefit}, so fewer enquiries are left waiting.`, FOLLOW_ASK[brief.objective], sign].join('\n\n'),
    },
    educate: {
      subject: 'How faster follow-up helps {{business}}', waitDays: 3, sendIf: knobs.sendIf,
      body: [hi, `One thing I keep seeing with ${kind}: when an enquiry is answered late, or a follow-up is forgotten, the person often moves on to whoever responded first.`, `That is usually not a problem with the service itself. It is a problem of speed and consistency, and it is exactly what ${short} is built to help with.`, `If it is useful, I can show you what that looks like for {{business}}.`, sign].join('\n\n'),
    },
    demo: {
      subject: `See ${short} in action`, waitDays: 3, sendIf: knobs.sendIf,
      body: [hi, `I would like to invite you to a short walkthrough of ${short}, so you can see how it works in practice for {{business}}: the dashboard, and the journey from a first enquiry to a booked conversation.`, ASK.book_meetings.replace('Would you be open to a brief demonstration of how this could work for {{business}}?', 'It takes about 15 minutes. Would you be open to that?'), sign].join('\n\n'),
    },
    final: {
      subject: 'Last note about {{business}}', waitDays: 5, sendIf: 'no_reply',
      body: [hi, `I will keep this short, since this is my last note about ${short}.`, `If it is something {{business}} would like to explore, just reply with "interested" and I will take it from there. If not, reply with "no thanks" and I will not contact you again. Either answer is completely fine.`, sign].join('\n\n'),
    },
  };
  const order = ({ 1: [], 2: ['final'], 3: ['review', 'final'], 4: ['review', 'demo', 'final'], 5: ['review', 'educate', 'demo', 'final'] } as Record<number, Array<keyof typeof touches>>)[knobs.count] ?? ['review', 'educate', 'demo', 'final'];
  // People who opened but did not reply have seen the pitch: they get a shorter, more direct version.
  const opened: Partial<Record<keyof typeof touches, { subject: string; body: string }>> = {
    review: {
      subject: 'Re: {{subject}}',
      body: [hi, `Thank you for taking a look at my note about ${short}.`, `If any part of it stood out for {{business}}, I would be glad to show you exactly how it would work, with no obligation.`, FOLLOW_ASK[brief.objective], sign].join('\n\n'),
    },
    educate: {
      subject: `A quick example for {{business}}`,
      body: [hi, `Since you had a look at ${short}, here is the short version of how it usually helps ${kind}: every enquiry gets an answer straight away, follow-ups happen on time, and fewer opportunities slip through.`, `Would it help if I showed you what that would look like for {{business}}?`, sign].join('\n\n'),
    },
    demo: {
      subject: `15 minutes to see ${short} for {{business}}`,
      body: [hi, `You have had a look at ${short}, so the most useful next step is a short walkthrough built around {{business}}.`, 'Would one day this week or next suit you? Reply with a time and I will send an invite.', sign].join('\n\n'),
    },
  };
  const emails = [first, ...order.map((k) => ({ ...touches[k], ...(knobs.gapDays !== null ? { waitDays: knobs.gapDays } : {}), ...(opened[k] && touches[k].sendIf !== 'not_opened' ? { openedVariant: opened[k] } : {}) }))];

  return sanitizeAutomation({
    name: brief.name || [short, brief.audience].filter(Boolean).join(': ') || 'Customer outreach campaign',
    emails, stopOnReply: knobs.stopOnReply, replyRules: { notifyInterested: true, outOfOfficePauseDays: 3 },
    sendMode: 'review', dailyCap: knobs.dailyCap, windowStart: 9, windowEnd: 17, weekdaysOnly: true,
    brief, playbook: defaultPlaybook(brief, bye),
  }) as Automation;
}

/** The first sentence of a longer summary, kept short for a follow-up. */
function shortSummary(s: string): string {
  const first = s.split(/(?<=[.!?])\s/)[0].trim();
  const t = first.length > 160 ? `${first.slice(0, 157).replace(/\s+\S*$/, '')}…` : first;
  return /^we\b/i.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1);
}

/** Typed goal in, complete campaign out: reads the brief from the text (or uses the given one) and builds from it. */
export function planFromGoal(text: string, given?: CampaignBrief | null): { automation: Automation; brief: CampaignBrief } {
  const fromText = briefFromText(text);
  // What the user filled in wins; what they only typed fills the gaps.
  const brief: CampaignBrief = given ? {
    name: given.name || fromText.name, objective: given.offer || given.audience || given.goal ? given.objective : fromText.objective,
    offer: given.offer || fromText.offer, offerSummary: given.offerSummary, features: given.features,
    audience: given.audience || fromText.audience, goal: given.goal || fromText.goal, signOff: given.signOff,
  } : fromText;
  const automation = buildFromBrief(brief, parseKnobs(text));
  return { automation, brief: automation.brief ?? brief };
}
