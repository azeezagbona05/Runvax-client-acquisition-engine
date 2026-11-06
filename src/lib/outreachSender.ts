/**
 * Sends a campaign's emails, a few at a time, from the user's own mailbox.
 *
 * Why their mailbox and not the platform's: the pitch comes from their address, replies land
 * in their inbox, and a bad list damages their sender reputation, not RUNVAX's own (the one
 * that delivers sign-in and receipt emails).
 *
 * Each lead is claimed before it is sent (queued → sending, or a compare-and-set on
 * lastSentAt for follow-ups), so two overlapping requests, such as a double-click or the
 * daily cron, can never email the same person twice.
 */

import { getConnection } from '@/lib/integrations/store';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { prisma } from '@/lib/prisma';
import { checkRecipient } from '@/lib/acquisition/recipientGuard';
import { getAppUrl } from '@/lib/url';
import { snovEnabled, verifyEmail, type SnovEmail } from '@/lib/snov';
import { trackedLink } from '@/lib/trackedLink';
import { conditionMet, followUpWaits, sanitizeAutomation, stepCopy } from '@/lib/automation';
import { STOPS_FOLLOW_UPS } from '@/lib/replyIntel';
import { logAgent } from '@/lib/acqReplies';
import {
  DEFAULT_FOLLOW_UP_BODY, DEFAULT_FOLLOW_UP_SUBJECT, EMAIL_RE, MAX_BATCH,
  buildEmail, remainingToday, renderTemplate, startOfToday,
  type LeadInput, type SenderIdentity,
} from '@/lib/outreachCampaign';

export const newLeadToken = (): string => crypto.randomBytes(18).toString('base64url');

export interface UserMailbox {
  transport: Transporter;
  fromAddress: string;
  fromName?: string;
  replyTo?: string;
  sender: SenderIdentity;
}

/** The user's own SMTP from Settings → Email. Null when it isn't set up (campaigns never fall back to the platform's). */
export async function loadMailbox(userId: string): Promise<UserMailbox | null> {
  const s = await prisma.userSettings.findUnique({
    where: { userId },
    select: {
      smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true,
      replyEmail: true, senderName: true, businessName: true, whatsapp: true, tagline: true,
    },
  });
  // Signed in with Google: send with the account's own OAuth login, no password stored.
  const g = await getConnection(userId, 'gmail').catch(() => null);
  if (g && g.status === 'connected' && g.secrets.refreshToken && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    const email = String(g.metaObj.email ?? '');
    if (EMAIL_RE.test(email)) {
      const fromName = (s?.smtpFrom ?? s?.businessName ?? s?.senderName ?? '').replace(/["\r\n<>]/g, '').trim() || undefined;
      return {
        transport: nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { type: 'OAuth2', user: email, clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, refreshToken: g.secrets.refreshToken } }),
        fromAddress: email, fromName,
        replyTo: s?.replyEmail && s.replyEmail.toLowerCase() !== email.toLowerCase() && EMAIL_RE.test(s.replyEmail) ? s.replyEmail : undefined,
        sender: { name: s?.senderName, business: s?.businessName, whatsapp: s?.whatsapp, tagline: s?.tagline },
      };
    }
  }
  // No mailbox of their own: an administrator may use the platform's mail server (the same SMTP the app already sends with).
  if (!s?.smtpHost || !s.smtpUser || !s.smtpPass) return loadPlatformMailbox(userId, s ?? null);
  const fromAddress = s.smtpUser.includes('@') ? s.smtpUser : (s.replyEmail ?? '');
  if (!EMAIL_RE.test(fromAddress)) return null;
  const port = s.smtpPort ?? 587;
  const fromName = (s.smtpFrom ?? s.businessName ?? s.senderName ?? '').replace(/["\r\n<>]/g, '').trim() || undefined;
  return {
    transport: nodemailer.createTransport({ host: s.smtpHost, port, secure: port === 465, auth: { user: s.smtpUser, pass: s.smtpPass } }),
    fromAddress,
    fromName,
    replyTo: s.replyEmail && s.replyEmail.toLowerCase() !== fromAddress.toLowerCase() && EMAIL_RE.test(s.replyEmail) ? s.replyEmail : undefined,
    sender: { name: s.senderName, business: s.businessName, whatsapp: s.whatsapp, tagline: s.tagline },
  };
}

type SettingsRow = { replyEmail: string | null; senderName: string | null; businessName: string | null; whatsapp: string | null; tagline: string | null; smtpFrom: string | null } | null;

/** The platform's own SMTP (env), for administrators only: so internal acquisition works before a personal mailbox is connected. */
async function loadPlatformMailbox(userId: string, s: SettingsRow): Promise<UserMailbox | null> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  const admins = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!u?.email || !admins.includes(u.email.toLowerCase())) return null;
  const fromAddress = SMTP_USER.includes('@') ? SMTP_USER : (SMTP_FROM?.match(/<([^>]+)>/)?.[1] ?? '');
  if (!EMAIL_RE.test(fromAddress)) return null;
  const port = Number(SMTP_PORT ?? 587);
  const fromName = (s?.smtpFrom ?? s?.businessName ?? s?.senderName ?? SMTP_FROM?.replace(/<.*>/, '') ?? '').replace(/["\r\n<>]/g, '').trim() || undefined;
  return {
    transport: nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } }),
    fromAddress, fromName,
    replyTo: s?.replyEmail && EMAIL_RE.test(s.replyEmail) && s.replyEmail.toLowerCase() !== fromAddress.toLowerCase() ? s.replyEmail : undefined,
    sender: { name: s?.senderName, business: s?.businessName, whatsapp: s?.whatsapp, tagline: s?.tagline },
  };
}

