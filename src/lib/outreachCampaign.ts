import { normalizePhone } from '@/lib/phone';
/**
 * Email outreach campaigns: the parts that need no database.
 *
 * A campaign is one pitch sent to an uploaded list of leads from the user's own mailbox.
 * This module parses the upload, fills in the template, builds the message (with the
 * unsubscribe link and open pixel), and answers the dashboard's questions: how many were
 * sent, opened, replied, and who needs a follow-up.
 */

import { firstNameOf } from '@/lib/decisionMaker';

export interface LeadInput {
  email: string;
  name?: string;
  business?: string;
  website?: string;
  /** International digits for WhatsApp (no +). Optional. */
  phone?: string;
}

export interface RejectedRow { line: number; raw: string; reason: string }

export const MAX_LEADS_PER_CAMPAIGN = 2000;
/** Whatever a campaign asks for, one account never sends more than this many in a day. */
export const HARD_DAILY_MAX = 200;
export const DEFAULT_DAILY_CAP = 30;
/** Per request: keeps a batch inside the serverless time limit. */
export const MAX_BATCH = 30;

export const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]{2,}$/;

/** Digits-only international number, or '' when it cannot be a WhatsApp number. Local numbers get the default country code. */
export const cleanPhone = (raw: string): string => {
  if (!raw || !raw.trim()) return '';
  const d = normalizePhone(raw);
  return d.length >= 8 && d.length <= 15 ? d : '';
};

export const cleanEmail = (raw: string): string => raw.trim().replace(/^mailto:/i, '').toLowerCase();

// ── CSV ──────────────────────────────────────────────────────────────────────

/** RFC-4180-ish: quoted fields, doubled quotes, newlines inside quotes. */
function splitRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else cell += ch;
  }
  row.push(cell);
  rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim()));
}

function detectDelimiter(firstLine: string): string {
  const counts: Array<[string, number]> = [['\t', 0], [';', 0], [',', 0]];
  for (const c of firstLine) for (const e of counts) if (c === e[0]) e[1]++;
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
}

const HEADERS: Record<keyof LeadInput | 'first' | 'last', RegExp> = {
  email: /^(e-?mail( address)?|mail|email_address)$/i,
  name: /^(full ?name|name|contact( name)?|decision.?maker|person|owner)$/i,
  first: /^(first ?name|first|given ?name)$/i,
  last: /^(last ?name|last|surname|family ?name)$/i,
  business: /^(business( name)?|company( name)?|organi[sz]ation|clinic|practice|firm|employer)$/i,
  website: /^(web ?site|url|domain|site|web)$/i,
  phone: /^(phone( number)?|mobile( number)?|whats ?app( number)?|tel(ephone)?|cell( phone)?)$/i,
};

/**
 * Turns pasted text or an uploaded CSV into leads. Understands a header row (email, name,
 * business/company, website — in any order) or a bare list of addresses. Duplicates inside
 * the file are dropped; every row that can't be used is returned with the reason.
 */
