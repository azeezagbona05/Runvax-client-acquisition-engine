import { LIMITS } from './text';

export interface PdfText { pages: Array<{ n: number; text: string }>; totalPages: number }

/** Text from a PDF file. Throws a plain-sentence Error when it cannot be read or has no text (for example a scan). */
export async function extractPdf(buf: Buffer): Promise<PdfText> {
  if (buf.length > LIMITS.pdfBytes) throw new Error('That PDF is over 4 MB. Split it or export a smaller one.');
  if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('That file is not a PDF.');
  let totalPages = 0; let texts: string[] = [];
  try {
    const { getDocumentProxy, extractText } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const r = await extractText(pdf, { mergePages: false }); totalPages = r.totalPages; texts = (r.text as string[]).slice(0, LIMITS.pdfPages);
  } catch { throw new Error('This PDF could not be read. It may be damaged or password protected.'); }
  const pages = texts.map((t, i) => ({ n: i + 1, text: t.replace(/[ \t ]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim() })).filter((p) => p.text.length > 0);
  if (pages.reduce((a, p) => a + p.text.length, 0) < 40) throw new Error('This PDF has no readable text (it may be a scan). Export it as text, or paste the content as Questions & Answers.');
  return { pages, totalPages };
}
