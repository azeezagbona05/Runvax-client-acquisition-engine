/**
 * "Ready to send?" for a campaign: the things that stop an email campaign from working, or send it to spam, found BEFORE the first
 * email goes out. Pure (the caller supplies the mailbox, DNS and lead facts), so every rule is testable.
 *   block = sending would fail or embarrass the sender; warn = it will probably hurt results; ok = checked and fine; info = worth knowing.
 */
import { hasPlaceholder } from '@/lib/outreachCampaign';

export interface PreflightInput {
  mailbox: { connected: boolean; fromAddress?: string; senderNamed: boolean };
  /** SPF / DMARC lookups for the sending domain. null = not looked up; a field is null when the lookup itself failed. */
  dns: { spf: boolean | null; dmarc: boolean | null } | null;
  subject: string;
  /** The first email and every follow-up. */
  bodies: string[];
  dailyCap: number;
  status: string;
  followUps: number;
  autoFollowUps: boolean;
  leads: { queued: number; total: number; noName: number; roleAddress: number };
  hasOfferLink: boolean;
}

export interface Check { id: string; level: 'block' | 'warn' | 'ok' | 'info'; title: string; detail?: string }
export interface Preflight { ready: boolean; checks: Check[] }

const FREEMAIL = /@(gmail|googlemail|yahoo|ymail|outlook|hotmail|live|icloud|aol|proton|protonmail)\./i;
/** Words and shapes that mail filters weigh heavily. Matching one is not fatal; piling them up is. */
const SPAMMY = /\b(free|100% ?free|guarantee[d]?|act now|limited time|urgent|winner|cash|risk[- ]?free|click here|buy now|order now|earn money|save big|% off|cheap|congratulations)\b/gi;
const URL_RE = /https?:\/\/\S+|www\.\S+/gi;

const uniq = (a: string[]) => Array.from(new Set(a.map((x) => x.toLowerCase())));

