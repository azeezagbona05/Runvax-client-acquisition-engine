import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { loadCareer, logEvent } from '@/lib/career/store';
import { cancelQueued } from '@/lib/career/submit/queue';

export const dynamic = 'force-dynamic';

/**
 * POST { action: 'deploy' | 'pause' | 'resume' }. Deploying records the agent as Active with the chosen permissions.
 * In Phase 1 it has no job sources connected and submits nothing: that is stated on the page, not hidden.
 */
export async function POST(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const b = await req.json().catch(() => ({})) as { action?: unknown };
  const c = await loadCareer(u.userId);
  if (b.action === 'pause') {
    if (c.status !== 'active') return NextResponse.json({ error: 'The agent is not running.' }, { status: 400 });
    await prisma.careerPreference.update({ where: { userId: u.userId }, data: { status: 'paused' } }); await cancelQueued(u.userId); await logEvent(u.userId, 'orchestrator', 'paused', 'Candidate paused the agent');
  } else if (b.action === 'deploy' || b.action === 'resume') {
    if (c.issues.length) return NextResponse.json({ error: c.issues[0], issues: c.issues }, { status: 400 });
    await prisma.careerPreference.update({ where: { userId: u.userId }, data: { status: 'active', deployedAt: c.deployedAt ?? new Date() } });
    await logEvent(u.userId, 'orchestrator', b.action === 'deploy' ? 'deployed' : 'resumed', `Permission: ${c.permissions.mode}; minimum match ${c.discovery.minScore}%`);
  } else return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  return NextResponse.json(await loadCareer(u.userId));
}
