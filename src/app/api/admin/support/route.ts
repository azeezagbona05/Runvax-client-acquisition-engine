import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { adminList } from '@/lib/support';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;
  const sp = req.nextUrl.searchParams;
  try { return NextResponse.json(await adminList(sp.get('status') ?? 'all', (sp.get('q') ?? '').trim().slice(0, 80))); }
  catch (e) { console.error('[admin/support] list failed', e); return NextResponse.json({ error: 'Support tickets are unavailable. Has migration 15_support_tickets been applied?' }, { status: 503 }); }
}
