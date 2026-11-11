import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { prisma } from '@/lib/prisma';
import { loadCampaign, sendCounts, stepAudience } from '@/lib/platformCampaign';
import { cleanText, configProblems, describeSegment, sanitizeConfig } from '@/lib/platformCampaignShared';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const audit = (actorEmail: string, action: string, title: string, detail?: string) => prisma.adminAuditLog.create({ data: { actorEmail, action, title, detail } }).catch(() => {});
type Ctx = { params: Promise<{ id: string }> };

/** The campaign with, for every email, who can be sent it right now and why everyone else cannot. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const admin = await requireAdmin(); if (!admin.ok) return admin.response;
  const { id } = await params;
  try {
    const c = await loadCampaign(id);
    if (!c) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    const counts = await sendCounts(id, c.cfg.steps.length);
    const steps = await Promise.all(c.cfg.steps.map(async (_, i) => {
      const a = await stepAudience(id, c.cfg, i);
      return { sent: counts.perStep[i], matching: a.matching, eligible: a.eligible.length, waiting: a.waiting, notReached: a.notReached, goalReached: a.goalReached, optedOut: a.optedOut };
    }));
    return NextResponse.json({ ok: true, campaign: { id, name: c.row.name, purpose: c.row.purpose, status: c.row.status, config: c.cfg, createdBy: c.row.createdBy, updatedAt: c.row.updatedAt }, steps, last24h: counts.last24h, audience: describeSegment(c.cfg.segment) });
  } catch (e) {
    console.error('[admin/platform-campaigns/id] get', e);
    return NextResponse.json({ error: 'Could not load the campaign.' }, { status: 503 });
  }
}

/** Edit the name, the settings, the emails, or pause/resume/finish. Emails that already went out cannot be rewritten. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const admin = await requireAdmin(); if (!admin.ok) return admin.response;
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { name?: unknown; config?: unknown; status?: unknown };
  try {
    const c = await loadCampaign(id);
    if (!c) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    const data: { name?: string; status?: string; config?: object } = {};
    const notes: string[] = [];
    if (typeof body.name === 'string') { data.name = cleanText(body.name, 120) || c.row.name; if (data.name !== c.row.name) notes.push('renamed'); }
    if (body.status === 'paused' || body.status === 'active' || body.status === 'finished') {
      if (c.row.status === 'finished') return NextResponse.json({ error: 'A finished campaign cannot be restarted. Duplicate it instead.' }, { status: 409 });
      data.status = body.status; notes.push(`status ${body.status}`);
    }
    if (body.config !== undefined) {
      const next = sanitizeConfig(body.config);
      const { perStep } = await sendCounts(id, c.cfg.steps.length);
      // An email that has gone out stays exactly as it was sent.
      const locked = perStep.map((n) => n > 0);
      const merged = { ...next, steps: next.steps.map((s, i) => (locked[i] && c.cfg.steps[i] ? c.cfg.steps[i] : s)) };
      for (let i = merged.steps.length; i < c.cfg.steps.length; i++) if (locked[i]) merged.steps.push(c.cfg.steps[i]);
      const problems = configProblems(merged);
      if (problems.length) return NextResponse.json({ error: problems[0] }, { status: 400 });
      data.config = merged as unknown as object; notes.push('settings or emails edited');
    }
    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
    await prisma.platformCampaign.update({ where: { id }, data });
    await audit(admin.email, 'platform_campaign_updated', `Updated campaign "${data.name ?? c.row.name}"`, notes.join(', '));
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
    const c = await loadCampaign(id);
    if (!c) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    const { perStep } = await sendCounts(id, c.cfg.steps.length);
    if (perStep.some((n) => n > 0)) return NextResponse.json({ error: 'This campaign has already sent email, so it is kept for the record. Mark it finished instead.' }, { status: 409 });
    await prisma.platformCampaign.delete({ where: { id } });
    await audit(admin.email, 'platform_campaign_deleted', `Deleted campaign "${c.row.name}"`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[admin/platform-campaigns/id] delete', e);
    return NextResponse.json({ error: 'Could not delete the campaign.' }, { status: 503 });
  }
}