export function preflight(i: PreflightInput): Preflight {
  const c: Check[] = [];
  const all = [i.subject, ...i.bodies].join('\n');

  // Blockers
  if (!i.mailbox.connected) c.push({ id: 'mailbox', level: 'block', title: 'Connect your email', detail: 'Campaigns send from your own mailbox so replies reach you. Add it in Integrations or Settings → Email.' });
  else c.push({ id: 'mailbox', level: 'ok', title: `Sending from ${i.mailbox.fromAddress ?? 'your mailbox'}` });
  if (i.mailbox.connected && !i.mailbox.senderNamed) c.push({ id: 'sender', level: 'block', title: 'Add your name or business name', detail: 'Every email is signed with it. Set it in Settings → Profile.' });
  if (i.leads.queued === 0 && i.status !== 'completed') c.push({ id: 'leads', level: 'block', title: 'Nobody is waiting to be emailed', detail: 'Add leads first.' });
  else if (i.leads.queued > 0) c.push({ id: 'leads', level: 'ok', title: `${i.leads.queued} lead${i.leads.queued === 1 ? '' : 's'} waiting` });
  if (hasPlaceholder(all)) c.push({ id: 'placeholder', level: 'block', title: 'An email still has a fill-in-the-blank like [Your Name]', detail: 'Edit the campaign and replace it. Your real signature is added automatically.' });

  // Deliverability
  const domain = i.mailbox.fromAddress?.split('@')[1]?.toLowerCase();
  if (i.mailbox.connected && i.mailbox.fromAddress) {
    if (FREEMAIL.test(i.mailbox.fromAddress)) {
      c.push({ id: 'freemail', level: i.dailyCap > 40 ? 'warn' : 'info', title: 'You are sending from a free mailbox', detail: `Free mailboxes have strict daily limits and are filtered harder than a business domain. ${i.dailyCap > 40 ? `Lower the daily limit to 30–40 (it is ${i.dailyCap}) and ` : ''}Consider a business email on your own domain for a larger campaign.` });
    } else if (i.dns) {
      if (i.dns.spf === false) c.push({ id: 'spf', level: 'warn', title: `No SPF record found for ${domain}`, detail: 'Without it, many inboxes send your email to spam. Ask your mail or domain provider to add the SPF record they give you.' });
      else if (i.dns.spf === true) c.push({ id: 'spf', level: 'ok', title: `SPF found for ${domain}` });
      if (i.dns.dmarc === false) c.push({ id: 'dmarc', level: 'warn', title: `No DMARC record found for ${domain}`, detail: 'Gmail and Yahoo expect one from anyone sending in volume. A basic "p=none" record is enough to start.' });
      else if (i.dns.dmarc === true) c.push({ id: 'dmarc', level: 'ok', title: `DMARC found for ${domain}` });
      if (i.dns.spf === null || i.dns.dmarc === null) c.push({ id: 'dns', level: 'info', title: 'Could not check the domain records right now', detail: 'Try again in a moment.' });
      c.push({ id: 'dkim', level: 'info', title: 'DKIM cannot be checked from here', detail: 'Confirm in your mail provider that DKIM signing is switched on for your domain.' });
    }
    if (!FREEMAIL.test(i.mailbox.fromAddress) && i.dailyCap > 100) c.push({ id: 'cap', level: 'warn', title: `${i.dailyCap} emails a day is a lot for a mailbox with no sending history`, detail: 'Start around 30–50 a day for the first week and raise it slowly. A sudden jump is what gets domains flagged.' });
  }

  // Wording
  const subjectHits = uniq(Array.from(i.subject.matchAll(SPAMMY), (m) => m[0]));
  const bodyHits = uniq(Array.from(i.bodies.join('\n').matchAll(SPAMMY), (m) => m[0]));
  if (subjectHits.length) c.push({ id: 'subject-spam', level: 'warn', title: `The subject uses spam-trigger wording: ${subjectHits.slice(0, 4).join(', ')}`, detail: 'Subjects are weighed hardest. Say what it is for this business instead, and keep the offer details for the body.' });
  if (bodyHits.length >= 3) c.push({ id: 'body-spam', level: 'warn', title: `The emails use several spam-trigger words: ${bodyHits.slice(0, 5).join(', ')}`, detail: 'One or two are fine in a sales email. Several together raise the chance of the spam folder.' });
  if (i.subject.length > 60) c.push({ id: 'subject-len', level: 'warn', title: `The subject is ${i.subject.length} characters`, detail: 'Phones cut it off at around 40–60. Shorter gets read.' });
  if (/[A-Z]{5,}/.test(i.subject.replace(/\{\{.*?\}\}/g, '')) || /!{2,}/.test(all)) c.push({ id: 'shouting', level: 'warn', title: 'ALL CAPS or repeated "!!" found', detail: 'Both look like spam to filters and to people.' });
  const links = (all.match(URL_RE) ?? []).length;
  if (links > 2) c.push({ id: 'links', level: 'warn', title: `${links} links in the emails`, detail: 'Use one link at most per email. More looks like spam.' });
  if (i.hasOfferLink) c.push({ id: 'offer', level: 'ok', title: 'The emails send people to your offer page (clicks are counted)' });

  // The list
  if (i.leads.total > 0 && i.leads.noName / i.leads.total > 0.3) c.push({ id: 'names', level: 'info', title: `${i.leads.noName} of ${i.leads.total} leads have no contact name`, detail: 'Their greeting will read "Hello there". Fine, but a named person replies more often.' });
  if (i.leads.total > 0 && i.leads.roleAddress / i.leads.total > 0.5) c.push({ id: 'role', level: 'info', title: 'Most addresses are shared inboxes (info@, contact@)', detail: 'Expect lower reply rates than named people. Replies still come back to you.' });

  // Follow-ups
  if (i.followUps > 0) c.push({ id: 'followups', level: 'info', title: i.autoFollowUps ? `${i.followUps} follow-up${i.followUps === 1 ? '' : 's'} will send automatically in your window` : `${i.followUps} follow-up${i.followUps === 1 ? '' : 's'} wait for your click`, detail: i.autoFollowUps ? undefined : 'Switch on Automatic follow-ups on this page if you want them sent for you.' });
  c.push({ id: 'unsub', level: 'ok', title: 'Every email has an unsubscribe link, and opted-out or bounced addresses are never emailed' });
  c.push({ id: 'test', level: 'info', title: 'Send yourself a test first', detail: 'Use "Send me a test" and read it on your phone before you press Run.' });

  const order = { block: 0, warn: 1, info: 2, ok: 3 } as const;
  c.sort((a, b) => order[a.level] - order[b.level]);
  return { ready: !c.some((x) => x.level === 'block'), checks: c };
}

/** True for info@, contact@, sales@ and similar. */
export const isRoleAddress = (email: string) => /^(info|contact|contacts|hello|admin|office|support|sales|enquir(y|ies)|inquir(y|ies)|mail|reception|booking|bookings|team|help|service|services|accounts?|marketing)@/i.test(email);
