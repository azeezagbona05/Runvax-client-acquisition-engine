import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { loadCareer, logEvent } from '@/lib/career/store';
import { cancelQueuedFor } from '@/lib/career/submit/queue';

export const dynamic = 'force-dynamic';

/**
 * PATCH { action: 'approve' | 'reject' | 'reopen' | 'applied', coverLetter?, answers? }: the candidate decides.
 * 'approve' = ready to submit (Phase 4 will do the submitting; today nothing is sent). 'applied' = the candidate says THEY applied; it is recorded as theirs.
 * Text can be edited only while the application is still waiting for a decision.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({})) as { action?: unknown; coverLetter?: unknown; answers?: unknown };
  const a = await prisma.jobApplication.findFirst({ where: { id, userId: u.userId }, include: { match: { include: { listing: { select: { title: true, company: true } } } } } });
  if (!a) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
  const label = `${a.match.listing.title} at ${a.match.listing.company}`;
  const data: Record<string, unknown> = {};

  if (b.coverLetter !== undefined || b.answers !== undefined) {
    if (a.status !== 'prepared') return NextResponse.json({ error: 'Re-open the application to edit it.' }, { status: 400 });
    if (typeof b.coverLetter === 'string') data.coverLetter = b.coverLetter.slice(0, 4000);
    if (Array.isArray(b.answers)) data.answers = b.answers.slice(0, 10).map((x) => ({ question: String((x as { question?: unknown })?.question ?? '').slice(0, 200), answer: String((x as { answer?: unknown })?.answer ?? '').slice(0, 2000) })).filter((x) => x.question);
    data.edited = true;
  }
  const act = b.action;
  if (act === 'approve') {
    if (a.status !== 'prepared') return NextResponse.json({ error: 'Only an application waiting for a decision can be approved.' }, { status: 400 });
    if (!(await loadCareer(u.userId)).profileConfirmed) return NextResponse.json({ error: 'Your profile has changed since this was written. Confirm it again, then prepare the application again.' }, { status: 400 });
    Object.assign(data, { status: 'approved', approvedAt: new Date() });
  } else if (act === 'reject') {
    if (a.status === 'applied') return NextResponse.json({ error: 'You already marked this as applied.' }, { status: 400 });
    Object.assign(data, { status: 'rejected', approvedAt: null });
  } else if (act === 'reopen') {
    if (a.status === 'applied') return NextResponse.json({ error: 'You already marked this as applied.' }, { status: 400 });
    Object.assign(data, { status: 'prepared', approvedAt: null });
  } else if (act === 'applied') {
    if (a.status === 'rejected') return NextResponse.json({ error: 'Re-open the application first.' }, { status: 400 });
    if (a.status === 'applied') return NextResponse.json({ error: a.appliedBy === 'agent' ? 'The agent already submitted this one.' : 'You already marked this as applied.' }, { status: 400 });
    Object.assign(data, { status: 'applied', appliedAt: new Date(), appliedBy: 'user' });
  } else if (act !== undefined) return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });

  if (!Object.keys(data).length) return NextResponse.json({ error: 'Nothing to change.' }, { status: 400 });
  await prisma.jobApplication.update({ where: { id }, data });
  if (act === 'applied' || act === 'reject' || act === 'reopen' || data.edited) await cancelQueuedFor(u.userId, id);
  const what = act === 'approve' ? 'application_approved' : act === 'reject' ? 'application_rejected' : act === 'reopen' ? 'application_reopened' : act === 'applied' ? 'marked_applied_by_candidate' : 'application_edited';
  await logEvent(u.userId, act === 'approve' || act === 'reject' ? 'orchestrator' : 'application_writer', what, label);
  return NextResponse.json({ ok: true });
}
