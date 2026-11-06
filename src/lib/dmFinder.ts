/**
 * Finds the decision-maker for a business by asking every source we can reach.
 *
 * Free sources run first and in parallel: the business's own website, and public web
 * search (which surfaces LinkedIn profile pages without us ever fetching linkedin.com).
 * Paid sources — Hunter, Snov.io, Apollo, an Apify actor — run only when the caller asks for a
 * deeper search, one at a time, and stop as soon as a strong answer appears so credits
 * are not spent confirming what we already know.
 *
 * Every provider is optional: it is skipped unless its key is set. A provider that
 * errors never fails the lookup; it just contributes nothing.
 */

import { safeFetch } from '@/lib/safeFetch';
import { apolloEnabled, domainFromUrl, findDecisionMaker } from '@/lib/apollo';
import { domainContacts, findEmail as snovFindEmail, snovEnabled, verifyEmails } from '@/lib/snov';
import { emailPatterns } from '@/lib/emailPatterns';
import { channelsOf, crawlSite, rankedPeople, type ContactChannel, type SiteIntel } from '@/lib/siteIntel';
import {
  cleanPhone, extractDecisionMaker, industryTitles, titleQuery, mapApifyItem, mergeCandidates, isStrong, parseLinkedInResult, parseSnippetResult, titleRank,
  type DmCandidate, type DmSource,
} from '@/lib/decisionMaker';

export interface FindContext {
  businessName: string;
  city: string;
  website?: string;
  /** Google category and place types, used to search for the titles that industry uses. */
  category?: string;
  categoryTypes?: string[];
  /** A person already named (website, or typed by the sender): paid sources look up their contact first. */
  knownPerson?: { name: string; title?: string };
}

interface Provider {
  id: DmSource;
  paid: boolean;
  enabled: () => boolean;
  run: (ctx: FindContext & { domain: string | null; /** Filled in by the website provider for the caller. */ intel?: SiteIntel | null }) => Promise<DmCandidate[]>;
}

export interface FindResult {
  candidates: DmCandidate[];
  best: DmCandidate | null;
  /** Sources that actually ran, in order. */
  ran: DmSource[];
  /** A deeper (paid) search is configured and has not been run. */
  paidAvailable: boolean;
  /** Every contact route the website gave us, by kind (decision-maker email, general email, form, phone). */
  channels: ContactChannel[];
  /** Pages the crawler read, for the record. */
  pagesRead: string[];
}

const SEARCH_TIMEOUT = 8000;

async function getText(url: string, init: RequestInit = {}, ms = 6000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await safeFetch(url, { ...init, signal: ctrl.signal });
    return res.ok ? (await res.text()).slice(0, 250_000) : '';
  } catch { return ''; }
  finally { clearTimeout(t); }
}

// ── Free: the business's own website ─────────────────────────────────────────

const PAGES = ['', '/about', '/about-us', '/team', '/our-team', '/contact'];

