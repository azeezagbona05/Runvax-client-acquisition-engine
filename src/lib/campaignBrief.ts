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

const titleCase = (s: string) => s.replace(/\b([a-z])([a-z']*)/gi, (_, a: string, b: string) => (b.length <= 1 && /^(a|an|of|in|to|for|the|and)$/i.test(a + b) ? a + b : `${a.toUpperCase()}${b}`));
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

  b.objective = /reactivat|win.?back|re-?engage|inactive|dormant|went quiet/i.test(t) ? 'reactivate'
    : /book|demo|meeting|call|appointment|consultation/i.test(t) ? 'book_meetings'
    : /lead|enquir|inquir|sign.?up|waitlist|more information|brochure/i.test(t) ? 'generate_leads'
    : /promot|launch|announce|discount|offer\b|campaign for/i.test(t) ? 'promote_offer'
    : /repl|convers|talk|feedback|survey/i.test(t) ? 'get_replies' : 'book_meetings';

  const aud = t.match(new RegExp(`\\b((?:[A-Za-z-]+\\s){0,2}(?:${AUDIENCE_NOUNS}))(?:\\s+in\\s+([A-Z][A-Za-z]+(?:\\s[A-Z][A-Za-z]+)?))?`, 'i'));
  if (aud) {
    const noun = aud[1].replace(/^(?:the|our|my|some|all|local|with|to|for|and|a|an)\s+/i, '').trim();
    b.audience = capitalise(`${noun}${aud[2] ? ` in ${aud[2]}` : ''}`);
  }

  const off = t.match(/\b(?:my|our|the)\s+([A-Za-z0-9&' ]{3,50}?)(?=\s+(?:to|for|with|so|that|which)\b|[,.;]|$)/i);
  if (off && !new RegExp(`^(?:${AUDIENCE_NOUNS})$`, 'i').test(off[1].trim())) b.offer = titleCase(off[1].trim());

  const num = t.match(/(\d{1,4})\s*(?:qualified\s+)?(demos?|meetings?|calls?|leads?|repl(?:y|ies)|bookings?)/i);
  if (num) {
    const kind = num[2].toLowerCase().replace(/s$/, '').replace('repl(y|ie)', 'repl');
    const word = kind.startsWith('demo') ? PLURAL.demos : kind.startsWith('meeting') ? PLURAL.meetings : kind.startsWith('call') ? PLURAL.calls : kind.startsWith('lead') ? PLURAL.leads : kind.startsWith('book') ? PLURAL.bookings : PLURAL.replies;
    b.goal = `Generate ${num[1]} qualified ${word}${b.audience ? ` from ${b.audience.toLowerCase()}` : ''}`;
  }
  b.name = [b.offer || '', b.audience || ''].filter(Boolean).join(': ');
  return b;
}

const capitalise = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** The goal as a number and a unit when it contains one ("Generate 10 qualified demo bookings" gives 10), else null. */
export function goalTarget(goal: string): number | null {
  const m = goal.match(/\b(\d{1,4})\b/);
  return m ? Number(m[1]) : null;
}
