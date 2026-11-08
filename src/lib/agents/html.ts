/** Small, dependency-free helpers for content that will be shown on OTHER people's websites, so it is strictly cleaned. */

export const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const escapeXml = (s: string) => escapeHtml(s).replace(/'/g, '&apos;');

const ALLOWED = new Set(['p', 'h2', 'h3', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'blockquote', 'br']);

/**
 * Keeps only a handful of formatting tags. Every attribute is dropped except a plain http(s) href on links
 * (which get rel="nofollow noopener" and open in a new tab). Scripts, styles, iframes, event handlers and
 * javascript: links cannot survive. Output is safe to inject with innerHTML.
 */
export function sanitizeHtml(input: string, maxLen = 40_000): string {
  let s = String(input ?? '').slice(0, maxLen * 2);
  s = s.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|iframe|object|embed|noscript|template|svg|math)\b[\s\S]*?<\/\1\s*>/gi, '');
  const parts = s.split(/(<\/?[a-zA-Z][^>]*>)/g);
  const out = parts.map((part) => {
    const m = part.match(/^<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>$/);
    if (!m) return part.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const [, close, rawName, attrs] = m; const name = rawName.toLowerCase();
    if (!ALLOWED.has(name)) return '';
    if (close) return name === 'br' ? '' : `</${name}>`;
    if (name === 'br') return '<br>';
    if (name === 'a') {
      const h = attrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const href = (h?.[1] ?? h?.[2] ?? h?.[3] ?? '').trim().replace(/&amp;/g, '&');
      if (!/^https?:\/\//i.test(href) || /[\s"'<>`]/.test(href)) return '<a>';
      return `<a href="${escapeHtml(href)}" rel="nofollow noopener" target="_blank">`;
    }
    return `<${name}>`;
  }).join('');
  return closeOpenTags(out).slice(0, maxLen);
}

/** Closes any tag the writer left open so one article can never break the page around it. */
function closeOpenTags(html: string): string {
  const stack: string[] = [];
  for (const m of Array.from(html.matchAll(/<(\/?)([a-z0-9]+)[^>]*>/g))) {
    const name = m[2]; if (name === 'br') continue;
    if (!m[1]) stack.push(name); else { const i = stack.lastIndexOf(name); if (i >= 0) stack.splice(i); }
  }
  return html + stack.reverse().map((n) => `</${n}>`).join('');
}

export const htmlToText = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

export function slugify(s: string, max = 80): string {
  const base = s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/g, '');
  return base || 'post';
}

/** An http(s) URL reduced to its origin + path without query or credentials, or '' when it is not one. */
export function cleanUrl(raw: unknown, keepPath = false): string {
  if (typeof raw !== 'string') return '';
  let t = raw.trim(); if (!t) return '';
  if (!/^https?:\/\//i.test(t)) t = 'https://' + t;
  try {
    const u = new URL(t);
    if (!/^https?:$/.test(u.protocol) || u.username || u.password || !u.hostname.includes('.')) return '';
    return keepPath ? `${u.origin}${u.pathname.replace(/\/+$/, '')}` : u.origin;
  } catch { return ''; }
}

export const hostOf = (raw: string) => { try { return new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } };
