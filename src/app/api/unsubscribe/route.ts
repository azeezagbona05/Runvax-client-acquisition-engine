import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyUnsubscribeToken } from '@/lib/unsubscribe';

export const dynamic = 'force-dynamic';

async function optOut(req: NextRequest): Promise<boolean> {
  const u = req.nextUrl.searchParams.get('u') ?? '';
  const t = req.nextUrl.searchParams.get('t') ?? '';
  if (!u || !t || !verifyUnsubscribeToken(u, t)) return false;
  try {
    await prisma.lifecycleEmail.upsert({
      where: { userId_key: { userId: u, key: 'optout' } },
      create: { userId: u, key: 'optout' },
      update: {},
    });
    return true;
  } catch (e) {
    console.error('[unsubscribe]', e);
    return false;
  }
}

const page = (title: string, body: string, status = 200) => new NextResponse(
  `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head>
<body style="margin:0;background:#eef1f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="max-width:460px;margin:15vh auto;padding:36px 32px;background:#fff;border-radius:18px;box-shadow:0 8px 32px rgba(15,23,42,.10);text-align:center;">
<h1 style="margin:0 0 12px;font-size:22px;color:#0f172a;">${title}</h1><p style="margin:0;font-size:15px;line-height:1.65;color:#475569;">${body}</p></div></body></html>`,
  { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
);

// Link in the email footer.
export async function GET(req: NextRequest) {
  return (await optOut(req))
    ? page("You're unsubscribed", "We won't send you any more tips or promotional emails. You'll still get important account emails, like email verification and receipts.")
    : page('This link is not valid', 'It may be incomplete or out of date. To stop emails, reply to any of them with the word "unsubscribe" and we&rsquo;ll take care of it.', 400);
}

// RFC 8058 one-click unsubscribe, used by Gmail/Apple Mail's own "Unsubscribe" button.
export async function POST(req: NextRequest) {
  return NextResponse.json({ ok: await optOut(req) });
}
