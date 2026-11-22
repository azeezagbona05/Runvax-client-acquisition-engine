/**
 * Reads delivery-failure messages ("bounces") that mail servers send back to the sender's inbox after a message was
 * accepted and later refused. Pure (no network, no database) so the rules are testable.
 *
 * Only a HARD bounce (the address does not exist, the domain is dead, the mailbox was refused for good) stops anyone from being
 * emailed again. A soft one (mailbox full, server busy, delayed) is left alone: it may well work next time.
 * A recipient is only ever accepted when it is one of the sender's own contacts, so a stray address in a bounce
 * message can never mark an unrelated person.
 */

export interface BounceInput {
  /** Address the message came from. */
  from: string;
  subject: string;
  /** Plain text body. */
  text: string;
  /** Content of the message/delivery-status part, when the server sent a standard one. */
  dsn?: string;
  /** The X-Failed-Recipients header, when present. */
  failedHeader?: string;
}

export interface Bounce { recipients: string[]; hard: boolean; reason: string }

const SENDER_RE = /^(mailer-daemon|postmaster|mail delivery (sub)?system)/i;
const SUBJECT_RE = /(undeliver|delivery (status|failure|has failed|incomplete)|failure notice|returned mail|mail delivery failed|could not be delivered|not delivered|delivery problem)/i;

/** Cheap check on the envelope alone, so only likely bounces are downloaded. */
export function looksLikeBounce(from: string | undefined, subject: string | undefined): boolean {
  const local = (from ?? '').split('@')[0].trim();
  return SENDER_RE.test(local) || SUBJECT_RE.test(subject ?? '');
}

const EMAIL = /[A-Z0-9._%+'-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const HARD_TEXT = /\b(550|551|552|553|554)\b|user unknown|unknown user|no such user|does not exist|doesn'?t exist|address (not found|rejected)|couldn'?t be found|mailbox (unavailable|not found|does not exist)|invalid (recipient|address)|recipient (rejected|address rejected|not found)|no mx|domain (not found|does not exist)|account (is )?(disabled|inactive|suspended)|unrouteable|not a valid mailbox/i;
const SOFT_TEXT = /mailbox (is )?full|over quota|quota exceeded|temporar(y|ily)|try again later|deferred|greylist|server busy|connection timed out/i;

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

/** What a bounce says, or null when this is not one (or names nobody we emailed). `known` holds the lower-cased addresses we sent to. */
export function parseBounce(i: BounceInput, known: Set<string>): Bounce | null {
  if (!looksLikeBounce(i.from, i.subject)) return null;
  const dsn = i.dsn ?? '';
  const body = `${i.text}\n${dsn}`;

  const found = new Set<string>();
  const add = (raw: string) => { const e = raw.trim().toLowerCase().replace(/^<|>$/g, ''); if (known.has(e)) found.add(e); };
  for (const m of Array.from(dsn.matchAll(/(?:Final|Original)-Recipient:\s*(?:rfc822;)?\s*([^\s;]+)/gi))) add(m[1]);
  for (const e of (i.failedHeader ?? '').split(/[,;\s]+/)) if (e) add(e);
  // Plain-text bounces: only addresses that are our own contacts count.
  if (!found.size) for (const m of Array.from(body.matchAll(EMAIL))) add(m[0]);
  if (!found.size) return null;

  const status = dsn.match(/Status:\s*([245])\.\d+\.\d+/i)?.[1];
  const action = dsn.match(/Action:\s*(\w+)/i)?.[1]?.toLowerCase();
  let hard: boolean;
  if (status === '5') hard = true;
  else if (status === '4' || action === 'delayed') hard = false;
  else hard = HARD_TEXT.test(body) && !SOFT_TEXT.test(body);

  const diag = dsn.match(/Diagnostic-Code:\s*([^\n]+(?:\n[ \t]+[^\n]+)*)/i)?.[1];
  const reason = oneLine(diag ?? body.split('\n').find((l) => HARD_TEXT.test(l) || SOFT_TEXT.test(l)) ?? 'the address could not be delivered').slice(0, 160);
  return { recipients: Array.from(found), hard, reason };
}
