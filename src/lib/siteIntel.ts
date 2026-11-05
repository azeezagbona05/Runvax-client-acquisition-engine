/**
 * Website intelligence: visits the public pages of one business website (home, about, team, management,
 * leadership, contact) and records who is named there, their titles, any email, phone and LinkedIn link,
 * and WHICH PAGE each finding came from. Free: it only reads pages the business published itself.
 *
 * It keeps the kinds of contact apart. An address a person is named on (or that carries their name) is a
 * decision-maker email; info@ and similar is a general business inbox; a contact form and a phone number
 * are separate channels. They are never presented as the same thing.
 */
import { extractPeople, cleanPhone, titleRank } from '@/lib/decisionMaker';
import { listEmails, revealEmails } from '@/lib/siteEmail';

export interface SitePerson { name: string; title: string; sourcePage: string; email?: string; linkedin?: string }
export interface SiteEmail { email: string; sourcePage: string; /** Carries a person's name (ada.obi@). */ personal: boolean; /** On the business's own domain. */ ownDomain: boolean }
export interface SitePhone { phone: string; sourcePage: string }
export interface SiteLink { url: string; kind: 'person' | 'company'; sourcePage: string }

export interface SiteIntel {
  origin: string;
  pages: string[];
  people: SitePerson[];
  emails: SiteEmail[];
  phones: SitePhone[];
  linkedin: SiteLink[];
  /** A page with a contact/enquiry form, when there is one. */
  contactForm?: string;
}

// Contact first: it is where emails and forms live.
const DEFAULT_PATHS = ['/contact', '/contact-us', '/about', '/about-us', '/our-team', '/team', '/meet-the-team', '/management', '/leadership'];
const INTERESTING = /(about|team|staff|people|doctor|dentist|specialist|meet|management|leadership|board|founder|director|who-we-are|our-story|contact)/i;
const SKIP_FILE = /\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|mp4|mp3)(\?|$)/i;
const MAX_PAGES = 10;

const GENERIC_LOCAL = /^(info|contact|contacts|hello|hi|hey|admin|office|support|sales|enquir(y|ies)|inquir(y|ies)|mail|reception|booking|bookings|reservations?|team|help|service|services|care|general|accounts?|billing|marketing|frontdesk|appointments?|orders?|webmaster)$/i;

const tokens = (name: string) => name.toLowerCase().replace(/^(dr|mr|mrs|ms|miss|engr|eng|barr|prof|chief|pastor)\.?\s+/, '').split(/[^a-z]+/).filter((t) => t.length >= 3);

/** Does this address carry the person's name (ada.okafor@, aokafor@, okafor@)? */
function emailMatchesPerson(email: string, name: string): boolean {
  const local = email.split('@')[0].toLowerCase().replace(/[^a-z]/g, '');
  const t = tokens(name);
  if (!t.length) return false;
  const first = t[0]; const last = t[t.length - 1];
  return local.includes(last) || (first.length >= 4 && local.includes(first));
}

/** Looks like a person's address even when we have not met the person: first.last@, firstlast with a separator. */
function looksPersonal(email: string): boolean {
  const local = email.split('@')[0];
  if (GENERIC_LOCAL.test(local)) return false;
  return /^[a-z]{2,}[._-][a-z]{2,}$/i.test(local);
}

function pageText(html: string): string { return revealEmails(html); }

function phonesIn(html: string): string[] {
  const out: string[] = [];
  for (const m of Array.from(html.matchAll(/href=["']tel:([^"']+)["']/gi))) { const p = cleanPhone(decodeURIComponent(m[1])); if (p) out.push(p); }
  const text = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ');
  for (const m of Array.from(text.matchAll(/(?:\+?234[\s-]?|\b0)[789][01]\d[\s-]?\d{3}[\s-]?\d{4}\b/g))) { const p = cleanPhone(m[0]); if (p) out.push(p); }
  return out;
}

