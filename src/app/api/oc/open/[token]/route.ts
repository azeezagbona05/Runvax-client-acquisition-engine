import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// 1×1 transparent GIF.
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const TOKEN_RE = /^[A-Za-z0-9_-]{16,40}$/;

// Mail apps that preload images (Apple Mail Privacy Protection, Gmail's proxy) and security
// scanners fetch this too, so "opened" is an estimate, never proof that a person read it.
// A hit in the first seconds after sending is a scanner, so it isn't counted.
const SCANNER_WINDOW_MS = 8_000;

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    if (TOKEN_RE.test(params.token)) {
      const lead = await prisma.outreachLead.findUnique({ where: { token: params.token }, select: { id: true, lastSentAt: true, openedAt: true } });
      if (lead?.lastSentAt && Date.now() - lead.lastSentAt.getTime() > SCANNER_WINDOW_MS) {
        await prisma.outreachLead.update({
          where: { id: lead.id },
          data: { openCount: { increment: 1 }, ...(lead.openedAt ? {} : { openedAt: new Date() }) },
        });
      }
    }
  } catch (e) {
    console.error('[oc/open]', e);
  }
  return new NextResponse(PIXEL, {
    headers: { 'Content-Type': 'image/gif', 'Content-Length': String(PIXEL.length), 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
  });
}
