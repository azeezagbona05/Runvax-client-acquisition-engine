/**
 * Campaign automation: a sequence of emails with delays, conditions and reply rules, plus the logic
 * that decides what should happen next for a lead. Pure (no database, no network), so the builder's
 * preview, the AI planner's output checks and the engine all share one set of rules.
 *
 * Safety rules baked in, whatever the AI or the user asks for:
 *   - Unsubscribed and bounced leads are never contacted again.
 *   - Replies stop the sequence unless the sender turns that off (an unsubscribe always stops it).
 *   - Sending mode defaults to "review": follow-ups wait for the sender. The AI can never switch on auto.
 *   - Only the placeholders the engine understands are allowed, and links in AI text are removed.
 */

import { HARD_DAILY_MAX, canonTokens, unknownTokens } from '@/lib/outreachCampaign';
import { sanitizeBrief, type CampaignBrief } from '@/lib/campaignBrief';
import { sanitizePlaybook, type ReplyPlay } from '@/lib/replyPlaybook';

export const DAY = 86_400_000;
export const MAX_EMAILS = 5;
export const MAX_WAIT_DAYS = 30;
/** What the engine runs: one introduction and up to four follow-ups, each with its own wording and wait. */
export const ENGINE_MAX_FOLLOW_UPS = 4;

export type SendIf = 'no_reply' | 'not_opened' | 'opened' | 'clicked';
export const SEND_IF_LABEL: Record<SendIf, string> = {
  no_reply: 'They have not replied',
  not_opened: 'They have not opened it',
  opened: 'They opened it but did not reply',
  clicked: 'They clicked a link but did not reply',
};

export type ReplyKind = 'interested' | 'not_interested' | 'out_of_office' | 'unsubscribe' | 'other';
export type SendMode = 'review' | 'auto';

export interface AutoEmail {
  subject: string;
  body: string;
  /** Days after the previous email. Ignored (0) for the first email. */
  waitDays: number;
  /** When to send it. Always 'no_reply' for the first email. */
  sendIf: SendIf;
  /** Different wording for people who opened an earlier email but did not reply. Follow-ups only. */
  openedVariant?: { subject: string; body: string };
}

export interface ReplyRules {
  /** Tell the sender straight away when someone is interested. */
  notifyInterested: boolean;
  /** An out-of-office reply pauses the sequence for this many days, then it carries on. */
  outOfOfficePauseDays: number;
}

export interface Automation {
  name: string;
  emails: AutoEmail[];
  stopOnReply: boolean;
  replyRules: ReplyRules;
  sendMode: SendMode;
  dailyCap: number;
  windowStart: number; // hour 0-23
  windowEnd: number;
  weekdaysOnly: boolean;
  /** The campaign setup this was built from (objective, offer, audience, goal), so it can be shown, edited and tracked. */
  brief?: CampaignBrief;
  /** What to say back for each kind of reply. */
  playbook?: ReplyPlay[];
}

export const DEFAULT_REPLY_RULES: ReplyRules = { notifyInterested: true, outOfOfficePauseDays: 3 };

// ── Sanitising ───────────────────────────────────────────────────────────────

const clamp = (n: unknown, lo: number, hi: number, fallback: number) => {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : fallback;
  return Math.min(hi, Math.max(lo, v));
};
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, max) : '');
const URL_RE = /https?:\/\/\S+|www\.\S+/gi;
const SEND_IFS: SendIf[] = ['no_reply', 'not_opened', 'opened', 'clicked'];

/** Removes links and any placeholder the engine doesn't know, so AI text can't smuggle in anything unexpected. */
export function cleanCopy(s: string, allowSubject = false): string {
  let out = canonTokens(s).replace(URL_RE, '');
  for (const bad of unknownTokens(out, allowSubject ? ['subject'] : [])) out = out.split(`{{${bad}}}`).join('');
  // Removing things leaves gaps: close up double spaces, spaces before punctuation and blank-line runs.
  return out.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+([,.;:!?])/g, '$1').replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Turns anything (AI output, saved JSON, a half-edited form) into a safe Automation: clamps numbers,
 * fills defaults, removes links and unknown placeholders, and forces the safety rules above.
 * Returns null when there is no usable email at all.
 */
