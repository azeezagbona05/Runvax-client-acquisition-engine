import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { isNotInstalled } from '@/lib/v2Setup';
import { OFFICIAL_TEMPLATES } from '@/lib/templateLibrary';
import { sanitizeTemplateMeta, templateDataFromCampaign, toConfig } from '@/lib/userTemplates';
import { logAgent } from '@/lib/acqReplies';

export const dynamic = 'force-dynamic';

const MAX_PER_USER = 50;

/** GET — the official templates, and this account's saved ones. The official ones load even before the saved-templates table exists. */
export async function GET(req: NextRequest) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;
  try {
    const rows = await prisma.campaignTemplate.findMany({ where: { userId: user.userId }, orderBy: { createdAt: 'desc' }, take: MAX_PER_USER });
    return NextResponse.json({ official: OFFICIAL_TEMPLATES, mine: rows.map(toConfig).filter(Boolean), ready: true });
  } catch (e) {
    if (isNotInstalled(e)) return NextResponse.json({ official: OFFICIAL_TEMPLATES, mine: [], ready: false });
    throw e;
  }
}

/** POST { campaignId, name, description? } — saves a campaign's structure as a reusable template. Contacts and results are never copied. */
export async function POST(req: NextRequest) {
  const user = await requireCampaignUser(req);
  if (!user.ok) return user.response;
  const b = await req.json().catch(() => null) as { campaignId?: unknown; name?: unknown; description?: unknown } | null;
  if (!b || typeof b.campaignId !== 'string') return NextResponse.json({ error: 'Choose a campaign to save.' }, { status: 400 });
  const meta = sanitizeTemplateMeta(b);
  if (!meta.name) return NextResponse.json({ error: 'Give the template a name.' }, { status: 400 });
  try {
    const campaign = await prisma.outreachCampaign.findFirst({ where: { id: b.campaignId, userId: user.userId }, select: { id: true, automation: true } });
    if (!campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
    const data = templateDataFromCampaign(campaign.automation);
    if (!data) return NextResponse.json({ error: 'This campaign has no saved email sequence yet. Build it in the Automation Builder first, then save it as a template.' }, { status: 422 });
    if ((await prisma.campaignTemplate.count({ where: { userId: user.userId } })) >= MAX_PER_USER) return NextResponse.json({ error: `You can keep up to ${MAX_PER_USER} templates. Delete one first.` }, { status: 409 });
    const industry = meta.industry !== 'Custom' ? meta.industry : (data.brief.templateId ? undefined : 'Custom');
    const created = await prisma.campaignTemplate.create({
      data: { userId: user.userId, name: meta.name, industry: industry ?? 'Custom', description: meta.description || null, baseTemplateId: data.brief.templateId ?? null, data: JSON.parse(JSON.stringify(data)) },
      select: { id: true },
    });
    await logAgent(user.userId, 'strategist', `Saved "${meta.name}" as a template`, 'Structure and wording only: no contacts or results.', campaign.id);
    return NextResponse.json({ id: created.id });
  } catch (e) {
    if (isNotInstalled(e)) return NextResponse.json({ error: 'Saving templates needs one database update (migration 7). Ask an administrator to apply it.', code: 'V2_NOT_INSTALLED' }, { status: 503 });
    throw e;
  }
}
