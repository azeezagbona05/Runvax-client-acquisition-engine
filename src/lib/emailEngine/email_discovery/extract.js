import { normalizeEmail, normalizeDomain } from '../shared/normalize.js';
import { decodeEntities, stripTags, extractLinks, extractJsonLd, parseAttrs } from '../shared/html.js';
import { parseName } from '../shared/names.js';

const PLAIN = /[a-z0-9._%+'-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,24}/gi;
// "name [at] host [dot] com", "name (at) host.com", "name AT host DOT com"
const OBF = /([a-z0-9._%+-]+)\s*(?:\[\s*at\s*\]|\(\s*at\s*\)|\{\s*at\s*\}|<\s*at\s*>|\s+at\s+)\s*([a-z0-9-]+(?:\s*(?:\[\s*dot\s*\]|\(\s*dot\s*\)|\{\s*dot\s*\}|\s+dot\s+|\.)\s*[a-z0-9-]+)*)/gi;
const IMG_EXT = /\.(png|jpe?g|gif|svg|webp|css|js|ico|woff2?|ttf|avif)$/i;
const TITLE_RE = /\b(chief [a-z]+ officer|ceo|cfo|cto|coo|cmo|founder|co-?founder|owner|president|vice president|vp|director|head of [a-z ]+|manager|partner|principal|attorney|lawyer|dentist|doctor|dr\.|broker|agent|realtor|consultant|engineer|architect|accountant|editor|producer|chef|coordinator|administrator|associate|lead|specialist|advisor|treasurer|secretary)\b/i;

/** Decode Cloudflare email protection (data-cfemail / /cdn-cgi/l/email-protection#hex). */
export function decodeCfEmail(hex) {
  try {
    const key = parseInt(hex.slice(0, 2), 16); let out = '';
    for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
    return decodeURIComponent(escape(out));
  } catch { return null; }
}

const NAME_SEQ = /(?<![\w'’-])((?:[A-Z][a-zà-ÿ]+|[A-Z](?=['’][A-Z]))(?:['’-][A-Z]?[a-zà-ÿ]+)*(?:[ \t]+[A-Z]\.?)?(?:[ \t]+(?:(?:(?:van|von|der|den|de|del|della|la|le|da|di|do|dos|du|al|bin|ibn|el)[ \t]+)+)?(?:[A-Z][a-zà-ÿ]+|[A-Z](?=['’][A-Z]))(?:['’-][A-Z]?[a-zà-ÿ]+)*){1,2})(?![\w'’-])/g;
/** Name and title nearest BEFORE an email, never crossing into the previous email's card. */
function personContext(before) {
  let pre = before; const prevEmail = [...pre.matchAll(PLAIN)].pop();
  if (prevEmail) pre = pre.slice(prevEmail.index + prevEmail[0].length);
  pre = pre.split('\n').map((l) => l.trim()).filter(Boolean).slice(-4).join('\n'); // card-local context only
  const cands = [...pre.matchAll(NAME_SEQ)].filter((m) => !TITLE_RE.test(m[1]) && !/^(contact|email|our|meet|the|send|about|get|call|phone|mail|general|head|chief|office)\b/i.test(m[1]) && parseName(m[1]));
  const nm = cands[cands.length - 1];
  const after = nm ? pre.slice(nm.index + nm[1].length) : pre;
  const lines = after.split('\n').map((l) => l.trim()).filter(Boolean);
  const titleLine = [...lines].reverse().find((l) => l.length < 70 && TITLE_RE.test(l));
  return { name: nm ? nm[1].trim() : undefined, title: titleLine };
}

/**
 * Extract emails from one HTML/text document.
 * Returns [{ email, method, name?, title?, context }]. `method` records HOW it was found:
 *   mailto | text | obfuscated | entity | cloudflare | jsonld
 * Duplicates within the page are merged, keeping the strongest method.
 */
