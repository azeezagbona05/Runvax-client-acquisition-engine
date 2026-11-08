import { safeFetch, UnsafeUrlError } from '@/lib/safeFetch';
import { cleanUrl, hostOf } from '@/lib/agents/html';
import { extractLinks, htmlToText, LIMITS } from './text';

/** A polite, small crawler for teaching an assistant about a website. Same site only, public addresses only, robots.txt respected, no query strings, a few pages. */
const UA = 'RunvaxKnowledgeBot/1.0 (+https://runvax.com)';
const SKIP = /\.(jpe?g|png|gif|svg|webp|ico|css|js|json|xml|pdf|zip|mp4|mp3|woff2?|ttf|docx?|xlsx?|pptx?)(\?|$)/i;
const PRIORITY = /(about|service|product|pricing|price|faq|contact|how|solution|feature|plan|help|support)/i;

export interface Page { url: string; title: string; text: string }

async function get(url: string, ms = 8000): Promise<{ status: number; type: string; body: string }> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await safeFetch(url, { signal: ctl.signal, headers: { 'user-agent': UA, accept: 'text/html,text/plain;q=0.8' } }, { maxRedirects: 3 });
    const type = r.headers.get('content-type') ?? ''; const reader = r.body?.getReader(); let body = ''; let size = 0;
    if (reader) { const dec = new TextDecoder(); for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; body += dec.decode(value, { stream: true }); if (size > 1_500_000) { await reader.cancel(); break; } } }
    return { status: r.status, type, body };
  } finally { clearTimeout(t); }
}

/** The "Disallow" rules of robots.txt that apply to us (our name or *). Anything unreadable other than a plain 404 means: do not crawl. */
export function parseRobots(txt: string): string[] {
  const dis: string[] = []; let applies = false; let specific = false;
  for (const raw of txt.split('\n')) {
    const line = raw.replace(/#.*/, '').trim(); const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i); if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') { const ua = v.toLowerCase(); applies = ua === '*' || ua.includes('runvax'); specific = ua.includes('runvax'); void specific; }
    else if (k === 'disallow' && applies && v) dis.push(v);
  }
  return dis;
}
export const robotsAllows = (path: string, disallow: string[]) => !disallow.some((d) => (d === '/' ? true : path.startsWith(d.replace(/\*.*$/, ''))));

export async function crawlSite(startRaw: string, maxPages: number = LIMITS.pages): Promise<{ pages: Page[]; note?: string }> {
  const start = cleanUrl(startRaw, true); if (!start) throw new Error('Enter a website address such as yourcompany.com.');
  const host = hostOf(start); const origin = new URL(start).origin; let disallow: string[] = [];
  try {
    const rb = await get(`${origin}/robots.txt`, 5000);
    if (rb.status === 200) disallow = parseRobots(rb.body);
    else if (rb.status !== 404 && rb.status !== 410) throw new Error('This site asks automated tools to stay away, so RUNVAX cannot read it. Add its content as a document or Q&A instead.');
  } catch (e) { if (e instanceof UnsafeUrlError) throw new Error('That address is not a public website.'); if (e instanceof Error && /asks automated tools/.test(e.message)) throw e; /* robots unreachable: the page fetch below decides */ }
  const queue: string[] = [start]; const seen = new Set<string>([start]); const pages: Page[] = []; const t0 = Date.now(); let blocked = 0;
  while (queue.length && pages.length < maxPages && Date.now() - t0 < 40_000) {
    const url = queue.shift()!; const u = new URL(url);
    if (!robotsAllows(u.pathname, disallow)) { blocked++; continue; }
    let r; try { r = await get(url); } catch (e) { if (e instanceof UnsafeUrlError && pages.length === 0) throw new Error('That address is not a public website.'); continue; }
    if (r.status !== 200 || !/html/i.test(r.type)) { if (pages.length === 0 && url === start) throw new Error(`The site answered ${r.status}${r.status === 200 ? ' with something that is not a web page' : ''}. Check the address.`); continue; }
    const { title, text } = htmlToText(r.body); if (text.length >= 80) pages.push({ url, title, text });
    const next = extractLinks(r.body, url).filter((l) => { try { const x = new URL(l); return hostOf(l) === host && !x.search && !SKIP.test(x.pathname) && !seen.has(l.replace(/\/$/, '')) && !seen.has(l); } catch { return false; } });
    next.sort((a, b) => Number(PRIORITY.test(b)) - Number(PRIORITY.test(a)));
    for (const l of next) { if (seen.size > 60) break; seen.add(l); seen.add(l.replace(/\/$/, '')); queue.push(l); }
    await new Promise((r2) => setTimeout(r2, 250));
  }
  if (pages.length === 0) throw new Error(blocked ? 'This site asks automated tools not to read its pages, so RUNVAX cannot use it.' : 'No readable text was found on that website. It may be built so that its content only appears in a browser. Add the content as a document or Q&A instead.');
  return { pages, note: blocked ? `${blocked} page${blocked === 1 ? '' : 's'} skipped because the site's robots.txt asks tools not to read ${blocked === 1 ? 'it' : 'them'}.` : undefined };
}
