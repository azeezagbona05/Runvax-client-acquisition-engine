// Minimal, dependency-free HTML helpers (not a full HTML5 parser; tolerant by design).
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', commat: '@', period: '.', lowbar: '_', hyphen: '-', dash: '-' };
export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const c = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(c) && c > 0 && c < 0x110000 ? String.fromCodePoint(c) : m; }
    return ENT[e.toLowerCase()] ?? m;
  });
}
export function stripTags(html) {
  return decodeEntities(html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d|section|article)>/gi, '\n').replace(/<[^>]+>/g, ' ')).replace(/[ \t\f\r]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}
export function parseAttrs(tag) {
  const attrs = {}; const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g; let m;
  const body = tag.replace(/^<\s*[a-zA-Z0-9]+/, '').replace(/\/?>$/, '');
  while ((m = re.exec(body))) attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  return attrs;
}
/** All <a> links: { href, text }. */
export function extractLinks(html) {
  const out = []; const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi; let m;
  while ((m = re.exec(html))) { const a = parseAttrs('<a ' + m[1] + '>'); if (a.href) out.push({ href: a.href.trim(), text: stripTags(m[2]).slice(0, 200), attrs: a }); }
  return out;
}
/** Parsed JSON-LD blocks (arrays flattened, @graph expanded). Invalid JSON is skipped. */
export function extractJsonLd(html) {
  const out = []; const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi; let m;
  const walk = (n) => { if (Array.isArray(n)) n.forEach(walk); else if (n && typeof n === 'object') { out.push(n); if (n['@graph']) walk(n['@graph']); } };
  while ((m = re.exec(html))) { try { walk(JSON.parse(m[1].trim())); } catch { /* ignore malformed */ } }
  return out;
}
export function resolveUrl(href, base) { try { return new URL(href, base).toString(); } catch { return null; } }
