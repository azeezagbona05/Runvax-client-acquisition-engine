/**
 * The campaign setup: what the user wants to achieve, what they are offering and to whom. Everything the
 * builder writes (the emails, the follow-ups, the goal tracking) comes from this brief, whether the user filled
 * the form in or just typed their goal and let the agent work it out.
 */

export type Objective = 'book_meetings' | 'get_replies' | 'generate_leads' | 'promote_offer' | 'reactivate';

export const OBJECTIVES: Array<{ id: Objective; label: string; hint: string; unit: string }> = [
  { id: 'book_meetings', label: 'Book Meetings', hint: 'Get qualified prospects to book a demo or a call', unit: 'meetings' },
  { id: 'get_replies', label: 'Start Conversations', hint: 'Get decision-makers to reply and talk', unit: 'conversations' },
  { id: 'generate_leads', label: 'Generate Leads', hint: 'Get prospects to ask for more information', unit: 'leads' },
  { id: 'promote_offer', label: 'Promote an Offer', hint: 'Tell the right people about a product, launch or deal', unit: 'responses' },
  { id: 'reactivate', label: 'Re-engage Contacts', hint: 'Win back people who went quiet', unit: 'replies' },
];

export interface CampaignBrief {
  name: string;
  objective: Objective;
  /** The product or service being offered, e.g. "Dental AI Hub: AI Patient Acquisition System". */
  offer: string;
  /** One or two sentences on what it does for the audience. */
  offerSummary: string;
  /** What it includes, one per item, e.g. "AI Receptionist: answers patient enquiries and helps book appointments". */
  features: string[];
  /** Who it is for, e.g. "Dental clinics in Nigeria". */
  audience: string;
  /** What success looks like, e.g. "Generate 10 qualified demo bookings from clinic decision-makers". */
  goal: string;
  /** How the emails end, e.g. "Dental AI Hub Team\nHarzotech Innovative Solutions". */
  signOff: string;
  /** The official or saved template this campaign started from (library config drives the wording and stage names). */
  templateId?: string;
  /** What the campaign asks people to do. */
  conversion?: Conversion;
  /** The geographical market, e.g. "United Kingdom". */
  market?: string;
  /** Channels the user wants. Only email sends today. */
  channels?: string[];
}

export type Conversion = 'demo_booking' | 'sales_enquiry' | 'product_purchase' | 'viewing' | 'general_enquiry';
export const CONVERSIONS: Array<{ id: Conversion; label: string }> = [
  { id: 'demo_booking', label: 'Book a demonstration' },
  { id: 'sales_enquiry', label: 'Make a sales enquiry' },
  { id: 'product_purchase', label: 'Buy the product' },
  { id: 'viewing', label: 'Book a property viewing' },
  { id: 'general_enquiry', label: 'Send a general enquiry' },
];
const CONV_IDS = CONVERSIONS.map((c) => c.id);
const CHANNEL_IDS = ['email', 'whatsapp', 'sms', 'linkedin'];

export const emptyBrief = (): CampaignBrief => ({ name: '', objective: 'book_meetings', offer: '', offerSummary: '', features: [], audience: '', goal: '', signOff: '' });

const URL_RE = /https?:\/\/\S+|www\.\S+/gi;
const line = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(URL_RE, '').replace(/\s+/g, ' ').trim().slice(0, max) : '');
const OBJ_IDS = OBJECTIVES.map((o) => o.id);