export function extractEmailsFromHtml(html, { siteDomain } = {}) {
  const found = new Map();
  const add = (raw, method, ctx = {}) => {
    const email = normalizeEmail(raw);
    if (!email || IMG_EXT.test(email) || /^(example|domain|email|name|user|yourname|you|your)@/.test(email) || /@(example|domain|email|sentry\.io|wixpress\.com)/.test(email)) return;
    if (/^[0-9a-f]{20,}@/.test(email)) return; // tracking ids
    const rank = { jsonld: 5, mailto: 4, cloudflare: 4, text: 3, entity: 2, obfuscated: 1 };
    const prev = found.get(email);
    if (prev) { prev.methods.add(method); prev.name ||= ctx.name; prev.title ||= ctx.title; if ((rank[method] ?? 0) > (rank[prev.method] ?? 0)) prev.method = method; return; }
    found.set(email, { email, method, methods: new Set([method]), name: ctx.name, title: ctx.title, context: ctx.context });
  };

  // 1) JSON-LD (Person / Organization / LocalBusiness)
  for (const node of extractJsonLd(html)) {
    const types = [].concat(node['@type'] || []).join(',');
    const emails = [].concat(node.email || []).filter((e) => typeof e === 'string');
    const name = /Person/i.test(types) && typeof node.name === 'string' ? node.name : undefined;
    for (const e of emails) add(e, 'jsonld', { name, title: typeof node.jobTitle === 'string' ? node.jobTitle : undefined, context: types });
    for (const c of [].concat(node.contactPoint || [])) if (c && typeof c.email === 'string') add(c.email, 'jsonld', { context: 'contactPoint' });
  }

  // 2) Cloudflare-protected emails
  for (const m of html.matchAll(/data-cfemail\s*=\s*["']([0-9a-f]+)["']/gi)) { const d = decodeCfEmail(m[1]); if (d) add(d, 'cloudflare'); }
  for (const m of html.matchAll(/email-protection#([0-9a-f]+)/gi)) { const d = decodeCfEmail(m[1]); if (d) add(d, 'cloudflare'); }

  // 3) mailto links, with surrounding text for name/title context
  for (const a of extractLinks(html)) {
    if (!/^mailto:/i.test(a.href)) continue;
    const addr = decodeURIComponent(a.href.replace(/^mailto:/i, '').split('?')[0]).split(',')[0];
    const idx = html.indexOf(a.href);
    let start = Math.max(0, idx - 600); const prevM = html.lastIndexOf('mailto:', idx - 1);
    if (prevM >= start) { const close = html.indexOf('</a>', prevM); if (close >= 0 && close < idx) start = close + 4; } // do not borrow the previous card's name
    const before = stripTags(html.slice(start, idx));
    add(addr, 'mailto', { ...personContext(before), context: before.slice(-160) });
  }

  // 4) text-level: entity-decoded plain emails and obfuscations
  const decoded = decodeEntities(html);
  const text = stripTags(html);
  const hadEntity = /&#(?:x40|64);|&commat;/i.test(html);
  for (const [src, isDecoded] of [[text, false], [decoded.replace(/<[^>]+>/g, ' '), true]]) {
    for (const m of src.matchAll(PLAIN)) {
      const i = m.index;
      add(m[0], isDecoded && hadEntity ? 'entity' : 'text', { ...personContext(src.slice(Math.max(0, i - 400), i)), context: src.slice(Math.max(0, i - 120), i + m[0].length + 60) });
    }
  }
  for (const m of text.matchAll(OBF)) {
    const host = m[2].replace(/\s*(?:\[\s*dot\s*\]|\(\s*dot\s*\)|\{\s*dot\s*\}|\s+dot\s+)\s*/gi, '.').replace(/\s+/g, '');
    if (!/\.[a-z]{2,24}$/i.test(host)) continue;
    add(`${m[1]}@${host}`, 'obfuscated', { context: m[0] });
  }

  let list = [...found.values()].map(({ methods, ...r }) => ({ ...r, methods: [...methods] }));
  if (siteDomain) list = list.map((r) => ({ ...r, onSiteDomain: normalizeDomain(r.email.split('@')[1]) === siteDomain || r.email.split('@')[1].endsWith('.' + siteDomain) }));
  return list;
}

/**
 * Find people (name + title) on a team/about page, with or without an email.
 * Heuristic: a short line that looks like a personal name, followed within 2 lines by a title line.
 * Also JSON-LD Person nodes. Returns [{ name, title?, source: 'jsonld'|'layout' }].
 */
export function extractPeople(html) {
  const people = new Map();
  for (const node of extractJsonLd(html)) {
    if (/Person/i.test([].concat(node['@type'] || []).join(',')) && typeof node.name === 'string' && parseName(node.name))
      people.set(node.name.toLowerCase(), { name: node.name, title: typeof node.jobTitle === 'string' ? node.jobTitle : undefined, source: 'jsonld' });
  }
  const lines = stripTags(html).split('\n').map((l) => l.trim()).filter(Boolean);
  const NAME_LINE = /^(?:(?:Dr|Mr|Mrs|Ms|Prof)\.?\s+)?(?:[A-Z][a-zà-ÿ]+|[A-Z](?=['’][A-Z]))(?:['’-][A-Z]?[a-zà-ÿ]+)*(?:\s+[A-Z]\.?)?(?:\s+(?:(?:(?:van|von|der|den|de|del|della|la|le|da|di|do|dos|du|al|bin|ibn|el)\s+)+)?(?:[A-Z][a-zà-ÿ]+|[A-Z](?=['’][A-Z]))(?:['’-][A-Z]?[a-zà-ÿ]+)*){1,2}(?:,\s*[A-Z]{2,5})?$/;
  const NOT_NAME = /^(our|the|about|contact|meet|get|read|learn|view|home|privacy|terms|new york|los angeles|san francisco|united states|customer service)\b/i;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.length > 45 || !NAME_LINE.test(l) || NOT_NAME.test(l) || TITLE_RE.test(l)) continue;
    const next = [lines[i + 1], lines[i + 2]].find((x) => x && x.length < 80 && TITLE_RE.test(x));
    if (next && parseName(l)) people.set(l.toLowerCase(), people.get(l.toLowerCase()) || { name: l, title: next, source: 'layout' });
  }
  return [...people.values()];
}
