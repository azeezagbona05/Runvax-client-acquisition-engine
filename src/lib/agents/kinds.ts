import { cleanUrl, hostOf } from './html';

/** The agent templates. Each kind has its own settings; they share the business description, tone and deployment keys. */
export type AgentKind = 'visibility' | 'assistant';
export const AGENT_KINDS: Record<AgentKind, { label: string; tagline: string; does: string; where: string[]; example: string }> = {
  visibility: {
    label: 'Visibility Agent',
    tagline: 'Keeps your website fresh so buyers and AI search find you',
    does: 'Writes helpful, search-friendly articles about your business on a schedule. You approve them (or let it publish) and they go to your site, your WordPress, an RSS feed or any tool you connect.',
    where: ['Any website (embed)', 'WordPress', 'RSS / webhook', 'Hosted page'],
    example: 'We are a logistics company in Lagos. Publish two articles a week for importers about customs, delivery times and cost.',
  },
  assistant: {
    label: 'Sales Assistant',
    tagline: 'Answers visitors, qualifies them, and hands you the leads',
    does: 'A chat agent that knows your business. It answers questions, asks your qualifying questions, collects the contact details and tells you about every warm lead. Put it on your website or on Telegram.',
    where: ['Website chat widget', 'Telegram bot'],
    example: 'We sell payroll software to SMEs. Greet visitors, ask company size and current tool, and book a demo with warm leads.',
  },
};
export const isKind = (v: unknown): v is AgentKind => v === 'visibility' || v === 'assistant';

export const TONES = ['friendly', 'professional', 'expert', 'conversational'] as const;
export type Tone = (typeof TONES)[number];
export const CADENCES = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 } as const;
export type Cadence = keyof typeof CADENCES;
export const LENGTHS = { short: 350, medium: 650, long: 1000 } as const;
export type Length = keyof typeof LENGTHS;

export interface Business { name: string; url: string; about: string; audience: string }
export interface VisibilityConfig {
  business: Business; tone: Tone; topics: string[]; keywords: string[]; cadence: Cadence; postsPerRun: number; approval: 'review' | 'auto'; length: Length;
  destinations: { embed: boolean; hosted: boolean; rss: boolean; webhookUrl: string; wordpress: { siteUrl: string; username: string; status: 'draft' | 'publish' } | null };
  allowedDomains: string[];
}
export interface AssistantConfig {
  business: Business; tone: Tone; goal: 'qualify' | 'book' | 'support' | 'all'; greeting: string; knowledge: string; questions: string[];
  calendarUrl: string; privacyUrl: string; notifyEmail: string; channels: { web: boolean; telegram: boolean; telegramBot: string }; allowedDomains: string[];
}
export type AgentConfig = VisibilityConfig | AssistantConfig;

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max) : '');
const list = (v: unknown, n: number, max: number) => (Array.isArray(v) ? v : typeof v === 'string' ? v.split(/\n|,/) : []).map((x) => str(x, max)).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).slice(0, n);
const pick = <T extends string>(v: unknown, all: readonly T[], d: T): T => (all.includes(v as T) ? (v as T) : d);
const domains = (v: unknown) => list(v, 10, 100).map(hostOf).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i);
const business = (v: unknown): Business => {
  const b = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return { name: str(b.name, 100), url: cleanUrl(b.url), about: str(b.about, 1200), audience: str(b.audience, 300) };
};
const email = (v: unknown) => { const t = str(v, 160); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? t.toLowerCase() : ''; };

export function sanitizeConfig(kind: AgentKind, raw: unknown): AgentConfig {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const b = business(c.business), tone = pick(c.tone, TONES, 'professional');
  if (kind === 'visibility') {
    const d = (c.destinations ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const wp = d.wordpress && typeof d.wordpress === 'object' ? { siteUrl: cleanUrl(d.wordpress.siteUrl, true), username: str(d.wordpress.username, 100), status: d.wordpress.status === 'publish' ? 'publish' as const : 'draft' as const } : null;
    return {
      business: b, tone, topics: list(c.topics, 20, 140), keywords: list(c.keywords, 12, 60), cadence: pick(c.cadence, Object.keys(CADENCES) as Cadence[], 'weekly'),
      postsPerRun: Math.min(3, Math.max(1, Math.floor(Number(c.postsPerRun) || 1))), approval: c.approval === 'auto' ? 'auto' : 'review', length: pick(c.length, Object.keys(LENGTHS) as Length[], 'medium'),
      destinations: { embed: d.embed !== false, hosted: d.hosted !== false, rss: d.rss !== false, webhookUrl: cleanUrl(d.webhookUrl, true), wordpress: wp && wp.siteUrl && wp.username ? wp : null },
      allowedDomains: domains(c.allowedDomains),
    };
  }
  const ch = (c.channels ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    business: b, tone, goal: pick(c.goal, ['qualify', 'book', 'support', 'all'] as const, 'qualify'),
    greeting: str(c.greeting, 300) || `Hi! I am the assistant for ${b.name || 'this business'}. How can I help?`,
    knowledge: str(c.knowledge, 8000), questions: list(c.questions, 5, 160), calendarUrl: cleanUrl(c.calendarUrl, true), privacyUrl: cleanUrl(c.privacyUrl, true), notifyEmail: email(c.notifyEmail),
    channels: { web: ch.web !== false, telegram: !!ch.telegram, telegramBot: str(ch.telegramBot, 64).replace(/^@/, '') }, allowedDomains: domains(c.allowedDomains),
  };
}

/** What is missing before an agent can be switched on. Plain sentences. */
export function configIssues(kind: AgentKind, cfg: AgentConfig): string[] {
  const out: string[] = []; const b = cfg.business;
  if (!b.name) out.push('Add your business name.');
  if (!b.about) out.push('Say what your business does, in a sentence or two.');
  if (kind === 'visibility') { const v = cfg as VisibilityConfig; if (v.topics.length === 0) out.push('Add at least one topic to write about.'); }
  else { const a = cfg as AssistantConfig; if (!a.knowledge && !b.about) out.push('Tell the assistant what it should know.'); if (!a.channels.web && !a.channels.telegram) out.push('Choose where the assistant works: website or Telegram.'); }
  return out;
}

export const nextRunFrom = (cfg: AgentConfig, from = new Date()) => 'cadence' in cfg ? new Date(from.getTime() + CADENCES[cfg.cadence] * 86_400_000) : null;

/** What every visitor is told before they type: it is an AI, and what happens to what they say. Same words on the website widget, the hosted page and Telegram. */
export const disclosureText = (cfg: AssistantConfig) => `You are chatting with an AI assistant. Your messages are saved and shared with ${cfg.business.name || 'this business'} so the team can follow up.`;