export function parseLeadCsv(text: string): { leads: LeadInput[]; rejected: RejectedRow[]; duplicates: number } {
  const trimmed = text.trim();
  if (!trimmed) return { leads: [], rejected: [], duplicates: 0 };
  const delimiter = detectDelimiter(trimmed.split(/\r?\n/, 1)[0]);
  const rows = splitRows(trimmed, delimiter);

  const header = rows[0].map((c) => c.trim());
  const hasHeader = !header.some((c) => c.includes('@')) && header.some((c) => HEADERS.email.test(c));
  const col: Partial<Record<keyof typeof HEADERS, number>> = {};
  if (hasHeader) {
    header.forEach((h, i) => {
      for (const key of Object.keys(HEADERS) as Array<keyof typeof HEADERS>) {
        if (col[key] === undefined && HEADERS[key].test(h)) col[key] = i;
      }
    });
  }

  const leads: LeadInput[] = [];
  const rejected: RejectedRow[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  rows.slice(hasHeader ? 1 : 0).forEach((cells, idx) => {
    const line = idx + (hasHeader ? 2 : 1);
    const raw = cells.join(delimiter).slice(0, 120);
    const get = (i: number | undefined) => (i === undefined ? '' : (cells[i] ?? '').trim());

    // No header: the first cell that looks like an address is the email; the next text cells are name, business.
    let email: string;
    let name: string;
    let business: string;
    let website: string;
    let phone = '';
    if (hasHeader) {
      email = cleanEmail(get(col.email));
      name = get(col.name) || `${get(col.first)} ${get(col.last)}`.trim();
      business = get(col.business);
      website = get(col.website);
      phone = cleanPhone(get(col.phone));
    } else {
      const at = cells.findIndex((c) => c.includes('@'));
      email = at >= 0 ? cleanEmail(cells[at]) : '';
      const rest = cells.filter((_, i) => i !== at).map((c) => c.trim()).filter(Boolean);
      [name = '', business = '', website = ''] = rest;
    }

    if (!email) { rejected.push({ line, raw, reason: 'No email address' }); return; }
    if (!EMAIL_RE.test(email)) { rejected.push({ line, raw, reason: `"${email.slice(0, 60)}" is not a valid email` }); return; }
    if (seen.has(email)) { duplicates++; return; }
    seen.add(email);
    leads.push({
      email,
      ...(name ? { name: name.slice(0, 120) } : {}),
      ...(business ? { business: business.slice(0, 160) } : {}),
      ...(website ? { website: website.slice(0, 190) } : {}),
      ...(phone ? { phone } : {}),
    });
  });

  return { leads, rejected, duplicates };
}

// ── Templates ────────────────────────────────────────────────────────────────

export const TEMPLATE_TOKENS = ['name', 'fullName', 'business', 'website'] as const;
type Token = (typeof TEMPLATE_TOKENS)[number];

export const DEFAULT_SUBJECT = 'A digital front door for {{business}}';
export const DEFAULT_BODY = `Hi {{name}},

I came across {{business}} online and noticed there's no clear digital home to send customers to when they search for you or ask an AI assistant for a recommendation. That trust quietly slips away to a competitor who has one.

I build digital front doors for local businesses: found on Google, recommended by AI assistants, taking enquiries and bookings while you're busy.

Could I share a quick example of what this could look like for {{business}}?

Thanks,`;

export const DEFAULT_FOLLOW_UP_SUBJECT = 'Re: {{subject}}';
export const DEFAULT_FOLLOW_UP_BODY = `Hi {{name}},

Just floating this back to the top of your inbox in case it got buried. Happy to send a short example for {{business}} if that would help. No obligation either way.

Thanks,`;

/** Friendly spellings people write, and what they mean. {{First Name}} and {{Clinic Name}} are the same as {{name}} and {{business}}. */
const TOKEN_ALIASES: Record<string, Token> = {
  name: 'name', 'first name': 'name', firstname: 'name', 'contact name': 'name', 'recipient name': 'name',
  fullname: 'fullName', 'full name': 'fullName',
  business: 'business', 'business name': 'business', 'clinic name': 'business', clinic: 'business', 'practice name': 'business', practice: 'business',
  company: 'business', 'company name': 'business', organisation: 'business', organization: 'business', 'restaurant name': 'business', restaurant: 'business',
  website: 'website', 'web site': 'website', url: 'website',
};
const normKey = (k: string) => k.trim().toLowerCase().replace(/[_\s]+/g, ' ');

/** Rewrites friendly placeholders to the ones the engine fills: {{First Name}} becomes {{name}}, {{Clinic Name}} becomes {{business}}. */
export function canonTokens(text: string): string {
  return text.replace(/\{\{\s*([^}]*?)\s*\}\}/g, (whole, key: string) => { const c = TOKEN_ALIASES[normKey(key)]; return c ? `{{${c}}}` : whole; });
}

/** Tokens used in a template that we don't know how to fill. */
export function unknownTokens(template: string, extra: string[] = []): string[] {
  template = canonTokens(template);
  const known = new Set<string>([...TEMPLATE_TOKENS, ...extra]);
  const bad = new Set<string>();
  for (const m of Array.from(template.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g))) if (!known.has(m[1])) bad.add(m[1] || '(empty)');
  return Array.from(bad);
}

/** Fills {{name}} (first name, else "there"), {{fullName}}, {{business}} (else "your business"), {{website}}. */
export function renderTemplate(template: string, lead: LeadInput, extra: Record<string, string> = {}): string {
  template = canonTokens(template);
  const values: Record<Token | string, string> = {
    name: lead.name?.trim() ? firstNameOf(lead.name) : 'there',
    fullName: lead.name?.trim() || 'there',
    business: lead.business?.trim() || 'your business',
    website: lead.website?.trim() || 'your website',
    ...extra,
  };
  return template.replace(/\{\{\s*([^}]*?)\s*\}\}/g, (whole, key: string) => values[key] ?? whole);
}