export function sanitizeAutomation(raw: unknown): Automation | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const list = Array.isArray(r.emails) ? r.emails.slice(0, MAX_EMAILS) : [];
  const emails: AutoEmail[] = [];
  list.forEach((e, i) => {
    if (!e || typeof e !== 'object') return;
    const x = e as Record<string, unknown>;
    const subject = cleanCopy(text(x.subject, 190).replace(/\s+/g, ' '), i > 0);
    const body = cleanCopy(text(x.body, 8000), i > 0);
    if (!subject || !body) return;
    const sendIf: SendIf = i === 0 ? 'no_reply' : SEND_IFS.includes(x.sendIf as SendIf) ? (x.sendIf as SendIf) : 'no_reply';
    const v = x.openedVariant && typeof x.openedVariant === 'object' ? x.openedVariant as Record<string, unknown> : null;
    const vSubject = v ? cleanCopy(text(v.subject, 190).replace(/\s+/g, ' '), true) : '';
    const vBody = v ? cleanCopy(text(v.body, 8000), true) : '';
    // A variant only makes sense when the step can reach someone who opened.
    const variantOk = i > 0 && vSubject && vBody && (sendIf === 'no_reply' || sendIf === 'opened' || sendIf === 'clicked');
    emails.push({
      subject, body,
      waitDays: i === 0 ? 0 : clamp(x.waitDays, 1, MAX_WAIT_DAYS, 3),
      sendIf,
      ...(variantOk ? { openedVariant: { subject: vSubject, body: vBody } } : {}),
    });
  });
  if (emails.length === 0) return null;
  const rr = (r.replyRules && typeof r.replyRules === 'object' ? r.replyRules : {}) as Record<string, unknown>;
  const startH = clamp(r.windowStart, 0, 23, 9);
  const endH = clamp(r.windowEnd, 1, 24, 17);
  return {
    name: text(r.name, 120) || 'Automated campaign',
    emails,
    stopOnReply: r.stopOnReply === false ? false : true,
    replyRules: {
      notifyInterested: rr.notifyInterested === false ? false : true,
      outOfOfficePauseDays: clamp(rr.outOfOfficePauseDays, 1, 14, DEFAULT_REPLY_RULES.outOfOfficePauseDays),
    },
    // Auto-send is never granted by a plan from the AI or by saved data; the sender switches it on knowingly.
    sendMode: r.sendMode === 'auto' && r.__confirmedAuto === true ? 'auto' : 'review',
    dailyCap: clamp(r.dailyCap, 1, HARD_DAILY_MAX, 30),
    windowStart: Math.min(startH, endH - 1),
    windowEnd: Math.max(endH, startH + 1),
    weekdaysOnly: r.weekdaysOnly === false ? false : true,
    ...(r.brief ? { brief: sanitizeBrief(r.brief) } : {}),
    ...(r.playbook ? { playbook: sanitizePlaybook(r.playbook) } : {}),
  };
}

/** The wording one follow-up uses for this contact: the "opened" variant when they opened and it has one. */
export function stepCopy(step: AutoEmail, opened: boolean): { subject: string; body: string; variant: boolean } {
  if (opened && step.openedVariant) return { ...step.openedVariant, variant: true };
  return { subject: step.subject, body: step.body, variant: false };
}

/** Problems that block saving, in plain words. Empty means it is fine. */
export function validateAutomation(a: Automation): string[] {
  const issues: string[] = [];
  if (!a.name.trim()) issues.push('Give the automation a name.');
  if (a.emails.length === 0) issues.push('Add at least one email.');
  a.emails.forEach((e, i) => {
    const label = i === 0 ? 'The first email' : `Email ${i + 1}`;
    if (!e.subject.trim()) issues.push(`${label} needs a subject.`);
    if (!e.body.trim()) issues.push(`${label} needs a body.`);
    const bad = [...unknownTokens(e.subject, i > 0 ? ['subject'] : []), ...unknownTokens(e.body, i > 0 ? ['subject'] : [])];
    if (bad.length) issues.push(`${label} uses an unknown placeholder: {{${bad[0]}}}.`);
  });
  if (a.windowEnd <= a.windowStart) issues.push('The sending window must end after it starts.');
  return issues;
}

