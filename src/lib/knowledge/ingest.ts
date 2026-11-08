import { prisma } from '@/lib/prisma';
import { crawlSite } from './crawl';
import { extractPdf } from './pdf';
import { chunkText, LIMITS, parseCsv, qaPieces, tablePieces, type Piece } from './text';

const cleanName = (s: unknown, fallback: string) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160) : '') || fallback;

/** Saves a source and its chunks. Fails with a plain sentence when the account is full or the content is empty. */
async function save(userId: string, kind: 'website' | 'pdf' | 'table' | 'qa' | 'text', name: string, meta: Record<string, unknown>, all: Piece[], replaceId?: string) {
  let chars = 0; const pieces: Piece[] = [];
  for (const p of all) { if (pieces.length >= LIMITS.chunksPerSource || chars + p.text.length > LIMITS.charsPerSource) break; pieces.push(p); chars += p.text.length; }
  if (!pieces.length) throw new Error('There was no usable text to learn from.');
  if (!replaceId) {
    if ((await prisma.knowledgeSource.count({ where: { userId } })) >= LIMITS.sourcesPerUser) throw new Error(`You can keep up to ${LIMITS.sourcesPerUser} knowledge sources. Delete one to add another.`);
  }
  const used = await prisma.knowledgeChunk.count({ where: { userId, ...(replaceId ? { NOT: { sourceId: replaceId } } : {}) } });
  if (used + pieces.length > LIMITS.chunksPerUser) throw new Error('Your knowledge base is full. Delete a source you no longer need.');
  const src = await prisma.$transaction(async (tx) => {
    let id = replaceId;
    if (id) { await tx.knowledgeChunk.deleteMany({ where: { sourceId: id } }); await tx.knowledgeSource.update({ where: { id }, data: { name, meta: meta as object, chars, status: 'ready', error: null } }); }
    else id = (await tx.knowledgeSource.create({ data: { userId, kind, name, meta: meta as object, chars, status: 'ready' } })).id;
    for (let i = 0; i < pieces.length; i += 100) await tx.knowledgeChunk.createMany({ data: pieces.slice(i, i + 100).map((p, j) => ({ sourceId: id!, userId, idx: i + j, label: p.label.slice(0, 200), text: p.text })) });
    return tx.knowledgeSource.findUniqueOrThrow({ where: { id } });
  });
  return { source: src, chunks: pieces.length };
}

const webPieces = (pages: Array<{ url: string; title: string; text: string }>): Piece[] => pages.flatMap((p) => chunkText(p.text).map((t) => ({ label: p.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 190), text: p.title && !t.startsWith(p.title) ? `${p.title}\n${t}` : t })));

export async function addWebsite(userId: string, url: string) {
  const { pages, note } = await crawlSite(url); const host = new URL(pages[0].url).hostname.replace(/^www\./, '');
  return { ...(await save(userId, 'website', cleanName(host, 'Website'), { url: pages[0].url, pages: pages.length, note: note ?? null, readAt: new Date().toISOString() }, webPieces(pages))), note };
}
export async function refreshWebsite(userId: string, id: string) {
  const src = await prisma.knowledgeSource.findFirst({ where: { id, userId, kind: 'website' } }); if (!src) throw new Error('Knowledge source not found.');
  const url = (src.meta as { url?: string } | null)?.url ?? ''; const { pages, note } = await crawlSite(url);
  return { ...(await save(userId, 'website', src.name, { url, pages: pages.length, note: note ?? null, readAt: new Date().toISOString() }, webPieces(pages), id)), note };
}
export async function addPdf(userId: string, filename: string, buf: Buffer) {
  const pdf = await extractPdf(buf);
  const pieces = pdf.pages.flatMap((p) => chunkText(p.text).map((t) => ({ label: `page ${p.n}`, text: t })));
  return save(userId, 'pdf', cleanName(filename.replace(/\.pdf$/i, ''), 'Document'), { filename: filename.slice(0, 160), pages: pdf.totalPages }, pieces);
}
export async function addTable(userId: string, filename: string, csv: string) {
  const rows = parseCsv(csv); if (rows.length < 2) throw new Error('That table needs a header row and at least one row of data.');
  return save(userId, 'table', cleanName(filename.replace(/\.(csv|txt)$/i, ''), 'Table'), { filename: filename.slice(0, 160), rows: rows.length - 1, columns: rows[0].length }, tablePieces(rows));
}
export async function addQa(userId: string, filename: string, csv: string) {
  const pieces = qaPieces(parseCsv(csv)); if (!pieces.length) throw new Error('No question and answer pairs were found. Use two columns: question and answer.');
  return save(userId, 'qa', cleanName(filename.replace(/\.(csv|txt)$/i, ''), 'Questions & answers'), { filename: filename.slice(0, 160), rows: pieces.length }, pieces);
}
export async function addText(userId: string, name: string, text: string) {
  const pieces = chunkText(text.slice(0, LIMITS.charsPerSource)).map((t, i) => ({ label: `part ${i + 1}`, text: t }));
  return save(userId, 'text', cleanName(name, 'Notes'), { chars: text.length }, pieces);
}
