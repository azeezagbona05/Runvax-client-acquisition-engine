import { emitWebhook } from '@/lib/integrations/providers';
import { prisma } from '@/lib/prisma';
import { classifyReplyRules, suggestReplyRules, freshText, STOPS_SEQUENCE, isPositive, type ReplyClass } from '@/lib/replyIntel';
import { sanitizeAutomation } from '@/lib/automation';
import { REPLY_LABEL } from '@/lib/replyIntel';

export type AgentId = 'strategist' | 'audience' | 'content' | 'outreach' | 'followup' | 'reply';

/** Out-of-office replies pause follow-ups for this long. */
export const OOO_PAUSE_DAYS = 7;

/** Writes one line to the shared campaign log. Never throws: a log failure must not lose a reply. */
export async function logAgent(userId: string, agent: AgentId, action: string, detail?: string, campaignId?: string | null, leadId?: string | null): Promise<void> {
  try {
    await prisma.campaignLog.create({ data: { userId, agent, action, detail: detail?.slice(0, 1000) ?? null, campaignId: campaignId ?? null, leadId: leadId ?? null } });
  } catch { /* logging is best-effort */ }
}

export interface IngestInput {
  userId: string;
  leadId: string;
  text: string;
  subject?: string | null;
  source: 'manual' | 'inbox';
  messageId?: string | null;
  receivedAt?: Date;
}

export interface IngestDeps {
  /** Optional AI second look when the rules are unsure. Must return null on any failure. */
  classifyAi?: (text: string, subject: string) => Promise<{ replyClass: ReplyClass; confidence: number } | null>;
  /** Optional AI-written suggestion. Falls back to the rule-based one. */
  suggestAi?: (i: { replyClass: ReplyClass; text: string; leadName: string | null; business: string | null }) => Promise<string | null>;
  notifyOwner?: (n: { userId: string; campaignName: string; leadLabel: string; replyClass: ReplyClass; excerpt: string }) => Promise<void>;
  now?: () => Date;
}

export interface IngestResult { ok: true; duplicate: boolean; replyId: string; replyClass: ReplyClass; stoppedSequence: boolean }

/**
 * Takes one reply from a campaign contact and does everything that follows: file it against the right
 * campaign and contact, classify it, stop the sequence (out-of-office only pauses it), write a suggested
 * answer, mark the contact's outcome and tell the owner. The suggestion is never sent from here.
 */
export async function ingestReply(i: IngestInput, deps: IngestDeps = {}): Promise<IngestResult | { ok: false; error: string }> {
  const now = deps.now?.() ?? new Date();
  const lead = await prisma.outreachLead.findFirst({
    where: { id: i.leadId, userId: i.userId },
    select: { id: true, campaignId: true, email: true, name: true, business: true, repliedAt: true, stage: true, campaign: { select: { name: true, automation: true } } },
  });
  if (!lead) return { ok: false, error: 'That contact was not found.' };
  const text = i.text.replace(/\0/g, '').trim().slice(0, 20000);
  if (!text) return { ok: false, error: 'The reply is empty.' };

  if (i.messageId) {
    const seen = await prisma.campaignReply.findFirst({ where: { userId: i.userId, messageId: i.messageId }, select: { id: true, replyClass: true } });
    if (seen) return { ok: true, duplicate: true, replyId: seen.id, replyClass: seen.replyClass as ReplyClass, stoppedSequence: false };
  }

  const subject = (i.subject ?? '').slice(0, 300);
  let cls = classifyReplyRules(text, subject);
  let classifiedBy = 'rules';
  if (cls.confidence < 0.75 && deps.classifyAi) {
    const ai = await deps.classifyAi(freshText(text), subject).catch(() => null);
    if (ai && ai.confidence > cls.confidence) { cls = { ...cls, replyClass: ai.replyClass, confidence: ai.confidence }; classifiedBy = 'ai'; }
  }

  const brief = sanitizeAutomation(lead.campaign.automation)?.brief ?? null;
  const ruleSuggestion = suggestReplyRules({ replyClass: cls.replyClass, replyText: text, leadName: lead.name, business: lead.business, brief });
  let suggestion = ruleSuggestion; let suggestionBy = 'rules';
  if (deps.suggestAi && isPositive(cls.replyClass)) {
    const ai = await deps.suggestAi({ replyClass: cls.replyClass, text: freshText(text), leadName: lead.name, business: lead.business }).catch(() => null);
    if (ai && ai.trim()) { suggestion = ai.trim().slice(0, 4000); suggestionBy = 'ai'; }
  }

  const reply = await prisma.campaignReply.create({
    data: {
      userId: i.userId, campaignId: lead.campaignId, leadId: lead.id, messageId: i.messageId ?? null, source: i.source,
      fromEmail: lead.email, subject: subject || null, text, receivedAt: i.receivedAt ?? now,
      replyClass: cls.replyClass, confidence: cls.confidence, classifiedBy, suggestion, suggestionBy,
    },
    select: { id: true },
  });

  const stops = STOPS_SEQUENCE(cls.replyClass);
  const data: Record<string, unknown> = { replyClass: cls.replyClass };
  if (cls.replyClass === 'out_of_office') {
    data.pausedUntil = new Date(now.getTime() + OOO_PAUSE_DAYS * 86_400_000);
  } else {
    data.repliedAt = lead.repliedAt ?? i.receivedAt ?? now;
    data.outcome = isPositive(cls.replyClass) ? 'interested' : cls.replyClass === 'not_interested' || cls.replyClass === 'unsubscribe' ? 'not_interested' : null;
  }
  await prisma.outreachLead.update({ where: { id: lead.id }, data });

  if (cls.replyClass === 'unsubscribe') {
    // Same effect as the one-click link: no campaign of this user's emails them again.
    await prisma.outreachLead.updateMany({ where: { userId: i.userId, email: lead.email, unsubscribedAt: null }, data: { status: 'unsubscribed', unsubscribedAt: now } });
  }

  const label = lead.business || lead.name || lead.email;
  await logAgent(i.userId, 'reply', `Read a reply from ${label}`, `${REPLY_LABEL[cls.replyClass]} (${Math.round(cls.confidence * 100)}%, ${classifiedBy}). ${cls.reason}`, lead.campaignId, lead.id);
  if (stops) await logAgent(i.userId, 'followup', `Stopped follow-ups for ${label}`, cls.replyClass === 'unsubscribe' ? 'They asked not to be contacted again.' : 'They replied.', lead.campaignId, lead.id);

  if (deps.notifyOwner && isPositive(cls.replyClass)) {
    await deps.notifyOwner({ userId: i.userId, campaignName: lead.campaign.name, leadLabel: label, replyClass: cls.replyClass, excerpt: freshText(text).slice(0, 400) })
      .then(() => prisma.outreachLead.update({ where: { id: lead.id }, data: { ownerNotifiedAt: now } }))
      .catch(() => undefined);
  }

  emitWebhook(i.userId, 'reply.received', { replyId: reply.id, campaign: lead.campaign.name, lead: { email: lead.email, name: lead.name, business: lead.business }, replyType: cls.replyClass, text: freshText(text).slice(0, 2000) });
  if (isPositive(cls.replyClass)) emitWebhook(i.userId, 'lead.interested', { replyId: reply.id, campaign: lead.campaign.name, lead: { email: lead.email, name: lead.name, business: lead.business }, replyType: cls.replyClass });

  return { ok: true, duplicate: false, replyId: reply.id, replyClass: cls.replyClass, stoppedSequence: stops };
}
