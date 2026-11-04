/**
 * Linear-time HTML tokenizer for untrusted pages.
 *
 * The previous regex-based scanning was quadratic on hostile input (unclosed
 * <form>/<script>/<!--, long runs without '>' or '@'). This scanner makes one
 * forward pass:
 *   - every search (indexOf) starts at or after the previous position, and
 *     the next '>' is cached, so total work is O(n);
 *   - a tag is at most MAX_TAG_LENGTH characters, otherwise its '<' is text;
 *   - raw-text elements (script/style/…) are skipped by searching for their
 *     closing tag; an unclosed one ends the document (as a browser would);
 *   - at most MAX_TAGS tags are kept (`truncated` reports the cut).
 * It is a scanner for extracting signals, not a spec-complete HTML parser.
 */

export const MAX_TAG_LENGTH = 4096;
export const MAX_TAGS = 20_000;

export interface HtmlTag {
  name: string;
  closing: boolean;
  attrs: Record<string, string>;
  raw: string;
  index: number;
}

export interface RawTextElement { name: string; attrs: Record<string, string>; content: string; index: number }

export interface ParsedHtml {
  tags: HtmlTag[];
  rawText: RawTextElement[];
  text: string;
  truncated: boolean;
}

// Content not rendered as page text.
const RAW_SKIP = new Set(['script', 'style', 'noscript', 'template']);
// Content kept as text but scanned like raw text (may contain '<').
const RAW_KEEP = new Set(['title', 'textarea']);

const ATTR_RE = /([^\s=/>"']+)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const CONTROL_AND_BIDI = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u2028-\u202E\u2066-\u2069]/g;

function parseAttrs(raw: string, nameEnd: number): Record<string, string> {
  const attrs: Record<string, string> = {};
  const body = raw.slice(nameEnd, raw.length - 1);
  ATTR_RE.lastIndex = 0;
  for (let m = ATTR_RE.exec(body); m; m = ATTR_RE.exec(body)) {
    if (m[0] === '') { ATTR_RE.lastIndex++; continue; }
    const k = m[1].toLowerCase();
    if (!(k in attrs)) attrs[k] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return attrs;
}

function findClose(html: string, name: string, from: number): number {
  for (let k = html.indexOf('</', from); k >= 0; k = html.indexOf('</', k + 2)) {
    if (html.substr(k + 2, name.length).toLowerCase() === name) return k;
  }
  return -1;
}

export function parseHtml(html: string): ParsedHtml {
  const tags: HtmlTag[] = [];
  const rawText: RawTextElement[] = [];
  const text: string[] = [];
  const n = html.length;
  let truncated = false;
  let gtCache = -2; // -2: unknown, -1: no further '>'
  const nextGt = (from: number) => {
    if (gtCache === -1) return -1;
    if (gtCache >= from) return gtCache;
    gtCache = html.indexOf('>', from);
    return gtCache;
  };

  let i = 0;
  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt < 0) { text.push(html.slice(i)); break; }
    if (lt > i) text.push(html.slice(i, lt));

    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      if (end < 0) break; // unclosed comment: the rest is comment
      i = end + 3;
      continue;
    }
    const gt = nextGt(lt + 1);
    if (gt < 0) { text.push(html.slice(lt)); break; } // no '>' anywhere after: the rest is text
    if (gt - lt + 1 > MAX_TAG_LENGTH) { text.push('<'); i = lt + 1; continue; }

    const raw = html.slice(lt, gt + 1);
    if (raw[1] === '!' || raw[1] === '?') { i = gt + 1; continue; } // doctype / declarations
    const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)/.exec(raw);
    if (!m) { text.push('<'); i = lt + 1; continue; }
    if (tags.length >= MAX_TAGS) { truncated = true; break; }

    const name = m[2].toLowerCase();
    const closing = m[1] === '/';
    const tag: HtmlTag = { name, closing, attrs: closing ? {} : parseAttrs(raw, m[0].length), raw, index: lt };
    tags.push(tag);
    i = gt + 1;

    if (!closing && (RAW_SKIP.has(name) || RAW_KEEP.has(name)) && !raw.endsWith('/>')) {
      const close = findClose(html, name, i);
      const content = html.slice(i, close < 0 ? n : close);
      rawText.push({ name, attrs: tag.attrs, content, index: lt });
      if (RAW_KEEP.has(name)) text.push(content);
      if (close < 0) break; // unclosed raw-text element: the rest of the document is its content
      const closeGt = html.indexOf('>', close);
      if (closeGt < 0) break;
      tags.push({ name, closing: true, attrs: {}, raw: html.slice(close, closeGt + 1), index: close });
      i = closeGt + 1;
    }
  }

  const plain = text.join(' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(CONTROL_AND_BIDI, '')
    .replace(/\s+/g, ' ')
    .trim();
  return { tags, rawText, text: plain, truncated };
}