const website: Provider = {
  id: 'website', paid: false, enabled: () => true,
  async run(ctx) {
    if (!ctx.website) return [];
    const intel = await crawlSite(ctx.website, (url) => getText(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RunvaxBot/1.0)', Accept: 'text/html,*/*;q=0.8' } }));
    ctx.intel = intel;
    if (!intel) return [];
    return rankedPeople(intel).slice(0, 5).map((p): DmCandidate => ({
      name: p.name, title: p.title, source: 'website', confidence: 'medium', sourcePage: p.sourcePage,
      ...(p.linkedin ? { linkedin: p.linkedin } : {}),
      ...(p.email ? { email: p.email, emailStatus: 'Published on their website' } : {}),
    }));
  },
};

// ── Free: public web search ──────────────────────────────────────────────────

interface SearchHit { title?: string; url?: string; description?: string }

async function braveSearch(q: string): Promise<SearchHit[]> {
  const key = process.env.BRAVE_SEARCH_KEY;
  if (!key || !key.trim() || key.includes('your-')) return [];
  try {
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=10`, {
      headers: { Accept: 'application/json', 'X-Subscription-Token': key },
      signal: AbortSignal.timeout(SEARCH_TIMEOUT),
    });
    if (!res.ok) return [];
    const json = await res.json() as { web?: { results?: SearchHit[] } };
    return json.web?.results ?? [];
  } catch { return []; }
}

const strip = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

/** Best-effort fallback when no search API key is set. Engines throttle servers, so empty is normal. */
async function bingSearch(q: string): Promise<SearchHit[]> {
  const html = await getText(`https://www.bing.com/search?q=${encodeURIComponent(q)}&mkt=en-NG`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9' },
  }, SEARCH_TIMEOUT);
  if (!html || html.length < 500 || /captcha/i.test(html)) return [];
  const out: SearchHit[] = [];
  for (const block of Array.from(html.matchAll(/<li class="b_algo"[\s\S]*?<\/li>/g)).slice(0, 10)) {
    const a = block[0].match(/<h2[^>]*><a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!a) continue;
    const p = block[0].match(/<p[^>]*>([\s\S]*?)<\/p>/);
    out.push({ url: a[1].replace(/&amp;/g, '&'), title: strip(a[2]), description: p ? strip(p[1]) : '' });
  }
  return out;
}

const search: Provider = {
  id: 'search', paid: false, enabled: () => true,
  async run({ businessName, city, category, categoryTypes }) {
    const short = businessName.split('(')[0].trim();
    const titles = industryTitles(category, categoryTypes);
    const queries = [
      `site:linkedin.com/in "${short}" ${city} ${titleQuery(titles)}`,
      `"${short}" ${city} ${titleQuery(titles.slice(0, 4))} -jobs`,
    ];
    const engine = process.env.BRAVE_SEARCH_KEY?.trim() ? braveSearch : bingSearch;
    const hits = (await Promise.all(queries.map((q) => engine(q)))).flat();
    const out: DmCandidate[] = [];
    for (const h of hits) {
      const c = parseLinkedInResult(h, short) ?? parseSnippetResult(h, short);
      if (c) out.push(c);
    }
    return out;
  },
};

// ── Paid: Hunter ─────────────────────────────────────────────────────────────

interface HunterPerson {
  value?: string; email?: string; first_name?: string; last_name?: string; position?: string;
  confidence?: number; score?: number; linkedin?: string; linkedin_url?: string; phone_number?: string;
  verification?: { status?: string };
}

/** Email Finder: the address of one named person at a domain (1 credit, only charged when found). */
async function hunterFindPerson(domain: string, person: { name: string; title?: string }): Promise<DmCandidate[]> {
  const parts = person.name.replace(/^(dr|mr|mrs|ms|miss|prof|engr|barr)\.?\s+/i, '').trim().split(/\s+/);
  if (parts.length < 2) return [];
  const url = `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(domain)}&first_name=${encodeURIComponent(parts[0])}&last_name=${encodeURIComponent(parts[parts.length - 1])}&api_key=${encodeURIComponent(process.env.HUNTER_API_KEY ?? '')}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(SEARCH_TIMEOUT) });
  if (!res.ok) return [];
  const d = (await res.json() as { data?: HunterPerson }).data;
  if (!d?.email) return [];
  const score = d.score ?? 0;
  return [{
    name: person.name, title: d.position || person.title || '', source: 'hunter',
    confidence: score >= 80 ? 'high' : 'medium',
    email: d.email.toLowerCase(),
    emailStatus: d.verification?.status ? `${d.verification.status}, score ${score}` : `score ${score}`,
    phone: cleanPhone(d.phone_number),
    linkedin: d.linkedin_url || undefined,
  }];
}

const hunter: Provider = {
  id: 'hunter', paid: true, enabled: () => !!process.env.HUNTER_API_KEY?.trim(),
  async run({ domain, knownPerson }) {
    if (!domain) return [];
    try {
      if (knownPerson?.name) {
        const found = await hunterFindPerson(domain, knownPerson);
        if (found.length) return found;
      }
      const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&seniority=senior,executive&limit=5&api_key=${encodeURIComponent(process.env.HUNTER_API_KEY ?? '')}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(SEARCH_TIMEOUT) });
      if (!res.ok) return [];
      const json = await res.json() as { data?: { emails?: HunterPerson[] } };
      const out: DmCandidate[] = [];
      for (const e of json.data?.emails ?? []) {
        const name = `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim();
        const title = e.position ?? '';
        if (!name || titleRank(title) < 0) continue;
        out.push({
          name, title, source: 'hunter',
          confidence: (e.confidence ?? 0) >= 80 ? 'high' : 'medium',
          email: e.value?.toLowerCase(),
          emailStatus: typeof e.confidence === 'number' ? `confidence ${e.confidence}` : undefined,
          linkedin: e.linkedin || undefined,
          phone: cleanPhone(e.phone_number),
        });
      }
      return out;
    } catch { return []; }
  },
};