// ── What happens next ────────────────────────────────────────────────────────

export interface LeadState {
  sentCount: number;
  lastSentAt?: number;
  openedAt?: number;
  clickedAt?: number;
  repliedAt?: number;
  replyKind?: ReplyKind;
  unsubscribedAt?: number;
  bounced?: boolean;
  /** A stage set by hand: a booked meeting, a proposal or a closed deal stops the sequence. */
  stage?: string | null;
}

export type NextAction =
  | { type: 'send'; index: number }
  | { type: 'wait'; until: number; reason: string }
  | { type: 'stop'; reason: string }
  | { type: 'done' };

export function conditionMet(c: SendIf, l: Pick<LeadState, 'repliedAt' | 'openedAt' | 'clickedAt'>): boolean {
  const replied = !!l.repliedAt;
  if (c === 'no_reply') return !replied;
  if (c === 'not_opened') return !l.openedAt && !replied;
  if (c === 'opened') return !!l.openedAt && !replied;
  return !!l.clickedAt && !replied;
}

/** What should happen to one lead right now. The single source of truth for the preview and the engine. */
export function nextAction(a: Automation, l: LeadState, now: number): NextAction {
  if (l.unsubscribedAt || l.replyKind === 'unsubscribe') return { type: 'stop', reason: 'They unsubscribed, so they will never be emailed again.' };
  if (l.bounced) return { type: 'stop', reason: 'The address bounced, so no more emails are sent.' };
  if (l.stage && ['demo_booked', 'proposal_sent', 'customer', 'lost'].includes(l.stage)) return { type: 'stop', reason: l.stage === 'demo_booked' ? 'A meeting is booked, so automatic follow-ups stop.' : l.stage === 'lost' ? 'This prospect was marked lost, so the sequence stops.' : 'They are past the first conversation, so automatic follow-ups stop.' };

  let effective: LeadState = l;
  if (l.repliedAt) {
    if (l.replyKind === 'out_of_office') {
      const until = l.repliedAt + a.replyRules.outOfOfficePauseDays * DAY;
      if (now < until) return { type: 'wait', until, reason: `Out-of-office reply: paused for ${a.replyRules.outOfOfficePauseDays} days.` };
      effective = { ...l, repliedAt: undefined, replyKind: undefined }; // back from leave: treat as no reply yet
    } else if (l.replyKind === 'interested') {
      return { type: 'stop', reason: a.replyRules.notifyInterested ? 'They are interested: you are told straight away and take over.' : 'They are interested: the sequence stops so you can take over.' };
    } else if (l.replyKind === 'not_interested') {
      return { type: 'stop', reason: 'They are not interested, so the sequence stops.' };
    } else if (a.stopOnReply) {
      return { type: 'stop', reason: 'They replied, so the sequence stops.' };
    } else {
      effective = { ...l, repliedAt: undefined, replyKind: undefined }; // the sender chose to carry on after replies
    }
  }

  if (effective.sentCount <= 0) return { type: 'send', index: 0 };
  if (effective.sentCount >= a.emails.length) return { type: 'done' };

  const next = a.emails[effective.sentCount];
  const due = (effective.lastSentAt ?? 0) + next.waitDays * DAY;
  if (now < due) return { type: 'wait', until: due, reason: `Waiting ${next.waitDays} day${next.waitDays === 1 ? '' : 's'} after the last email.` };
  if (!conditionMet(next.sendIf, effective)) return { type: 'stop', reason: `Email ${effective.sentCount + 1} only goes out if "${SEND_IF_LABEL[next.sendIf].toLowerCase()}", and that is not the case.` };
  return { type: 'send', index: effective.sentCount };
}

// ── Simulator ────────────────────────────────────────────────────────────────

export type Scenario = 'no_reply' | 'opens' | 'clicks' | 'interested' | 'not_interested' | 'out_of_office' | 'unsubscribe';

