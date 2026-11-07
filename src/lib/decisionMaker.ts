/**
 * Decision-maker targeting.
 *
 * A message is only worth sending if it can reach the person who decides. This
 * module answers two questions without any paid API:
 *   1. assessReach() — given what we know about a business, who is this message
 *      likely to land in front of: the decision-maker, or a gatekeeper?
 *   2. extractDecisionMaker() — can a named owner/founder be read off the
 *      business's own website?
 *
 * Everything here is a heuristic. A name found on a website is a lead, not a
 * verified fact, and the UI and prompts treat it that way.
 */

import type { Business } from '@/types';

export type ReachLevel = 'direct' | 'likely' | 'gatekeeper' | 'unknown';

export interface ReachPerson {
  name: string;
  firstName: string;
  title: string;
}

export interface ReachAssessment {
  level: ReachLevel;
  headline: string;
  detail: string;
  /** What the sender should do to get closer to the decision-maker. */
  nextStep: string;
  person: ReachPerson | null;
}

export type EmailKind = 'decision_role' | 'named' | 'generic' | 'none';

// ── Titles ────────────────────────────────────────────────────────────────────

/** Ordered: earlier entries are closer to the person who signs off. */
const DECISION_TITLES: RegExp[] = [
  /\b(owner|co-?owner|proprietor|proprietress)\b/i,
  /\b(co-?)?founder\b/i,
  /\bmanaging (director|partner)\b/i,
  /\b(ceo|chief executive( officer)?)\b/i,
  /\b(principal|lead) (dentist|doctor|physician|consultant|lawyer|partner|architect)\b/i,
  /\bprincipal\b/i,
  /\bpresident\b/i,
  /\bmanaging\b.*\b(director|partner)\b/i,
  /\b(executive|general) (director|manager)\b/i,
  /\bmedical director\b/i,
  /\bdirector\b/i,
  /\bpartner\b/i,
  /\b(general manager|gm|md)\b/i,
  /\b(operations|practice|branch|business|clinic|hotel|store|restaurant|office) manager\b/i,
  /\bmanager\b/i,
];

/** Titles that look senior but belong to someone who relays, not decides. */
const NOT_DECISION = /\b(assistant|assistance|receptionist|secretary|intern|trainee|support|coordinator|junior|deputy to|pa to|personal assistant)\b/i;

/** Lower index = stronger decision-maker. -1 = not a decision title. */
export function titleRank(title: string): number {
  if (!title || NOT_DECISION.test(title)) return -1;
  return DECISION_TITLES.findIndex((re) => re.test(title));
}

export function isDecisionTitle(title: string): boolean {
  // Plain "manager" is a weak signal — treat it as a decision title only for the
  // ranked, non-trivial cases above it.
  const r = titleRank(title);
  return r >= 0 && r < DECISION_TITLES.length - 1;
}

// ── Email classification ──────────────────────────────────────────────────────

const GENERIC_LOCAL = /^(info|contact|contacts|hello|hi|hey|admin|administrator|office|support|sales|enquir(y|ies)|inquir(y|ies)|mail|reception|booking|bookings|reservations?|team|help|service|services|care|general|accounts?|billing|marketing|customercare|customerservice|frontdesk|appointments?|orders?|shop|store|webmaster|noreply|no-reply)$/i;
const ROLE_LOCAL = /^(ceo|md|owner|founder|director|principal|president|manager|gm|boss|chairman|proprietor)$/i;
const NAME_LOCAL = /^[a-z]{2,}([._-][a-z]{2,}){0,2}$/i;

export function classifyEmail(email?: string | null): EmailKind {
  if (!email) return 'none';
  const local = email.split('@')[0]?.trim();
  if (!local) return 'none';
  if (GENERIC_LOCAL.test(local)) return 'generic';
  if (ROLE_LOCAL.test(local)) return 'decision_role';
  if (NAME_LOCAL.test(local) && local.length >= 3) return 'named';
  return 'generic';
}

// ── Names ─────────────────────────────────────────────────────────────────────

const HONORIFICS = /^(dr|mr|mrs|ms|miss|engr|eng|barr|prof|chief|pastor|alhaji|alhaja|hon|sir|dame|arc|arch|pharm)\.?$/i;

export function firstNameOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  // "Dr. Ade Bello" is greeted as "Ade"; a bare "Dr. Bello" keeps the honorific,
  // since a lone surname without one reads as curt.
  if (parts.length >= 2 && HONORIFICS.test(parts[0])) {
    const honorific = parts[0].replace(/\.?$/, '.');
    return parts.length >= 3 ? parts[1] : `${honorific} ${parts[1]}`;
  }
  return parts[0] ?? name;
}

