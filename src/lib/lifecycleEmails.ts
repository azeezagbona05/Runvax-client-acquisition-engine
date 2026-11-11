/**
 * Templates for the new-user workflow (see ./lifecycle.ts for who gets which, and when).
 * Copy follows the approved sequence. Two rules baked in:
 *  - Pricing is currently off (PRICING_ENABLED), so trial emails never point at a plan page or
 *    ask anyone to subscribe, and never imply an automatic charge. They say what happens to the
 *    account and data when the trial ends.
 *  - Promotional emails carry a signed one-click unsubscribe; verification emails do not.
 */

import { emailShell, iconBadge, ctaButton, securityNotice } from './email';
import { PRICING_ENABLED, TRIAL_DAYS } from './promo';
import type { StepKey } from './lifecycle';

export interface RenderCtx {
  name: string;
  appUrl: string;
  appName: string;
  /** Trial length in days when the admin has changed it from the default. */
  trialDays?: number;
  /** Fresh verification link (verification steps only). */
  verifyUrl?: string;
  /** Signed unsubscribe link (promotional steps only). */
  unsubscribeUrl?: string;
}

export interface Rendered { subject: string; html: string; preheader: string; transactional: boolean }

const first = (n: string) => (n || '').trim().split(/\s+/)[0] || 'there';

const h1 = (t: string) => `<h1 style="margin:0 0 16px;font-size:27px;font-weight:800;color:#0f172a;letter-spacing:-0.6px;line-height:1.25;">${t}</h1>`;
const p = (t: string) => `<p style="margin:0 0 16px;font-size:16px;color:#475569;line-height:1.7;">${t}</p>`;
const strong = (t: string) => `<strong style="color:#1e293b;">${t}</strong>`;
const sign = (appName: string) => `<p style="margin:22px 0 0;font-size:15px;color:#334155;line-height:1.6;">The ${appName} Team</p>`;

function list(items: string[], ordered = false): string {
  const rows = items.map((t, i) => `<tr>
    <td style="padding:7px 0;width:30px;vertical-align:top;font-size:14px;font-weight:700;color:#7c3aed;">${ordered ? `${i + 1}.` : '&bull;'}</td>
    <td style="padding:7px 0;font-size:15px;color:#334155;line-height:1.6;">${t}</td></tr>`).join('');
  return `<table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 18px;">${rows}</table>`;
}

function callout(t: string): string {
  return `<table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px;"><tr>
    <td style="background:rgba(124,58,237,0.06);border:1px solid rgba(124,58,237,0.18);border-radius:12px;padding:15px 18px;font-size:15px;color:#334155;line-height:1.65;">${t}</td></tr></table>`;
}

const footerPromo = (c: RenderCtx) =>
  `You&rsquo;re receiving this because you have a ${c.appName} account. ${c.unsubscribeUrl
    ? `<a href="${c.unsubscribeUrl}" style="color:#94a3b8;">Unsubscribe from tips and offers</a>.`
    : 'Reply &ldquo;unsubscribe&rdquo; to stop these emails.'}`;
const footerAccount = (c: RenderCtx) => `You&rsquo;re receiving this because of activity on your ${c.appName} account.`;

function wrap(c: RenderCtx, opts: { icon: string; color: string; pre: string; transactional: boolean; body: string }): { html: string } {
  return { html: emailShell(c.appName, `${iconBadge(opts.icon, opts.color)}${opts.body}`, opts.pre, opts.transactional ? footerAccount(c) : footerPromo(c)) };
}

/** Welcome: sent by the register route right after sign-up. */
/** `verifyUrl` is omitted for Google sign-ups: Google has already verified the address. */
export function welcomeEmail(c: RenderCtx & { verifyUrl?: string }): Rendered {
  const pre = c.verifyUrl ? `Welcome to ${c.appName}. Verify your email to unlock your account.` : `Welcome to ${c.appName}. Your account is ready.`;
  const body = `
    ${h1(`Welcome to ${c.appName}. Let&rsquo;s find your next client 🚀`)}
    ${p(`Hi ${strong(first(c.name))},`)}
    ${p(`Finding clients shouldn&rsquo;t mean spending hours searching the internet, guessing which businesses need your services, or wondering who to contact.`)}
    ${p(`That&rsquo;s why ${c.appName} exists. It helps you discover businesses, identify opportunities for your services, research decision-makers and prepare personalised outreach.`)}
    ${p(`Whether you build websites, offer digital marketing or deploy AI automation, your next step is to find businesses worth approaching.`)}
    ${c.verifyUrl
      ? `${p(`Let&rsquo;s get you started. ${strong('First, verify your email address')} to unlock access to your account.`)}
    ${ctaButton('Verify my email', c.verifyUrl)}
    ${p('Once verified, log in and start discovering prospects.')}`
      : `${p(`Let&rsquo;s get you started. Your account is ready, so you can start discovering prospects right now.`)}
    ${ctaButton(`Open ${c.appName}`, c.appUrl)}`}
    ${sign(c.appName)}`;
  return { subject: `Welcome to ${c.appName}. Let's find your next client 🚀`, preheader: pre, transactional: true,
    ...wrap(c, { icon: '🚀', color: '#7c3aed', pre, transactional: true, body }) };
}