const fromHeader = (m: UserMailbox) => (m.fromName ? `"${m.fromName}" <${m.fromAddress}>` : m.fromAddress);

export type BatchKind = 'initial' | 'followup';

export interface BatchResult {
  sent: number;
  failed: number;
  skipped: number;
  /** How many more may go out today under the daily cap. */
  remainingToday: number;
  /** Still waiting after this batch: queued leads, or follow-ups that are due. */
  leftToSend: number;
  capReached: boolean;
  aborted?: 'no_mailbox' | 'mailbox_error' | 'check_unavailable' | 'not_found' | 'not_started';
  message?: string;
}

interface Deps {
  mailbox?: UserMailbox | null;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  pauseMs?: number;
  appUrl?: string;
  /** Address check run before a first email. Defaults to Snov.io when SNOV_VERIFY_BEFORE_SEND is on. Tests inject one. */
  verify?: ((email: string) => Promise<SnovEmail | null>) | null;
}

/**
 * Snov.io address check before a FIRST email (follow-ups go to addresses that already accepted a message).
 * Off unless SNOV_VERIFY_BEFORE_SEND=true and the Snov keys are set, because every check costs a credit.
 * It fails open: if Snov is down, slow or out of credits, the email is sent as before.
 */
function defaultVerifier(): ((email: string) => Promise<SnovEmail | null>) | null {
  const on = /^(1|true|yes)$/i.test(process.env.SNOV_VERIFY_BEFORE_SEND?.trim() ?? '');
  return on && snovEnabled() ? (email) => verifyEmail(email) : null;
}

/** A reason to skip this address, or null to send. */
async function addressProblem(verify: Deps['verify'], email: string): Promise<string | null> {
  if (!verify) return null;
  try {
    const r = await verify(email);
    if (!r) return null;
    if (r.smtpStatus === 'not_valid') return 'Email check: this address does not exist, so it was not emailed.';
    if (r.disposable) return 'Email check: this is a disposable address, so it was not emailed.';
  } catch { /* fail open */ }
  return null;
}

// Errors that mean "the mailbox or network is broken", not "this recipient is bad".
const MAILBOX_ERRORS = new Set(['EAUTH', 'ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS', 'ECONNREFUSED', 'ENOTFOUND', 'ESOCKETTIMEDOUT', 'ETLS']);

