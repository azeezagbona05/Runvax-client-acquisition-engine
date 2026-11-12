import { unzipSync, strFromU8 } from 'fflate';

export const CV_MAX_BYTES = 4 * 1024 * 1024;
export const CV_MAX_CHARS = 60_000;

const clean = (t: string) => t.replace(/\r/g, '').replace(/[ \t ]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
const decode = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, '&');

/** Text of a .docx: paragraphs of word/document.xml, with tabs and breaks kept as spaces/newlines. */
export function docxToText(buf: Uint8Array): string {
  let files: Record<string, Uint8Array>;
  try { files = unzipSync(buf, { filter: (f) => f.name === 'word/document.xml' }); } catch { throw new Error('This Word file could not be read. It may be damaged.'); }
  const xml = files['word/document.xml'];
  if (!xml) throw new Error('This does not look like a Word (.docx) file.');
  const x = strFromU8(xml).replace(/<w:tab\/>/g, ' ').replace(/<w:br\/>/g, '\n').replace(/<\/w:p>/g, '\n');
  return decode(x.replace(/<[^>]+>/g, ''));
}

async function pdfToText(buf: Uint8Array): Promise<string> {
  try {
    const { getDocumentProxy, extractText } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const r = await extractText(pdf, { mergePages: false });
    return (r.text as string[]).slice(0, 12).join('\n\n');
  } catch { throw new Error('This PDF could not be read. It may be damaged or password protected.'); }
}

/** Text from an uploaded CV. PDF and DOCX only; a scan with no text layer is refused with a plain sentence. */
export async function cvToText(name: string, bytes: Uint8Array): Promise<{ text: string; mime: string }> {
  const lower = name.toLowerCase();
  const isPdf = lower.endsWith('.pdf') || (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46);
  const isDocx = lower.endsWith('.docx') || (bytes[0] === 0x50 && bytes[1] === 0x4b);
  if (!isPdf && !isDocx) throw new Error('Upload a PDF or a Word (.docx) file.');
  const raw = isPdf ? await pdfToText(bytes) : docxToText(bytes);
  const text = clean(raw).slice(0, CV_MAX_CHARS);
  if (text.length < 80) throw new Error('No readable text found. If this CV is a scan or an image, export it as a text PDF or a Word file.');
  return { text, mime: isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
}
