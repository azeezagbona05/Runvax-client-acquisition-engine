/**
 * Campaigns the admin runs for RUNVAX's own users: the shape, the validation and the built-in writer. Pure (no server
 * imports), so the admin screen can use it too. The same flow as the customer campaign builder: pick a purpose and describe
 * it, the writer drafts a sequence, the admin reviews and edits it, tests it, then sends each email on their own confirmation.
 *
 * Honest by construction: the built-in writer never invents numbers, discounts or features; it only uses what the admin typed
 * and what RUNVAX plainly is. Links are never typed into an email: each email has at most one button to a page on the app.
 */

export type Purpose = 'announce' | 'activate_trial' | 'verify' | 'reengage' | 'feedback' | 'custom';
export type Goal = 'none' | 'claim_trial' | 'verify_email' | 'come_back';
export type PlanKind = 'free' | 'trial' | 'paid';

export interface Segment {
  /** Empty = every plan. "trial" = on a free Pro trial right now, "paid" = has paid. */
  plans: PlanKind[];
  verified: 'any' | 'yes' | 'no';
  trial: 'any' | 'claimed' | 'unclaimed';
  joinedWithinDays: number | null;
  joinedOlderThanDays: number | null;
  activeWithinDays: number | null;
  inactiveForDays: number | null;
}

export interface Step {
  subject: string;
  body: string;
  /** Days after the previous email was sent. Email 1 ignores it. */
  waitDays: number;
  ctaLabel: string;
  /** A page on this app, e.g. /claim-pro. Empty = no button. */
  ctaPath: string;
}

export interface CampaignConfig {
  goal: Goal;
  /** Stop emailing a person once they have done the goal (claimed the trial, verified, come back). */
  stopOnGoal: boolean;
  segment: Segment;
  steps: Step[];
  /** Most emails this campaign will send in one calendar day. */
  dailyCap: number;
  /** What the admin typed when asking for it. */
  brief: string;
}

export const MAX_STEPS = 5;
export const MAX_WAIT_DAYS = 30;
export const DEFAULT_DAILY_CAP = 200;
export const MAX_DAILY_CAP = 500;

export const PURPOSES: Array<{ id: Purpose; label: string; hint: string; goal: Goal; placeholder: string }> = [
  { id: 'announce', label: 'Announce something new', hint: 'A feature, a launch or an update', goal: 'come_back', placeholder: 'e.g. You can now build AI agents that qualify leads and post articles for you' },
  { id: 'activate_trial', label: 'Get free users to claim the trial', hint: 'Free accounts that have not started their free Pro', goal: 'claim_trial', placeholder: 'e.g. Pro includes email campaigns, follow-up automation and the AI agent builder' },
  { id: 'verify', label: 'Get people to verify their email', hint: 'Accounts that never confirmed their address', goal: 'verify_email', placeholder: 'e.g. You need a verified email to run campaigns' },
  { id: 'reengage', label: 'Win back quiet users', hint: 'People who have not been in for a while', goal: 'come_back', placeholder: 'e.g. We have added AI agents and a simpler campaign builder since you last visited' },
  { id: 'feedback', label: 'Ask for feedback', hint: 'One short email asking people to reply', goal: 'none', placeholder: 'e.g. What is the one thing that would make RUNVAX more useful to you?' },
  { id: 'custom', label: 'Something else', hint: 'You describe it, the writer drafts it', goal: 'none', placeholder: 'Describe what you want to tell people' },
];

export const GOALS: Array<{ id: Goal; label: string }> = [
  { id: 'none', label: 'No goal (just send the sequence)' },
  { id: 'claim_trial', label: 'They claim the free Pro trial' },
  { id: 'verify_email', label: 'They verify their email' },
  { id: 'come_back', label: 'They come back to the app' },
];

export const emptySegment = (): Segment => ({ plans: [], verified: 'any', trial: 'any', joinedWithinDays: null, joinedOlderThanDays: null, activeWithinDays: null, inactiveForDays: null });

const PURPOSE_IDS = PURPOSES.map((p) => p.id);
const GOAL_IDS = GOALS.map((g) => g.id);
export const isPurpose = (v: unknown): v is Purpose => typeof v === 'string' && (PURPOSE_IDS as string[]).includes(v);

