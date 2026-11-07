/**
 * Editing the campaign sequence from the workflow chart. Pure functions, so the chart, the editor and the tests agree.
 *
 * The engine sends a fixed sequence: the introduction, then up to four follow-ups, each with its own wording, wait and condition.
 * So "drag" means reordering that sequence: the wording of an email moves, and each slot keeps its own timing and condition,
 * which keeps the first email an introduction that goes out straight away.
 */
import { MAX_EMAILS, MAX_WAIT_DAYS, emptyEmail, type AutoEmail, type Automation, type SendIf } from './automation';

/** Which email a chart node belongs to: e0, e2, e2v (opened version), w2 (wait), r2 and o2 (decisions), x2 (stop). */
export function emailIndexOfNode(id: string): number | null {
  const m = /^(?:e|w|r|o|x)(\d+)v?$/.exec(id);
  return m ? Number(m[1]) : null;
}

const clampDays = (n: number) => Math.min(MAX_WAIT_DAYS, Math.max(1, Math.round(Number.isFinite(n) ? n : 1)));

/** The first email is always the introduction: no wait, no condition, no "opened" version. Everything else keeps a sensible wait. */
function normalize(emails: AutoEmail[]): AutoEmail[] {
  return emails.map((e, i) => {
    if (i === 0) { const { openedVariant: _drop, ...rest } = e; void _drop; return { ...rest, waitDays: 0, sendIf: 'no_reply' as SendIf }; }
    return { ...e, waitDays: clampDays(e.waitDays) };
  });
}
const withEmails = (a: Automation, emails: AutoEmail[]): Automation => ({ ...a, emails: normalize(emails) });

export function updateEmail(a: Automation, i: number, patch: Partial<AutoEmail>): Automation {
  if (!a.emails[i]) return a;
  return withEmails(a, a.emails.map((e, k) => (k === i ? { ...e, ...patch } : e)));
}

/** Moves the wording of email `from` to position `to`. Waits and conditions stay with their slots. */
export function moveEmail(a: Automation, from: number, to: number): Automation {
  const n = a.emails.length;
  if (from === to || from < 0 || to < 0 || from >= n || to >= n) return a;
  const content = a.emails.map(({ subject, body, openedVariant }) => ({ subject, body, openedVariant }));
  const [moved] = content.splice(from, 1);
  content.splice(to, 0, moved);
  return withEmails(a, a.emails.map((slot, k) => ({ waitDays: slot.waitDays, sendIf: slot.sendIf, ...content[k] })));
}

/** Adds a follow-up after email `i`, if there is room. */
export function addEmailAfter(a: Automation, i: number): Automation {
  if (a.emails.length >= MAX_EMAILS) return a;
  const at = Math.min(Math.max(i, 0), a.emails.length - 1) + 1;
  const emails = [...a.emails];
  emails.splice(at, 0, emptyEmail(1));
  return withEmails(a, emails);
}

/** Removes email `i`. There is always at least one email. */
export function removeEmail(a: Automation, i: number): Automation {
  if (a.emails.length <= 1 || !a.emails[i]) return a;
  return withEmails(a, a.emails.filter((_, k) => k !== i));
}

export const canAddEmail = (a: Automation) => a.emails.length < MAX_EMAILS;