const SOURCE_LABEL: Record<string, string> = {
  website: "the business's website",
  search: 'a public web search',
  apollo: 'Apollo',
  hunter: 'Hunter',
  snov: 'an email finder',
  apify: 'Apify',
};

// ── Reach assessment ──────────────────────────────────────────────────────────

export function assessReach(business: Pick<Business, 'email' | 'decisionMaker'>): ReachAssessment {
  const dm = business.decisionMaker;
  const emailKind = classifyEmail(recipientEmail(business));

  if (dm?.name) {
    const person: ReachPerson = { name: dm.name, firstName: firstNameOf(dm.name), title: dm.title ?? '' };
    if (!dm.title || isDecisionTitle(dm.title)) {
      return {
        level: 'direct',
        headline: `Reaching ${person.name}${person.title ? `, ${person.title}` : ''}`,
        detail: dm.source === 'manual'
          ? 'You named this person yourself.'
          : `Found via ${SOURCE_LABEL[dm.source] ?? 'a people lookup'} — not verified, so check it before you send.`,
        nextStep: dm.email
          ? `Email goes to their own address (${dm.email}${dm.emailStatus ? `, ${dm.emailStatus}` : ''}), not the front desk. Address them by name.`
          : emailKind === 'generic'
          ? 'Their email is a shared inbox. Address the message to them by name so whoever opens it knows who it is for.'
          : 'Address them by name. Lead with the outcome for their business, not your services.',
        person,
      };
    }
    return {
      level: 'likely',
      headline: `Reaching ${person.name}, ${person.title}`,
      detail: `${person.title} may influence the decision but probably is not the one who signs off.`,
      nextStep: 'Ask them who decides on this, or look for the owner or director.',
      person,
    };
  }

  if (emailKind === 'decision_role') {
    return {
      level: 'likely',
      headline: 'Likely reaching a decision-maker',
      detail: 'This address is a role (owner, director, manager), not a shared inbox.',
      nextStep: 'Find their name so the message can open with it.',
      person: null,
    };
  }
  if (emailKind === 'named') {
    return {
      level: 'likely',
      headline: 'Likely reaching one named person',
      detail: 'A personal-looking address usually reaches the person directly, but we cannot tell whether they decide.',
      nextStep: 'Add their name and role so the message is addressed to them.',
      person: null,
    };
  }
  if (emailKind === 'generic') {
    return {
      level: 'gatekeeper',
      headline: 'Likely reaching a gatekeeper',
      detail: 'Shared inboxes like info@ or contact@ are usually read by staff, not the owner.',
      nextStep: 'Find the owner or manager by name. Until then the message asks to be passed to the right person.',
      person: null,
    };
  }
  return {
    level: 'unknown',
    headline: 'Decision-maker not identified',
    detail: 'We have no named contact for this business.',
    nextStep: 'Look up the owner before sending, or let the message ask who handles this.',
    person: null,
  };
}

// ── Website extraction ────────────────────────────────────────────────────────

export interface ExtractedPerson { name: string; title: string; source: 'website' }

const NAME_STOP = /\b(our|the|team|about|contact|meet|welcome|services?|home|get|call|book|read|learn|more|clinic|dental|hotel|restaurant|limited|ltd|plc|company|group|centre|center|hospital|school|studio|salon|agency|business|office|staff|leadership|management|board|us|we|you|your|with|and|for|of)\b/i;
const NAME_RE = /^(?:(?:Dr|Mr|Mrs|Ms|Miss|Engr|Eng|Barr|Prof|Chief|Pastor|Alhaji|Alhaja|Hon|Arc|Pharm)\.?\s+)?[A-Z][a-zA-Z'’-]{1,}(?:\s+[A-Z][a-zA-Z'’-]{1,}){1,2}$/;

function plausibleName(raw: string): string | null {
  const name = raw.replace(/\s+/g, ' ').replace(/[,.:;|–—-]+$/, '').trim();
  if (name.length < 5 || name.length > 40) return null;
  if (!NAME_RE.test(name)) return null;
  if (NAME_STOP.test(name)) return null;
  return name;
}

function cleanTitle(raw: string): string {
  return raw.replace(/\s+/g, ' ').replace(/^[,.:;|–—-]+|[,.:;|–—-]+$/g, '').trim();
}

