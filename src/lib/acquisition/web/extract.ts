import type { IndustryConfig } from '../config/schema';
import { normalizePhone } from '@/lib/phone';
import { classifyEmail, isEmail } from '../contacts';
import { registrableDomain } from './url';
import { parseHtml, type ParsedHtml, type HtmlTag } from './html';

/**
 * Deterministic extractors over a clinic's own pages. No AI, no inference of
 * people: the only contact points extracted are role inboxes and published
 * business phone / WhatsApp numbers. Named-looking addresses are counted,
 * never stored (Phase 2 decision D2).
 *
 * Every signal carries a short quote from the page and its URL. Quotes are
 * MASKED: phone numbers and email addresses inside them are replaced, so
 * evidence never duplicates a contact value (erasure then only has to remove
 * the contact rows themselves). When a page looks JavaScript-rendered,
 * absence signals become "unknown" rather than "absent".
 *
 * Runs in linear time on hostile input: all scanning goes through
 * parseHtml() (html.ts) and bounded, anchored patterns.
 */

export interface PageInput { url: string; html: string }

export interface SignalDraft {
  code: string;
  value: boolean | string | null;
  basis: 'observed' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  sourceUrl: string;
  quote: string;
}

export interface SiteExtraction {
  signals: SignalDraft[];
  roleInboxes: Array<{ email: string; sourceUrl: string; quote: string }>;
  phones: Array<{ phone: string; sourceUrl: string; quote: string; whatsapp: boolean }>;
  namedEmailCount: number;
  jsRendered: boolean;
  readablePages: number;
}

const BOOKING_CTA = /\b(book (an |your )?appointment|book (a |your )?(visit|consultation)|schedule (an |a |your )?(appointment|visit)|request (an )?appointment)\b/i;
const HOURS_TEXT = /\b(mon(day)?|tue(s(day)?)?|wed(nesday)?|thu(rs(day)?)?|fri(day)?|sat(urday)?|sun(day)?)\b[^.\n]{0,40}\b\d{1,2}(:\d{2})?\s?(am|pm)\b/i;
const NG_PHONE = /(?:\+?234[\s-]?|0)[789][01]\d(?:[\s-]?\d){7}/g;
const EMAIL_TOKEN = /^[a-z0-9._%+'-]{1,64}@[a-z0-9.-]{1,253}\.[a-z]{2,24}$/i;
const NOISE_EMAIL = /(noreply|no-reply|donotreply|example\.|sentry|wixpress|@2x|\.png|\.jpg|\.webp|\.gif|domain\.com|email\.com|yourname)/i;
const MAX_QUOTE = 300;

// ─── masking ────────────────────────────────────────────────────────────────

const MASK_EMAIL = /[^\s@<>"'(),;:]{1,64}@[^\s@<>"'(),;:]{1,253}/g;
const MASK_PHONE = /\+?\d[\d\s().-]{5,24}\d/g;

/** Replaces email addresses and phone-like digit runs (≥7 digits) in evidence text. */
export function maskContactValues(text: string): string {
  return text
    .replace(MASK_EMAIL, '[email]')
    .replace(MASK_PHONE, (m) => (m.replace(/\D/g, '').length >= 7 ? '[phone]' : m));
}

function quote(s: string): string {
  return maskContactValues(s.replace(/\s+/g, ' ').trim().slice(0, MAX_QUOTE + 60)).slice(0, MAX_QUOTE);
}

function snippet(text: string, index: number, length: number): string {
  return quote(text.slice(Math.max(0, index - 60), Math.min(text.length, index + length + 60)));
}

// ─── helpers ────────────────────────────────────────────────────────────────

function hostOf(u: string, base: string): string | null {
  try { return new URL(u, base).hostname.toLowerCase(); } catch { return null; }
}

function hostMatches(host: string | null, list: string[]): boolean {
  return !!host && list.some((h) => host === h || host.endsWith(`.${h}`));
}

function jsonLdNodes(parsed: ParsedHtml): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const el of parsed.rawText) {
    if (el.name !== 'script' || !/application\/ld\+json/i.test(el.attrs.type ?? '') || el.content.length > 200_000) continue;
    try {
      const parsedJson = JSON.parse(el.content.trim());
      const stack = Array.isArray(parsedJson) ? [...parsedJson] : [parsedJson];
      let guard = 0;
      while (stack.length && guard++ < 500) {
        const n = stack.pop();
        if (!n || typeof n !== 'object') continue;
        out.push(n as Record<string, unknown>);
        const g = (n as Record<string, unknown>)['@graph'];
        if (Array.isArray(g)) stack.push(...g.slice(0, 200));
      }
    } catch { /* malformed JSON-LD is ignored */ }
  }
  return out;
}

