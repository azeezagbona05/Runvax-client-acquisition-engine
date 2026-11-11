import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';
import { campaignDetail, deleteCampaign, sendSafetyProblem, setCampaignState, startCampaign, updateCampaign } from '@/lib/platformCampaign';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };
const audit = (actorEmail: string, action: string, title: string, detail?: string) => prisma.adminAuditLog.create({ data: { actorEmail, action, title, detail } }).catch(() => {});

/** The campaign with its workflow, per-email numbers, every person and how they interacted, and the replies. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const admin = await requireAdmin(); if (!admin.ok) return admin.response;
  const { id } = await params;
  try {
    const d = await campaignDetail(admin.userId, id);
    if (!d) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    return NextResponse.json({ ok: true, ...d });
  } catch (e) {
    console.error('[admin/platform-campaigns/id] get', e);
    return NextResponse.json({ error: 'Could not load the campaign.' }, { status: 503 });
  }
}

/**
 * PATCH { name?, plan? }                      edit the name, emails or settings
 * PATCH { action: 'run', confirm: 'SEND' }    start it: from now on introductions can be sent and follow-ups come due
 * PATCH { action: 'pause' | 'resume' | 'finish' }
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const admin = await requireAdmin(); if (!admin.ok) return admin.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { name?: unknown; plan?: unknown; action?: unknown; confirm?: unknown };
  try {
    if (body.action === 'run' || body.action === 'resume') {
      if (body.action === 'run' && body.confirm !== 'SEND') return NextResponse.json({ error: 'Type SEND to confirm' }, { status: 400 });
      const problem = sendSafetyProblem(); if (problem) return NextResponse.json({ error: problem }, { status: 503 });
      const r = await startCampaign(admin.userId, id);
      if ('error' in r) return NextResponse.json({ error: r.error, code: r.code }, { status: r.code === 'NO_MAILBOX' ? 503 : 400 });
      await audit(admin.email, 'platform_campaign_started', body.action === 'run' ? 'Started a campaign for users' : 'Resumed a campaign for users', id);
      return NextResponse.json({ ok: true });
    }
    if (body.action === 'pause' || body.action === 'finish') {
      const r = await setCampaignState(admin.userId, id, body.action === 'pause' ? 'paused' : 'finished');
      if ('error' in r) return NextResponse.json({ error: r.error }, { status: 404 });
      await audit(admin.email, 'platform_campaign_updated', body.action === 'pause' ? 'Paused a campaign for users' : 'Finished a campaign for users', id);
      return NextResponse.json({ ok: true });
    }
    if (body.action !== undefined) return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    const r = await updateCampaign(admin.userId, admin.email, id, { name: body.name, plan: body.plan });
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[admin/platform-campaigns/id] patch', e);
    return NextResponse.json({ error: 'Could not save the campaign.' }, { status: 503 });
  }
}

/** Only a campaign that has never sent can be deleted; otherwise mark it finished. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const admin = await requireAdmin(); if (!admin.ok) return admin.response;
  const { id } = await params;
  try {
    const r = await deleteCampaign(admin.userId, admin.email, id);
    if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status ?? 400 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[admin/platform-campaigns/id] delete', e);
    return NextResponse.json({ error: 'Could not delete the campaign.' }, { status: 503 });
  }
}