function jsonLdNodes(node: unknown, acc: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (Array.isArray(node)) {
    node.forEach((n) => jsonLdNodes(n, acc));
  } else if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    acc.push(obj);
    Object.keys(obj).forEach((k) => { if (obj[k] && typeof obj[k] === 'object') jsonLdNodes(obj[k], acc); });
  }
  return acc;
}

function fromJsonLd(html: string): ExtractedPerson[] {
  const out: ExtractedPerson[] = [];
  const blocks = Array.from(html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi));
  for (const m of blocks) {
    let parsed: unknown;
    try { parsed = JSON.parse(m[1]); } catch { continue; }
    for (const node of jsonLdNodes(parsed)) {
      const types = ([] as unknown[]).concat(node['@type'] ?? []).map(String);
      // schema.org "founder" is a person (or list) even when the node omits jobTitle.
      for (const key of ['founder', 'founders'] as const) {
        for (const f of ([] as unknown[]).concat(node[key] ?? [])) {
          const n = typeof f === 'string' ? f : (f as { name?: string })?.name;
          const name = n ? plausibleName(n) : null;
          if (name) out.push({ name, title: 'Founder', source: 'website' });
        }
      }
      if (types.includes('Person') && typeof node.name === 'string' && typeof node.jobTitle === 'string') {
        const name = plausibleName(node.name);
        const title = cleanTitle(node.jobTitle);
        if (name && titleRank(title) >= 0) out.push({ name, title, source: 'website' });
      }
    }
  }
  return out;
}

const TITLE_WORDS = '(?:owner|co-?owner|proprietor|founder|co-?founder|managing director|managing partner|ceo|chief executive(?: officer)?|chief executive|principal(?: [a-z]+)?|lead [a-z]+|medical director|clinical director|executive director|general manager|(?:practice|operations|branch|business|clinic|hotel|store|restaurant|office) manager|director|partner|president|md|manager)';

function fromText(html: string): ExtractedPerson[] {
  const text = html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/h[1-6]|\/li|\/span|\/td|\/a)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8211;|&#8212;|&ndash;|&mdash;/g, '–')
    .replace(/[ \t]+/g, ' ');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  const out: ExtractedPerson[] = [];
  const titleOnly = new RegExp(`^${TITLE_WORDS}(?:\\s*(?:&|and|/)\\s*${TITLE_WORDS})?$`, 'i');
  const nameThenTitle = new RegExp(`^(.{4,40}?)\\s*(?:,|–|—|-|\\||\\()\\s*(${TITLE_WORDS}(?:\\s*(?:&|and|/)\\s*${TITLE_WORDS})?)\\)?\\.?$`, 'i');
  const titleThenName = new RegExp(`^(${TITLE_WORDS})\\s*(?::|–|—|-|\\|)\\s*(.{4,40})$`, 'i');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > 90) continue;

    let m = line.match(nameThenTitle);
    if (m) {
      const name = plausibleName(m[1]);
      if (name) { out.push({ name, title: cleanTitle(m[2]), source: 'website' }); continue; }
    }
    m = line.match(titleThenName);
    if (m) {
      const name = plausibleName(m[2]);
      if (name) { out.push({ name, title: cleanTitle(m[1]), source: 'website' }); continue; }
    }
    // Team-card layout: the name and the title sit on adjacent lines.
    if (titleOnly.test(line)) {
      const prev = i > 0 ? plausibleName(lines[i - 1]) : null;
      const next = i + 1 < lines.length ? plausibleName(lines[i + 1]) : null;
      const name = prev ?? next;
      if (name) out.push({ name, title: cleanTitle(line), source: 'website' });
    }
  }
  return out;
}

/** Every decision-maker named on one page of HTML (strongest title first, one entry per person). */
export function extractPeople(html: string): ExtractedPerson[] {
  if (!html) return [];
  const seen = new Set<string>();
  return [...fromJsonLd(html), ...fromText(html)]
    .filter((c) => titleRank(c.title) >= 0)
    .sort((a, b) => titleRank(a.title) - titleRank(b.title))
    .filter((c) => { const k = c.name.toLowerCase().replace(/^(dr|mr|mrs|ms|miss|engr|eng|barr|prof|chief|pastor)\.?\s+/, ''); if (seen.has(k)) return false; seen.add(k); return true; });
}

/** Best decision-maker named on one page of HTML, or null. Strongest title wins. */
export function extractDecisionMaker(html: string): ExtractedPerson | null {
  return extractPeople(html)[0] ?? null;
}

// ── Titles by industry ────────────────────────────────────────────────────────