/** Makes any input a safe brief: trimmed, links removed, lengths limited, objective valid. */
export function sanitizeBrief(raw: unknown): CampaignBrief {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const feats = Array.isArray(r.features) ? r.features : typeof r.features === 'string' ? r.features.split('\n') : [];
  const signOff = typeof r.signOff === 'string' ? r.signOff.replace(URL_RE, '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 3).map((l) => l.slice(0, 120)).join('\n') : '';
  return {
    name: line(r.name, 120),
    objective: OBJ_IDS.includes(r.objective as Objective) ? (r.objective as Objective) : 'book_meetings',
    offer: line(r.offer, 120),
    offerSummary: line(r.offerSummary, 500),
    features: feats.map((f) => line(f, 220)).filter(Boolean).slice(0, 8),
    audience: line(r.audience, 160),
    goal: line(r.goal, 220),
    signOff,
    ...(typeof r.templateId === 'string' && /^[a-z0-9_-]{1,60}$/i.test(r.templateId) ? { templateId: r.templateId } : {}),
    ...(CONV_IDS.includes(r.conversion as Conversion) ? { conversion: r.conversion as Conversion } : {}),
    ...(line(r.market, 120) ? { market: line(r.market, 120) } : {}),
    ...(Array.isArray(r.channels) ? { channels: r.channels.filter((c): c is string => typeof c === 'string' && CHANNEL_IDS.includes(c)).slice(0, 4) } : {}),
  };
}

export const briefIsBlank = (b: CampaignBrief): boolean => !b.offer && !b.audience && !b.goal && !b.offerSummary && b.features.length === 0;

/** "Dental AI Hub: AI Patient Acquisition System" or "Dental AI Hub – …" gives "Dental AI Hub". */
export function shortOffer(offer: string): string {
  const head = offer.split(/\s[–—:-]\s|:\s/)[0].trim();
  return head || offer.trim();
}

const titleCase = (s: string) => fixAcronyms(s.replace(/\b([a-z])([a-z']*)/gi, (_, a: string, b: string) => (b.length <= 1 && /^(a|an|of|in|to|for|the|and)$/i.test(a + b) ? a + b : `${a.toUpperCase()}${b}`)));
/** Keeps AI, SEO, CRM and similar in capitals. */
const fixAcronyms = (s: string) => s.replace(/\b(ai|seo|crm|sms|pos|erp|hr|api)\b/gi, (m) => m.toUpperCase());
const AUDIENCE_NOUNS = 'clinics?|restaurants?|hotels?|schools?|agencies|agency|firms?|salons?|barbers?|shops?|stores?|businesses|companies|startups?|dentists?|doctors?|lawyers?|gyms?|hospitals?|pharmacies|cafes?|cafés?|bakeries|estates?|realtors?|accountants?|contractors?|owners?|practices|labs?';
const PLURAL = { meetings: 'meetings', replies: 'replies', leads: 'leads', demos: 'demo bookings', calls: 'calls', bookings: 'bookings' } as const;

/**
 * Works out a brief from plain English: "Book demos for my Dental AI Hub with dental clinics in Nigeria, 10 demos".
 * It only fills what it can read; the rest stays empty for the user (or the AI) to complete.
 */
export function briefFromText(text: string): CampaignBrief {
  const t = text.replace(/\s+/g, ' ').trim();
  const b = emptyBrief();
  if (!t) return b;

  b.objective = objectiveOf(t);

  const aud = t.match(new RegExp(`\\b((?:[A-Za-z-]+\\s){0,2}(?:${AUDIENCE_NOUNS}))(?:\\s+in\\s+([A-Z][A-Za-z]+(?:\\s[A-Z][A-Za-z]+)?))?`, 'i'));
  if (aud) {
    const noun = aud[1].replace(/^(?:the|our|my|some|all|local|with|to|for|and|a|an)\s+/i, '').trim();
    b.audience = capitalise(`${noun}${aud[2] ? ` in ${aud[2]}` : ''}`);
  }

  // "sell AI agents to dental clinics, visibility, receptionist, follow up and patient reactivation"
  const sell = t.match(/\b(?:sell|selling|offer|offering|pitch|pitching|promote|promoting|market|marketing|introduce)\s+(?:my\s+|our\s+|the\s+)?([A-Za-z0-9&' -]{2,60}?)\s+(?:to|for)\s+([A-Za-z' -]{3,80}?)(?=\s*(?:[,.;:(]|\bwith\b|\bincluding\b|\blike\b|\bsuch as\b|$))(?:\s*(?:[,:(]|\bwith\b|\bincluding\b|\blike\b|\bsuch as\b)\s*(.+))?$/i);
  if (sell) {
    b.offer = titleCase(sell[1].trim());
    const where = sell[2].match(/^(.*?)\s+in\s+([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+)?)$/);
    b.audience = capitalise(pluralise((where ? where[1] : sell[2]).trim().replace(/^(?:the|all|local)\s+/i, '')) + (where ? ` in ${where[2]}` : ''));
    if (sell[3]) {
      const people = /dental|dentist|clinic|medical|hospital|pharmac|physio|optic|vet|doctor|health/i.test(b.audience) ? 'patients' : 'customers';
      b.features = listItems(sell[3]).filter((x) => !KNOB_RE.test(x)).map((x) => expandFeature(x).replace(/customers/g, people)).slice(0, 8);
      // Features such as "patient reactivation" describe the product, not what this campaign is for.
      b.objective = objectiveOf(t.slice(0, t.length - sell[3].length));
    }
  } else {
    const off = t.match(/\b(?:my|our|the)\s+([A-Za-z0-9&' ]{3,50}?)(?=\s+(?:to|for|with|so|that|which)\b|[,.;]|$)/i);
    if (off && !new RegExp(`^(?:${AUDIENCE_NOUNS})$`, 'i').test(off[1].trim())) b.offer = titleCase(off[1].trim());
  }
  if (b.offer && b.features.length) {
    const people = /dental|dentist|clinic|medical|hospital|pharmac|physio|optic|vet|doctor|health/i.test(b.audience) ? 'patients' : 'customers';
    b.offerSummary = summaryFromFeatures(b.offer, b.audience, b.features).replace(/customers/g, people);
  }

  const num = t.match(/(\d{1,4})\s*(?:qualified\s+)?(demos?|meetings?|calls?|leads?|repl(?:y|ies)|bookings?)/i);
  if (num) {
    const kind = num[2].toLowerCase().replace(/s$/, '').replace('repl(y|ie)', 'repl');
    const word = kind.startsWith('demo') ? PLURAL.demos : kind.startsWith('meeting') ? PLURAL.meetings : kind.startsWith('call') ? PLURAL.calls : kind.startsWith('lead') ? PLURAL.leads : kind.startsWith('book') ? PLURAL.bookings : PLURAL.replies;
    b.goal = `Generate ${num[1]} qualified ${word}${b.audience ? ` from ${b.audience.toLowerCase()}` : ''}`;
  }
  if (sell && !b.goal && b.audience) b.goal = b.objective === 'book_meetings' ? `Book demos with ${lowerFirst(b.audience)}` : b.objective === 'reactivate' ? `Win back ${lowerFirst(b.audience)}` : `Start conversations with ${lowerFirst(b.audience)}`;
  b.name = [b.offer || '', b.audience || ''].filter(Boolean).join(': ');
  return b;
}

/** The campaign objective a request implies. */
function objectiveOf(t: string): Objective {
  return /reactivat|win.?back|re-?engage|inactive|dormant|went quiet/i.test(t) ? 'reactivate'
    : /book|demo|meeting|call|appointment|consultation/i.test(t) ? 'book_meetings'
    : /lead|enquir|inquir|sign.?up|waitlist|more information|brochure/i.test(t) ? 'generate_leads'
    : /promot|launch|announce|discount|offer\b|campaign for/i.test(t) ? 'promote_offer'
    : /repl|convers|talk|feedback|survey/i.test(t) ? 'get_replies' : 'book_meetings';
}

const lowerFirst = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const capitalise = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** "dental clinic" gives "dental clinics"; already-plural or uncountable phrases stay as they are. */
function pluralise(s: string): string {
  if (!s || /s$/i.test(s) || /\b(?:staff|people|owners? of)\b/i.test(s)) return s;
  if (/(?:ch|sh|x)$/i.test(s)) return `${s}es`;
  if (/[^aeiou]y$/i.test(s)) return `${s.slice(0, -1)}ies`;
  return `${s}s`;
}

/** Sequence settings ("3 emails", "follow up after 4 days", "20 a day") are not product features. */
const KNOB_RE = /\b\d+\s*(?:emails?|days?|touch(?:es)?|steps?|messages?)\b|\b(?:a|per)\s+day\b|\bstop (?:when|if)\b|\b(?:formal|friendly|direct) tone\b|^(?:one|two|three|four|five) emails?$/i;

/** "visibility, receptionist, follow up and patient reactivation" gives the four items. */
function listItems(s: string): string[] {
  return s.replace(/[.)]+$/, '').split(/\s*(?:,|;|\/|\band\b|&|\+)\s*/i).map((x) => x.replace(/^(?:an?|the)\s+/i, '').trim()).filter((x) => x.length > 1 && x.length < 60);
}

/** What well-known parts of an AI offer do, so a one-word feature becomes a line a prospect understands. */
const FEATURE_LINES: Array<{ re: RegExp; name?: string; does: string; verb: string }> = [
  { re: /visib|seo|google|search|found|discover/i, name: 'AI Visibility', does: 'gets you found on Google, Maps and AI search when new customers look for you', verb: 'get found by new customers' },
  { re: /reception|front ?desk|answer|call|phone/i, name: 'AI Receptionist', does: 'answers every enquiry and call day or night and books appointments', verb: 'answer every enquiry, day or night' },
  { re: /follow|nurtur/i, name: 'Automated Follow-up', does: 'follows up every enquiry until it becomes a booking, so no lead is forgotten', verb: 'follow up every lead automatically' },
  { re: /reactiv|win ?back|recall|dormant|lapsed|re-?engag/i, does: 'brings back past customers who are due a visit, with friendly reminders', verb: 'bring back past customers' },
  { re: /review|reputation|rating/i, name: 'Review Booster', does: 'asks happy customers for reviews so your rating keeps growing', verb: 'grow your reviews' },
  { re: /book|appoint|schedul|calendar/i, name: 'Smart Booking', does: 'lets customers book themselves in, with reminders that cut no-shows', verb: 'fill your calendar' },
  { re: /whatsapp|chat ?bot|chat|message|sms/i, name: 'AI Chat Assistant', does: 'replies on WhatsApp and website chat instantly, in your tone', verb: 'reply instantly on chat' },
  { re: /lead|prospect|acquisi/i, name: 'Lead Generation', does: 'brings in new enquiries from the people most likely to buy', verb: 'bring in new enquiries' },
  { re: /social|content|post|market/i, name: 'AI Content', does: 'keeps your social pages active with posts that bring enquiries', verb: 'keep your social pages active' },
];

/** "receptionist" gives "AI Receptionist: answers every enquiry and call day or night and books appointments". */
export function expandFeature(item: string): string {
  const raw = item.trim();
  if (raw.includes(':')) return raw;
  const hit = FEATURE_LINES.find((f) => f.re.test(raw));
  if (!hit) return titleCase(raw);
  // The user's own words name the feature ("Patient Reactivation"); well-known ones get their usual name.
  const name = hit.name && raw.split(/\s+/).length <= 2 && !/patient|client|customer|member/i.test(raw) ? hit.name : titleCase(raw);
  return `${name}: ${hit.does}`;
}

/** One sentence on what the offer does, built only from the features the user named. */
function summaryFromFeatures(offer: string, audience: string, features: string[]): string {
  const verbs = features.map((f) => FEATURE_LINES.find((x) => x.re.test(f.split(':')[0]))?.verb).filter((v): v is string => !!v);
  const uniq = Array.from(new Set(verbs));
  const who = audience ? audience.replace(/\s+in\s+.+$/i, '').toLowerCase() : 'businesses';
  if (!uniq.length) return `${offer} ${/s$/i.test(offer) ? 'help' : 'helps'} ${who} win and keep more customers.`;
  const list = uniq.length === 1 ? uniq[0] : `${uniq.slice(0, -1).join(', ')} and ${uniq[uniq.length - 1]}`;
  return `${offer} ${/s$/i.test(offer) ? 'help' : 'helps'} ${who} ${list}.`;
}

/** The goal as a number and a unit when it contains one ("Generate 10 qualified demo bookings" gives 10), else null. */
export function goalTarget(goal: string): number | null {
  const m = goal.match(/\b(\d{1,4})\b/);
  return m ? Number(m[1]) : null;
}

/**
 * One grammatical sentence about the offer from its name and a summary that may be a noun phrase ("An AI assistant that…"),
 * a "we" sentence, or already start with the name. Avoids the fragment "At X, an AI assistant that…".
 */
export function describeOffer(short: string, summary: string): string {
  const t = summary.trim();
  if (!t) return '';
  const lowerFirst = (x: string) => (x ? x.charAt(0).toLowerCase() + x.slice(1) : x);
  const esc = short.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const body = /^we\b/i.test(t) ? `At ${short}, ${lowerFirst(t)}`
    : short && new RegExp(`^${esc}\\b`, 'i').test(t) ? t
    : /^(helps?|brings?|gives?|lets?|makes?|keeps?|turns?)\b/i.test(t) ? `${short} ${lowerFirst(t)}`
    : `${short} is ${lowerFirst(t)}`;
  return /[.!?]$/.test(body) ? body : `${body}.`;
}
