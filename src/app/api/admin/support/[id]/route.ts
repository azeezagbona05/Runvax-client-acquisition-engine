import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { adminGet, adminReply, adminSetStatus } from '@/lib/support';
import { isStatus, validateReply } from '@/lib/supportShared';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;
  const { id } = await ctx.params;
  const found = await adminGet(id).catch(() => null);
  return found ? NextResponse.json(found) : NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
}

/** POST { body, status? }: reply (emails the customer). */
export async function POST(req: NextRequest, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;
  const raw = await req.json().catch(() => null) as { status?: string } | null;
  const parsed = validateReply(raw);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { id } = await ctx.params;
  const ok = await adminReply({ email: admin.email }, id, parsed.body, isStatus(raw?.status) ? raw.status : undefined).catch(() => false);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
}

/** PATCH { status } */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;
  const body = await req.json().catch(() => null) as { status?: string } | null;
  if (!isStatus(body?.status)) return NextResponse.json({ error: 'Unknown status.' }, { status: 400 });
  const { id } = await ctx.params;
  const ok = await adminSetStatus({ email: admin.email }, id, body.status).catch(() => false);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Ticket not found.' }, { status: 404 });
}