/**
 * The titles a decision-maker actually goes by in each kind of business, for search queries.
 * Matched against the Google category and place types; the first matching group wins.
 */
const INDUSTRY_TITLES: Array<{ match: RegExp; titles: string[] }> = [
  { match: /dent|orthodont|endodont|periodont/i, titles: ['principal dentist', 'practice owner', 'clinical director', 'dentist'] },
  { match: /\bvet(erinar)?/i, titles: ['practice owner', 'veterinary surgeon', 'clinical director'] },
  { match: /clinic|hospital|doctor|physician|medical|health|physio|chiropract|optic|optometr|pharma|dermatolog|surgery/i, titles: ['medical director', 'practice owner', 'clinical director', 'principal'] },
  { match: /\bspa\b|salon|beauty|barber|hair|nail|aesthetic|massage/i, titles: ['owner', 'founder', 'salon owner', 'creative director'] },
  { match: /gym|fitness|yoga|pilates|crossfit|martial/i, titles: ['owner', 'founder', 'head coach', 'general manager'] },
  { match: /\blaw\b|lawyer|attorney|solicitor|legal|notary/i, titles: ['managing partner', 'principal partner', 'senior partner', 'founder'] },
  { match: /account|tax|audit|bookkeep|financ|insurance/i, titles: ['managing partner', 'principal', 'director', 'founder'] },
  { match: /real.?estate|realtor|estate agent|propert|lodging_agent/i, titles: ['principal', 'broker', 'managing director', 'founder'] },
  { match: /hotel|lodging|resort|guest.?house|motel|hostel/i, titles: ['general manager', 'hotel manager', 'owner', 'managing director'] },
  { match: /restaurant|cafe|coffee|bar\b|bakery|food|catering|bistro|grill|pizza/i, titles: ['owner', 'founder', 'restaurant manager', 'chef patron'] },
  { match: /school|academy|college|tutor|nursery|kindergarten|daycare|education/i, titles: ['proprietor', 'principal', 'head teacher', 'director'] },
  { match: /\bcar\b|car (dealer|repair|wash)|auto|mechanic|garage|dealer|tyre|tire/i, titles: ['owner', 'dealer principal', 'general manager', 'managing director'] },
  { match: /plumb|electric|roof|construct|contractor|builder|hvac|clean|landscap|pest|locksmith/i, titles: ['owner', 'founder', 'managing director', 'operations manager'] },
  // Industry set (RUNVAX 2.0 templates): more specific than the generic "agency" row below, so they come first.
  { match: /recruit|staffing|employment agenc|hr consult|human resources/i, titles: ['founder', 'recruitment director', 'managing director', 'HR director'] },
  { match: /event|entertainment|conference|wedding planner/i, titles: ['founder', 'event director', 'CEO', 'operations manager'] },
  { match: /software|saas|information technology|managed service|app developer|it consult/i, titles: ['CEO', 'founder', 'CTO', 'head of engineering'] },
  { match: /architect|design|interior|agency|marketing|studio|photograph/i, titles: ['founder', 'principal', 'creative director', 'managing director'] },
  { match: /store|shop|retail|boutique|supermarket|pharmacy|market/i, titles: ['owner', 'founder', 'store manager', 'managing director'] },
  { match: /solar|renewable|photovoltaic|energy/i, titles: ['owner', 'CEO', 'sales director', 'operations manager'] },
  { match: /logistic|freight|courier|shipping|haulage|trucking|cargo/i, titles: ['managing director', 'operations director', 'owner', 'CEO'] },
  { match: /manufactur|factory|packaging|industrial/i, titles: ['CEO', 'owner', 'operations director', 'commercial director'] },
  { match: /wholesal|distribut|importer|supplier/i, titles: ['managing director', 'sales director', 'procurement director', 'owner'] },
];

const DEFAULT_TITLES = ['owner', 'founder', 'managing director', 'CEO'];