/** What people may use inside the text. Anything else in {{ }} is removed. */
export const PLACEHOLDERS = ['name', 'plan', 'appName', 'trialDays'] as const;
const URL_RE = /https?:\/\/\S+|www\.\S+/gi;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Plain text only: no links (the button is the only link), only known placeholders, bounded length. */
export function cleanText(v: unknown, max: number, multiline = false): string {
  if (typeof v !== 'string') return '';
  let s = v.replace(/\r\n?/g, '\n').replace(URL_RE, '').replace(/\{\{\s*([A-Za-z]+)\s*\}\}/g, (m, k: string) => ((PLACEHOLDERS as readonly string[]).includes(k) ? `{{${k}}}` : ''));
  s = multiline ? s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n') : s.replace(/\s+/g, ' ');
  return s.trim().slice(0, max);
}

/** An on-app path only: letters, digits, dash, underscore and slashes. No hosts, no query strings. */
export function cleanPath(v: unknown): string {
  if (typeof v !== 'string') return '';
  const s = v.trim();
  return /^\/[A-Za-z0-9_\-/]{0,80}$/.test(s) && !s.includes('//') ? s : '';
}

const int = (v: unknown, lo: number, hi: number, d: number) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d;
};
const dayOrNull = (v: unknown) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(3650, Math.round(n)) : null;
};

export function sanitizeSegment(raw: unknown): Segment {
  const r = isObj(raw) ? raw : {};
  const plans = (Array.isArray(r.plans) ? r.plans : []).filter((p, i, a): p is PlanKind => (p === 'free' || p === 'trial' || p === 'paid') && a.indexOf(p) === i);
  return {
    plans,
    verified: r.verified === 'yes' || r.verified === 'no' ? r.verified : 'any',
    trial: r.trial === 'claimed' || r.trial === 'unclaimed' ? r.trial : 'any',
    joinedWithinDays: dayOrNull(r.joinedWithinDays), joinedOlderThanDays: dayOrNull(r.joinedOlderThanDays),
    activeWithinDays: dayOrNull(r.activeWithinDays), inactiveForDays: dayOrNull(r.inactiveForDays),
  };
}

export function sanitizeStep(raw: unknown): Step {
  const r = isObj(raw) ? raw : {};
  const path = cleanPath(r.ctaPath), label = cleanText(r.ctaLabel, 40);
  return {
    subject: cleanText(r.subject, 120), body: cleanText(r.body, 2500, true),
    waitDays: int(r.waitDays, 0, MAX_WAIT_DAYS, 0),
    // A button needs both a label and a page.
    ctaLabel: path ? label : '', ctaPath: label ? path : '',
  };
}

export function sanitizeConfig(raw: unknown): CampaignConfig {
  const r = isObj(raw) ? raw : {};
  // Drop blank emails first, then cap: a blank email must not use up one of the slots.
  const steps = (Array.isArray(r.steps) ? r.steps : []).map(sanitizeStep).filter((s) => s.subject && s.body).slice(0, MAX_STEPS);
  return {
    goal: (GOAL_IDS as unknown[]).includes(r.goal) ? (r.goal as Goal) : 'none',
    stopOnGoal: r.stopOnGoal !== false,
    segment: sanitizeSegment(r.segment),
    steps: steps.map((s, i) => (i === 0 ? { ...s, waitDays: 0 } : s)),
    dailyCap: int(r.dailyCap, 1, MAX_DAILY_CAP, DEFAULT_DAILY_CAP),
    brief: cleanText(r.brief, 600),
  };
}

/** Problems that stop a campaign being saved or sent; an empty list means it is fine. */
export function configProblems(c: CampaignConfig): string[] {
  const out: string[] = [];
  if (c.steps.length === 0) out.push('Add at least one email with a subject and a message.');
  return out;
}

export function describeSegment(s: Segment): string {
  const bits: string[] = [];
  bits.push(s.plans.length ? `${s.plans.map((p) => ({ free: 'free', trial: 'on a free trial', paid: 'paying' }[p])).join(' or ')} accounts` : 'all accounts');
  if (s.verified === 'yes') bits.push('verified');
  if (s.verified === 'no') bits.push('not verified');
  if (s.trial === 'claimed') bits.push('already claimed the trial');
  if (s.trial === 'unclaimed') bits.push('never claimed the trial');
  if (s.joinedWithinDays !== null) bits.push(`joined in the last ${s.joinedWithinDays} days`);
  if (s.joinedOlderThanDays !== null) bits.push(`joined more than ${s.joinedOlderThanDays} days ago`);
  if (s.activeWithinDays !== null) bits.push(`active in the last ${s.activeWithinDays} days`);
  if (s.inactiveForDays !== null) bits.push(`not active for ${s.inactiveForDays}+ days`);
  return bits.join(', ');
}

