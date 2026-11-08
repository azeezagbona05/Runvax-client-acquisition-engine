/** Turning websites, PDFs and CSV files into small pieces of text an assistant can search. Pure functions, no network. */

export const LIMITS = { sourcesPerUser: 20, chunksPerUser: 4000, charsPerSource: 300_000, chunksPerSource: 400, rows: 5000, pdfPages: 100, pdfBytes: 4 * 1024 * 1024, csvBytes: 2 * 1024 * 1024, pages: 12 } as const;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', copy: '©' };
const decode = (s: string) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
  if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ' '; }
  return ENTITIES[e.toLowerCase()] ?? m;
});

/** Readable text of a web page: no scripts, styles, menus or footers, with paragraphs kept apart. */
export function htmlToText(html: string): { title: string; text: string } {
  let s = html.slice(0, 1_500_000);
  const title = decode((s.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim()).slice(0, 160);
  s = s.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|svg|iframe|template|form|nav|footer|header|aside)\b[\s\S]*?<\/\1\s*>/gi, ' ');
  s = s.replace(/<\/(p|div|section|article|li|tr|h[1-6]|blockquote|table|ul|ol)\s*>/gi, '\n').replace(/<(br|hr)\s*\/?>/gi, '\n').replace(/<li[^>]*>/gi, '• ').replace(/<[^>]+>/g, ' ');
  const text = decode(s).split('\n').map((l) => l.replace(/[ \t ]+/g, ' ').trim()).filter((l) => l.length > 1).join('\n').replace(/\n{3,}/g, '\n\n');
  return { title, text };
}

/** The links on a page, as absolute URLs (no fragments). */
export function extractLinks(html: string, base: string): string[] {
  const out: string[] = [];
  for (const m of Array.from(html.matchAll(/<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi))) {
    try { const u = new URL(decode(m[1] ?? m[2] ?? ''), base); u.hash = ''; if (/^https?:$/.test(u.protocol)) out.push(u.toString()); } catch { /* ignore */ }
  }
  return out.filter((u, i, a) => a.indexOf(u) === i);
}

/** Splits text at paragraph then sentence boundaries into pieces of about `size` characters, with a little overlap so an answer is not cut in half. */
export function chunkText(text: string, size = 900, overlap = 120): string[] {
  const paras = text.replace(/\r/g, '').split(/\n{2,}|\n(?=• )/).map((p) => p.trim()).filter(Boolean);
  const out: string[] = []; let cur = '';
  const flush = () => { if (cur.trim()) out.push(cur.trim()); cur = ''; };
  for (const p of paras) {
    const parts = p.length > size ? p.split(/(?<=[.!?])\s+/).reduce<string[]>((a, sent) => { if (sent.length > size) { for (let i = 0; i < sent.length; i += size) a.push(sent.slice(i, i + size)); } else a.push(sent); return a; }, []) : [p];
    for (const part of parts) {
      if (cur && cur.length + part.length + 1 > size) { const tail = cur.slice(-overlap); flush(); cur = tail.includes(' ') ? tail.slice(tail.indexOf(' ') + 1) + ' ' : ''; }
      cur += (cur && !cur.endsWith(' ') ? '\n' : '') + part;
    }
  }
  flush();
  return out;
}

/** CSV (or semicolon / tab separated) text to rows. Handles quotes, doubled quotes, line breaks inside quotes and a leading BOM. */
export function parseCsv(input: string, maxRows = LIMITS.rows + 1): string[][] {
  const text = input.replace(/^﻿/, '');
  const first = text.split('\n', 1)[0] ?? '';
  const sep = [',', ';', '\t'].map((c) => [c, first.split(c).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length && rows.length < maxRows; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"' && cell === '') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some((x) => x.trim())) rows.push(row); row = []; }
    else cell += c;
  }
  if ((cell || row.length) && rows.length < maxRows) { row.push(cell); if (row.some((x) => x.trim())) rows.push(row); }
  return rows.map((r) => r.map((x) => x.replace(/\s+/g, ' ').trim()));
}

export interface Piece { label: string; text: string }

/** A table: each chunk repeats the column names so a row is understood on its own. */
export function tablePieces(rows: string[][], perChunk = 8): Piece[] {
  if (rows.length < 2) return [];
  const head = rows[0].map((h, i) => h || `Column ${i + 1}`); const out: Piece[] = [];
  for (let i = 1; i < rows.length; i += perChunk) {
    const slice = rows.slice(i, i + perChunk);
    out.push({ label: `rows ${i}-${i + slice.length - 1}`, text: slice.map((r) => head.map((h, c) => (r[c] ? `${h}: ${r[c]}` : '')).filter(Boolean).join('; ')).filter(Boolean).join('\n') });
  }
  return out.filter((p) => p.text);
}

/** Questions and answers: one chunk per pair. Uses columns named question/answer when there are headers, otherwise the first two columns. */
export function qaPieces(rows: string[][]): Piece[] {
  if (!rows.length) return [];
  const h = rows[0].map((x) => x.toLowerCase());
  const qi = h.findIndex((x) => /^(question|questions|q|faq|prompt)$/.test(x)), ai = h.findIndex((x) => /^(answer|answers|a|response|reply)$/.test(x));
  const hasHead = qi >= 0 && ai >= 0; const [qc, ac] = hasHead ? [qi, ai] : [0, 1];
  return rows.slice(hasHead ? 1 : 0).map((r, i) => ({ label: `Q&A ${i + 1}`, text: r[qc] && r[ac] ? `Q: ${r[qc]}\nA: ${r[ac]}` : '' })).filter((p) => p.text);
}