function linkedinIn(html: string): Array<{ url: string; kind: 'person' | 'company' }> {
  const out: Array<{ url: string; kind: 'person' | 'company' }> = [];
  for (const m of Array.from(html.matchAll(/https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(in|company)\/[^"'\s<>)?#\\]+/gi))) out.push({ url: m[0].replace(/\/$/, ''), kind: m[1].toLowerCase() === 'in' ? 'person' : 'company' });
  return out;
}

function hasForm(html: string, url: string): boolean {
  const forms = html.match(/<form[\s\S]*?<\/form>/gi) ?? [];
  const contactPage = /contact|enquir|book|appointment/i.test(new URL(url).pathname);
  return forms.some((f) => /<textarea/i.test(f) || (/type=["']?email/i.test(f) && (contactPage || /message|enquir|contact/i.test(f))));
}

/** Same-site links worth visiting, found on a page (team, about, contact, leadership…). */
function discoverLinks(html: string, pageUrl: string, origin: string): string[] {
  const out: string[] = [];
  for (const m of Array.from(html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi))) {
    try {
      const u = new URL(m[1], pageUrl);
      if (u.origin !== origin || SKIP_FILE.test(u.pathname) || u.pathname === '/' ) continue;
      const label = m[2].replace(/<[^>]+>/g, ' ');
      if (INTERESTING.test(u.pathname) || INTERESTING.test(label)) out.push(u.origin + u.pathname.replace(/\/$/, ''));
    } catch { /* not a URL */ }
  }
  return Array.from(new Set(out));
}

/**
 * Crawl one website. `fetchHtml` returns a page's HTML ('' when it cannot be read), so the crawl is testable
 * and the caller decides how to fetch safely. Visits at most 10 pages, 5 at a time.
 */
export async function crawlSite(site: string, fetchHtml: (url: string) => Promise<string>): Promise<SiteIntel | null> {
  let origin: string;
  try { origin = new URL(/^https?:\/\//i.test(site) ? site : `https://${site}`).origin; } catch { return null; }
  const host = new URL(origin).hostname.replace(/^www\./, '');
  const intel: SiteIntel = { origin, pages: [], people: [], emails: [], phones: [], linkedin: [] };

  const visited = new Set<string>();
  const queue: string[] = [origin];
  const take = (url: string) => { const k = url.replace(/\/$/, ''); if (visited.has(k) || visited.size >= MAX_PAGES) return false; visited.add(k); return true; };

  const visit = async (url: string) => {
    const html = await fetchHtml(url);
    if (!html) return [] as string[];
    intel.pages.push(url);
    for (const p of extractPeople(html)) if (!intel.people.some((x) => tokens(x.name).join(' ') === tokens(p.name).join(' '))) intel.people.push({ name: p.name, title: p.title, sourcePage: url });
    for (const email of listEmails(pageText(html))) {
      if (intel.emails.some((e) => e.email === email)) continue;
      intel.emails.push({ email, sourcePage: url, personal: looksPersonal(email), ownDomain: email.split('@')[1].replace(/^www\./, '') === host || email.endsWith(`.${host}`) });
    }
    for (const phone of phonesIn(html)) if (!intel.phones.some((x) => x.phone.replace(/\D/g, '') === phone.replace(/\D/g, ''))) intel.phones.push({ phone, sourcePage: url });
    for (const l of linkedinIn(html)) if (!intel.linkedin.some((x) => x.url.toLowerCase() === l.url.toLowerCase())) intel.linkedin.push({ ...l, sourcePage: url });
    if (!intel.contactForm && hasForm(html, url)) intel.contactForm = url;
    return discoverLinks(html, url, origin);
  };

  take(origin);
  const found = await visit(origin);
  // Links the site itself points to for team/about/contact first, then the usual paths.
  for (const u of [...found, ...DEFAULT_PATHS.map((p) => origin + p)]) if (take(u)) queue.push(u);
  const rest = queue.slice(1);
  for (let i = 0; i < rest.length; i += 5) await Promise.all(rest.slice(i, i + 5).map(visit));

  // Attach each person's own address and LinkedIn profile where the address or URL carries their name.
  for (const person of intel.people) {
    const mail = intel.emails.find((e) => e.ownDomain && emailMatchesPerson(e.email, person.name)) ?? intel.emails.find((e) => emailMatchesPerson(e.email, person.name));
    if (mail) { person.email = mail.email; mail.personal = true; }
    const t = tokens(person.name);
    const li = intel.linkedin.find((l) => l.kind === 'person' && t.length > 0 && t.every((x) => l.url.toLowerCase().includes(x)));
    if (li) person.linkedin = li.url;
  }
  return intel;
}

// ── What kind of contact do we actually have? ───────────────────────────────

export type ContactType = 'decision_maker_email' | 'general_email' | 'contact_form' | 'business_phone' | 'none';
export interface ContactChannel { type: ContactType; value?: string; person?: string; sourcePage?: string }

export const CHANNEL_LABEL: Record<ContactType, string> = {
  decision_maker_email: 'Decision-maker email',
  general_email: 'General business email',
  contact_form: 'Contact form',
  business_phone: 'Business phone',
  none: 'No contact found',
};

/** Every contact route the website gave us, strongest first. [{ type: 'none' }] when there is nothing. */
export function channelsOf(intel: Pick<SiteIntel, 'people' | 'emails' | 'phones' | 'contactForm'> | null): ContactChannel[] {
  if (!intel) return [{ type: 'none' }];
  const out: ContactChannel[] = [];
  const personEmails = new Set<string>();
  for (const p of intel.people) if (p.email) { out.push({ type: 'decision_maker_email', value: p.email, person: p.name, sourcePage: p.sourcePage }); personEmails.add(p.email); }
  // A named-looking address with no person attached is still a person's address, not the reception inbox.
  for (const e of intel.emails) if (!personEmails.has(e.email) && e.personal && !GENERIC_LOCAL.test(e.email.split('@')[0])) { out.push({ type: 'decision_maker_email', value: e.email, sourcePage: e.sourcePage }); personEmails.add(e.email); }
  for (const e of intel.emails) if (!personEmails.has(e.email)) out.push({ type: 'general_email', value: e.email, sourcePage: e.sourcePage });
  if (intel.contactForm) out.push({ type: 'contact_form', value: intel.contactForm, sourcePage: intel.contactForm });
  for (const ph of intel.phones.slice(0, 2)) out.push({ type: 'business_phone', value: ph.phone, sourcePage: ph.sourcePage });
  return out.length ? out : [{ type: 'none' }];
}

/** Titles worth keeping from a crawl: only people whose title is a decision title (already filtered), strongest first. */
export function rankedPeople(intel: Pick<SiteIntel, 'people'>): SitePerson[] {
  return [...intel.people].sort((a, b) => titleRank(a.title) - titleRank(b.title));
}