export const SCENARIOS: Array<{ id: Scenario; label: string; desc: string }> = [
  { id: 'no_reply', label: 'Never replies', desc: 'Gets every email and ignores them' },
  { id: 'opens', label: 'Opens, no reply', desc: 'Opens the first email on day 1' },
  { id: 'clicks', label: 'Clicks a link', desc: 'Opens and clicks on day 1' },
  { id: 'interested', label: 'Replies: interested', desc: 'Replies on day 2 with interest' },
  { id: 'not_interested', label: 'Replies: not interested', desc: 'Replies on day 2 to say no' },
  { id: 'out_of_office', label: 'Out-of-office reply', desc: 'Auto-reply on day 1' },
  { id: 'unsubscribe', label: 'Unsubscribes', desc: 'Clicks unsubscribe on day 2' },
];

export interface SimEvent { day: number; kind: 'send' | 'event' | 'stop' | 'done'; text: string }

/** Plays the automation forward for one imaginary lead, day by day. */
export function simulate(a: Automation, scenario: Scenario, maxDays = 60): SimEvent[] {
  const out: SimEvent[] = [];
  const state: LeadState = { sentCount: 0 };
  const fired = new Set<string>();
  const happen = (d: number, key: string, text: string, apply: () => void) => {
    if (fired.has(key)) return; fired.add(key); apply(); out.push({ day: d, kind: 'event', text });
  };

  for (let d = 0; d <= maxDays; d++) {
    const now = d * DAY;
    if (scenario === 'opens' && d >= 1 && state.sentCount >= 1) happen(d, 'open', 'They open the first email', () => { state.openedAt = now; });
    if (scenario === 'clicks' && d >= 1 && state.sentCount >= 1) happen(d, 'click', 'They open the email and click a link', () => { state.openedAt = now; state.clickedAt = now; });
    if (d >= 2 && state.sentCount >= 1) {
      if (scenario === 'interested') happen(d, 'reply', 'They reply: "Yes, tell me more"', () => { state.repliedAt = now; state.replyKind = 'interested'; });
      if (scenario === 'not_interested') happen(d, 'reply', 'They reply: "Not for us, thanks"', () => { state.repliedAt = now; state.replyKind = 'not_interested'; });
      if (scenario === 'unsubscribe') happen(d, 'unsub', 'They click Unsubscribe', () => { state.unsubscribedAt = now; });
    }
    if (d >= 1 && state.sentCount >= 1 && scenario === 'out_of_office') happen(d, 'ooo', 'An out-of-office auto-reply arrives', () => { state.repliedAt = now; state.replyKind = 'out_of_office'; });

    const act = nextAction(a, state, now);
    if (act.type === 'send') {
      state.sentCount = act.index + 1; state.lastSentAt = now;
      const copy = stepCopy(a.emails[act.index], !!state.openedAt);
      out.push({ day: d, kind: 'send', text: `Email ${act.index + 1} is ${a.sendMode === 'review' ? 'ready for you to send' : 'sent'}${copy.variant ? ' (the version for people who opened)' : ''}: "${copy.subject}"` });
    } else if (act.type === 'stop') {
      out.push({ day: d, kind: 'stop', text: act.reason }); return out;
    } else if (act.type === 'done') {
      out.push({ day: d, kind: 'done', text: 'The sequence is finished.' }); return out;
    }
  }
  out.push({ day: maxDays, kind: 'done', text: 'Nothing more is due.' });
  return out;
}

// ── Mapping to the campaign engine ───────────────────────────────────────────

export interface EngineFields {
  subject: string; body: string; followUpSubject: string | null; followUpBody: string | null;
  followUpAfterDays: number; maxFollowUps: number; dailyCap: number;
}

/** The days to wait before each follow-up (from the previous email), in order. */
export const followUpWaits = (a: Automation): number[] => a.emails.slice(1, 1 + ENGINE_MAX_FOLLOW_UPS).map((e) => e.waitDays);

/** The campaign fields for the engine: the introduction, the first follow-up (the fallback wording) and how many follow-ups. */
export function toCampaignFields(a: Automation): EngineFields {
  const follow = a.emails.slice(1, 1 + ENGINE_MAX_FOLLOW_UPS);
  return {
    subject: a.emails[0].subject, body: a.emails[0].body,
    followUpSubject: follow[0]?.subject ?? null, followUpBody: follow[0]?.body ?? null,
    followUpAfterDays: follow[0]?.waitDays ?? 3, maxFollowUps: follow.length, dailyCap: a.dailyCap,
  };
}

