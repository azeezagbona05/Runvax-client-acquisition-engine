import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { addPdf, addQa, addTable, addText, addWebsite } from '@/lib/knowledge/ingest';
import { LIMITS } from '@/lib/knowledge/text';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const present = (s: { id: string; kind: string; name: string; status: string; error: string | null; meta: unknown; chars: number; createdAt: Date }, chunks: number) => ({ id: s.id, kind: s.kind, name: s.name, status: s.status, error: s.error, meta: s.meta ?? {}, chars: s.chars, chunks, createdAt: s.createdAt.toISOString() });

/** GET: the user's knowledge sources. */
export async function GET(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  const rows = await prisma.knowledgeSource.findMany({ where: { userId: u.userId }, orderBy: { createdAt: 'desc' }, take: 50 });
  const counts = await prisma.knowledgeChunk.groupBy({ by: ['sourceId'], where: { userId: u.userId }, _count: true });
  const n = new Map(counts.map((c) => [c.sourceId, c._count]));
  return NextResponse.json({ sources: rows.map((s) => present(s, n.get(s.id) ?? 0)), limits: { sources: LIMITS.sourcesPerUser, pdfMb: 4, pages: LIMITS.pages } });
}

/**
 * POST adds a source. JSON { kind: 'website', url } | { kind: 'text', name, text } | { kind: 'table'|'qa', name, csv },
 * or multipart with a `file` (PDF for kind=pdf; CSV for table and qa).
 */
export async function POST(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  if (!rateLimit(`knowledge-add:${u.userId}`, { maxRequests: 8, windowMs: 60_000 }).ok) return NextResponse.json({ error: 'Slow down: try again in a minute.' }, { status: 429 });
  try {
    const ct = req.headers.get('content-type') ?? '';
    if (ct.includes('multipart/form-data')) {
      const f = await req.formData(); const kind = String(f.get('kind') ?? ''); const file = f.get('file');
      if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Choose a file to upload.' }, { status: 400 });
      if (kind === 'pdf') { if (file.size > LIMITS.pdfBytes) return NextResponse.json({ error: 'That PDF is over 4 MB. Split it or export a smaller one.' }, { status: 400 }); const r = await addPdf(u.userId, file.name, Buffer.from(await file.arrayBuffer())); return NextResponse.json({ source: present(r.source, r.chunks) }, { status: 201 }); }
      if (kind === 'table' || kind === 'qa') {
        if (file.size > LIMITS.csvBytes) return NextResponse.json({ error: 'That file is over 2 MB. Split it into smaller files.' }, { status: 400 });
        const text = await file.text(); const r = kind === 'table' ? await addTable(u.userId, file.name, text) : await addQa(u.userId, file.name, text);
        return NextResponse.json({ source: present(r.source, r.chunks) }, { status: 201 });
      }
      return NextResponse.json({ error: 'Unknown kind of knowledge.' }, { status: 400 });
    }
    const b = await req.json().catch(() => ({})) as { kind?: unknown; url?: unknown; name?: unknown; text?: unknown; csv?: unknown };
    if (b.kind === 'website') { const r = await addWebsite(u.userId, typeof b.url === 'string' ? b.url : ''); return NextResponse.json({ source: present(r.source, r.chunks), note: r.note }, { status: 201 }); }
    if (b.kind === 'text') { const r = await addText(u.userId, String(b.name ?? ''), String(b.text ?? '')); return NextResponse.json({ source: present(r.source, r.chunks) }, { status: 201 }); }
    if (b.kind === 'table' || b.kind === 'qa') {
      const csv = String(b.csv ?? '').slice(0, LIMITS.csvBytes); const r = b.kind === 'table' ? await addTable(u.userId, String(b.name ?? 'Table'), csv) : await addQa(u.userId, String(b.name ?? 'Questions & answers'), csv);
      return NextResponse.json({ source: present(r.source, r.chunks) }, { status: 201 });
    }
    return NextResponse.json({ error: 'Unknown kind of knowledge.' }, { status: 400 });
  } catch (e) {
    // Errors from the ingest code are written as plain sentences for the user.
    return NextResponse.json({ error: e instanceof Error && e.message ? e.message.slice(0, 300) : 'Could not add that. Try again.' }, { status: 400 });
  }
}
