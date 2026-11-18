import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardInstalled } from '@/lib/v2Setup';
import { requireCrm } from '@/lib/crm/access';

export const dynamic = 'force-dynamic';
const KINDS = ['note', 'call', 'email', 'whatsapp', 'meeting'];

/** POST { kind?, body }: log what the team did or learned about a contact (a call, a WhatsApp chat, a note). This records only: it contacts nobody. */
export const POST = (req: NextRequest, { params }: { params: { id: string } }) => guardInstalled(async () => {
  const a = await requireCrm(req); if (!a.ok) return a.response;
  const { ctx } = a;
  const b = await req.json().catch(() => ({})) as { kind?: unknown; body?: unknown };
  const body = typeof b.body === 'string' ? b.body.trim().slice(0, 4000) : '';
  if (!body) return NextResponse.json({ error: 'Write something to log.' }, { status: 400 });
  const lead = await prisma.outreachLead.findFirst({ where: { id: params.id, userId: ctx.ownerId }, select: { id: true } });
  if (!lead) return NextResponse.json({ error: 'Contact not found.' }, { status: 404 });
  const kind = KINDS.includes(b.kind as string) ? (b.kind as string) : 'note';
  await prisma.crmNote.create({ data: { ownerId: ctx.ownerId, leadId: lead.id, authorId: ctx.userId, kind, body } });
  return NextResponse.json({ ok: true }, { status: 201 });
});
