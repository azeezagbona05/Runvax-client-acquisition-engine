/**
 * Reads ONE employer email the candidate pasted and proposes what it means. Rules only: no AI, so it can be tested and never invents.
 * It proposes; the candidate confirms before anything is saved, and the email body itself is never stored.
 */
export const RESPONSE_KINDS = ['acknowledged', 'interview', 'info_request', 'rejected', 'offer', 'other', 'followed_up'] as const;
export type ResponseKind = typeof RESPONSE_KINDS[number];
export const KIND_LABEL: Record<ResponseKind, string> = { acknowledged: 'Application received', interview: 'Interview invitation', info_request: 'They asked for something', rejected: 'Rejection', offer: 'Job offer', other: 'Other reply', followed_up: 'You followed up' };
/** Replies FROM an employer (a follow-up is the candidate's own action, so it is not a response). */
export const EMPLOYER_KINDS: ResponseKind[] = ['acknowledged', 'interview', 'info_request', 'rejected', 'offer', 'other'];

const OFFER = /\b(?:pleased|delighted|happy|excited) to (?:offer|extend)|offer of employment|formal offer|job offer|offer letter|we(?:'d| would) like to offer you/i;
const REJECT = /\b(?:unfortunately|regret to inform|sorry to (?:inform|tell)|not (?:be )?(?:moving|going|proceeding) forward|will not be (?:moving|proceeding|taking)|decided (?:not )?to (?:move forward|proceed) with (?:other|another)|other candidates|not (?:been )?selected|unsuccessful|position has been filled|no longer (?:considering|being considered))\b/i;
const INTERVIEW = /\b(?:invite you to (?:an? |a )?(?:\w+ )?(?:interview|call|chat|screen)|would like to (?:invite|arrange|schedule|set up|speak|talk|meet)|schedule (?:an?|your|the) (?:\w+ )?(?:interview|call|chat|screen)|interview (?:is |has been )?(?:scheduled|confirmed|booked)|book a (?:time|slot)|select a (?:time|slot)|phone screen|video (?:call|interview)|next (?:step|stage) (?:is|will be) (?:an? )?(?:interview|call))\b/i;
const INFO = /\b(?:please (?:provide|send|complete|submit|fill|take|answer)|could you (?:please )?(?:provide|send|share|complete)|complete (?:the|our|this) (?:following|assessment|test|questionnaire|form)|assessment|coding (?:test|challenge)|take-?home|additional (?:information|documents)|references?)\b/i;
const ACK = /\b(?:thank(?:s| you) for (?:applying|your (?:application|interest)|submitting)|(?:we(?:'ve| have) )?received your application|application (?:has been )?(?:received|submitted)|your application (?:to|for|with))\b/i;

/** Sentences that are only "if you are shortlisted we will invite you" are not an invitation. */
const stripConditional = (t: string) => t.split(/(?<=[.!?])\s+|\n+/).filter((s) => !/^\s*(?:if|should|in the event|when)\b/i.test(s) && !/\bif (?:your|you)\b.*\b(?:match|shortlist|selected|suitable)/i.test(s)).join('\n');

export interface Analysis { kind: ResponseKind; subject: string; summary: string; interviewDates: string[]; interviewKind: 'phone' | 'video' | 'onsite' | 'other'; links: string[] }

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const pad = (n: number) => String(n).padStart(2, '0');
function timeIn(s: string): string | null {
  const m = s.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b/i) ?? s.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (!m) return null;
  let h = Number(m[1]); const min = m[2] ? Number(m[2]) : 0; const ap = (m[3] ?? '').toLowerCase().replace(/\./g, '');
  if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0;
  return h > 23 ? null : `${pad(h)}:${pad(min)}`;
}
/** Wall-clock suggestions ("YYYY-MM-DDTHH:mm", no timezone) to pre-fill a date box. The candidate confirms the time, so the zone is never guessed. */
export function suggestDates(text: string, now: Date): string[] {
  const out: string[] = []; const push = (y: number, mo: number, d: number, around: string) => {
    const dt = new Date(Date.UTC(y, mo, d)); if (dt.getUTCMonth() !== mo) return;
    const t = timeIn(around) ?? '09:00'; const v = `${y}-${pad(mo + 1)}-${pad(d)}T${t}`; if (!out.includes(v)) out.push(v);
  };
  const near = (i: number, len: number) => text.slice(i, i + len + 40);
  let m: RegExpExecArray | null;
  const iso = /\b(20\d{2})-(\d{2})-(\d{2})\b/g; while ((m = iso.exec(text))) push(+m[1], +m[2] - 1, +m[3], near(m.index, m[0].length));
  const dmy = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS.join('|')})[a-z]*\\.?,?(?:\\s+(20\\d{2}))?`, 'gi');
  while ((m = dmy.exec(text))) push(m[3] ? +m[3] : inferYear(MONTHS.indexOf(m[2].toLowerCase().slice(0, 3)), +m[1], now), MONTHS.indexOf(m[2].toLowerCase().slice(0, 3)), +m[1], near(m.index, m[0].length));
  const mdy = new RegExp(`\\b(${MONTHS.join('|')})[a-z]*\\.?\\s+(\\d{1,2})(?!\\d)(?:st|nd|rd|th)?,?(?:\\s+(20\\d{2}))?`, 'gi');
  while ((m = mdy.exec(text))) push(m[3] ? +m[3] : inferYear(MONTHS.indexOf(m[1].toLowerCase().slice(0, 3)), +m[2], now), MONTHS.indexOf(m[1].toLowerCase().slice(0, 3)), +m[2], near(m.index, m[0].length));
  return out.filter((v) => new Date(v + 'Z').getTime() > now.getTime() - 86_400_000).slice(0, 4);
}
/** A date with no year means the next time it occurs. */
function inferYear(mo: number, d: number, now: Date): number { const y = now.getUTCFullYear(); return Date.UTC(y, mo, d, 23, 59) < now.getTime() ? y + 1 : y; }

export function analyseEmail(raw: string, now = new Date()): Analysis {
  const text = raw.replace(/\r/g, '').trim().slice(0, 12_000);
  const subj = text.match(/^\s*subject:\s*(.+)$/im)?.[1]?.trim().slice(0, 200) ?? '';
  const body = text.replace(/^\s*(?:from|to|cc|date|subject):.*$/gim, '');
  const live = stripConditional(body);
  const kind: ResponseKind = OFFER.test(live) ? 'offer' : REJECT.test(live) ? 'rejected' : INTERVIEW.test(live) ? 'interview' : INFO.test(live) ? 'info_request' : ACK.test(body) ? 'acknowledged' : 'other';

  const trigger = { offer: OFFER, rejected: REJECT, interview: INTERVIEW, info_request: INFO, acknowledged: ACK, other: null, followed_up: null }[kind];
  const sentences = live.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const hit = trigger ? sentences.find((s) => trigger.test(s)) : sentences.find((s) => s.length > 30);
  const summary = `${KIND_LABEL[kind]}${hit ? `: "${hit.slice(0, 260)}"` : ''}`.slice(0, 600);
  const interviewKind = /\b(?:zoom|teams|google meet|meet\.google|video)\b/i.test(body) ? 'video' : /\b(?:phone|call you|telephone)\b/i.test(body) ? 'phone' : /\b(?:on-?site|in person|our office|at our)\b/i.test(body) ? 'onsite' : 'other';
  const links = (body.match(/https?:\/\/[^\s<>")]+/g) ?? []).filter((u) => /zoom|teams|meet\.google|calendly|cal\.com|whereby|webex/i.test(u)).slice(0, 2);
  return { kind, subject: subj, summary, interviewDates: kind === 'interview' ? suggestDates(body, now) : [], interviewKind, links };
}

/** Which of the candidate's applications does this email most likely belong to? Company name in the text, then job title words. */
export function matchApplications<T extends { id: string; company: string; title: string }>(raw: string, apps: T[]): T[] {
  const t = raw.toLowerCase(); const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  return apps.map((a) => { const c = norm(a.company); let s = 0; if (c && ` ${norm(raw)} `.includes(` ${c} `)) s += 10; const tw = norm(a.title).split(' ').filter((w) => w.length > 3); s += tw.filter((w) => t.includes(w)).length; return { a, s }; }).filter((x) => x.s >= 4).sort((x, y) => y.s - x.s).map((x) => x.a);
}
