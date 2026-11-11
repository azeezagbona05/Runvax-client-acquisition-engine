import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { emailConfigured } from '@/lib/lifecycleRunner';
import { aiAvailable, createPlatformCampaign, draftWithAi, listPlatformCampaigns, previewAudience, renderPreview } from '@/lib/platformCampaign';
import { GOALS, LINK_PAGES, PURPOSES, SAMPLES, cleanText, isPurpose, planCampaign, sampleById, sanitizePlan, sanitizeSegment } from '@/lib/platformCampaignShared';
import { getSiteSettings } from '@/lib/siteSettings';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Admin-only. Campaigns for RUNVAX users run on the customer campaign engine (same follow-ups, tracking and replies),
 * owned by the signed-in admin's own account. GET lists them. POST does one of:
 *   plan     { purpose, detail, useAi }  -> a drafted campaign (nothing saved)
 *   sample   { id }                      -> a ready-made campaign to start from (nothing saved)
 *   audience { segment }                 -> how many people the filters match
 *   preview  { email, linkPath }         -> the email as people will receive it
 *   create   { plan }                    -> saves it and adds the matching users as leads (nothing is sent)
 */
const UNAVAILABLE = 'Campaigns for users are unavailable. Has migration 14_platform_campaigns been applied? (The campaign engine tables from migrations 4 to 6 are needed too.)';

export async function GET() {
  const admin = await requireAdmin(); if (!admin.ok) return admin.response;
  try {
    return NextResponse.json({
      ok: true, campaigns: await listPlatformCampaigns(admin.userId), aiAvailable: aiAvailable(), emailConfigured: emailConfigured(),
      purposes: PURPOSES, goals: GOALS, linkPages: LINK_PAGES, samples: SAMPLES.map(({ id, label, hint }) => ({ id, label, hint })),
    });
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
      const plan = ai ?? planCampaign(body.purpose, detail, (await getSiteSettings()).trialDays);
      return NextResponse.json({ ok: true, plan, usedAi: !!ai, aiRequestedButUnavailable: body.useAi === true && !ai });
    }
    if (body.action === 'sample') {
      const x = sampleById(body.id);
      if (!x) return NextResponse.json({ error: 'Unknown sample' }, { status: 400 });
      return NextResponse.json({ ok: true, plan: x.plan, usedAi: false, aiRequestedButUnavailable: false });
    }
    if (body.action === 'audience') return NextResponse.json({ ok: true, ...(await previewAudience(sanitizeSegment(body.segment))) });
    if (body.action === 'preview') {
      const e = (body.email ?? {}) as { subject?: unknown; body?: unknown; firstSubject?: unknown };
      const p = sanitizePlan({ name: 'x', automation: { name: 'x', emails: [{ subject: e.subject, body: e.body }] }, linkPath: body.linkPath });
      if (!p) return NextResponse.json({ error: 'Write a subject and a message first.' }, { status: 400 });
      const first = typeof e.firstSubject === 'string' && e.firstSubject ? e.firstSubject : p.automation.emails[0].subject;
      return NextResponse.json({ ok: true, ...(await renderPreview(admin.userId, p.automation.emails[0], p.linkPath, first)) });
    }
    if (body.action === 'create') {
      const plan = sanitizePlan(body.plan);
      if (!plan) return NextResponse.json({ error: 'Add at least one email with a subject and a message.' }, { status: 400 });
      const r = await createPlatformCampaign({ adminUserId: admin.userId, adminEmail: admin.email, plan });
      if ('error' in r) return NextResponse.json({ error: r.error }, { status: 400 });
      return NextResponse.json({ ok: true, ...r }, { status: 201 });
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    console.error('[admin/platform-campaigns]', e);
    return NextResponse.json({ error: UNAVAILABLE }, { status: 503 });
  }
}
