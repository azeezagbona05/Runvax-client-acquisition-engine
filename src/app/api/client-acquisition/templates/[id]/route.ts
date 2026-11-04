import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { guardInstalled } from '@/lib/v2Setup';
import { sanitizeTemplateMeta } from '@/lib/userTemplates';

export const dynamic = 'force-dynamic';

/** PATCH { name?, description? } — rename one of your own templates. Official templates are not editable here. */
async function handlePatch(req: NextRequest, id: string) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;
  const b = await req.json().catch(() => null) as { name?: unknown; description?: unknown } | null;
  const meta = sanitizeTemplateMeta(b ?? {});
  const data: { name?: string; description?: string | null } = {};
  if (b && 'name' in b) { if (!meta.name) return NextResponse.json({ error: 'Give the template a name.' }, { status: 400 }); data.name = meta.name; }
  if (b && 'description' in b) data.description = meta.description || null;
  const r = await prisma.campaignTemplate.updateMany({ where: { id, userId: user.userId }, data });
  return r.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Template not found.' }, { status: 404 });
}

/** DELETE — removes one of your own templates. Campaigns already made from it are not affected. */
async function handleDelete(req: NextRequest, id: string) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;
  const r = await prisma.campaignTemplate.deleteMany({ where: { id, userId: user.userId } });
  return r.count ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Template not found.' }, { status: 404 });
}

export const PATCH = (req: NextRequest, { params }: { params: { id: string } }) => guardInstalled(() => handlePatch(req, params.id));
export const DELETE = (req: NextRequest, { params }: { params: { id: string } }) => guardInstalled(() => handleDelete(req, params.id));
