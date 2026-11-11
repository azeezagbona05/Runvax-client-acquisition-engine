/**
 * Admin campaigns for RUNVAX's own users. They run on the SAME engine as the customer campaign builder: a campaign is an
 * `Automation` (the email sequence with each follow-up's wait and condition, reply rules, a reply playbook) plus a set of leads.
 * Here the leads are RUNVAX users, picked by audience filters, and the campaign is owned by the admin's own account.
 * That gives the admin the same follow-ups, open and click tracking, reply handling and pipeline as the front end.
 *
 * Pure (no server imports), so the admin screen can use it too. The built-in writer never invents numbers, discounts or features.
 * The engine removes links from the copy, so the one link (a page on this app) travels in {{website}}.
 */
import { sanitizeAutomation, validateAutomation, type Automation, type AutoEmail } from '@/lib/automation';
import { defaultPlaybook } from '@/lib/replyPlaybook';
import { emptyBrief, type CampaignBrief } from '@/lib/campaignBrief';

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

/** A whole admin campaign before it is saved: who, what they should do, which page the link opens, and the engine automation. */
export interface PlatformPlan {
  name: string;
  purpose: Purpose;
  goal: Goal;
  /** Stop following up with someone once they have done the goal. */
  stopOnGoal: boolean;
  segment: Segment;
  /** The page on this app that {{website}} opens. */
  linkPath: string;
  automation: Automation;
}

export const PURPOSES: Array<{ id: Purpose; label: string; hint: string; goal: Goal; placeholder: string }> = [
  { id: 'announce', label: 'Announce something new', hint: 'A feature, a launch or an update', goal: 'come_back', placeholder: 'e.g. You can now build AI agents that qualify leads and post articles for you' },
  { id: 'activate_trial', label: 'Get free users to claim the trial', hint: 'Free accounts that have not started their free Pro', goal: 'claim_trial', placeholder: 'e.g. Pro includes email campaigns, follow-up automation and the AI agent builder' },
  { id: 'verify', label: 'Get people to verify their email', hint: 'Accounts that never confirmed their address', goal: 'verify_email', placeholder: 'e.g. You need a verified email to run campaigns' },
  { id: 'reengage', label: 'Win back quiet users', hint: 'People who have not been in for a while', goal: 'come_back', placeholder: 'e.g. We have added AI agents and a simpler campaign builder since you last visited' },
  { id: 'feedback', label: 'Ask for feedback', hint: 'A short email asking people to reply', goal: 'none', placeholder: 'e.g. What is the one thing that would make RUNVAX more useful to you?' },
  { id: 'custom', label: 'Something else', hint: 'You describe it, the writer drafts it', goal: 'none', placeholder: 'Describe what you want to tell people' },
];

export const GOALS: Array<{ id: Goal; label: string }> = [
  { id: 'none', label: 'No goal (just run the sequence)' },
  { id: 'claim_trial', label: 'They claim the free Pro trial' },
  { id: 'verify_email', label: 'They verify their email' },
  { id: 'come_back', label: 'They come back to the app' },
];

/** The pages a campaign's link can open (all on this app; the link is built from the app's own address). */
export const LINK_PAGES = [
  { path: '/client-acquisition', label: 'Client Acquisition home' },
  { path: '/client-acquisition/find', label: 'Find Prospects' },
  { path: '/client-acquisition/campaigns', label: 'Campaigns' },
  { path: '/client-acquisition/agents', label: 'AI Agents' },
  { path: '/claim-pro', label: 'Claim free Pro page' },
  { path: '/auth/signin', label: 'Sign-in page' },
];
const LINK_PATHS = LINK_PAGES.map((p) => p.path);

export const emptySegment = (): Segment => ({ plans: [], verified: 'any', trial: 'any', joinedWithinDays: null, joinedOlderThanDays: null, activeWithinDays: null, inactiveForDays: null });

const GOAL_IDS = GOALS.map((g) => g.id);
export const isPurpose = (v: unknown): v is Purpose => typeof v === 'string' && PURPOSES.some((p) => p.id === v);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