// ── Paid: Snov.io ────────────────────────────────────────────────────────────

/**
 * With a person already named, Email Finder returns that person's address. Either way, Domain Search
 * then lists other people Snov knows at the business's domain (filtered to this industry's
 * decision-maker titles) and looks up each one's email, so one business can yield several contacts.
 * Only runs on a deeper search, which is capped per user per day.
 */
const snov: Provider = {
  id: 'snov', paid: true, enabled: snovEnabled,
  async run({ domain, knownPerson, category, categoryTypes }) {
    if (!domain) return [];
    const out: DmCandidate[] = [];
    const label = (st?: string, reason?: string) => (st === 'valid' ? 'Email check: valid' : `Email check: ${st ?? 'unknown'}${reason ? ` (${reason})` : ''}`);
    try {
      if (knownPerson?.name) {
        const found = await snovFindEmail(domain, knownPerson.name);
        if (found) {
          out.push({
            name: knownPerson.name, title: knownPerson.title ?? '', source: 'snov',
            confidence: found.smtpStatus === 'valid' ? 'high' : 'medium', email: found.email, emailStatus: label(found.smtpStatus, found.reason),
          });
        }
      }
    } catch { /* fall through to the domain list */ }
    try {
      const people = await domainContacts(domain, { positions: industryTitles(category, categoryTypes), max: 3 });
      for (const p of people) {
        out.push({
          name: p.name, title: p.position, source: 'snov', confidence: p.smtpStatus === 'valid' ? 'high' : 'medium',
          ...(p.email ? { email: p.email, emailStatus: label(p.smtpStatus) } : {}),
        });
      }
    } catch { /* a failing lookup contributes nothing */ }
    return out;
  },
};

// ── Paid: Apollo ─────────────────────────────────────────────────────────────

const apollo: Provider = {
  id: 'apollo', paid: true, enabled: apolloEnabled,
  async run({ domain }) {
    if (!domain) return [];
    try {
      const dm = await findDecisionMaker(domain);
      if (!dm || titleRank(dm.title) < 0) return [];
      return [{ name: dm.name, title: dm.title, source: 'apollo', confidence: 'medium', linkedin: dm.linkedin, email: dm.email, emailStatus: dm.emailStatus }];
    } catch { return []; }
  },
};

// ── Paid: Apify ──────────────────────────────────────────────────────────────

/**
 * Runs any Apify actor that returns people for a company. Actors differ in input, so it is
 * configured rather than hard-coded:
 *   APIFY_TOKEN        your Apify API token
 *   APIFY_DM_ACTOR     actor id, e.g. "username~actor-name"
 *   APIFY_DM_INPUT     JSON input template; {{business}}, {{domain}}, {{city}} are filled in
 * Items are mapped by common field names (name/fullName, title/position, linkedinUrl, email).
 * Which actor you choose, and what it collects, is your call to vet.
 */