// ── The message ──────────────────────────────────────────────────────────────

export interface SenderIdentity {
  name?: string | null;
  business?: string | null;
  whatsapp?: string | null;
  tagline?: string | null;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export interface BuiltEmail {
  subject: string;
  text: string;
  html: string;
  headers: Record<string, string>;
}

const URL_RE = /https?:\/\/[^\s<>"']+/g;

/** Escapes the body for HTML and turns bare URLs into links (counted ones when `track` is given). */
export function linkify(text: string, track?: (url: string) => string): string {
  let out = '';
  let last = 0;
  for (const m of Array.from(text.matchAll(URL_RE))) {
    const start = m.index ?? 0;
    // Sentence punctuation after a link is not part of it.
    const url = m[0].replace(/[.,;:!?)\]]+$/, '');
    out += escapeHtml(text.slice(last, start));
    const href = track ? track(url) : url;
    out += `<a href="${escapeHtml(href)}" style="color:#2563eb;">${escapeHtml(url)}</a>`;
    last = start + url.length;
  }
  out += escapeHtml(text.slice(last));
  return out.replace(/\n/g, '<br>');
}

export function signatureOf(s: SenderIdentity): string {
  const who = s.name && s.business ? `${s.name} | ${s.business}` : s.name || s.business || '';
  return [who, s.whatsapp ? `WhatsApp: ${s.whatsapp}` : '', s.tagline ?? ''].filter(Boolean).join('\n');
}

/**
 * Builds one outgoing message. Every email carries a visible unsubscribe link and the
 * one-click List-Unsubscribe headers mail apps use for their own Unsubscribe button.
 */
