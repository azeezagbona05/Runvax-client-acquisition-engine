import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminEmail } from '@/lib/adminSessionShared';

export const dynamic = 'force-dynamic';

const TOKEN_RE = /^[A-Za-z0-9_-]{16,40}$/;

const page = (title: string, body: string, status = 200) => new NextResponse(
  `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head>
<body style="margin:0;background:#eef1f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:460px;margin:15vh auto;padding:36px 32px;background:#fff;border-radius:18px;box-shadow:0 8px 32px rgba(15,23,42,.10);text-align:center;">
<h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;">${title}</h1><p style="margin:0;font-size:15px;line-height:1.65;color:#475569;">${body}</p></div></body></html>`,
  { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
);

/**
 * Stops every email to this address from this sender, across all of their campaigns.
 * Returns false when the link isn't a real one.
 */
async function optOut(token: string): Promise<boolean> {
  if (!TOKEN_RE.test(token)) return false;
  try {
    const lead = await prisma.outreachLead.findUnique({ where: { token }, select: { userId: true, email: true } });
    if (!lead) return false;
    await prisma.outreachLead.updateMany({
      where: { userId: lead.userId, email: lead.email, unsubscribedAt: null },
      data: { status: 'unsubscribed', unsubscribedAt: new Date() },
    });
    // A campaign RUNVAX itself runs for its own users: opting out also stops RUNVAX's other automatic emails to that person.
    try {
      const owner = await prisma.user.findUnique({ where: { id: lead.userId }, select: { email: true } });
      if (isAdminEmail(owner?.email)) {
        const account = await prisma.user.findUnique({ where: { email: lead.email }, select: { id: true } });
        if (account) await prisma.lifecycleEmail.create({ data: { userId: account.id, key: 'optout' } }).catch(() => {});
      }
    } catch (e) { console.error('[oc/unsubscribe] platform opt-out sync', e); }
    return true;
  } catch (e) {
    console.error('[oc/unsubscribe]', e);
    return false;
  }
}

// The link in the email footer opens a confirm page. Nothing changes on GET, because link
// scanners follow every URL in an email and would unsubscribe people who never clicked.
export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get('t') ?? '';
  if (t === 'preview') return page('This is a test email', 'In a real campaign this link lets the person opt out of further emails.');
  if (!TOKEN_RE.test(t)) return page('This link is not valid', 'It may be incomplete or out of date. Reply to the email and ask to be removed, and the sender will take care of it.', 400);
  return new NextResponse(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Unsubscribe</title></head>
<body style="margin:0;background:#eef1f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<form method="POST" action="/api/oc/unsubscribe?t=${encodeURIComponent(t)}" style="max-width:460px;margin:15vh auto;padding:36px 32px;background:#fff;border-radius:18px;box-shadow:0 8px 32px rgba(15,23,42,.10);text-align:center;">
<h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;">Unsubscribe</h1>
<p style="margin:0 0 22px;font-size:15px;line-height:1.65;color:#475569;">Stop receiving emails from this sender?</p>
<button type="submit" style="background:#0f172a;color:#fff;border:0;border-radius:10px;padding:12px 28px;font-size:15px;font-weight:600;cursor:pointer;">Yes, unsubscribe me</button></form></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  );
}

// The confirm button, and RFC 8058 one-click unsubscribe from Gmail / Apple Mail.
export async function POST(req: NextRequest) {
  const ok = await optOut(req.nextUrl.searchParams.get('t') ?? '');
  return ok
    ? page("You're unsubscribed", "You won't get any more emails from this sender.")
    : page('This link is not valid', 'It may be incomplete or out of date. Reply to the email and ask to be removed, and the sender will take care of it.', 400);
}
