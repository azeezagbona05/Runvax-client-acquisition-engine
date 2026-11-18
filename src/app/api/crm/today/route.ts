import { NextRequest, NextResponse } from 'next/server';
import { guardInstalled } from '@/lib/v2Setup';
import { requireCrm, workspaceUsers } from '@/lib/crm/access';
import { loadWorkspaceContacts } from '@/lib/crm/data';
import { buildQueue } from '@/lib/crm/queue';

export const dynamic = 'force-dynamic';

/** GET ?scope=mine|all: who to reach out to, most urgent first, each with the reasons. "mine" = assigned to me plus anything unassigned. */
export const GET = (req: NextRequest) => guardInstalled(async () => {
  const a = await requireCrm(req); if (!a.ok) return a.response;
  const { ctx } = a;
  const scope = new URL(req.url).searchParams.get('scope') === 'all' ? 'all' : 'mine';
  const [rows, users] = await Promise.all([loadWorkspaceContacts(ctx.ownerId), workspaceUsers(ctx.ownerId)]);
  const by = new Map(rows.map((r) => [r.lead.id, r]));
  const name = (id: string | null) => (id ? users.find((u) => u.id === id)?.name || users.find((u) => u.id === id)?.email || null : null);
  const queue = buildQueue(rows.map((r) => r.queue), { userId: ctx.userId, scope }).slice(0, 100).map((i) => {
    const r = by.get(i.leadId)!;
    return { ...i, business: r.lead.business, name: r.lead.name, email: r.lead.email, stage: r.stage, campaign: r.lead.campaign.name, assigneeName: name(i.assigneeId), unassigned: i.assigneeId === null };
  });
  return NextResponse.json({ scope, total: queue.length, queue });
});