export interface EngineNote { level: 'ok' | 'limit' | 'planned'; text: string }

/** Day numbers for the sequence as people read them: the introduction is Day 1. */
export function dayNumbers(a: Automation): number[] {
  let day = 1;
  return a.emails.map((e, i) => { if (i > 0) day += e.waitDays; return day; });
}

/** An honest list of what the campaign engine does for this automation, and what it does not do yet. */
export function engineSupport(a: Automation): EngineNote[] {
  const notes: EngineNote[] = [];
  notes.push({ level: 'ok', text: `Each of the ${a.emails.length} emails goes out with its own wording, on ${dayNumbers(a).map((d) => `Day ${d}`).join(', ')}.` });
  notes.push({ level: 'ok', text: 'Follow-ups stop the moment someone replies, opts out, bounces, books a meeting or is marked as a proposal or customer. An out-of-office reply only pauses them.' });
  notes.push({ level: 'ok', text: 'Every email carries an unsubscribe link, and anyone who has unsubscribed from any of your campaigns is never emailed again.' });
  const variants = a.emails.filter((e) => e.openedVariant).length;
  if (variants) notes.push({ level: 'ok', text: `${variants} follow-up${variants === 1 ? ' has' : 's have'} a second version that goes to people who opened but did not reply.` });
  if (a.playbook?.some((p) => p.response.trim())) notes.push({ level: 'ok', text: 'Each reply is sorted (interested, question, meeting, objection, no, out-of-office, unsubscribe) and the playbook answer for that kind is drafted in your Inbox for you to send.' });
  if (a.emails.length - 1 > ENGINE_MAX_FOLLOW_UPS) notes.push({ level: 'limit', text: `The engine sends the introduction and up to ${ENGINE_MAX_FOLLOW_UPS} follow-ups.` });
  notes.push({ level: 'ok', text: 'Replies are read from your mailbox when you check your inbox (it uses the same login as your outgoing mail). Only messages from your campaign contacts are looked at.' });
  notes.push({ level: 'planned', text: 'Follow-ups wait for your click on the campaign page. Fully automatic sending is switched off until reply detection runs on its own and the legal review is done.' });
  if (a.windowStart !== 9 || a.windowEnd !== 17 || !a.weekdaysOnly) notes.push({ level: 'planned', text: 'Sending windows and weekday rules are saved but not enforced yet.' });
  notes.push({ level: 'planned', text: 'Email is the only channel that sends today. WhatsApp needs a connected WhatsApp Business account and each contact\'s permission, and is not switched on.' });
  return notes;
}

// ── Rule-based planner (works offline, and is the fallback when the AI is unavailable) ──

const OFFERS: Array<{ re: RegExp; name: string; pitch: string; benefit: string }> = [
  { re: /\bchat ?bot|\bai\b|automation|assistant|receptionist/i, name: 'AI automation', pitch: 'an AI assistant that answers enquiries and follows up for you', benefit: 'reply to every customer instantly, day or night' },
  { re: /\bapp\b|mobile/i, name: 'mobile app', pitch: 'a simple app for your customers', benefit: 'keep customers coming back and make booking effortless' },
  { re: /\bseo\b|marketing|google|social/i, name: 'local marketing', pitch: 'a local search and social plan', benefit: 'show up when nearby customers search for you' },
  { re: /software|system|dashboard|pos\b/i, name: 'custom software', pitch: 'software built around how you work', benefit: 'cut manual work and see your numbers in one place' },
  { re: /web|site|landing|design/i, name: 'website', pitch: 'a modern, fast website', benefit: 'attract more customers and turn visitors into enquiries' },
];
const DEFAULT_OFFER = { re: /./, name: 'service', pitch: 'what we do could help you win more customers', benefit: 'reach more of the right customers without extra effort' };

export interface PlanOptions { tone: 'friendly' | 'formal' | 'direct' }

function detectTone(p: string): PlanOptions['tone'] {
  if (/formal|professional|polite/i.test(p)) return 'formal';
  if (/direct|short|concise|brief/i.test(p)) return 'direct';
  return 'friendly';
}

