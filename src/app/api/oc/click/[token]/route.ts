import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyTrackedLink } from '@/lib/trackedLink';

export const dynamic = 'force-dynamic';

const TOKEN_RE = /^[A-Za-z0-9_-]{16,40}$/;
// Link scanners follow every URL within seconds of delivery; those hits are redirected but not counted.
const SCANNER_WINDOW_MS = 8_000;

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const url = req.nextUrl.searchParams.get('u') ?? '';
  const sig = req.nextUrl.searchParams.get('s') ?? '';
  const dest = TOKEN_RE.test(params.token) ? verifyTrackedLink(params.token, url, sig) : null;
  if (!dest) return new NextResponse('This link is not valid.', { status: 400, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

  try {
    const lead = await prisma.outreachLead.findUnique({ where: { token: params.token }, select: { id: true, lastSentAt: true, openedAt: true, clickedAt: true } });
    if (lead?.lastSentAt && Date.now() - lead.lastSentAt.getTime() > SCANNER_WINDOW_MS) {
      const now = new Date();
      await prisma.outreachLead.update({
        where: { id: lead.id },
        data: {
          clickCount: { increment: 1 },
          ...(lead.clickedAt ? {} : { clickedAt: now }),
          // Someone who clicked certainly opened it, even if their mail app blocks images.
          ...(lead.openedAt ? {} : { openedAt: now, openCount: { increment: 1 } }),
        },
      });
    }
  } catch (e) {
    console.error('[oc/click]', e);
  }
  return NextResponse.redirect(dest, 302);
}