/** Search titles for a business, industry-specific first, then the generic ones. Max 6. */
export function industryTitles(category?: string, categoryTypes?: string[]): string[] {
  const hay = [category ?? '', ...(categoryTypes ?? [])].join(' ').replace(/_/g, ' ');
  const group = hay.trim() ? INDUSTRY_TITLES.find((g) => g.match.test(hay)) : undefined;
  const out: string[] = [];
  for (const t of [...(group?.titles ?? []), ...DEFAULT_TITLES]) {
    if (!out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  return out.slice(0, 6);
}

/** `(owner OR founder OR "managing director")` for a search query. */
export function titleQuery(titles: string[]): string {
  return `(${titles.map((t) => (t.includes(' ') ? `"${t}"` : t)).join(' OR ')})`;
}

// ── Multi-source candidates ───────────────────────────────────────────────────

export type DmSource = 'website' | 'search' | 'apollo' | 'hunter' | 'snov' | 'apify';
export type DmConfidence = 'low' | 'medium' | 'high';

export interface DmCandidate {
  name: string;
  title: string;
  linkedin?: string;
  email?: string;
  emailStatus?: string;
  phone?: string;
  source: DmSource;
  confidence: DmConfidence;
  /** Every source that independently named this person. */
  sources?: DmSource[];
  /** The page where this person was found, when we know it. */
  sourcePage?: string;
  /** How firmly they are tied to this business: 'confirmed' (their own profile names it next to a title) or 'likely'. */
  match?: 'confirmed' | 'likely';
  /** The page and snippet that put them here, so it can be checked. */
  evidence?: { url: string; snippet: string };
}

const COMPANY_NOISE = /\b(ltd|limited|llc|inc|plc|co|company|the|and|of|nigeria|ng|group|services|solutions)\b/g;

function companyTokens(s: string): string[] {
  return s.toLowerCase().replace(COMPANY_NOISE, ' ').replace(/[^a-z0-9]+/g, ' ').split(' ').filter((t) => t.length > 1);
}

/** True when `text` plausibly names the same business (most distinctive words present). */
export function companyMatches(text: string, businessName: string): boolean {
  const want = companyTokens(businessName);
  if (want.length === 0) return false;
  const hay = ` ${companyTokens(text).join(' ')} `;
  const hit = want.filter((t) => hay.includes(` ${t} `)).length;
  return hit / want.length >= (want.length <= 2 ? 1 : 0.6);
}

/**
 * A public search hit for a LinkedIn profile, e.g.
 *   "Ade Bello - Owner - Smile Dental Clinic | LinkedIn"
 *   "Ade Bello – Founder at Smile Dental | LinkedIn"
 * We read only what the search engine already shows — we never fetch linkedin.com.
 * Requires the business to be named in the title or snippet, otherwise it is another
 * person with the same job title somewhere else.
 */
export function parseLinkedInResult(
  r: { title?: string; url?: string; description?: string },
  businessName: string,
): DmCandidate | null {
  const url = r.url ?? '';
  if (!/^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\//i.test(url)) return null;
  const title = (r.title ?? '').replace(/\s*[|·]\s*LinkedIn.*$/i, '').trim();
  const parts = title.split(/\s+[-–—]\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const name = plausibleName(parts[0].replace(/,\s*(MBA|PhD|MD|FCA|ACA|MSc|BSc)\b.*$/i, ''));
  if (!name) return null;

  const rest = parts.slice(1).join(' - ');
  // "Title at Company" or "Title - Company"
  let jobTitle = '';
  const at = rest.match(/^(.+?)\s+(?:at|@)\s+(.+)$/i);
  if (at) jobTitle = at[1];
  else jobTitle = parts.slice(1).find((p) => titleRank(p) >= 0) ?? '';
  jobTitle = cleanTitle(jobTitle);
  if (titleRank(jobTitle) < 0) return null;

  const named = companyMatches(`${rest} ${r.description ?? ''}`, businessName);
  if (!named) return null;

  return { name, title: jobTitle, linkedin: url.split('?')[0], source: 'search', confidence: 'medium' };
}

/** A non-LinkedIn search snippet that names this business next to a person and a title. */
export function parseSnippetResult(
  r: { title?: string; description?: string },
  businessName: string,
): DmCandidate | null {
  const text = `${r.title ?? ''}. ${r.description ?? ''}`;
  if (!companyMatches(text, businessName)) return null;
  // "Founder of Smile Dental" -> "Founder": the extractor wants the title at the end of the line.
  const cleaned = text
    .replace(/\.\s+/g, '\n')
    .replace(new RegExp(`(${TITLE_WORDS})\\s+(?:of|at|for|@)\\s+[^\\n]+`, 'gi'), '$1');
  const found = extractDecisionMaker(cleaned);
  return found ? { name: found.name, title: found.title, source: 'search', confidence: 'low' } : null;
}

/** Apify actors disagree on field names; accept the common spellings. */
export function mapApifyItem(item: Record<string, unknown>): DmCandidate | null {
  const pick = (...keys: string[]) => {
    for (const k of keys) { const v = item[k]; if (typeof v === 'string' && v.trim()) return v.trim(); }
    return '';
  };
  const first = pick('firstName', 'first_name');
  const last = pick('lastName', 'last_name');
  const name = plausibleName(pick('fullName', 'full_name', 'name') || `${first} ${last}`.trim());
  const title = cleanTitle(pick('title', 'jobTitle', 'job_title', 'position', 'headline', 'currentPosition'));
  if (!name || titleRank(title) < 0) return null;
  const email = pick('email', 'workEmail', 'work_email').toLowerCase();
  const phone = cleanPhone(pick('phone', 'mobileNumber', 'mobile_number', 'phoneNumber', 'phone_number'));
  return {
    name, title, source: 'apify', confidence: 'medium',
    linkedin: pick('linkedinUrl', 'linkedin_url', 'linkedin', 'profileUrl', 'url') || undefined,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined,
    phone,
  };
}

/** A phone number worth keeping: 7–15 digits, optional leading +. Anything else is dropped. */
export function cleanPhone(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const p = raw.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
  const digits = p.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15 ? p : undefined;
}

/** Same person, ignoring honorifics, case and punctuation ("Dr. Ada Obi" = "ada obi"). */
export function sameName(a: string, b: string): boolean {
  const x = norm(a);
  return !!x && x === norm(b);
}

/** The email outreach should go to: the decision-maker's own address first, then the business's. */
export function recipientEmail(business: Pick<Business, 'email' | 'decisionMaker'>): string {
  return business.decisionMaker?.email || business.email || '';
}

const CONF_RANK: Record<DmConfidence, number> = { low: 0, medium: 1, high: 2 };

const norm = (n: string) => n.toLowerCase().replace(/\b(dr|mr|mrs|ms|miss|engr|eng|barr|prof|chief|pastor|alhaji|alhaja|hon|arc|pharm)\.?\s+/g, '').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();

/**
 * Collapses candidates from every source into one ranked list. The same person named by
 * two independent sources is far more likely to be real, so agreement raises confidence.
 * Ordering: strongest title first, then confidence, then how many sources agree.
 */
export function mergeCandidates(all: DmCandidate[]): DmCandidate[] {
  const byName = new Map<string, DmCandidate>();
  for (const c of all) {
    const key = norm(c.name);
    if (!key) continue;
    const prev = byName.get(key);
    if (!prev) { byName.set(key, { ...c, sources: [c.source] }); continue; }
    const sources = Array.from(new Set([...(prev.sources ?? [prev.source]), c.source]));
    const better = titleRank(c.title) >= 0 && (titleRank(prev.title) < 0 || titleRank(c.title) < titleRank(prev.title)) ? c : prev;
    // Named by the company's own website and also found on the open web: that is as firm as it gets.
    const match = prev.match === 'confirmed' || c.match === 'confirmed' || (sources.includes('website') && sources.includes('search')) ? 'confirmed' : (prev.match ?? c.match);
    const evidence = prev.evidence ?? c.evidence;
    byName.set(key, {
      ...prev,
      ...(match ? { match } : {}),
      ...(evidence ? { evidence } : {}),
      title: better.title,
      linkedin: prev.linkedin ?? c.linkedin,
      email: prev.email ?? c.email,
      emailStatus: prev.emailStatus ?? c.emailStatus,
      phone: prev.phone ?? c.phone,
      source: CONF_RANK[c.confidence] > CONF_RANK[prev.confidence] ? c.source : prev.source,
      confidence: sources.length >= 2 ? 'high' : CONF_RANK[c.confidence] > CONF_RANK[prev.confidence] ? c.confidence : prev.confidence,
      sources,
    });
  }
  const rank = (c: DmCandidate) => { const r = titleRank(c.title); return r < 0 ? 99 : r; };
  return Array.from(byName.values()).sort((a, b) =>
    rank(a) - rank(b) || CONF_RANK[b.confidence] - CONF_RANK[a.confidence] || (b.sources?.length ?? 1) - (a.sources?.length ?? 1));
}

/**
 * A result strong enough to stop spending credits: a top-tier title we have some confidence in.
 * With `needContact`, the person must also come with an email — a name alone is what the free
 * sources already give, so paid sources keep going until one returns a way to reach them.
 */
export function isStrong(c: DmCandidate | undefined, needContact = false): boolean {
  if (!c) return false;
  if (needContact && !c.email) return false;
  const r = titleRank(c.title);
  return r >= 0 && r <= 5 && (c.confidence !== 'low' || (c.sources?.length ?? 1) >= 2);
}
