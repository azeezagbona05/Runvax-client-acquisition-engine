import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';
import { emailConfigured } from '@/lib/lifecycleRunner';
import { aiAvailable, draftWithAi, previewAudience, renderStep, sendCounts } from '@/lib/platformCampaign';
import { cleanText, configProblems, describeSegment, firstName, isPurpose, planCampaign, sampleById, sanitizeConfig, sanitizeSegment, sanitizeStep, PURPOSES, SAMPLES } from '@/lib/platformCampaignShared';
import { getAppName } from '@/lib/url';
import { getSiteSettings } from '@/lib/siteSettings';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Admin-only. GET lists the campaigns for RUNVAX users. POST does one of:
 *   plan     { purpose, detail, useAi }  -> a drafted campaign (nothing saved)
 *   sample   { id }                      -> a ready-made campaign to start from (nothing saved)
 *   audience { segment }                 -> how many people the filters match
 *   preview  { step }                    -> the rendered email, for the preview pane
 *   create   { name, purpose, config }   -> saves a draft (nothing is sent)
 * Nothing here sends email: sending is /[id]/send, behind a typed confirmation.
 */

const UNAVAILABLE = 'Campaigns for users are unavailable. Has migration 14_platform_campaigns been applied? (It also needs 4_lifecycle_emails.)';
const audit = (actorEmail: string, action: string, title: string, detail?: string) => prisma.adminAuditLog.create({ data: { actorEmail, action, title, detail } }).catch(() => {});

export async function GET() {
  const admin = await requireAdmin(); if (!admin.ok) return admin.response;
  try {
    const rows = await prisma.platformCampaign.findMany({ orderBy: { updatedAt: 'desc' }, take: 100 });
    const campaigns = await Promise.all(rows.map(async (r) => {
      const cfg = sanitizeConfig(r.config);
      const { perStep } = await sendCounts(r.id, cfg.steps.length);
      return { id: r.id, name: r.name, purpose: r.purpose, status: r.status, updatedAt: r.updatedAt, emails: cfg.steps.length, perStep, audience: describeSegment(cfg.segment) };
    }));
    return NextResponse.json({ ok: true, campaigns, aiAvailable: aiAvailable(), emailConfigured: emailConfigured(), purposes: PURPOSES, samples: SAMPLES.map(({ id, label, hint }) => ({ id, label, hint })) });
  } catch (e) {
    console.error('[admin/platform-campaigns] list', e);
    return NextResponse.json({ ok: false, error: UNAVAILABLE }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(); if (!admin.ok) return admin.response;
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  try {
    if (body.action === 'plan') {
      if (!isPurpose(body.purpose)) return NextResponse.json({ error: 'Choose what the campaign is for.' }, { status: 400 });
      const detail = cleanText(body.detail, 400);
      const ai = body.useAi === true ? await draftWithAi(body.purpose, detail) : null;
      const plan = ai ?? planCampaign(body.purpose, detail);
      return NextResponse.json({ ok: true, ...plan, usedAi: !!ai, aiRequestedButUnavailable: body.useAi === true && !ai });
    }
    if (body.action === 'sample') {
      const x = sampleById(body.id);
      if (!x) return NextResponse.json({ error: 'Unknown sample' }, { status: 400 });
      return NextResponse.json({ ok: true, name: x.name, purpose: x.purpose, config: x.config, usedAi: false, aiRequestedButUnavailable: false });
    }
    if (body.action === 'audience') {
      return NextResponse.json({ ok: true, ...(await previewAudience(sanitizeSegment(body.segment))) });
    }
    if (body.action === 'preview') {
      const step = sanitizeStep(body.step);
      if (!step.subject || !step.body) return NextResponse.json({ error: 'Write a subject and a message first.' }, { status: 400 });
      const mail = renderStep(step, { name: firstName('Ada Obi'), plan: 'Free', appName: getAppName(), trialDays: (await getSiteSettings()).trialDays });
      return NextResponse.json({ ok: true, ...mail });
    }
    if (body.action === 'create') {
      const config = sanitizeConfig(body.config);
      const problems = configProblems(config);
      if (problems.length) return NextResponse.json({ error: problems[0] }, { status: 400 });
      const purpose = isPurpose(body.purpose) ? body.purpose : 'custom';
      const name = cleanText(body.name, 120) || 'Untitled campaign';
      const row = await prisma.platformCampaign.create({ data: { name, purpose, status: 'draft', config: config as unknown as object, createdBy: admin.email } });
      await audit(admin.email, 'platform_campaign_created', `Created campaign "${name}"`, `${config.steps.length} emails. Audience: ${describeSegment(config.segment)}`);
      return NextResponse.json({ ok: true, id: row.id }, { status: 201 });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    console.error('[admin/platform-campaigns]', e);
    return NextResponse.json({ error: UNAVAILABLE }, { status: 503 });
  }
}
