import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';
import { loadCampaign, sendBatch, sendTest } from '@/lib/platformCampaign';
import { sendSafetyProblem } from '@/lib/launchCampaign';
import { emailConfigured } from '@/lib/lifecycleRunner';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const audit = (actorEmail: string, action: string, title: string, detail?: string) => prisma.adminAuditLog.create({ data: { actorEmail, action, title, detail } }).catch(() => {});

/**
 * POST { step, action: 'test' | 'send', confirm }.
 * test: one copy to the signed-in admin's own address, records nothing.
 * send: the next batch of that email to the people who are due it. Needs confirm === 'SEND'. Call again until remaining is 0.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(); if (!admin.ok) return admin.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { step?: unknown; action?: unknown; confirm?: unknown };
  const step = typeof body.step === 'number' && Number.isInteger(body.step) ? body.step : -1;
  try {
    const c = await loadCampaign(id);
    if (!c) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    if (step < 0 || step >= c.cfg.steps.length) return NextResponse.json({ error: 'Choose which email.' }, { status: 400 });

    if (body.action === 'test') {
      if (!emailConfigured()) return NextResponse.json({ error: 'Email is not configured on this server.' }, { status: 503 });
      await sendTest(c.cfg, step, admin.email);
      return NextResponse.json({ ok: true, sentTo: admin.email });
    }

    if (body.action === 'send') {
      if (body.confirm !== 'SEND') return NextResponse.json({ error: 'Type SEND to confirm' }, { status: 400 });
      if (c.row.status === 'paused') return NextResponse.json({ error: 'This campaign is paused. Resume it to send.' }, { status: 409 });
      if (c.row.status === 'finished') return NextResponse.json({ error: 'This campaign is finished.' }, { status: 409 });
      const problem = sendSafetyProblem();
      if (problem) return NextResponse.json({ error: problem }, { status: 503 });
      const result = await sendBatch(id, c.cfg, step);
      if (c.row.status === 'draft' && result.sent > 0) await prisma.platformCampaign.update({ where: { id }, data: { status: 'active' } }).catch(() => {});
      await audit(admin.email, 'platform_campaign_sent', `"${c.row.name}" email ${step + 1}: sent ${result.sent}, failed ${result.failed}, ${result.remaining} remaining`);
      return NextResponse.json({ ok: true, ...result });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    console.error('[admin/platform-campaigns/send]', e);
    return NextResponse.json({ error: 'Could not send. Check that the campaign tables exist.' }, { status: 503 });
  }
}
