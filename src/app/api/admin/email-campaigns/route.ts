import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';
import { launchAudience, sendLaunchBatch, sendLaunchTest, sendSafetyProblem, MAX_BATCH, type LaunchWhich } from '@/lib/launchCampaign';
import { runLifecycle, emailConfigured } from '@/lib/lifecycleRunner';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Admin-only control for the email campaigns: the launch emails (offer, countdown, RUNVAX 2.0 invitation) and the new-user workflow.
 * Every real send is audit-logged. A "send" needs the typed confirmation word, so a stray
 * request can never email the user base.
 */

const UNAVAILABLE = 'Campaign data is unavailable. Has migration 4_lifecycle_emails been applied?';

async function audit(actorEmail: string, action: string, title: string, detail?: string) {
  await prisma.adminAuditLog.create({ data: { actorEmail, action, title, detail } }).catch(() => {});
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;
  try {
    const [a1, a2, a3] = await Promise.all([launchAudience(1), launchAudience(2), launchAudience(3)]);
    const strip = (a: Awaited<ReturnType<typeof launchAudience>>) => ({
      total: a.total, verified: a.verified, unverified: a.unverified, optedOut: a.optedOut, alreadySent: a.alreadySent, alreadyClaimed: a.alreadyClaimed, joinedRecently: a.joinedRecently, eligible: a.eligible.length,
    });
    return NextResponse.json({ ok: true, emailConfigured: emailConfigured(), maxBatch: MAX_BATCH, launch: { 1: strip(a1), 2: strip(a2), 3: strip(a3) } });
  } catch (e) {
    console.error('[admin/email-campaigns] status', e);
    return NextResponse.json({ ok: false, error: UNAVAILABLE }, { status: 503 });
  }
}

type Body = {
  campaign?: 'launch_1' | 'launch_2' | 'launch_3' | 'workflow';
  action?: 'test' | 'send' | 'preview' | 'run';
  confirm?: string;
};

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const body = await req.json().catch(() => ({})) as Body;
  const { campaign, action } = body;

  try {
    // ── The new-user workflow ──
    if (campaign === 'workflow') {
      if (action !== 'preview' && action !== 'run') return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
      if (action === 'run' && body.confirm !== 'SEND') return NextResponse.json({ error: 'Type SEND to confirm' }, { status: 400 });
      const result = await runLifecycle({ dryRun: action === 'preview' });
      if (action === 'run') {
        const n = Object.values(result.sent).reduce((a, b) => a + b, 0);
        await audit(admin.email, 'email_workflow_run', `Ran the new-user email workflow: ${n} sent, ${result.failed} failed`, JSON.stringify(result.sent));
      }
      return NextResponse.json(result, { status: result.ok ? 200 : 503 });
    }

    // ── A launch email ──
    if (campaign === 'launch_1' || campaign === 'launch_2' || campaign === 'launch_3') {
      const which: LaunchWhich = campaign === 'launch_1' ? 1 : campaign === 'launch_2' ? 2 : 3;

      if (action === 'test') {
        if (!emailConfigured()) return NextResponse.json({ error: 'Email is not configured on this server.' }, { status: 503 });
        await sendLaunchTest(which, admin.email);
        return NextResponse.json({ ok: true, sentTo: admin.email });
      }

      if (action === 'send') {
        if (body.confirm !== 'SEND') return NextResponse.json({ error: 'Type SEND to confirm' }, { status: 400 });
        const problem = sendSafetyProblem();
        if (problem) return NextResponse.json({ error: problem }, { status: 503 });
        const result = await sendLaunchBatch(which);
        await audit(admin.email, 'launch_email_sent', `Launch email ${which}: sent ${result.sent}, failed ${result.failed}, ${result.remaining} remaining`);
        return NextResponse.json({ ok: true, ...result });
      }
    }

    return NextResponse.json({ error: 'Unknown campaign or action' }, { status: 400 });
  } catch (e) {
    console.error('[admin/email-campaigns]', e);
    return NextResponse.json({ error: UNAVAILABLE }, { status: 503 });
  }
}
