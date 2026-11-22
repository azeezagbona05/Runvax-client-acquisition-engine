import { NextRequest, NextResponse } from 'next/server';
import dns from 'node:dns/promises';
import { prisma } from '@/lib/prisma';
import { guardInstalled } from '@/lib/v2Setup';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { loadMailbox } from '@/lib/outreachSender';
import { autoFollowUpsOn, sanitizeAutomation } from '@/lib/automation';
import { isRoleAddress, preflight } from '@/lib/preflight';

export const dynamic = 'force-dynamic';

const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9-]{1,63}\.)+[a-z]{2,24}$/;
const withTimeout = <T,>(p: Promise<T>, ms = 3000): Promise<T> => Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

/** true = a record exists, false = the domain answered and has none, null = the lookup itself failed. */
async function hasTxt(name: string, starts: string): Promise<boolean | null> {
  try {
    const rows = await withTimeout(dns.resolveTxt(name));
    return rows.some((r) => r.join('').toLowerCase().startsWith(starts));
  } catch (e) {
    const code = (e as { code?: string }).code;
    return code === 'ENODATA' || code === 'ENOTFOUND' ? false : null;
  }
}

/** GET — is this campaign ready to send, and what will hurt its results? Reads only; sends nothing. */
async function handleGet(req: NextRequest, id: string) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;
  if (!rateLimit(`oc-preflight:${user.userId}`, { maxRequests: 30, windowMs: 60_000 }).ok) return NextResponse.json({ error: 'Slow down: try again in a minute.' }, { status: 429 });

  const campaign = await prisma.outreachCampaign.findFirst({ where: { id, userId: user.userId }, select: { subject: true, body: true, followUpBody: true, dailyCap: true, status: true, maxFollowUps: true, automation: true } });
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [mailbox, leads] = await Promise.all([
    loadMailbox(user.userId),
    prisma.outreachLead.findMany({ where: { campaignId: id }, select: { email: true, name: true, status: true }, take: 5000 }),
  ]);
  const seq = campaign.automation ? sanitizeAutomation(campaign.automation) : null;
  const domain = mailbox?.fromAddress.split('@')[1]?.toLowerCase();
  const freeMail = !!domain && /^(gmail|googlemail|yahoo|ymail|outlook|hotmail|live|icloud|aol|proton|protonmail)\./.test(domain);
  const dnsResult = mailbox && domain && DOMAIN_RE.test(domain) && !freeMail
    ? { spf: await hasTxt(domain, 'v=spf1'), dmarc: await hasTxt(`_dmarc.${domain}`, 'v=dmarc1') }
    : null;

  const queued = leads.filter((l) => l.status === 'queued');
  const result = preflight({
    mailbox: { connected: !!mailbox, fromAddress: mailbox?.fromAddress, senderNamed: !!(mailbox?.sender.name?.trim() || mailbox?.sender.business?.trim()) },
    dns: dnsResult,
    subject: campaign.subject,
    bodies: seq ? seq.emails.map((e) => e.body) : [campaign.body, ...(campaign.followUpBody ? [campaign.followUpBody] : [])],
    dailyCap: campaign.dailyCap, status: campaign.status, followUps: seq ? Math.max(0, seq.emails.length - 1) : campaign.maxFollowUps,
    autoFollowUps: autoFollowUpsOn(campaign.automation),
    leads: { queued: queued.length, total: leads.length, noName: leads.filter((l) => !l.name?.trim()).length, roleAddress: leads.filter((l) => isRoleAddress(l.email)).length },
    hasOfferLink: !!seq?.brief?.offerUrl,
  });
  return NextResponse.json(result);
}

export const GET = (req: NextRequest, { params }: { params: { id: string } }) => guardInstalled(() => handleGet(req, params.id));
