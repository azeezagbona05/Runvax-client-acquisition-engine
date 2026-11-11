import { crawlSite } from './crawler.js';
import { extractEmailsFromHtml, extractPeople } from './extract.js';
import { normalizeDomain } from '../shared/normalize.js';
import { Provenance } from '../shared/constants.js';

/** Merge per-page extractions into unique emails with full source attribution. */
export function discoverFromPages(domainInput, pages, { now = new Date() } = {}) {
  const domain = normalizeDomain(domainInput);
  const byEmail = new Map(); const peopleMap = new Map();
  for (const p of pages) {
    for (const r of extractEmailsFromHtml(p.html, { siteDomain: domain })) {
      const src = { url: p.url, method: r.method, discoveredAt: p.fetchedAt || now.toISOString() };
      const e = byEmail.get(r.email);
      if (e) { e.sources.push(src); e.name ||= r.name; e.title ||= r.title; }
      else byEmail.set(r.email, { email: r.email, provenance: Provenance.DISCOVERED, onSiteDomain: r.onSiteDomain, name: r.name, title: r.title, sources: [src] });
    }
    for (const person of extractPeople(p.html)) {
      const k = person.name.toLowerCase();
      if (!peopleMap.has(k)) peopleMap.set(k, { ...person, sourceUrl: p.url });
    }
  }
  return { domain, emails: [...byEmail.values()], people: [...peopleMap.values()], pagesScanned: pages.length };
}

export async function discoverEmails(domain, opts = {}) {
  const crawl = await crawlSite(domain, opts);
  return { ...discoverFromPages(crawl.domain, crawl.pages), crawlErrors: crawl.errors };
}
