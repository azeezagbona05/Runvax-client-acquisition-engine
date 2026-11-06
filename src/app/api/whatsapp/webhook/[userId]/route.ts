import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getConnection } from '@/lib/integrations/store';
import { parseInbound, signatureOk, verifyTokenFor } from '@/lib/waWebhook';
import { ingestReply } from '@/lib/acqReplies';
import { phoneKey } from '@/lib/waPhoneKey';

export const dynamic = 'force-dynamic';

/** Meta's one-time check when the user registers this URL in their app. */
export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  const q = req.nextUrl.searchParams;
  if (q.get('hub.mode') === 'subscribe' && q.get('hub.verify_token') === verifyTokenFor(params.userId) && q.get('hub.challenge')) {
    return new NextResponse(q.get('hub.challenge'), { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

/** Messages people send to the user's WhatsApp number. Accepted only with a valid Meta signature; only replies from campaign contacts are kept. */
export async function POST(req: NextRequest, { params }: { params: { userId: string } }) {
  const raw = await req.text();
  const [conn, s] = await Promise.all([
    getConnection(params.userId, 'wa').catch(() => null),
    prisma.userSettings.findUnique({ where: { userId: params.userId }, select: { waPhoneNumberId: true } }),
  ]);
  const secret = conn?.secrets.appSecret;
  if (!secret || !s?.waPhoneNumberId) return new NextResponse('Not configured', { status: 403 });
  if (!signatureOk(raw, req.headers.get('x-hub-signature-256'), secret)) return new NextResponse('Bad signature', { status: 403 });

  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return new NextResponse('ok', { status: 200 }); }
  const messages = parseInbound(payload, s.waPhoneNumberId);
  if (messages.length) {
    const contacts = await prisma.leadWhatsApp.findMany({ where: { userId: params.userId, sentAt: { not: null } }, select: { leadId: true, phone: true }, orderBy: { sentAt: 'desc' }, take: 5000 });
    const byPhone = new Map<string, string>();
    for (const c of contacts) if (!byPhone.has(phoneKey(c.phone))) byPhone.set(phoneKey(c.phone), c.leadId);
    for (const m of messages) {
      const leadId = byPhone.get(phoneKey(m.from));
      if (!leadId) continue;
      await ingestReply({ userId: params.userId, leadId, text: m.text, subject: 'WhatsApp reply', source: 'whatsapp', messageId: `wa-${m.id}`, receivedAt: m.at }).catch(() => undefined);
    }
  }
  // Always 200 so Meta does not keep retrying messages that are not ours.
  return new NextResponse('ok', { status: 200 });
}
