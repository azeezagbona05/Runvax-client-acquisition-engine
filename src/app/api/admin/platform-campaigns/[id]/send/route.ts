import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';
import { rateLimit } from '@/lib/rateLimiter';
import { firstName } from '@/lib/platformCampaignShared';
import { sendNow, sendSafetyProblem, sendTest } from '@/lib/platformCampaign';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const audit = (actorEmail: string, action: string, title: string, detail?: string) => prisma.adminAuditLog.create({ data: { actorEmail, action, title, detail } }).catch(() => {});

/**
 * POST { action: 'test', step }                          one copy of that email to the signed-in admin only
 * POST { action: 'send', kind: 'initial'|'followup', confirm: 'SEND' }   the next batch (the campaign must be started)
 * Follow-ups are only ever sent when the admin asks for them here, exactly as in the customer campaign builder. People who reached
 * the campaign goal are marked converted first, so they are not followed up. Batches respect the daily cap; call again while leftToSend > 0.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(); if (!admin.ok) return admin.response;
  if (!rateLimit(`pc-send:${admin.userId}`, { maxRequests: 40, windowMs: 60_000 }).ok) return NextResponse.json({ error: 'Slow down: too many send requests. Try again in a minute.' }, { status: 429 });
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { action?: unknown; kind?: unknown; step?: unknown; confirm?: unknown };
  try {
    if (body.action === 'test') {
      const step = typeof body.step === 'number' && Number.isInteger(body.step) ? body.step : 0;
      const me = await prisma.user.findUnique({ where: { id: admin.userId }, select: { name: true } });
      const r = await sendTest(admin.userId, admin.email, me?.name ? firstName(me.name) : null, id, step);
      if ('error' in r) return NextResponse.json({ error: r.error }, { status: 503 });
      return NextResponse.json({ ok: true, sentTo: admin.email });
    }
    if (body.action === 'send') {
      if (body.confirm !== 'SEND') return NextResponse.json({ error: 'Type SEND to confirm' }, { status: 400 });
      const problem = sendSafetyProblem(); if (problem) return NextResponse.json({ error: problem }, { status: 503 });
      const kind = body.kind === 'followup' ? 'followup' : 'initial';
      const r = await sendNow(admin.userId, id, kind);
      if ('error' in r) return NextResponse.json({ error: r.error }, { status: 409 });
      if (r.aborted === 'no_mailbox' || r.aborted === 'mailbox_error') return NextResponse.json({ error: r.message ?? 'The mail server could not be reached.', ...r }, { status: 503 });
      if (r.aborted === 'not_started') return NextResponse.json({ error: 'Start the campaign first.', ...r }, { status: 409 });
      if (r.sent > 0 || r.failed > 0) await audit(admin.email, 'platform_campaign_sent', `${kind === 'initial' ? 'Introductions' : 'Follow-ups'} for a campaign: sent ${r.sent}, failed ${r.failed}, skipped ${r.skipped}, ${r.leftToSend} left`, id);
      return NextResponse.json({ ok: true, ...r });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    console.error('[admin/platform-campaigns/send]', e);
    return NextResponse.json({ error: 'Could not send. Check that the campaign tables exist.' }, { status: 503 });
  }
}