const empty = (over: Partial<BatchResult>): BatchResult => ({
  sent: 0, failed: 0, skipped: 0, remainingToday: 0, leftToSend: 0, capReached: false, ...over,
});

type CampaignRow = { id: string; followUpAfterDays: number; maxFollowUps: number; automation?: unknown };

/** The saved sequence, when this campaign has one: each follow-up then has its own wording, wait and condition. */
function sequenceOf(c: CampaignRow) { return c.automation ? sanitizeAutomation(c.automation) : null; }

/**
 * Leads whose next follow-up is due now: still unanswered, not opted out, not past the first conversation, not paused,
 * old enough for THIS step's wait, and meeting THIS step's condition (for example "opened but did not reply").
 */
async function dueFollowUps(c: CampaignRow, now: number) {
  const seq = sequenceOf(c);
  const waits = seq ? followUpWaits(seq) : null;
  const max = Math.min(c.maxFollowUps, waits ? waits.length : c.maxFollowUps);
  const rows = await prisma.outreachLead.findMany({
    where: {
      campaignId: c.id, status: 'sent', repliedAt: null, unsubscribedAt: null, followUpsSent: { lt: max },
      AND: [
        { OR: [{ stage: null }, { stage: { notIn: STOPS_FOLLOW_UPS } }] },
        { OR: [{ pausedUntil: null }, { pausedUntil: { lte: new Date(now) } }] },
      ],
    },
    orderBy: { lastSentAt: 'asc' }, take: 500,
  });
  return rows.filter((l) => {
    const last = l.lastSentAt?.getTime();
    if (last === undefined) return false;
    const wait = waits ? waits[l.followUpsSent] : c.followUpAfterDays;
    if (wait === undefined || now - last < wait * 86_400_000) return false;
    const step = seq?.emails[l.followUpsSent + 1];
    return step ? conditionMet(step.sendIf, { repliedAt: l.repliedAt ? 1 : undefined, openedAt: l.openedAt ? 1 : undefined, clickedAt: l.clickedAt ? 1 : undefined }) : true;
  });
}

/**
 * Sends up to `max` (and never more than today's remaining allowance) emails for one campaign.
 * Callers loop on `leftToSend` / `capReached`.
 */