export interface RenderVars { name: string; plan: string; appName: string; trialDays: number }
/** First name only, never a raw email address. */
export const firstName = (name: string | null | undefined) => (name ?? '').trim().split(/\s+/)[0]?.replace(/[<>]/g, '') || 'there';
export function fillPlaceholders(text: string, v: RenderVars): string {
  return text.replace(/\{\{\s*([A-Za-z]+)\s*\}\}/g, (_m, k: string) => (k === 'name' ? v.name : k === 'plan' ? v.plan : k === 'appName' ? v.appName : k === 'trialDays' ? String(v.trialDays) : ''));
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Blank-line paragraphs, "- " bullets. Everything is escaped first, so the admin's text can never inject markup. */
export function bodyToHtml(body: string): string {
  const p = 'margin:0 0 18px;font-size:16px;line-height:1.7;color:#334155;';
  return body.split(/\n{2,}/).map((block) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length && lines.every((l) => /^[-•*]\s+/.test(l))) {
      return `<ul style="margin:0 0 18px;padding-left:22px;font-size:16px;line-height:1.7;color:#334155;">${lines.map((l) => `<li style="margin:0 0 6px;">${esc(l.replace(/^[-•*]\s+/, ''))}</li>`).join('')}</ul>`;
    }
    return `<p style="${p}">${lines.map(esc).join('<br>')}</p>`;
  }).join('');
}

// ───────────────────────── the built-in writer ─────────────────────────

const ONE_LINER = 'RUNVAX helps you find your next customers and gives you an AI workforce to approach, engage and win them.';
const SIGN = 'The {{appName}} team';

/** The sentence the admin typed, as a clean paragraph (or nothing). */
const about = (detail: string) => (detail ? (/[.!?]$/.test(detail) ? detail : `${detail}.`) : '');

/**
 * Drafts a whole campaign from a purpose and a few words. No network. The AI drafter does the same job with a model and
 * falls back to this, so the builder always works. Always passes sanitizeConfig.
 */