function types(node: Record<string, unknown>): string[] {
  const t = node['@type'];
  return (Array.isArray(t) ? t : [t]).filter((x): x is string => typeof x === 'string');
}

export function decodeCfEmail(hex: string): string | null {
  if (!/^[0-9a-f]{4,512}$/i.test(hex) || hex.length % 2) return null;
  const key = parseInt(hex.slice(0, 2), 16);
  let out = '';
  for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
  return isEmail(out) ? out.toLowerCase() : null;
}

function jsRenderedParsed(parsed: ParsedHtml): boolean {
  if (parsed.text.length >= 500) return false;
  const t = parsed.tags;
  for (let i = 0; i < t.length - 1; i++) {
    if (t[i].name === 'div' && !t[i].closing && ['root', '__next', 'app', '__nuxt'].includes(t[i].attrs.id ?? '') && t[i + 1].name === 'div' && t[i + 1].closing) return true;
  }
  if (parsed.rawText.some((e) => e.name === 'noscript' && /(enable|requires?) javascript/i.test(e.content.slice(0, 2000)))) return true;
  return t.filter((x) => x.name === 'script' && !x.closing).length >= 3;
}

export function looksJsRendered(html: string): boolean {
  return jsRenderedParsed(parseHtml(html));
}

/** Email candidates from text, by token (linear) — never a regex over the whole text. */
function emailTokens(text: string): Array<{ email: string; index: number }> {
  const out: Array<{ email: string; index: number }> = [];
  let pos = 0;
  for (const tok of text.split(/[\s<>()[\]{}"',;:|]+/)) {
    const at = text.indexOf(tok, pos);
    if (at >= 0) pos = at + tok.length;
    if (tok.length > 320 || !tok.includes('@')) continue;
    const t = tok.replace(/[.]+$/, '');
    if (EMAIL_TOKEN.test(t)) out.push({ email: t.toLowerCase(), index: at });
  }
  return out;
}

// ─── extraction ─────────────────────────────────────────────────────────────

export function extractSite(pages: PageInput[], industry: IndustryConfig, finalHomeUrl?: string | null): SiteExtraction {
  const r = industry.research;
  const found = new Map<string, SignalDraft>();
  const setTrue = (code: string, conf: SignalDraft['confidence'], sourceUrl: string, q: string, value: boolean | string = true) => {
    if (!found.has(code)) found.set(code, { code, value, basis: 'observed', confidence: conf, sourceUrl, quote: quote(q) });
  };
  const roleInboxes = new Map<string, { email: string; sourceUrl: string; quote: string }>();
  const phones = new Map<string, { phone: string; sourceUrl: string; quote: string; whatsapp: boolean }>();
  let namedEmailCount = 0;
  let readablePages = 0;
  let jsRendered = false;
  let truncatedPages = 0;
  let serviceHits = 0;
  let serviceQuote: { url: string; q: string } | null = null;
  let siteDomain: string | null = null;
  try { siteDomain = pages[0] ? registrableDomain(new URL(pages[0].url).hostname) : null; } catch { siteDomain = null; }

  const noteEmail = (e: string, url: string, q: string) => {
    if (!isEmail(e) || NOISE_EMAIL.test(e)) return;
    // Only the clinic's own domain: a designer's or host's address on the page is not the clinic's inbox.
    if (!siteDomain || registrableDomain(e.split('@')[1]) !== siteDomain) return;
    const kind = classifyEmail(e, r.roleInboxLocalParts);
    if (kind === 'role') { if (!roleInboxes.has(e)) roleInboxes.set(e, { email: e, sourceUrl: url, quote: quote(q) }); }
    else if (kind === 'named') namedEmailCount++;
  };
  const notePhone = (raw: string, url: string, q: string, whatsapp: boolean, minLen = 10) => {
    const ph = normalizePhone(raw);
    if (ph.length >= minLen && !phones.has(ph)) phones.set(ph, { phone: ph, sourceUrl: url, quote: quote(q), whatsapp });
  };

  for (const p of pages) {
    const parsed = parseHtml(p.html);
    if (jsRenderedParsed(parsed)) { jsRendered = true; continue; }
    if (parsed.truncated) truncatedPages++; // only part of the page was scanned
    readablePages++;
    const text = parsed.text;
    const lowerText = text.toLowerCase();

    // Forms: a form is a contact form if it has email/phone/message fields.
    let formCount = 0;
    let openForm: { tag: HtmlTag; contact: boolean } | null = null;
    const closeForm = () => {
      if (openForm?.contact) setTrue('contact_form_present', 'high', p.url, openForm.tag.raw);
      openForm = null;
    };

    for (const tag of parsed.tags) {
      if (tag.closing) { if (tag.name === 'form') closeForm(); continue; }
      const a = tag.attrs;
      if (tag.name === 'form') { closeForm(); formCount++; openForm = { tag, contact: false }; continue; }
      if (openForm && ((tag.name === 'input' && (/^(email|tel)$/i.test(a.type ?? '') || /email|phone|message/i.test(a.name ?? ''))) || tag.name === 'textarea')) {
        (openForm as { contact: boolean }).contact = true;
      }
      if (a['data-cfemail']) {
        const e = decodeCfEmail(a['data-cfemail']);
        if (e) noteEmail(e, p.url, `Cloudflare-protected email on ${p.url}`);
      }
      const link = tag.name === 'a' ? a.href : (tag.name === 'iframe' || tag.name === 'script') ? a.src : undefined;
      if (link) {
        const host = hostOf(link, p.url);
        if (hostMatches(host, r.bookingProviderHosts)) setTrue('online_booking_present', 'high', p.url, tag.raw);
        if (hostMatches(host, r.chatWidgetHosts)) setTrue('chat_widget_present', 'high', p.url, tag.raw);
      }
      if (tag.name === 'a' && a.href) {
        const v = a.href.trim();
        if (/^tel:/i.test(v)) { setTrue('click_to_call', 'high', p.url, tag.raw); notePhone(v.replace(/^tel:/i, ''), p.url, tag.raw, false); }
        if (/wa\.me\/|api\.whatsapp\.com\/|^whatsapp:/i.test(v)) setTrue('whatsapp_entry_point', 'high', p.url, tag.raw);
        const wa = v.match(/^(?:https?:\/\/)?(?:wa\.me\/|api\.whatsapp\.com\/send\/?\?phone=|whatsapp:\/\/send\?phone=)(\d{8,15})/i);
        if (wa) notePhone(wa[1], p.url, tag.raw, true);
        if (/^mailto:/i.test(v)) {
          let e = v.replace(/^mailto:/i, '').split('?')[0];
          try { e = decodeURIComponent(e); } catch { /* keep raw */ }
          noteEmail(e.toLowerCase(), p.url, tag.raw);
        }
      }
      if (tag.name === 'meta') {
        if (/^viewport$/i.test(a.name ?? '')) setTrue('mobile_viewport', 'high', p.url, '<meta name="viewport">');
        if (/^og:site_name$/i.test(a.property ?? '') && a.content && a.content.length >= 2 && a.content.length <= 150) {
          setTrue('business_name', 'medium', p.url, `og:site_name: ${a.content}`, a.content.trim());
        }
      }
    }
    closeForm();

    const cta = text.match(BOOKING_CTA);
    if (cta && formCount > 0) setTrue('booking_cta_to_form', 'medium', p.url, snippet(text, cta.index ?? 0, cta[0].length));

    // Structured data
    const biz = jsonLdNodes(parsed).find((n) => types(n).some((t) => ['Dentist', 'MedicalBusiness', 'MedicalClinic', 'MedicalOrganization', 'LocalBusiness'].includes(t)));
    if (biz) {
      setTrue('structured_data_dentist', 'high', p.url, `JSON-LD @type: ${types(biz).join(', ')}`);
      if (typeof biz.name === 'string') setTrue('business_name', 'high', p.url, `JSON-LD name: ${biz.name}`, biz.name.slice(0, 200));
      const addr = biz.address as Record<string, unknown> | string | undefined;
      const addrText = typeof addr === 'string' ? addr : addr && typeof addr === 'object' ? [addr.streetAddress, addr.addressLocality, addr.addressRegion].filter((x) => typeof x === 'string').join(', ') : '';
      if (addrText) setTrue('business_address', 'high', p.url, `JSON-LD address: ${addrText}`, maskContactValues(addrText.slice(0, 300)));
      if (biz.openingHours || biz.openingHoursSpecification) setTrue('opening_hours_published', 'high', p.url, 'JSON-LD openingHours');
    }
    const hours = text.match(HOURS_TEXT);
    if (hours) setTrue('opening_hours_published', 'medium', p.url, snippet(text, hours.index ?? 0, hours[0].length));

    // Business name fallback: the page title (the site's own self-description)
    const title = parsed.rawText.find((e) => e.name === 'title');
    if (title) {
      const t = title.content.replace(/\s+/g, ' ').trim().slice(0, 200);
      const name = t.split(/\s[|–—-]\s/)[0].trim();
      if (name.length >= 2) setTrue('business_name', 'low', p.url, `<title>${t}</title>`, name);
    }

    // Services
    for (const k of r.serviceKeywords) {
      const i = lowerText.indexOf(k.toLowerCase());
      if (i >= 0) { serviceHits++; serviceQuote ??= { url: p.url, q: snippet(text, i, k.length) }; }
    }

    // Emails and phones in visible text
    for (const { email, index } of emailTokens(text)) noteEmail(email, p.url, snippet(text, index, email.length));
    NG_PHONE.lastIndex = 0;
    for (const m of Array.from(text.matchAll(NG_PHONE)).slice(0, 200)) notePhone(m[0], p.url, snippet(text, m.index ?? 0, m[0].length), false, 12);
  }

  if (serviceHits >= 2 && serviceQuote) setTrue('service_pages', 'medium', (serviceQuote as { url: string; q: string }).url, (serviceQuote as { url: string; q: string }).q);
  const home = pages[0]?.url;
  const finalUrl = finalHomeUrl ?? home;
  if (finalUrl) setTrue('https', 'high', finalUrl, `final URL: ${finalUrl}`, finalUrl.startsWith('https:'));

  // Absence: only claimed when at least one page was readable, none was
  // JS-rendered and none was cut short by the scanner's tag limit.
  const absenceCodes: Array<[string, SignalDraft['confidence']]> = [
    ['online_booking_present', 'medium'], ['booking_cta_to_form', 'medium'], ['contact_form_present', 'medium'],
    ['whatsapp_entry_point', 'medium'], ['chat_widget_present', 'medium'], ['click_to_call', 'medium'],
    ['structured_data_dentist', 'medium'], ['service_pages', 'low'], ['opening_hours_published', 'low'], ['mobile_viewport', 'high'],
  ];
  const canClaimAbsence = readablePages > 0 && !jsRendered && truncatedPages === 0;
  for (const [code, conf] of absenceCodes) {
    if (found.has(code) || !home) continue;
    found.set(code, canClaimAbsence
      ? { code, value: false, basis: 'observed', confidence: conf, sourceUrl: home, quote: `not found on ${readablePages} fetched page(s)` }
      : { code, value: null, basis: 'unknown', confidence: 'low', sourceUrl: home, quote: jsRendered ? 'page appears JavaScript-rendered; content not readable without a browser' : truncatedPages ? 'page too large to scan completely' : 'no readable page' });
  }

  return { signals: Array.from(found.values()), roleInboxes: Array.from(roleInboxes.values()), phones: Array.from(phones.values()), namedEmailCount, jsRendered, readablePages };
}
