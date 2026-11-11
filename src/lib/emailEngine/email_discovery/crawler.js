import { normalizeDomain, sameSite } from '../shared/normalize.js';
import { extractLinks, resolveUrl } from '../shared/html.js';

const CONTACT_PATHS = ['/contact', '/contact-us', '/contactus', '/about', '/about-us', '/team', '/our-team', '/the-team', '/people', '/staff', '/leadership', '/management', '/attorneys', '/doctors', '/providers', '/agents'];
const LINK_HINT = /(contact|about|team|people|staff|leadership|management|our-?story|attorneys?|doctors?|providers?|agents?|meet)/i;
const SKIP_EXT = /\.(pdf|jpe?g|png|gif|svg|zip|docx?|xlsx?|mp[34]|css|js)(\?|$)/i;

export const DEFAULT_UA = 'RunvaxEmailResearchBot/0.1 (+research; respects robots.txt)';

/** Parse robots.txt for our user-agent (falls back to *). Returns { allowed(path), crawlDelay }. */
export function parseRobots(txt = '', ua = DEFAULT_UA) {
  const groups = []; let cur = null;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim(); if (!line) continue;
    const [k, ...rest] = line.split(':'); const key = k.trim().toLowerCase(); const val = rest.join(':').trim();
    if (key === 'user-agent') { if (!cur || cur.rules.length) { cur = { agents: [], rules: [], delay: null }; groups.push(cur); } cur.agents.push(val.toLowerCase()); }
    else if (cur && (key === 'allow' || key === 'disallow')) cur.rules.push({ allow: key === 'allow', path: val });
    else if (cur && key === 'crawl-delay') cur.delay = Number(val) || null;
  }
  const uaL = ua.toLowerCase();
  const g = groups.find((x) => x.agents.some((a) => a !== '*' && uaL.includes(a))) || groups.find((x) => x.agents.includes('*')) || { rules: [], delay: null };
  return {
    crawlDelay: g.delay,
    allowed(path) {
      let best = null;
      for (const r of g.rules) {
        if (!r.path) continue;
        const re = new RegExp('^' + r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
        if (re.test(path) && (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow))) best = r;
      }
      return !best || best.allow;
    },
  };
}

/**
 * Polite crawler. `fetchImpl(url) -> { ok, status, text, contentType }` is injectable so tests never hit the network.
 * Limits: maxPages, same-site only, robots.txt respected, no login/forms, HTML only.
 */
export async function crawlSite(domainInput, { fetchImpl = defaultFetch, maxPages = 8, delayMs = 500, ua = DEFAULT_UA, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const domain = normalizeDomain(domainInput);
  if (!domain) throw new Error(`Invalid domain: ${domainInput}`);
  const base = `https://${domain}`;
  const pages = []; const errors = []; const seen = new Set();
  let robots = { allowed: () => true, crawlDelay: null };
  try { const r = await fetchImpl(`${base}/robots.txt`, { ua }); if (r.ok) robots = parseRobots(r.text, ua); } catch { /* no robots = allowed */ }
  const wait = Math.max(delayMs, (robots.crawlDelay || 0) * 1000);

  const queue = [base + '/'];
  const enqueue = (u) => { if (!u || seen.has(u) || queue.includes(u)) return; queue.push(u); };
  let seeded = false;
  while (queue.length && pages.length < maxPages) {
    const url = queue.shift(); if (seen.has(url)) continue; seen.add(url);
    const u = new URL(url);
    if (!sameSite(u.hostname, domain) || SKIP_EXT.test(u.pathname)) continue;
    if (!robots.allowed(u.pathname)) { errors.push({ url, error: 'disallowed by robots.txt' }); continue; }
    if (pages.length || errors.length) await sleep(wait);
    try {
      const r = await fetchImpl(url, { ua });
      if (!r.ok) { errors.push({ url, error: `HTTP ${r.status}` }); continue; }
      if (r.contentType && !/html|xml|text/i.test(r.contentType)) continue;
      pages.push({ url, html: r.text, fetchedAt: new Date().toISOString() });
      for (const a of extractLinks(r.text)) {
        if (/^(mailto|tel|javascript):/i.test(a.href)) continue;
        const abs = resolveUrl(a.href, url); if (!abs) continue;
        const au = new URL(abs); au.hash = '';
        if (sameSite(au.hostname, domain) && (LINK_HINT.test(au.pathname) || LINK_HINT.test(a.text))) enqueue(au.toString());
      }
      if (!seeded) { seeded = true; for (const p of CONTACT_PATHS) enqueue(base + p); }
    } catch (e) { errors.push({ url, error: String(e.message || e) }); }
  }
  return { domain, pages, errors };
}

async function defaultFetch(url, { ua } = {}) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 10_000);
  try {
    const res = await fetch(url, { headers: { 'user-agent': ua, accept: 'text/html,*/*;q=0.5' }, signal: ctl.signal, redirect: 'follow' });
    const text = (await res.text()).slice(0, 2_000_000);
    return { ok: res.ok, status: res.status, text, contentType: res.headers.get('content-type') || '' };
  } finally { clearTimeout(t); }
}