export async function sendBatch(
  args: { campaignId: string; userId: string; kind: BatchKind; max?: number },
  deps: Deps = {},
): Promise<BatchResult> {
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const pauseMs = deps.pauseMs ?? 400;
  const appUrl = deps.appUrl ?? getAppUrl();

  const campaign = await prisma.outreachCampaign.findFirst({ where: { id: args.campaignId, userId: args.userId } });
  if (!campaign) return empty({ aborted: 'not_found', message: 'Campaign not found.' });
  if (args.kind === 'initial' && campaign.status !== 'running') {
    return empty({ aborted: 'not_started', message: 'Press Run campaign to start sending.' });
  }
  if (args.kind === 'followup' && !campaign.startedAt) {
    return empty({ aborted: 'not_started', message: 'Run the campaign before sending follow-ups.' });
  }

  const mailbox = deps.mailbox === undefined ? await loadMailbox(args.userId) : deps.mailbox;
  if (!mailbox) {
    return empty({ aborted: 'no_mailbox', message: 'Connect your own email in Settings → Email first. Campaigns send from your mailbox so replies reach you.' });
  }

  const dayStart = startOfToday(new Date(now()));
  const [sentCampaign, sentAccount] = await Promise.all([
    prisma.outreachLead.count({ where: { campaignId: campaign.id, lastSentAt: { gte: dayStart } } }),
    prisma.outreachLead.count({ where: { userId: args.userId, lastSentAt: { gte: dayStart } } }),
  ]);
  const allowance = remainingToday(campaign.dailyCap, sentCampaign, sentAccount);
  const seq = sequenceOf(campaign);

  const take = Math.min(allowance, Math.max(1, Math.min(args.max ?? MAX_BATCH, MAX_BATCH)));
  const leads = take === 0 ? [] : args.kind === 'initial'
    ? await prisma.outreachLead.findMany({ where: { campaignId: campaign.id, status: 'queued' }, orderBy: { createdAt: 'asc' }, take })
    : (await dueFollowUps(campaign, now())).slice(0, take);

  const out = empty({});
  const isFollowUp = args.kind === 'followup';
  const verify = isFollowUp ? null : deps.verify === undefined ? defaultVerifier() : deps.verify;

  for (const lead of leads) {
    // 1. Claim it. If another request got there first, move on.
    const claimed = isFollowUp
      ? await prisma.outreachLead.updateMany({
          where: { id: lead.id, status: 'sent', lastSentAt: lead.lastSentAt, repliedAt: null, unsubscribedAt: null },
          data: { lastSentAt: new Date(now()), followUpsSent: { increment: 1 } },
        })
      : await prisma.outreachLead.updateMany({ where: { id: lead.id, status: 'queued' }, data: { status: 'sending' } });
    if (claimed.count === 0) continue;

    const release = () => (isFollowUp
      ? prisma.outreachLead.update({ where: { id: lead.id }, data: { lastSentAt: lead.lastSentAt, followUpsSent: { decrement: 1 } } })
      : prisma.outreachLead.update({ where: { id: lead.id }, data: { status: 'queued' } }));

    // 2. Last look before sending: opted out from any of their campaigns, or off-limits.
    const optedOut = await prisma.outreachLead.findFirst({
      where: { userId: args.userId, email: lead.email, OR: [{ status: 'unsubscribed' }, { unsubscribedAt: { not: null } }] },
      select: { id: true },
    });
    if (optedOut) {
      await prisma.outreachLead.update({ where: { id: lead.id }, data: { status: 'unsubscribed', unsubscribedAt: new Date(now()) } });
      out.skipped++;
      continue;
    }
    const verdict = await checkRecipient(args.userId, { email: lead.email });
    if (!verdict.allowed) {
      if (verdict.code === 'check_unavailable') {
        await release();
        out.aborted = 'check_unavailable';
        out.message = verdict.message;
        break;
      }
      await prisma.outreachLead.update({ where: { id: lead.id }, data: { status: 'skipped', error: verdict.message.slice(0, 500) } });
      out.skipped++;
      continue;
    }

    // 2b. Does the address exist? (Snov.io, when switched on.)
    const problem = await addressProblem(verify, lead.email);
    if (problem) {
      await prisma.outreachLead.update({ where: { id: lead.id }, data: { status: 'skipped', error: problem } });
      out.skipped++;
      continue;
    }

    // 3. Send.
    const input: LeadInput = { email: lead.email, name: lead.name ?? undefined, business: lead.business ?? undefined, website: lead.website ?? undefined };
    // A lead personalised by the pitch engine gets its own first email; everything else uses the template.
    // Each follow-up uses its own step of the saved sequence; without one, the campaign's single follow-up template.
    // Someone who opened but did not reply gets the step's "opened" wording when it has one.
    const stepRaw = isFollowUp ? seq?.emails[lead.followUpsSent + 1] : undefined;
    const step = stepRaw ? stepCopy(stepRaw, !!lead.openedAt) : undefined;
    const subjectTpl = isFollowUp ? (step?.subject ?? campaign.followUpSubject ?? DEFAULT_FOLLOW_UP_SUBJECT) : campaign.subject;
    const bodyTpl = isFollowUp ? (step?.body ?? campaign.followUpBody ?? DEFAULT_FOLLOW_UP_BODY) : campaign.body;
    const own = !isFollowUp && lead.customSubject && lead.customBody;
    const built = buildEmail({
      subject: own ? (lead.customSubject as string) : subjectTpl, body: own ? (lead.customBody as string) : bodyTpl, lead: input, sender: mailbox.sender,
      unsubscribeUrl: `${appUrl}/api/oc/unsubscribe?t=${lead.token}`,
      pixelUrl: `${appUrl}/api/oc/open/${lead.token}`,
      trackLink: (url) => trackedLink(appUrl, lead.token, url),
      originalSubject: renderTemplate(campaign.subject, input),
    });
    try {
      const info = await mailbox.transport.sendMail({
        from: fromHeader(mailbox), to: lead.email, replyTo: mailbox.replyTo,
        subject: built.subject, text: built.text, html: built.html, headers: built.headers,
        ...(isFollowUp && lead.messageId ? { inReplyTo: lead.messageId, references: lead.messageId } : {}),
      });
      const at = new Date(now());
      await prisma.outreachLead.update({
        where: { id: lead.id },
        data: isFollowUp
          ? { error: null }
          : { status: 'sent', sentAt: at, lastSentAt: at, messageId: info.messageId ?? null, error: null },
      });
      out.sent++;
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      const message = (err instanceof Error ? err.message : 'Send failed').slice(0, 500);
      if (MAILBOX_ERRORS.has(code)) {
        // Their mailbox or the network, not this recipient: put the lead back and stop.
        await release();
        out.aborted = 'mailbox_error';
        out.message = code === 'EAUTH'
          ? 'Your email server rejected the login. Check Settings → Email (Gmail needs an app password).'
          : `Could not reach your email server (${code}). Nothing was lost; run again in a moment.`;
        break;
      }
      // A bad address or a refusal: remember why, and never retry it.
      await prisma.outreachLead.update({ where: { id: lead.id }, data: { status: 'failed', error: message } });
      out.failed++;
    }
    if (pauseMs > 0) await sleep(pauseMs);
  }

  // Wrap up: the numbers the caller (and the dashboard) loop on.
  if (args.kind === 'initial' && !out.aborted) {
    const queued = await prisma.outreachLead.count({ where: { campaignId: campaign.id, status: 'queued' } });
    if (queued === 0 && leads.length > 0) {
      await prisma.outreachCampaign.update({ where: { id: campaign.id }, data: { status: 'completed' } });
    }
    out.leftToSend = queued;
  } else if (args.kind === 'initial') {
    out.leftToSend = await prisma.outreachLead.count({ where: { campaignId: campaign.id, status: 'queued' } });
  } else {
    out.leftToSend = (await dueFollowUps(campaign, now())).length;
  }
  out.remainingToday = Math.max(0, remainingToday(campaign.dailyCap, sentCampaign + out.sent, sentAccount + out.sent));
  out.capReached = out.remainingToday === 0 && out.leftToSend > 0;
  if (out.sent > 0 || out.failed > 0) {
    await logAgent(args.userId, isFollowUp ? 'followup' : 'outreach', `${out.sent} ${isFollowUp ? 'follow-up' : 'introduction'}${out.sent === 1 ? '' : 's'} for ${campaign.name}`, out.failed ? `${out.failed} could not be delivered.` : undefined, campaign.id);
  }
  return out;
}