export function planCampaign(purpose: Purpose, detailRaw: string): { name: string; config: CampaignConfig } {
  const detail = cleanText(detailRaw, 400);
  const d = about(detail);
  const hi = 'Hi {{name}},';
  const meta = PURPOSES.find((p) => p.id === purpose)!;
  const base: CampaignConfig = { goal: meta.goal, stopOnGoal: true, segment: emptySegment(), steps: [], dailyCap: DEFAULT_DAILY_CAP, brief: detail };
  let name = meta.label;
  let steps: Step[] = [];

  switch (purpose) {
    case 'announce':
      name = detail ? `Announcement: ${detail.slice(0, 50)}` : 'Announcement';
      base.segment = { ...emptySegment(), verified: 'yes' };
      steps = [
        { subject: detail ? `New on {{appName}}: ${detail.slice(0, 70)}` : 'What is new on {{appName}}', waitDays: 0, ctaLabel: 'See what is new', ctaPath: '/client-acquisition',
          body: [hi, d || 'We have been working on {{appName}} and there is something new for you.', `${ONE_LINER}`, 'It takes a minute to look, and your work is exactly as you left it.', SIGN].join('\n\n') },
        { subject: 'In case you missed it', waitDays: 4, ctaLabel: 'Take a look', ctaPath: '/client-acquisition',
          body: [hi, `A quick reminder in case the last email got buried. ${d}`.trim(), SIGN].join('\n\n') },
      ];
      break;
    case 'activate_trial':
      name = 'Free Pro trial nudge';
      base.segment = { ...emptySegment(), plans: ['free'], verified: 'yes', trial: 'unclaimed' };
      steps = [
        { subject: 'Your {{trialDays}} free days of Pro are waiting', waitDays: 0, ctaLabel: 'Claim my free days', ctaPath: '/claim-pro',
          body: [hi, 'You have a free account, which means you can start {{trialDays}} days of {{appName}} Pro for $0. No card, nothing to cancel.', d, 'Your prospects, campaigns and settings stay exactly as they are when the trial ends.', SIGN].filter(Boolean).join('\n\n') },
        { subject: 'What you can do with Pro in ten minutes', waitDays: 3, ctaLabel: 'Start my free Pro', ctaPath: '/claim-pro',
          body: [hi, 'Ten minutes is enough to see whether {{appName}} fits how you win clients:', '- Find businesses that match who you want to work with\n- Write a personalised email sequence for them\n- Let the follow-ups run for you, with you approving what goes out', 'Pro unlocks the sending side. It is free to try.', SIGN].join('\n\n') },
        { subject: 'Last reminder about your free Pro', waitDays: 3, ctaLabel: 'Claim my free days', ctaPath: '/claim-pro',
          body: [hi, 'This is the last time we will mention it: your {{trialDays}} free days of Pro are still available.', 'If now is not the right time, no problem. You can always claim it later from your account.', SIGN].join('\n\n') },
      ];
      break;
    case 'verify':
      name = 'Verify your email';
      base.segment = { ...emptySegment(), verified: 'no' };
      steps = [
        { subject: 'One quick step to start using {{appName}}', waitDays: 0, ctaLabel: 'Open {{appName}}', ctaPath: '/auth/signin',
          body: [hi, 'Your {{appName}} account is almost ready. It just needs your email address confirmed.', d, 'Sign in and we will send a fresh confirmation link if you need one.', SIGN].filter(Boolean).join('\n\n') },
        { subject: 'Still need to confirm your email', waitDays: 3, ctaLabel: 'Open {{appName}}', ctaPath: '/auth/signin',
          body: [hi, 'A reminder that your {{appName}} account is waiting for your email to be confirmed. Until then, campaigns and AI agents stay locked.', SIGN].join('\n\n') },
      ];
      break;
    case 'reengage':
      name = 'Win back quiet users';
      base.segment = { ...emptySegment(), verified: 'yes', inactiveForDays: 14 };
      steps = [
        { subject: '{{name}}, a lot has changed in {{appName}}', waitDays: 0, ctaLabel: 'See what is new', ctaPath: '/client-acquisition',
          body: [hi, 'It has been a while since you last used {{appName}}.', d || 'We have been making it easier to find customers and follow up with them.', ONE_LINER, SIGN].join('\n\n') },
        { subject: 'Your prospects and campaigns are still here', waitDays: 4, ctaLabel: 'Pick up where I left off', ctaPath: '/client-acquisition',
          body: [hi, 'Everything you saved in {{appName}} is exactly where you left it, and it takes a minute to pick it back up.', SIGN].join('\n\n') },
        { subject: 'Should we keep your account active?', waitDays: 4, ctaLabel: 'Open {{appName}}', ctaPath: '/client-acquisition',
          body: [hi, 'This is our last note for now. If {{appName}} is not what you need right now, that is fine. If it is, your account is ready whenever you are.', 'And if something got in the way, just reply and tell us. We read every reply.', SIGN].join('\n\n') },
      ];
      break;
    case 'feedback':
      name = 'Feedback request';
      base.segment = { ...emptySegment(), verified: 'yes', joinedOlderThanDays: 7 };
      steps = [
        { subject: 'A quick question about {{appName}}', waitDays: 0, ctaLabel: '', ctaPath: '',
          body: [hi, d || 'What is the one thing that would make {{appName}} more useful to you?', 'Just reply to this email. A single sentence is plenty, and a real person reads every answer.', SIGN].join('\n\n') },
      ];
      break;
    default:
      name = detail ? detail.slice(0, 60) : 'Message to users';
      base.segment = { ...emptySegment(), verified: 'yes' };
      steps = [{ subject: detail ? detail.slice(0, 80) : 'A note from {{appName}}', waitDays: 0, ctaLabel: 'Open {{appName}}', ctaPath: '/client-acquisition', body: [hi, d || 'We wanted to reach out with a short update.', SIGN].join('\n\n') }];
  }
  return { name: cleanText(name, 120), config: sanitizeConfig({ ...base, steps }) };
}

// ───────────────────────── ready-made samples ─────────────────────────

export interface Sample { id: string; label: string; hint: string; purpose: Purpose; name: string; config: CampaignConfig }

