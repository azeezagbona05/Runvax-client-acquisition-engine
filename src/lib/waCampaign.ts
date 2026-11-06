import { prisma } from '@/lib/prisma';
import { checkRecipient } from '@/lib/acquisition/recipientGuard';
import { dailyCapFor } from '@/lib/waRateLimit';
import { logAgent } from '@/lib/acqReplies';
import { HARD_DAILY_MAX, startOfToday } from '@/lib/outreachCampaign';

const GRAPH = 'https://graph.facebook.com/v20.0';
export const WA_BATCH = 5;
const GAP_MS = 1500;

export interface WaState {
  /** Why WhatsApp can't send yet, or null when it can. */
  blocker: string | null;
  withPhone: number;
  waiting: number;
  sent: number;
  sentToday: number;
  cap: number;
  failed: number;
}

/** Distinct days this account has sent a campaign WhatsApp message in the last 60 days: drives the warm-up cap. */
async function activeDays(userId: string): Promise<number> {
  const rows = await prisma.leadWhatsApp.findMany({ where: { userId, sentAt: { gte: new Date(Date.now() - 60 * 86_400_000) } }, select: { sentAt: true } });
  return new Set(rows.map((r) => r.sentAt!.toISOString().slice(0, 10))).size;
}

export async function waState(userId: string, campaignId: string): Promise<WaState> {
  const [s, rows, today, days] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId }, select: { waPhoneNumberId: true, waAccessToken: true, waTemplateName: true, waTemplateStatus: true } }),
    prisma.leadWhatsApp.findMany({ where: { campaignId, userId }, select: { sentAt: true, error: true, lead: { select: { status: true, unsubscribedAt: true, repliedAt: true, outcome: true } } } }),
    prisma.leadWhatsApp.count({ where: { userId, sentAt: { gte: startOfToday() } } }),
    activeDays(userId),
  ]);
  const sendable = (r: (typeof rows)[number]) => !r.sentAt && !r.error && !r.lead.unsubscribedAt && !r.lead.repliedAt && r.lead.outcome !== 'not_interested' && r.lead.status !== 'unsubscribed' && r.lead.status !== 'skipped';
  let blocker: string | null = null;
  if (!s?.waPhoneNumberId || !s.waAccessToken) blocker = 'Connect WhatsApp in Integrations first.';
  else if (!s.waTemplateName || s.waTemplateStatus !== 'APPROVED') blocker = 'Your WhatsApp message template is not approved by Meta yet. Finish the template step in Integrations.';
  return {
    blocker, withPhone: rows.length, waiting: rows.filter(sendable).length, sent: rows.filter((r) => r.sentAt).length,
    sentToday: today, cap: Math.min(dailyCapFor(days + (today === 0 ? 1 : 0)), HARD_DAILY_MAX), failed: rows.filter((r) => r.error).length,
  };
}

export interface WaBatch { sent: number; failed: number; blocked: number; remainingToday: number; message?: string }

/** Sends the approved template to the next few campaign contacts who have a phone. Warm-up capped, opted-out contacts excluded, every recipient checked first. */
export async function sendWhatsAppBatch(userId: string, campaignId: string): Promise<WaBatch | { error: string }> {
  const campaign = await prisma.outreachCampaign.findFirst({ where: { id: campaignId, userId }, select: { id: true, status: true, dailyCap: true, name: true } });
  if (!campaign) return { error: 'Campaign not found.' };
  if (campaign.status !== 'running') return { error: 'Run the campaign first. WhatsApp messages go out only while it is running.' };
  const st = await waState(userId, campaignId);
  if (st.blocker) return { error: st.blocker };
  const s = await prisma.userSettings.findUnique({ where: { userId }, select: { waPhoneNumberId: true, waAccessToken: true, waTemplateName: true } });
  const room = Math.max(0, Math.min(st.cap, campaign.dailyCap) - st.sentToday);
  if (room === 0) return { sent: 0, failed: 0, blocked: 0, remainingToday: 0, message: `Today's WhatsApp limit (${Math.min(st.cap, campaign.dailyCap)}) is reached. It grows as your number builds a sending history, to protect it from being flagged.` };

  const rows = await prisma.leadWhatsApp.findMany({
    where: { campaignId, userId, sentAt: null, error: null, lead: { unsubscribedAt: null, repliedAt: null, status: { notIn: ['unsubscribed', 'skipped'] }, OR: [{ outcome: null }, { outcome: { not: 'not_interested' } }] } },
    include: { lead: { select: { id: true, email: true, name: true, business: true } } }, orderBy: { createdAt: 'asc' }, take: Math.min(WA_BATCH, room),
  });
  let sent = 0, failed = 0, blocked = 0;
  for (const r of rows) {
    const verdict = await checkRecipient(userId, { email: r.lead.email, phone: r.phone });
    if (!verdict.allowed) {
      if (verdict.code === 'check_unavailable') return { error: verdict.message };
      await prisma.leadWhatsApp.update({ where: { id: r.id }, data: { error: verdict.message.slice(0, 480) } });
      blocked++; continue;
    }
    // Claim first so two overlapping requests can never message the same person twice.
    const claim = await prisma.leadWhatsApp.updateMany({ where: { id: r.id, sentAt: null }, data: { sentAt: new Date() } });
    if (claim.count === 0) continue;
    const label = r.lead.business || r.lead.name || r.phone;
    try {
      const res = await fetch(`${GRAPH}/${s!.waPhoneNumberId}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s!.waAccessToken}` },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: r.phone, type: 'template', template: { name: s!.waTemplateName, language: { code: 'en' }, components: [{ type: 'body', parameters: [{ type: 'text', text: label.slice(0, 100) }] }] } }),
        signal: AbortSignal.timeout(15_000),
      });
      const d = await res.json() as { messages?: Array<{ id: string }>; error?: { message?: string; error_data?: { details?: string } } };
      if (!res.ok || d.error) throw new Error(d.error?.error_data?.details ?? d.error?.message ?? 'Meta refused the message');
      await prisma.leadWhatsApp.update({ where: { id: r.id }, data: { messageId: d.messages?.[0]?.id ?? null } });
      await logAgent(userId, 'outreach', `Messaged ${label} on WhatsApp`, 'Sent your approved WhatsApp template.', campaignId, r.lead.id);
      sent++;
    } catch (e) {
      await prisma.leadWhatsApp.update({ where: { id: r.id }, data: { sentAt: null, error: (e instanceof Error ? e.message : 'Send failed').slice(0, 480) } });
      failed++;
    }
    if (rows.indexOf(r) < rows.length - 1) await new Promise((x) => setTimeout(x, GAP_MS));
  }
  return { sent, failed, blocked, remainingToday: Math.max(0, room - sent) };
}
