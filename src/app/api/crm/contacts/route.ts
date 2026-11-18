import { NextRequest, NextResponse } from 'next/server';
import { guardInstalled } from '@/lib/v2Setup';
import { requireCrm, workspaceUsers } from '@/lib/crm/access';
import { loadWorkspaceContacts } from '@/lib/crm/data';
import { reachOut } from '@/lib/crm/queue';

export const dynamic = 'force-dynamic';

/** GET ?q=&stage=&assignee=<userId|none|me>&limit=&offset=: the workspace's contacts with stage, owner, next task and last activity. */
export const GET = (req: NextRequest) => guardInstalled(async () => {
  const a = await requireCrm(req); if (!a.ok) return a.response;
  const { ctx } = a; const sp = new URL(req.url).searchParams;
  const q = (sp.get('q') ?? '').trim().toLowerCase(); const stage = sp.get('stage') ?? ''; const assignee = sp.get('assignee') ?? '';
  const limit = Math.min(100, Math.max(1, Number(sp.get('limit')) || 50)); const offset = Math.max(0, Number(sp.get('offset')) || 0);
  const [rows, users] = await Promise.all([loadWorkspaceContacts(ctx.ownerId), workspaceUsers(ctx.ownerId)]);
  const who = (id: string | null) => (id ? users.find((u) => u.id === id)?.name || users.find((u) => u.id === id)?.email || 'Former teammate' : null);
  let list = rows.filter((r) => !r.queue.unsubscribed || stage === 'unsubscribed');
  if (q) list = list.filter((r) => `${r.lead.email} ${r.lead.name ?? ''} ${r.lead.business ?? ''}`.toLowerCase().includes(q));
  if (stage) list = list.filter((r) => r.stage === stage);
  if (assignee === 'none') list = list.filter((r) => !r.queue.assigneeId);
  else if (assignee) list = list.filter((r) => r.queue.assigneeId === (assignee === 'me' ? ctx.userId : assignee));
  const total = list.length;
  const page = list.slice(offset, offset + limit).map((r) => {
    const next = r.lead.crmTasks[0] ?? null;
    return {
      id: r.lead.id, email: r.lead.email, name: r.lead.name, business: r.lead.business, stage: r.stage, campaign: r.lead.campaign.name,
      assigneeId: r.queue.assigneeId, assigneeName: who(r.queue.assigneeId), dealValue: r.lead.dealValue,
      nextTask: next ? { title: next.title, dueAt: next.dueAt?.toISOString() ?? null } : null, lastTouchAt: r.lastTouchAt?.toISOString() ?? null,
      needsAttention: !!reachOut(r.queue),
    };
  });
  return NextResponse.json({ total, contacts: page });
});