const word = (n: number) => ({ 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five' } as Record<number, string>)[n] ?? String(n);

/**
 * Reads a plain-English request ("3 emails to dental clinics, follow up after 4 days, stop when they reply,
 * 20 a day") and builds a complete automation from it. Anything it cannot read gets a sensible default.
 */
export function ruleBasedPlan(prompt: string): Automation {
  const p = prompt.trim();
  const countM = p.match(/(\d)\s*[- ]?\s*(?:emails?|touch(?:es)?|steps?|messages?)/i) ?? p.match(/\b(one|two|three|four|five)\s+(?:emails?|touch(?:es)?|steps?|messages?)/i);
  const wordNums: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
  const count = clamp(countM ? (wordNums[countM[1].toLowerCase()] ?? Number(countM[1])) : 3, 1, MAX_EMAILS, 3);
  const gapM = p.match(/(?:after|every|wait(?:ing)?|gap of)\s*(\d{1,2})\s*days?/i) ?? p.match(/(\d{1,2})\s*days?\s*(?:apart|between|later|gap)/i);
  const gap = clamp(gapM ? Number(gapM[1]) : 3, 1, MAX_WAIT_DAYS, 3);
  const capM = p.match(/(\d{1,3})\s*(?:emails?\s*)?(?:a|per|\/)\s*day/i) ?? p.match(/(?:limit|cap)\s*(?:of)?\s*(\d{1,3})/i);
  const cap = clamp(capM ? Number(capM[1]) : 30, 1, HARD_DAILY_MAX, 30);
  const offer = OFFERS.find((o) => o.re.test(p)) ?? DEFAULT_OFFER;
  const tone = detectTone(p);
  const onlyOpened = /only (?:if|to those who|to people who) (?:they )?opened|if (?:they )?opened/i.test(p);
  const notOpened = /(?:did ?n[o']t|not|haven'?t) open/i.test(p);
  const sendIf: SendIf = onlyOpened ? 'opened' : notOpened ? 'not_opened' : 'no_reply';
  const stopReply = !/(?:don'?t|do not|keep going|continue) (?:stop )?(?:when|if|after) (?:they )?repl/i.test(p);
  const hi = tone === 'formal' ? 'Dear {{name}},' : tone === 'direct' ? '{{name}},' : 'Hi {{name}},';
  const bye = tone === 'formal' ? 'Kind regards,' : tone === 'direct' ? 'Thanks,' : 'Best regards,';
  const ask = /meeting|call|book|demo/i.test(p) ? 'Would you be open to a 15-minute call this week?' : 'Could I send you a quick example for {{business}}?';

  const first: AutoEmail = {
    subject: offer === DEFAULT_OFFER ? 'An idea for {{business}}' : `${offer.name.charAt(0).toUpperCase()}${offer.name.slice(1)} idea for {{business}}`,
    body: `${hi}\n\nI came across {{business}} and thought ${offer.pitch} could help you ${offer.benefit}.\n\n${ask}\n\n${bye}`,
    waitDays: 0, sendIf: 'no_reply',
  };
  const follow2: AutoEmail = {
    subject: 'Re: {{subject}}', waitDays: gap, sendIf,
    body: `${hi}\n\nJust floating this back up in case it got buried. Happy to send a short example for {{business}} if that would help.\n\n${bye}`,
  };
  const follow3: AutoEmail = {
    subject: 'One more idea for {{business}}', waitDays: gap, sendIf,
    body: `${hi}\n\nOne more thought: businesses that act on this early usually see the biggest difference. If it is not a priority right now, no problem at all.\n\n${bye}`,
  };
  const last: AutoEmail = {
    subject: 'Last note about {{business}}', waitDays: gap, sendIf: 'no_reply',
    body: `${hi}\n\nI will keep this short since this is my last note. If improving {{business}} is not a priority, no worries. If it is, just reply and I will send a quick idea.\n\n${bye}`,
  };
  const pool = [follow2, follow3, { ...follow3, subject: 'Still relevant for {{business}}?' }, last];
  const emails = [first, ...pool.slice(0, count - 1)];
  if (count > 1) emails[emails.length - 1] = { ...last, waitDays: gap, sendIf: emails[emails.length - 1].sendIf };

  return sanitizeAutomation({
    name: `${offer === DEFAULT_OFFER ? 'Customer' : offer.name.charAt(0).toUpperCase() + offer.name.slice(1)} outreach (${word(count)} email${count === 1 ? '' : 's'})`,
    emails, stopOnReply: stopReply, replyRules: DEFAULT_REPLY_RULES, sendMode: 'review', dailyCap: cap, windowStart: 9, windowEnd: 17, weekdaysOnly: true,
  }) as Automation;
}

export interface Revision { automation: Automation; changes: string[] }

/**
 * Applies a plain-English edit ("add a follow-up", "wait 5 days", "20 a day", "make it formal", "stop when they reply")
 * to the current automation without touching what was not mentioned. `changes` says what was done; it is empty when
 * nothing in the request could be read.
 */
export function ruleBasedRevise(current: Automation, prompt: string): Revision {
  const p = prompt.toLowerCase();
  const next: Automation = JSON.parse(JSON.stringify(current));
  const changes: string[] = [];
  const gap = next.emails[1]?.waitDays ?? 3;
  const rebuild = (n: number, extra = '') => ruleBasedPlan(`${n} emails, after ${gap} days, ${next.dailyCap} a day ${extra}`);

  const tone = /formal|professional|polite/.test(p) ? 'formal' : /direct|shorter|short|concise|brief/.test(p) ? 'direct' : /friendly|casual|warm/.test(p) ? 'friendly' : null;
  if (tone) {
    const fresh = rebuild(next.emails.length, tone);
    next.emails = fresh.emails.map((e, i) => ({ ...e, waitDays: next.emails[i]?.waitDays ?? e.waitDays, sendIf: next.emails[i]?.sendIf ?? e.sendIf }));
    changes.push(`Rewrote the emails in a ${tone} tone.`);
  }

  const countM = p.match(/(?:make it|to|have|use|want)\s*(\d|one|two|three|four|five)\s*(?:emails?|touch(?:es)?|steps?)/) ?? p.match(/\b(\d|one|two|three|four|five)\s*(?:emails?|touch(?:es)?)\b/);
  const nums: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
  if (countM && !/^add\b/.test(p.trim())) {
    const n = clamp(nums[countM[1]] ?? Number(countM[1]), 1, MAX_EMAILS, next.emails.length);
    if (n !== next.emails.length) {
      if (n < next.emails.length) { next.emails = next.emails.slice(0, n); changes.push(`Cut the sequence to ${n} email${n === 1 ? '' : 's'}.`); }
      else { const more = rebuild(n).emails.slice(next.emails.length); next.emails = [...next.emails, ...more]; changes.push(`Extended the sequence to ${n} emails.`); }
    }
  } else if (/\badd\b.*\b(email|follow-?up|touch|step)/.test(p) && next.emails.length < MAX_EMAILS) {
    const more = rebuild(next.emails.length + 1).emails[next.emails.length];
    next.emails.push(more); changes.push(`Added email ${next.emails.length}.`);
  } else if (/(remove|delete|drop)\b.*\blast\b|(one )?(fewer|less) email/.test(p) && next.emails.length > 1) {
    next.emails.pop(); changes.push(`Removed the last email.`);
  }

  const waitM = p.match(/(?:wait|after|every|gap of|delay)\s*(?:of\s*)?(\d{1,2})\s*days?/);
  if (waitM && next.emails.length > 1) {
    const d = clamp(Number(waitM[1]), 1, MAX_WAIT_DAYS, 3);
    next.emails = next.emails.map((e, i) => (i === 0 ? e : { ...e, waitDays: d }));
    changes.push(`Follow-ups now wait ${d} day${d === 1 ? '' : 's'}.`);
  }
  const capM = p.match(/(\d{1,3})\s*(?:emails?\s*)?(?:a|per|\/)\s*day/) ?? p.match(/(?:limit|cap)\s*(?:of|to)?\s*(\d{1,3})/);
  if (capM) { next.dailyCap = clamp(Number(capM[1]), 1, HARD_DAILY_MAX, next.dailyCap); changes.push(`Daily limit is now ${next.dailyCap}.`); }

  if (/(don'?t|do not|no longer|never) stop.*repl|keep (going|sending).*repl/.test(p)) { next.stopOnReply = false; changes.push('Replies no longer stop the sequence (unsubscribes still do).'); }
  else if (/stop (when|if|on|after).*repl/.test(p)) { next.stopOnReply = true; changes.push('The sequence stops when someone replies.'); }

  if (/only (?:if|to (?:those|people) who) (?:they )?opened|if (?:they )?opened/.test(p)) { next.emails = next.emails.map((e, i) => (i ? { ...e, sendIf: 'opened' as SendIf } : e)); changes.push('Follow-ups go only to people who opened.'); }
  else if (/(didn'?t|did not|haven'?t|not) open/.test(p)) { next.emails = next.emails.map((e, i) => (i ? { ...e, sendIf: 'not_opened' as SendIf } : e)); changes.push('Follow-ups go to people who have not opened.'); }
  else if (/(clicked|click)/.test(p)) { next.emails = next.emails.map((e, i) => (i ? { ...e, sendIf: 'clicked' as SendIf } : e)); changes.push('Follow-ups go to people who clicked.'); }

  const safe = sanitizeAutomation({ ...next, sendMode: 'review' });
  return { automation: safe ?? current, changes: safe ? changes : [] };
}

/** The one-click setup: a sensible 3-email sequence with default rules. */
export const quickSetup = (): Automation => ruleBasedPlan('Introduce my service to new prospects with 3 emails, follow up after 3 days, stop when they reply');

export function emptyEmail(index: number): AutoEmail {
  return index === 0
    ? { subject: 'A quick idea for {{business}}', body: 'Hi {{name}},\n\n\n\nBest regards,', waitDays: 0, sendIf: 'no_reply' }
    : { subject: 'Re: {{subject}}', body: 'Hi {{name}},\n\nJust following up on my last email.\n\nBest regards,', waitDays: 3, sendIf: 'no_reply' };
}

/** A few plain sentences describing what the automation will do, for the assistant's reply. */
export function summarize(a: Automation): string[] {
  const lines: string[] = [];
  lines.push(`${a.emails.length} email${a.emails.length === 1 ? '' : 's'}: an introduction${a.emails.length > 1 ? ` and ${a.emails.length - 1} follow-up${a.emails.length > 2 ? 's' : ''}` : ''}.`);
  if (a.emails.length > 1) lines.push(`Follow-ups ${a.emails.slice(1).map((e) => `after ${e.waitDays} day${e.waitDays === 1 ? '' : 's'}`).join(', then ')}, to people who ${SEND_IF_LABEL[a.emails[1].sendIf].toLowerCase().replace('they have', 'have').replace('they opened', 'opened').replace('they clicked', 'clicked')}.`);
  lines.push(a.stopOnReply ? 'The sequence stops as soon as someone replies; unsubscribes and bounces always stop it.' : 'Replies do not stop the sequence (unsubscribes and bounces still do).');
  lines.push(`Up to ${a.dailyCap} a day, ${a.windowStart}:00 to ${a.windowEnd}:00${a.weekdaysOnly ? ', weekdays only' : ''}. Follow-ups wait for your click.`);
  return lines;
}

/** Reads the automation previously saved on a campaign, or null. */
export const readSavedAutomation = (raw: unknown): Automation | null => sanitizeAutomation(raw);


/** The follow-up rule for a saved campaign: its own per-email waits when it has a sequence, else the single wait. */
export function followRule(c: { followUpAfterDays: number; maxFollowUps: number; automation?: unknown }): { followUpAfterDays: number; maxFollowUps: number; waits?: number[] } {
  const seq = c.automation ? sanitizeAutomation(c.automation) : null;
  if (!seq) return { followUpAfterDays: c.followUpAfterDays, maxFollowUps: c.maxFollowUps };
  const waits = followUpWaits(seq);
  return { followUpAfterDays: c.followUpAfterDays, maxFollowUps: Math.min(c.maxFollowUps, waits.length), waits };
}