/**
 * Sent the moment someone claims the free Pro trial (from the trial route, not the daily cron):
 * confirms it, says exactly when it ends and what happens then, and gives them a first move.
 * It is an account confirmation, so it carries no unsubscribe link.
 */
export function trialStartedEmail(c: RenderCtx & { endsLabel: string }): Rendered {
  const pre = `You're on Pro until ${c.endsLabel}. Here's how to make the most of it.`;
  const body = `
    ${h1(`You&rsquo;re in. ${c.trialDays ?? TRIAL_DAYS} days of Pro, free 🎉`)}
    ${p(`Hi ${strong(first(c.name))},`)}
    ${p(`Your ${c.appName} Pro access is live and runs until ${strong(c.endsLabel)}. No card was needed and nothing will be charged.`)}
    ${p(strong('Make the most of it. Start here:'))}
    ${list([
      `Search the industry and city you want to sell into. Try the ${strong('AI receptionist targets')} filter to see businesses that already have a website and are busy enough to need help.`,
      `Save the three that look best, then use ${strong('Find decision-maker')} to see who to talk to.`,
      'Generate a personalised message and send your first one today.',
    ], true)}
    ${callout(`${strong('When it ends:')} your account moves to the free plan. Your saved prospects and settings stay exactly as they are, and you can keep searching every day.`)}
    ${ctaButton('Start finding clients', c.appUrl)}
    ${sign(c.appName)}`;
  return { subject: `You're on ${c.appName} Pro for ${c.trialDays ?? TRIAL_DAYS} days 🎉`, preheader: pre, transactional: true,
    ...wrap(c, { icon: '🎉', color: '#16a34a', pre, transactional: true, body }) };
}

type Builder = (c: RenderCtx) => Omit<Rendered, 'html' | 'transactional'> & { icon: string; color: string; body: string; transactional?: boolean };