const URL_RE = /https?:\/\/\S+|www\.\S+/gi;
/** Plain text only: no links, bounded length. */
export function cleanText(v: unknown, max: number): string {
  return typeof v === 'string' ? v.replace(URL_RE, '').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

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

/** First name only, never a raw email address. */
export const firstName = (name: string | null | undefined) => (name ?? '').trim().split(/\s+/)[0]?.replace(/[<>]/g, '') || 'there';

/**
 * Makes any input a safe plan. The automation goes through the engine's own sanitiser (links and unknown placeholders removed,
 * auto-send refused, limits clamped); the rest is clamped here. Returns null when there is no usable email.
 */
export function sanitizePlan(raw: unknown): PlatformPlan | null {
  const r = isObj(raw) ? raw : null;
  if (!r) return null;
  const automation = sanitizeAutomation(r.automation);
  if (!automation) return null;
  const name = cleanText(r.name, 120) || automation.name;
  return {
    name,
    purpose: isPurpose(r.purpose) ? r.purpose : 'custom',
    goal: (GOAL_IDS as unknown[]).includes(r.goal) ? (r.goal as Goal) : 'none',
    stopOnGoal: r.stopOnGoal !== false,
    segment: sanitizeSegment(r.segment),
    linkPath: typeof r.linkPath === 'string' && LINK_PATHS.includes(r.linkPath) ? r.linkPath : '/client-acquisition',
    automation: { ...automation, name },
  };
}

export const planProblems = (p: PlatformPlan): string[] => validateAutomation(p.automation);

// ───────────────────────── the built-in writer and samples ─────────────────────────

const mail = (subject: string, body: string[], waitDays: number, extra: Partial<AutoEmail> = {}): AutoEmail => ({ subject, body: body.join('\n\n'), waitDays, sendIf: 'no_reply', ...extra });
const LINE = 'Have a look: {{website}}';

function brief(name: string, offer: string, summary: string, goal: string): CampaignBrief {
  return { ...emptyBrief(), name, objective: 'promote_offer', offer, offerSummary: summary, audience: 'RUNVAX users', goal, signOff: 'The RUNVAX team' };
}

function build(name: string, emails: AutoEmail[], b: CampaignBrief, dailyCap = 100): Automation {
  const a = sanitizeAutomation({
    name, emails, stopOnReply: true, replyRules: { notifyInterested: true, outOfOfficePauseDays: 3 }, sendMode: 'review',
    dailyCap, windowStart: 9, windowEnd: 17, weekdaysOnly: true, brief: b, playbook: defaultPlaybook(b, 'Best regards,'),
  });
  if (!a) throw new Error('A built-in campaign has no usable email');
  return a;
}

export interface Sample { id: string; label: string; hint: string; plan: PlatformPlan }

const verifiedUsers = (): Segment => ({ ...emptySegment(), verified: 'yes' });

/** Hand-written campaigns the admin can start from: real wording about what the product does today, no invented claims. */
export const SAMPLES: Sample[] = [
  {
    id: 'v2_announce', label: 'Announcing RUNVAX 2.0', hint: 'Three emails to verified users: what 2.0 is, a reminder for people who did not open it, and a last note',
    plan: {
      name: 'Announcing RUNVAX 2.0', purpose: 'announce', goal: 'come_back', stopOnGoal: true, segment: verifiedUsers(), linkPath: '/client-acquisition',
      automation: build('Announcing RUNVAX 2.0', [
        mail('{{name}}, RUNVAX 2.0 is here', [
          'Hi {{name}},',
          'RUNVAX 2.0 is live. It is built around one idea: find the businesses you want to work with, then let an AI workforce help you approach, engage and win them.',
          'Here is what you can do in it today:\n- Find Prospects: search by industry and place and see who is worth contacting\n- Campaigns: describe your goal in plain English and RUNVAX writes the whole email sequence, follow-ups included\n- Inbox & Opportunities: replies land in one place, sorted by who is interested\n- AI Agents: build a website assistant or an article-writing agent in plain English',
          'You stay in control: you review the emails and start every campaign yourself. Your account, prospects and settings carry over.',
          LINE,
        ], 0),
        mail('Re: {{subject}}', [
          'Hi {{name}},',
          'A quick follow-up in case my last note got buried. RUNVAX 2.0 helps you find the businesses you want to work with and gives you an AI workforce to approach and win them.',
          'It takes a minute to look around: {{website}}',
          'If anything is unclear, just reply and I will help.',
        ], 3, {
          openedVariant: { subject: 'Re: {{subject}}', body: ['Hi {{name}},', 'Thanks for taking a look at the RUNVAX 2.0 email. If you have not tried it yet, the quickest start is Find Prospects: pick an industry and a place and see who comes up.', '{{website}}', 'Reply with any question and I will answer it.'].join('\n\n') },
        }),
        mail('Last note about RUNVAX 2.0', [
          'Hi {{name}},',
          'I will keep this short, as this is my last note about RUNVAX 2.0. Your account is ready, and everything you made is where you left it: {{website}}',
          'If something is not working the way you expected, reply and tell me. A real person reads every reply.',
        ], 4),
      ], brief('Announcing RUNVAX 2.0', 'RUNVAX 2.0', 'RUNVAX helps you find your next customers and gives you an AI workforce to approach, engage and win them.', 'Get existing users to try RUNVAX 2.0')),
    },
  },
  {
    id: 'acquisition_engine', label: 'Build a client acquisition engine in seconds', hint: 'Three emails showing how a plain-English goal becomes a full campaign with follow-ups and sorted replies',
    plan: {
      name: 'Build a client acquisition engine in seconds', purpose: 'announce', goal: 'come_back', stopOnGoal: true, segment: verifiedUsers(), linkPath: '/client-acquisition/campaigns',
      automation: build('Build a client acquisition engine in seconds', [
        mail('{{name}}, build your client acquisition engine in seconds', [
          'Hi {{name}},',
          'You do not need a team or a week to set up outreach. In RUNVAX you describe who you want to reach in plain English, and it builds the whole campaign for you in seconds:\n- the email sequence, with follow-ups timed for you\n- the conditions, for example: follow up only if they have not replied\n- the replies, sorted by who is interested',
          'For example: "Introduce my web design service to dental clinics in Lagos, 4 emails, follow up after 3 days, stop when they reply." You read the result, change anything you like, and start it when you are ready. Nothing is sent without you.',
          'Try it: {{website}}',
        ], 0),
        mail('Re: {{subject}}', [
          'Hi {{name}},',
          'Here is the short version of how it works:\n1. Open Campaigns and describe your goal\n2. Read the sequence RUNVAX writes and edit anything you like\n3. Add your prospects, from Find Prospects or your own list\n4. Start it when you are ready',
          '{{website}}',
          'Stuck on any step? Reply and I will help.',
        ], 3, {
          openedVariant: { subject: 'Re: {{subject}}', body: ['Hi {{name}},', 'Thanks for taking a look. The quickest way to see it work is to type one sentence about who you want to reach into Campaigns and read what RUNVAX writes back.', '{{website}}', 'Reply with a question and I will answer it.'].join('\n\n') },
        }),
        mail('Last note about building your campaign', [
          'Hi {{name}},',
          'This is my last note about this. If you want to see a full campaign appear from one sentence, it takes a minute: {{website}}',
          'If it is not for you right now, no problem. And if something got in the way, reply and tell me.',
        ], 4),
      ], brief('Client acquisition engine', 'RUNVAX campaigns', 'Describe who you want to reach in plain English and RUNVAX builds the whole campaign: the email sequence, the follow-ups and the reply handling.', 'Get users to build their first campaign')),
    },
  },
  {
    id: 'ai_agents', label: 'Building an AI agent on RUNVAX', hint: 'Three emails on the Visibility Agent and Sales Assistant, and how to try one before it goes live',
    plan: {
      name: 'Building an AI agent on RUNVAX', purpose: 'announce', goal: 'come_back', stopOnGoal: true, segment: verifiedUsers(), linkPath: '/client-acquisition/agents',
      automation: build('Building an AI agent on RUNVAX', [
        mail('Build an AI agent for your business with RUNVAX', [
          'Hi {{name}},',
          'Besides campaigns, RUNVAX 2.0 lets you build AI agents for your own business. Describe what you want in plain English and RUNVAX sets it up:\n- Visibility Agent: writes articles for your website, so more of the right people find you\n- Sales Assistant: chats with your website visitors, answers from what you tell it, and collects their details as leads',
          'Before you save anything, use Try it to chat with your agent or read a sample article. When you are happy with it, deploy it to your website, WordPress or Telegram.',
          'An agent only runs once you switch it on, and every visitor is told they are talking to an AI.',
          'Build your first agent: {{website}}',
        ], 0),
        mail('Re: {{subject}}', [
          'Hi {{name}},',
          'A quick follow-up in case my last note got buried. You can build a website assistant or an article-writing agent in a few steps, and try it before anything goes live.',
          '{{website}}',
          'Reply if you would like help deciding which one fits your business.',
        ], 3, {
          openedVariant: { subject: 'Re: {{subject}}', body: ['Hi {{name}},', 'Thanks for taking a look. A good first step is to describe your business in a sentence or two, let RUNVAX build the agent, and use Try it to see how it answers a visitor.', '{{website}}', 'Reply with any question.'].join('\n\n') },
        }),
        mail('Last note about AI agents', [
          'Hi {{name}},',
          'This is my last note about this. If you would like an assistant answering your website visitors, or articles written for your site, start here: {{website}}',
          'Something unclear, or not working as you expected? Reply and tell me. A real person reads every reply.',
        ], 4),
      ], brief('Building an AI agent on RUNVAX', 'RUNVAX AI agents', 'Build a Visibility Agent that writes articles for your website, or a Sales Assistant that chats with visitors and collects leads, from a plain-English description.', 'Get users to build their first AI agent')),
    },
  },
];

export const sampleById = (id: unknown): Sample | null => SAMPLES.find((x) => x.id === id) ?? null;

/** What a user may be told about the free trial. */
const trialLine = (days: number) => `You have a free account, which means you can start ${days} days of RUNVAX Pro for $0. No card, nothing to cancel.`;

/**
 * Drafts a whole campaign from a purpose and a few words. No network: the AI drafter (the same planner the customer builder uses)
 * does the same job and falls back to this, so the builder always works. Always passes sanitizePlan.
 */
export function planCampaign(purpose: Purpose, detailRaw: string, trialDays = 10): PlatformPlan {
  const detail = cleanText(detailRaw, 400);
  const d = detail ? (/[.!?]$/.test(detail) ? detail : `${detail}.`) : '';
  const meta = PURPOSES.find((p) => p.id === purpose)!;
  const hi = 'Hi {{name}},';
  const ONE = 'RUNVAX helps you find your next customers and gives you an AI workforce to approach, engage and win them.';
  const b = brief(meta.label, 'RUNVAX', ONE, meta.label);
  let name = meta.label; let emails: AutoEmail[] = []; let segment = emptySegment(); let linkPath = '/client-acquisition';

  switch (purpose) {
    case 'announce':
      name = detail ? `Announcement: ${detail.slice(0, 50)}` : 'Announcement'; segment = verifiedUsers();
      emails = [
        mail(detail ? `New on RUNVAX: ${detail.slice(0, 70)}` : 'What is new on RUNVAX', [hi, d || 'We have been working on RUNVAX and there is something new for you.', ONE, 'It takes a minute to look, and your work is exactly as you left it.', LINE], 0),
        mail('Re: {{subject}}', [hi, `A quick reminder in case my last note got buried. ${d}`.trim(), '{{website}}'], 4),
      ]; break;
    case 'activate_trial':
      name = 'Free Pro trial nudge'; segment = { ...emptySegment(), plans: ['free'], verified: 'yes', trial: 'unclaimed' }; linkPath = '/claim-pro';
      emails = [
        mail(`Your ${trialDays} free days of Pro are waiting`, [hi, trialLine(trialDays), d, 'Your prospects, campaigns and settings stay exactly as they are when the trial ends.', 'Claim it here: {{website}}'].filter(Boolean), 0),
        mail('What you can do with Pro in ten minutes', [hi, 'Ten minutes is enough to see whether RUNVAX fits how you win clients:\n- Find businesses that match who you want to work with\n- Write a personalised email sequence for them\n- Let the follow-ups run for you, with you approving what goes out', 'Pro unlocks the sending side. It is free to try: {{website}}'], 3),
        mail('Last reminder about your free Pro', [hi, `This is the last time I will mention it: your ${trialDays} free days of Pro are still available. {{website}}`, 'If now is not the right time, no problem. You can always claim it later from your account.'], 3),
      ]; break;
    case 'verify':
      name = 'Verify your email'; segment = { ...emptySegment(), verified: 'no' }; linkPath = '/auth/signin';
      emails = [
        mail('One quick step to start using RUNVAX', [hi, 'Your RUNVAX account is almost ready. It just needs your email address confirmed.', d, 'Sign in and we will send a fresh confirmation link if you need one: {{website}}'].filter(Boolean), 0),
        mail('Still need to confirm your email', [hi, 'A reminder that your RUNVAX account is waiting for your email to be confirmed. Until then, campaigns and AI agents stay locked.', '{{website}}'], 3),
      ]; break;
    case 'reengage':
      name = 'Win back quiet users'; segment = { ...emptySegment(), verified: 'yes', inactiveForDays: 14 };
      emails = [
        mail('{{name}}, a lot has changed in RUNVAX', [hi, 'It has been a while since you last used RUNVAX.', d || 'We have been making it easier to find customers and follow up with them.', ONE, LINE], 0),
        mail('Your prospects and campaigns are still here', [hi, 'Everything you saved in RUNVAX is exactly where you left it, and it takes a minute to pick it back up: {{website}}'], 4),
        mail('Should we keep your account active?', [hi, 'This is my last note for now. If RUNVAX is not what you need right now, that is fine. If it is, your account is ready whenever you are: {{website}}', 'And if something got in the way, just reply and tell me. I read every reply.'], 4),
      ]; break;
    case 'feedback':
      name = 'Feedback request'; segment = { ...emptySegment(), verified: 'yes', joinedOlderThanDays: 7 };
      emails = [mail('A quick question about RUNVAX', [hi, d || 'What is the one thing that would make RUNVAX more useful to you?', 'Just reply to this email. A single sentence is plenty, and a real person reads every answer.'], 0)]; break;
    default:
      name = detail ? detail.slice(0, 60) : 'Message to users'; segment = verifiedUsers();
      emails = [mail(detail ? detail.slice(0, 80) : 'A note from RUNVAX', [hi, d || 'We wanted to reach out with a short update.', LINE], 0)];
  }
  const plan = sanitizePlan({ name, purpose, goal: meta.goal, stopOnGoal: true, segment, linkPath, automation: build(name, emails, b) });
  if (!plan) throw new Error('The built-in writer produced no usable email');
  return plan;
}