export function buildEmail(args: {
  subject: string;
  body: string;
  lead: LeadInput;
  sender: SenderIdentity;
  unsubscribeUrl: string;
  pixelUrl?: string;
  /** Subject of the first email, for {{subject}} in follow-ups. */
  originalSubject?: string;
  /** Wraps a link so clicks are counted. Applied to links in the body only, never to the unsubscribe link. */
  trackLink?: (url: string) => string;
}): BuiltEmail {
  const extra: Record<string, string> = args.originalSubject ? { subject: args.originalSubject } : {};
  const subject = renderTemplate(args.subject, args.lead, extra).replace(/\s+/g, ' ').trim();
  const body = renderTemplate(args.body, args.lead, extra).trim();
  const signature = signatureOf(args.sender);

  const footer = `You're getting this because ${args.sender.business || args.sender.name || 'the sender'} thought it might be relevant to ${args.lead.business || 'your business'}. Don't want these? Unsubscribe: ${args.unsubscribeUrl}`;
  const text = `${body}${signature ? `\n\n${signature}` : ''}\n\n--\n${footer}`;

  const htmlBody = linkify(body, args.trackLink);
  const htmlSig = signature ? `<br><br>${escapeHtml(signature).replace(/\n/g, '<br>')}` : '';
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#111827;">${htmlBody}${htmlSig}</div>`
    + `<div style="margin-top:28px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;font-family:Arial,sans-serif;">`
    + `${escapeHtml(`You're getting this because ${args.sender.business || args.sender.name || 'the sender'} thought it might be relevant to ${args.lead.business || 'your business'}.`)} `
    + `<a href="${escapeHtml(args.unsubscribeUrl)}" style="color:#6b7280;">Unsubscribe</a></div>`
    + (args.pixelUrl ? `<img src="${escapeHtml(args.pixelUrl)}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px;">` : '');

  return {
    subject, text, html,
    headers: {
      'List-Unsubscribe': `<${args.unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
}

// ── The dashboard ────────────────────────────────────────────────────────────

export interface LeadRow {
  /** A stage set by hand (demo_booked, proposal_sent, customer, lost) stops automatic follow-ups. */
  stage?: string | null;
  pausedUntil?: Date | string | null;
  status: string;
  sentAt?: Date | string | null;
  lastSentAt?: Date | string | null;
  openedAt?: Date | string | null;
  clickedAt?: Date | string | null;
  repliedAt?: Date | string | null;
  outcome?: string | null;
  unsubscribedAt?: Date | string | null;
  followUpsSent: number;
}

export interface FollowUpRule {
  followUpAfterDays: number;
  maxFollowUps: number;
  /** Days to wait before each follow-up (index 0 is the first follow-up). When absent every follow-up waits followUpAfterDays. */
  waits?: number[];
}

const ms = (d: Date | string | null | undefined) => (d ? new Date(d).getTime() : NaN);

/** Sent, no answer, still allowed to be contacted, and the wait since the last email is over. */
export function needsFollowUp(lead: LeadRow, rule: FollowUpRule, now = Date.now()): boolean {
  if (lead.status !== 'sent') return false;
  if (lead.repliedAt || lead.unsubscribedAt) return false;
  if (lead.stage && ['demo_booked', 'proposal_sent', 'customer', 'lost'].includes(lead.stage)) return false;
  if (lead.followUpsSent >= rule.maxFollowUps) return false;
  const paused = ms(lead.pausedUntil);
  if (Number.isFinite(paused) && paused > now) return false;
  const last = ms(lead.lastSentAt ?? lead.sentAt);
  const wait = rule.waits?.[lead.followUpsSent] ?? rule.followUpAfterDays;
  return Number.isFinite(last) && now - last >= wait * 86_400_000;
}

export interface CampaignStats {
  total: number;
  queued: number;
  sent: number;
  failed: number;
  skipped: number;
  unsubscribed: number;
  opened: number;
  clicked: number;
  replied: number;
  interested: number;
  needsFollowUp: number;
  followedUp: number;
  /** Share of sent emails that were opened / answered, 0–100. */
  openRate: number;
  replyRate: number;
}

export function statsOf(leads: LeadRow[], rule: FollowUpRule, now = Date.now()): CampaignStats {
  const s: CampaignStats = {
    total: leads.length, queued: 0, sent: 0, failed: 0, skipped: 0, unsubscribed: 0,
    opened: 0, clicked: 0, replied: 0, interested: 0, needsFollowUp: 0, followedUp: 0, openRate: 0, replyRate: 0,
  };
  for (const l of leads) {
    if (l.status === 'queued' || l.status === 'sending') s.queued++;
    else if (l.status === 'failed') s.failed++;
    else if (l.status === 'skipped') s.skipped++;
    else if (l.status === 'unsubscribed') s.unsubscribed++;
    // Unsubscribed and replied leads were still sent to.
    if (l.sentAt) s.sent++;
    if (l.sentAt && l.openedAt) s.opened++;
    if (l.clickedAt) s.clicked++;
    if (l.repliedAt) s.replied++;
    if (l.repliedAt && l.outcome === 'interested') s.interested++;
    if (l.followUpsSent > 0) s.followedUp++;
    if (needsFollowUp(l, rule, now)) s.needsFollowUp++;
  }
  s.openRate = s.sent ? Math.round((s.opened / s.sent) * 100) : 0;
  s.replyRate = s.sent ? Math.round((s.replied / s.sent) * 100) : 0;
  return s;
}

/** The label the table shows for a lead, most advanced state first. */
export type LeadStage = 'unsubscribed' | 'replied' | 'needs_follow_up' | 'opened' | 'sent' | 'queued' | 'failed' | 'skipped';

export function stageOf(lead: LeadRow, rule: FollowUpRule, now = Date.now()): LeadStage {
  if (lead.unsubscribedAt || lead.status === 'unsubscribed') return 'unsubscribed';
  if (lead.repliedAt) return 'replied';
  if (lead.status === 'failed') return 'failed';
  if (lead.status === 'skipped') return 'skipped';
  if (lead.status === 'queued' || lead.status === 'sending') return 'queued';
  if (needsFollowUp(lead, rule, now)) return 'needs_follow_up';
  if (lead.openedAt) return 'opened';
  return 'sent';
}

export function startOfToday(now = new Date()): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** How many more emails may go out today for this campaign. */
export function remainingToday(campaignCap: number, sentTodayCampaign: number, sentTodayAccount: number): number {
  const cap = Math.min(Math.max(1, Math.floor(campaignCap)), HARD_DAILY_MAX);
  return Math.max(0, Math.min(cap - sentTodayCampaign, HARD_DAILY_MAX - sentTodayAccount));
}

// ── Validation ───────────────────────────────────────────────────────────────

export interface CampaignFields {
  name: string;
  subject: string;
  body: string;
  followUpSubject: string | null;
  followUpBody: string | null;
  followUpAfterDays: number;
  maxFollowUps: number;
  dailyCap: number;
}

const str = (v: unknown) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim() : undefined);
const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : undefined);

/** Checks the editable fields of a campaign. With `partial`, only the fields present are checked and returned. */
export function validateCampaignFields(
  input: Record<string, unknown>,
  partial = false,
): { ok: true; data: Partial<CampaignFields> } | { ok: false; error: string } {
  const data: Partial<CampaignFields> = {};
  const need = (k: string) => !partial || input[k] !== undefined;

  if (need('name')) {
    const v = str(input.name);
    if (!v) return { ok: false, error: 'Give the campaign a name.' };
    data.name = v.slice(0, 120);
  }
  if (need('subject')) {
    const v = str(input.subject);
    if (!v) return { ok: false, error: 'The subject line is empty.' };
    if (v.length > 190) return { ok: false, error: 'Keep the subject under 190 characters.' };
    const bad = unknownTokens(v);
    if (bad.length) return { ok: false, error: `Unknown placeholder in the subject: {{${bad[0]}}}. Use ${TEMPLATE_TOKENS.map((t) => `{{${t}}}`).join(', ')}.` };
    data.subject = canonTokens(v);
  }
  if (need('body')) {
    const v = str(input.body);
    if (!v) return { ok: false, error: 'The email body is empty.' };
    if (v.length > 8000) return { ok: false, error: 'Keep the email under 8,000 characters.' };
    const bad = unknownTokens(v);
    if (bad.length) return { ok: false, error: `Unknown placeholder in the email: {{${bad[0]}}}. Use ${TEMPLATE_TOKENS.map((t) => `{{${t}}}`).join(', ')}.` };
    data.body = canonTokens(v);
  }
  for (const [key, label, max] of [['followUpSubject', 'follow-up subject', 190], ['followUpBody', 'follow-up email', 8000]] as const) {
    if (input[key] === undefined) continue;
    const v = input[key] === null ? '' : str(input[key]);
    if (v === undefined) return { ok: false, error: `The ${label} must be text.` };
    if (v.length > max) return { ok: false, error: `The ${label} is too long.` };
    const bad = unknownTokens(v, ['subject']);
    if (bad.length) return { ok: false, error: `Unknown placeholder in the ${label}: {{${bad[0]}}}.` };
    data[key] = v ? canonTokens(v) : null;
  }
  const days = int(input.followUpAfterDays);
  if (input.followUpAfterDays !== undefined) {
    if (days === undefined || days < 1 || days > 30) return { ok: false, error: 'Follow up after 1 to 30 days.' };
    data.followUpAfterDays = days;
  }
  const maxF = int(input.maxFollowUps);
  if (input.maxFollowUps !== undefined) {
    if (maxF === undefined || maxF < 0 || maxF > 4) return { ok: false, error: 'Send between 0 and 4 follow-ups.' };
    data.maxFollowUps = maxF;
  }
  const cap = int(input.dailyCap);
  if (input.dailyCap !== undefined) {
    if (cap === undefined || cap < 1 || cap > HARD_DAILY_MAX) return { ok: false, error: `Daily limit must be between 1 and ${HARD_DAILY_MAX}.` };
    data.dailyCap = cap;
  }
  return { ok: true, data };
}

/** Normalises leads posted as JSON (the browser parses the CSV, but the server never trusts it). */
export function sanitizeLeads(raw: unknown): { leads: LeadInput[]; invalid: number } {
  if (!Array.isArray(raw)) return { leads: [], invalid: 0 };
  const seen = new Set<string>();
  const leads: LeadInput[] = [];
  let invalid = 0;
  for (const r of raw.slice(0, MAX_LEADS_PER_CAMPAIGN * 2)) {
    const o = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    const email = typeof o.email === 'string' ? cleanEmail(o.email) : '';
    if (!EMAIL_RE.test(email) || email.length > 190) { invalid++; continue; }
    if (seen.has(email)) continue;
    seen.add(email);
    const clip = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.replace(/\s+/g, ' ').trim().slice(0, n) : undefined);
    const name = clip(o.name, 120), business = clip(o.business, 160), website = clip(o.website, 190);
    const phone = typeof o.phone === 'string' ? cleanPhone(o.phone) : '';
    leads.push({ email, ...(name ? { name } : {}), ...(business ? { business } : {}), ...(website ? { website } : {}), ...(phone ? { phone } : {}) });
  }
  return { leads, invalid };
}