const STEPS: Record<StepKey, Builder> = {
  verify_1: (c) => ({
    subject: 'One quick step before you can use ' + c.appName,
    preheader: 'Verify your email to unlock your account.',
    icon: '✉️', color: '#ea580c', transactional: true,
    body: `
      ${h1('One quick step before you start')}
      ${p(`Hi ${strong(first(c.name))},`)}
      ${p(`You&rsquo;re almost ready to explore ${c.appName}. There&rsquo;s just one thing left to do: ${strong('verify your email address')}.`)}
      ${p('We require email verification before you can access the platform.')}
      ${p(`Check your inbox for the verification email. Can&rsquo;t find it? Check your spam or junk folder. This button sends you straight to verification:`)}
      ${ctaButton('Verify my email', c.verifyUrl ?? c.appUrl)}
      ${p(`Once you&rsquo;ve verified, you can log in and start finding businesses worth approaching.`)}
      ${sign(c.appName)}`,
  }),

  verify_2: (c) => ({
    subject: `Last reminder: verify your email to start using ${c.appName}`,
    preheader: 'Your verification link is ready. It takes a few seconds.',
    icon: '⏰', color: '#ea580c', transactional: true,
    body: `
      ${h1('Your account is waiting on one thing')}
      ${p(`Hi ${strong(first(c.name))},`)}
      ${p(`This is our last reminder. Your ${c.appName} account is ready, but you can&rsquo;t use it until your email is verified.`)}
      ${ctaButton('Verify my email', c.verifyUrl ?? c.appUrl)}
      ${p(`This link is fresh and works for 24 hours. If it expires, log in to ${c.appName} and ask for a new verification email.`)}
      ${securityNotice(`Didn&rsquo;t create a ${c.appName} account? You can ignore this email and nothing will happen.`)}
      ${sign(c.appName)}`,
  }),

  first_search: (c) => ({
    subject: 'What if your next client was one search away?',
    preheader: 'Your first mission takes about ten minutes.',
    icon: '🔎', color: '#7c3aed',
    body: `
      ${h1('What if your next client was one search away?')}
      ${p(`Hi ${strong(first(c.name))},`)}
      ${p(`Imagine opening your laptop tomorrow and already knowing which businesses you want to approach.`)}
      ${p(`Instead of searching randomly, you could focus on businesses in your target industry and location, discover potential opportunities, and identify the right people to contact. That&rsquo;s the idea behind ${c.appName}.`)}
      ${p(strong('Here&rsquo;s your first mission:'))}
      ${list([
        'Choose the industry you want to target.',
        'Select the country or location where you want clients.',
        'Search for businesses that could benefit from your services.',
        'Review the results and save the most promising prospects.',
      ], true)}
      ${callout(`Don&rsquo;t worry about building a huge list today. Start with a handful of relevant businesses. Your goal is to find opportunities you can act on.`)}
      ${ctaButton('Find my first prospects', c.appUrl)}
      ${sign(c.appName)}`,
  }),

  research_outreach: (c) => ({
    subject: "You've found a business. What happens next?",
    preheader: 'Choose three prospects and prepare a relevant approach for each.',
    icon: '💬', color: '#7c3aed',
    body: `
      ${h1('You&rsquo;ve found a business. What happens next?')}
      ${p(`Hi ${strong(first(c.name))},`)}
      ${p(`Finding a business is a good start. Finding the right opportunity and starting a conversation is where prospecting becomes useful.`)}
      ${p('Before approaching a business, ask yourself:')}
      ${list([
        'Could this business genuinely benefit from my service?',
        'What problem could I help solve?',
        'Who is the right person to contact?',
        'How can I make my first message relevant to them?',
      ])}
      ${p(`${c.appName} helps you move beyond collecting business names by supporting prospect research, decision-maker discovery and personalised outreach.`)}
      ${callout(`${strong('Your challenge today:')} choose three promising prospects and prepare a relevant approach for each one. Keep it personal. Focus on the business&rsquo;s needs rather than sending generic pitches.`)}
      ${ctaButton('Continue prospecting', c.appUrl)}
      ${sign(c.appName)}`,
  }),

  pipeline: (c) => ({
    subject: "Don't let good prospects get lost in your tabs",
    preheader: 'Discover, research, reach out, follow up, track.',
    icon: '📈', color: '#7c3aed',
    body: `
      ${h1('Don&rsquo;t let good prospects get lost in your tabs')}
      ${p(`Hi ${strong(first(c.name))},`)}
      ${p('You might discover a promising business today and forget about it by tomorrow. Or you might contact a prospect and lose track of whether you followed up.')}
      ${p(`That&rsquo;s why a repeatable prospecting process matters. Use ${c.appName} to organise the businesses you&rsquo;re interested in, keep track of outreach, and keep a clear view of the opportunities you&rsquo;re pursuing.`)}
      ${p(strong('Try this simple routine:'))}
      ${callout(`${strong('Discover &rarr; Research &rarr; Reach out &rarr; Follow up &rarr; Track')}`)}
      ${p(`You don&rsquo;t need hundreds of prospects sitting in a list. You need relevant prospects and a consistent process for approaching them. Take a few minutes today to organise your next actions.`)}
      ${ctaButton('Review my pipeline', `${c.appUrl}/pipeline`)}
      ${sign(c.appName)}`,
  }),

  reengage: (c) => ({
    subject: `Are you making the most of ${c.appName}?`,
    preheader: 'Ten minutes is all it takes to find your first prospects.',
    icon: '👋', color: '#7c3aed',
    body: `
      ${h1(`Are you making the most of ${c.appName}?`)}
      ${p(`Hi ${strong(first(c.name))},`)}
      ${p(`You verified your account, but we haven&rsquo;t seen a search yet. That&rsquo;s completely normal. Starting is the hardest part.`)}
      ${p(`Try this: give it ten minutes. Pick one industry and one city, run a single search, and save three businesses that look like a fit. That&rsquo;s the whole task.`)}
      ${callout(`Stuck, or not sure it fits what you sell? Reply to this email and tell us what you&rsquo;re hoping to find. We read every reply.`)}
      ${ctaButton('Run my first search', c.appUrl)}
      ${sign(c.appName)}`,
  }),

  feedback: (c) => ({
    subject: `How is your ${c.appName} experience so far?`,
    preheader: 'Three quick questions. Honest answers welcome.',
    icon: '💡', color: '#7c3aed',
    body: `
      ${h1(`How is your ${c.appName} experience so far?`)}
      ${p(`Hi ${strong(first(c.name))},`)}
      ${p(`You&rsquo;ve had some time to explore ${c.appName}, and we&rsquo;d love to hear what you think. We&rsquo;re building it to help freelancers and agencies discover potential clients and make prospecting more systematic. Your feedback shows us what&rsquo;s useful, what&rsquo;s confusing and what to improve.`)}
      ${p(strong('Could you tell us three things?'))}
      ${list([
        `What have you used ${c.appName} for so far?`,
        "What's been the most useful part of the experience?",
        `What would make ${c.appName} more valuable to you?`,
      ], true)}
      ${p(`If you&rsquo;ve discovered promising prospects, started conversations or achieved a result you&rsquo;re happy with, we&rsquo;d love to hear that story too. Honest feedback is welcome, positive or negative. We&rsquo;ll never share your name, words or results publicly without asking you first.`)}
      ${ctaButton('Share my feedback', `mailto:info@runvax.com?subject=${encodeURIComponent(`${c.appName} feedback`)}`)}
      ${p(`Thank you for being part of ${c.appName}.`)}
      ${sign(c.appName)}`,
  }),

  trial_ending_soon: (c) => ({
    subject: `Your ${c.appName} Pro trial ends tomorrow`,
    preheader: 'What happens to your account, and how to make the most of today.',
    icon: '⏳', color: '#7c3aed',
    body: `
      ${h1(`Your ${c.appName} Pro trial ends tomorrow`)}
      ${p(`Hi ${strong(first(c.name))},`)}
      ${p(`Your ${c.trialDays ?? TRIAL_DAYS}-day ${c.appName} Pro experience is almost complete. We hope you&rsquo;ve explored new markets, discovered relevant businesses and seen how a more organised prospecting process could support your business.`)}
      ${p('Before your trial ends, take a moment to review your prospects and decide which opportunities you want to pursue next.')}
      ${callout(`${strong('What happens next:')} your account moves to the free plan. All your saved prospects and settings stay exactly as they are, and you can keep searching every day. Pro features pause. ${PRICING_ENABLED ? 'No card is on file, so you will not be charged.' : 'Nothing is charged, and nothing needs to be done.'}`)}
      ${PRICING_ENABLED
        ? `${p('If it&rsquo;s become a useful part of your workflow, you can continue on a paid plan.')}${ctaButton('View my plan', `${c.appUrl}/pricing`)}`
        : ctaButton('Review my prospects', `${c.appUrl}/pipeline`)}
      ${p(`Thanks for giving ${c.appName} a try.`)}
      ${sign(c.appName)}`,
  }),

  trial_ends_today: (c) => ({
    subject: `Your ${c.trialDays ?? TRIAL_DAYS} days of ${c.appName} Pro end today`,
    preheader: 'Your data is safe. Here is what changes.',
    icon: '⏰', color: '#ea580c',
    body: `
      ${h1(`Your ${c.trialDays ?? TRIAL_DAYS} days of ${c.appName} Pro end today`)}
      ${p(`Hi ${strong(first(c.name))},`)}
      ${p(`Today is the final day of your free ${c.appName} Pro trial. If you&rsquo;ve found value in discovering businesses, researching opportunities or organising your outreach, we&rsquo;re glad you did.`)}
      ${callout(`${strong('After today:')} your account moves to the free plan. Your prospects, pipeline and settings are kept, and you can keep prospecting every day within the free limits. ${PRICING_ENABLED ? 'You will not be charged automatically.' : 'Nothing is charged.'}`)}
      ${PRICING_ENABLED
        ? `${p('Choose the plan that works for your prospecting and keep building your pipeline.')}${ctaButton('Continue with ' + c.appName, `${c.appUrl}/pricing`)}`
        : `${p(`We&rsquo;ll let you know when paid plans open. Until then, make today count.`)}${ctaButton('Keep prospecting', c.appUrl)}`}
      ${p('Not ready to continue? That&rsquo;s okay. We&rsquo;d still appreciate your feedback: just reply to this email and tell us how we can make it better.')}
      ${p(`Thank you for trying ${c.appName}.`)}
      ${sign(c.appName)}`,
  }),

  post_expiry: (c) => ({
    subject: 'Keep your prospecting momentum',
    preheader: 'Your account and saved prospects are waiting.',
    icon: '🚀', color: '#7c3aed',
    body: `
      ${h1('Keep your prospecting momentum')}
      ${p(`Hi ${strong(first(c.name))},`)}
      ${p(`Your free Pro access has ended, but your ${c.appName} account is still here, and so are your saved prospects. You can keep finding businesses every day on the free plan.`)}
      ${p('A small habit goes a long way: one search, three promising businesses, one personal message. Pick up where you left off.')}
      ${PRICING_ENABLED
        ? `${p('If you want Pro features back, you can choose a plan any time.')}${ctaButton('View plans', `${c.appUrl}/pricing`)}`
        : `${p('We&rsquo;ll let you know when paid plans open.')}${ctaButton('Back to my prospects', c.appUrl)}`}
      ${sign(c.appName)}`,
  }),
};

export function renderStep(step: StepKey, c: RenderCtx): Rendered {
  const b = STEPS[step](c);
  const transactional = !!b.transactional;
  return {
    subject: b.subject, preheader: b.preheader, transactional,
    ...wrap(c, { icon: b.icon, color: b.color, pre: b.preheader, transactional, body: b.body }),
  };
}