/** One real-looking email to the user themselves, so they can check the wording and that their mailbox works. */
export async function sendTestEmail(
  userId: string,
  args: { campaign: { subject: string; body: string }; to: string; originalSubject?: string },
  deps: Deps = {},
): Promise<{ ok: true } | { ok: false; message: string }> {
  const mailbox = deps.mailbox === undefined ? await loadMailbox(userId) : deps.mailbox;
  if (!mailbox) return { ok: false, message: 'Connect your own email in Settings → Email first.' };
  const appUrl = deps.appUrl ?? getAppUrl();
  const built = buildEmail({
    subject: args.campaign.subject, body: args.campaign.body, sender: mailbox.sender,
    lead: { email: args.to, name: 'Alex Sample', business: 'Sample Business' },
    unsubscribeUrl: `${appUrl}/api/oc/unsubscribe?t=preview`,
    ...(args.originalSubject ? { originalSubject: renderTemplate(args.originalSubject, { email: args.to, name: 'Alex Sample', business: 'Sample Business' }) } : {}),
  });
  try {
    await mailbox.transport.sendMail({
      from: fromHeader(mailbox), to: args.to, replyTo: mailbox.replyTo,
      subject: `[Test] ${built.subject}`, text: built.text, html: built.html,
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message.slice(0, 300) : 'Could not send the test email.' };
  }
}

