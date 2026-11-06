import { prisma } from '@/lib/prisma';
import { MAX_LEADS_PER_CAMPAIGN, sanitizeLeads } from '@/lib/outreachCampaign';
import { newLeadToken } from '@/lib/outreachSender';

export interface AddLeadsResult {
  added: number;
  /** Already in this campaign. */
  duplicates: number;
  /** Unsubscribed from an earlier campaign of this account, so never added again. */
  optedOut: number;
  invalid: number;
  /** Past the per-campaign limit. */
  overLimit: number;
}

/**
 * Adds uploaded leads to a campaign. Anyone who has ever unsubscribed from one of this
 * account's campaigns is skipped, so a re-uploaded list can't email them again.
 */
export async function addLeads(campaignId: string, userId: string, raw: unknown): Promise<AddLeadsResult> {
  const { leads, invalid } = sanitizeLeads(raw);
  const result: AddLeadsResult = { added: 0, duplicates: 0, optedOut: 0, invalid, overLimit: 0 };
  if (!leads.length) return result;

  const emails = leads.map((l) => l.email);
  const [existing, unsubscribed, count] = await Promise.all([
    prisma.outreachLead.findMany({ where: { campaignId, email: { in: emails } }, select: { email: true } }),
    prisma.outreachLead.findMany({
      where: { userId, email: { in: emails }, OR: [{ status: 'unsubscribed' }, { unsubscribedAt: { not: null } }] },
      select: { email: true },
    }),
    prisma.outreachLead.count({ where: { campaignId } }),
  ]);
  const have = new Set(existing.map((e) => e.email));
  const optedOut = new Set(unsubscribed.map((e) => e.email));

  const fresh = [];
  for (const l of leads) {
    if (have.has(l.email)) { result.duplicates++; continue; }
    if (optedOut.has(l.email)) { result.optedOut++; continue; }
    fresh.push(l);
  }
  const room = Math.max(0, MAX_LEADS_PER_CAMPAIGN - count);
  const take = fresh.slice(0, room);
  result.overLimit = fresh.length - take.length;
  if (!take.length) return result;

  const created = await prisma.outreachLead.createMany({
    data: take.map((l) => ({
      campaignId, userId, email: l.email, name: l.name ?? null, business: l.business ?? null,
      website: l.website ?? null, token: newLeadToken(),
    })),
    skipDuplicates: true,
  });
  result.added = created.count;

  // Phone numbers live in their own table so a database without it yet still adds leads normally.
  const withPhone = take.filter((l) => l.phone);
  if (withPhone.length) {
    try {
      const ids = await prisma.outreachLead.findMany({ where: { campaignId, email: { in: withPhone.map((l) => l.email) } }, select: { id: true, email: true } });
      const idOf = new Map(ids.map((i) => [i.email, i.id]));
      await prisma.leadWhatsApp.createMany({ data: withPhone.flatMap((l) => (idOf.has(l.email) ? [{ userId, campaignId, leadId: idOf.get(l.email)!, phone: l.phone! }] : [])), skipDuplicates: true });
    } catch { /* WhatsApp table not created yet: leads are still added, WhatsApp just has no numbers */ }
  }
  return result;
}