const apify: Provider = {
  id: 'apify', paid: true,
  enabled: () => !!process.env.APIFY_TOKEN?.trim() && !!process.env.APIFY_DM_ACTOR?.trim(),
  async run({ businessName, city, domain }) {
    try {
      const template = process.env.APIFY_DM_INPUT?.trim() || '{"companyName":"{{business}}","companyDomain":"{{domain}}","maxItems":5}';
      const fill = (v: string) => JSON.stringify(v).slice(1, -1);
      const body = template
        .replace(/\{\{business\}\}/g, fill(businessName))
        .replace(/\{\{domain\}\}/g, fill(domain ?? ''))
        .replace(/\{\{city\}\}/g, fill(city));
      const input = JSON.parse(body) as unknown;
      const actor = encodeURIComponent(process.env.APIFY_DM_ACTOR ?? '');
      const res = await fetch(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?timeout=60&format=json&clean=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.APIFY_TOKEN}` },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(65_000),
      });
      if (!res.ok) return [];
      const items = await res.json() as Array<Record<string, unknown>>;
      return (Array.isArray(items) ? items : []).slice(0, 10).map(mapApifyItem).filter((c): c is DmCandidate => !!c);
    } catch { return []; }
  },
};

const FREE: Provider[] = [website, search];
// Cheapest first, so a strong early hit saves the dearer calls.
const PAID: Provider[] = [hunter, snov, apollo, apify];

export function paidProvidersConfigured(): boolean {
  return PAID.some((p) => p.enabled());
}

/**
 * People we have a name for but no email: try the usual address patterns on the business's domain and keep the
 * first one Snov.io's verifier says is valid (never "unknown", which includes catch-all domains). One bulk check
 * covers everyone. Limited to the top few people, since every pattern costs a verification credit.
 */
export async function fillByPattern(candidates: DmCandidate[], domain: string | null, maxPeople = 3): Promise<DmCandidate[]> {
  if (!domain || !snovEnabled()) return candidates;
  const need = candidates.filter((c) => !c.email && titleRank(c.title) >= 0).slice(0, maxPeople);
  const guesses = new Map(need.map((c) => [c, emailPatterns(c.name, domain)] as const));
  const all = Array.from(guesses.values()).flat();
  if (!all.length) return candidates;
  let checked: Awaited<ReturnType<typeof verifyEmails>>;
  try { checked = await verifyEmails(all); } catch { return candidates; }
  return candidates.map((c) => {
    const hit = guesses.get(c)?.map((e) => checked.get(e)).find((r) => r?.smtpStatus === 'valid' && !r.disposable);
    return hit ? { ...c, email: hit.email, emailStatus: 'Checked: address exists (pattern guess)', confidence: c.confidence === 'low' ? 'medium' : c.confidence } : c;
  });
}

export async function findDecisionMakers(ctx: FindContext, opts: { deep?: boolean; /** Read the business's website only, without the public-search step. */ skipSearch?: boolean } = {}): Promise<FindResult> {
  const full: FindContext & { domain: string | null; intel?: SiteIntel | null } = { ...ctx, domain: domainFromUrl(ctx.website) };
  const ran: DmSource[] = [];
  const found: DmCandidate[] = [];

  const free = FREE.filter((p) => p.enabled() && !(opts.skipSearch && p.id === 'search'));
  const results = await Promise.allSettled(free.map((p) => p.run(full)));
  results.forEach((r, i) => { ran.push(free[i].id); if (r.status === 'fulfilled') found.push(...r.value); });

  let candidates = mergeCandidates(found);

  if (opts.deep) {
    // Without a name from the caller, look up the contact of the best person the free sources found.
    const top = candidates[0];
    if (!full.knownPerson && top && titleRank(top.title) >= 0) full.knownPerson = { name: top.name, title: top.title };
    for (const p of PAID.filter((x) => x.enabled())) {
      // Paid sources are for reaching the person, so a name without an email keeps the search going.
      if (isStrong(candidates[0], true)) break;
      ran.push(p.id);
      try { found.push(...await p.run(full)); } catch { /* a failing provider contributes nothing */ }
      candidates = mergeCandidates(found);
    }
  }

  if (opts.deep) candidates = mergeCandidates(await fillByPattern(candidates, full.domain));

  return {
    candidates,
    best: candidates[0] ?? null,
    ran,
    paidAvailable: !opts.deep && paidProvidersConfigured(),
    // Contact routes seen on the site, plus any person's email a later (paid) source found.
    channels: (() => {
      const base = channelsOf(full.intel ?? null).filter((c) => c.type !== 'none');
      const have = new Set(base.map((c) => c.value));
      const extra: ContactChannel[] = candidates.filter((c) => c.email && !have.has(c.email)).map((c) => ({ type: 'decision_maker_email', value: c.email, person: c.name }));
      const all = [...extra, ...base].sort((a, b) => Number(b.type === 'decision_maker_email') - Number(a.type === 'decision_maker_email'));
      return all.length ? all : [{ type: 'none' }];
    })(),
    pagesRead: full.intel?.pages ?? [],
  };
}