/** Hand-written campaigns the admin can start from: real wording about what the product does today, no invented claims. */
const SAMPLE_SOURCES: Array<Omit<Sample, 'config'> & { config: unknown }> = [
  {
    id: 'v2_agents', label: 'RUNVAX 2.0 and building AI agents', hint: 'Three emails to verified users: what 2.0 is, how to build an AI agent, and a quick way to try both', purpose: 'announce',
    name: 'SAMPLE: RUNVAX 2.0 and building AI agents (test)',
    config: {
      goal: 'come_back', stopOnGoal: true, dailyCap: DEFAULT_DAILY_CAP, segment: { ...emptySegment(), verified: 'yes' },
      brief: 'Tell existing users about the RUNVAX 2.0 experience and how to build an AI agent with RUNVAX.',
      steps: [
        {
          subject: '{{name}}, meet RUNVAX 2.0: your next customers, and an AI team to win them', waitDays: 0, ctaLabel: 'Open RUNVAX 2.0', ctaPath: '/client-acquisition',
          body: [
            'Hi {{name}},',
            'RUNVAX 2.0 is live, and it is built around one idea: find the businesses you want to work with, then let an AI workforce help you approach, engage and win them.',
            'Here is what you can do in it today:\n- Find Prospects: search by industry and place and see who is worth contacting\n- Campaigns: describe your goal in plain English and RUNVAX writes the whole email sequence, follow-ups included\n- Inbox & Opportunities: replies land in one place, sorted by who is interested\n- You stay in control: you review the emails and start every campaign yourself',
            'Your account, prospects and settings carry over, and it takes a minute to look around.',
            SIGN,
          ].join('\n\n'),
        },
        {
          subject: 'Build an AI agent for your business with RUNVAX', waitDays: 3, ctaLabel: 'Build my first agent', ctaPath: '/client-acquisition/agents',
          body: [
            'Hi {{name}},',
            'Besides campaigns, RUNVAX 2.0 lets you build AI agents for your own business. Describe what you want in plain English and RUNVAX sets it up:\n- Visibility Agent: writes articles for your website, so more of the right people find you\n- Sales Assistant: chats with your website visitors, answers from what you tell it, and collects their details as leads',
            'Before you save anything, use Try it to chat with your agent or read a sample article. When you are happy with it, deploy it to your website, WordPress or Telegram.',
            'An agent only runs once you switch it on, and every visitor is told they are talking to an AI.',
            SIGN,
          ].join('\n\n'),
        },
        {
          subject: 'A quick way to see RUNVAX 2.0 working for you', waitDays: 4, ctaLabel: 'Open RUNVAX', ctaPath: '/client-acquisition',
          body: [
            'Hi {{name}},',
            'If you have not had a look yet, here is the quickest path:\n- Open AI Agents and describe your business in a sentence or two\n- Use Try it to see how your agent answers a visitor\n- Then open Campaigns and describe who you want to reach',
            'Something not working the way you expected, or a question? Just reply to this email. A real person reads every reply.',
            SIGN,
          ].join('\n\n'),
        },
      ],
    },
  },
];

export const SAMPLES: Sample[] = SAMPLE_SOURCES.map((x) => ({ ...x, config: sanitizeConfig(x.config) }));
export const sampleById = (id: unknown): Sample | null => SAMPLES.find((x) => x.id === id) ?? null;

/** The instruction for the AI drafter. The model's answer is never trusted: it goes through sanitizeConfig. */
export function aiSystemPrompt(): string {
  return [
    'You write email campaigns that the RUNVAX team sends to its own users. RUNVAX helps businesses find their next customers and gives them an AI workforce to approach, engage and win them.',
    'Return JSON only: {"name": string, "steps": [{"subject": string, "body": string, "waitDays": number, "ctaLabel": string, "ctaPath": string}]}.',
    'Write 1 to 5 emails. Email 1 has waitDays 0; later emails wait 2 to 7 days. Plain, warm, short paragraphs separated by a blank line; "- " for bullet lines.',
    'Open with "Hi {{name}},". You may use {{name}}, {{appName}}, {{trialDays}} and {{plan}} and nothing else in double braces. End with "The {{appName}} team".',
    'NEVER put links or URLs in the text. NEVER invent numbers, discounts, deadlines, customer results or features that were not given to you.',
    'ctaPath must be one of: /client-acquisition, /client-acquisition/find, /client-acquisition/campaigns, /client-acquisition/agents, /claim-pro, /auth/signin, or empty. Give ctaLabel only when ctaPath is set.',
  ].join('\n');
}
