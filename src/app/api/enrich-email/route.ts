import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/requireUser';
import { rateLimit } from '@/lib/rateLimiter';
import { safeFetch } from '@/lib/safeFetch';
import { pickEmail, pickSiteEmail } from '@/lib/siteEmail';
import { prisma } from '@/lib/prisma';
import { useUserKeys } from '@/lib/integrations/keys';
import { domainContacts, snovEnabled } from '@/lib/snov';
import { chargeReveals, loadCredits } from '@/lib/emailCredits';
import { findEmails as engineFindJs } from '@/lib/emailEngine/engine.js';
import { normalizeDomain } from '@/lib/emailEngine/shared/normalize.js';
import { createVerifier } from '@/lib/emailEngine/email_verification/verify.js';

type Found = { email: string; source: string; status?: string; statusNote?: string; [k: string]: unknown };
type VerifyResult = { status: string; reasons: string[] };
const statusVerifier = createVerifier() as unknown as { verify: (email: string, ctx: { discovered: boolean }) => Promise<VerifyResult> };
/** Every returned email carries a status badge. Checks are DNS-level only (no mailbox probing, nothing sent). */
async function withStatus(r: Found): Promise<Found> {
  if (r.status) return r;
  try { const v = await statusVerifier.verify(r.email, { discovered: true }); return { ...r, status: v.status, statusNote: v.reasons[v.reasons.length - 1] }; }
  catch { return { ...r, status: 'UNKNOWN' }; }
}

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function fetchText(url: string, ms = 7000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await safeFetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Referer': 'https://www.google.com/',
      },
    });
    if (!res.ok) return '';
    return (await res.text()).slice(0, 250_000);
  } catch { return ''; }
  finally { clearTimeout(t); }
}

function extractCity(address: string): string {
  const parts = address.split(',').map((s) => s.trim()).filter((s) => s.length > 1);
  const meaningful = parts.filter((p) => !/^[\d\s]+$/.test(p) && p.toLowerCase() !== 'nigeria');
  return meaningful[meaningful.length - 2] ?? meaningful[meaningful.length - 1] ?? 'Nigeria';
}

function phoneVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, '');
  const variants: string[] = [digits, phone.trim()];
  if (digits.startsWith('234') && digits.length === 13) {
    const national = '0' + digits.slice(3);
    variants.push(national);
    variants.push(`${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7)}`);
  }
  if (digits.startsWith('0') && digits.length === 11) {
    variants.push('+234' + digits.slice(1));
    variants.push(`+234 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`);
  }
  return Array.from(new Set(variants)).filter((v) => v.length > 7);
}

// ── VConnect Nigeria — primary Nigerian business directory ──
// Phone number search is most accurate (unique identifier vs name which can have duplicates)
async function tryVConnect(name: string, city: string, phone?: string): Promise<{ email: string; source: string } | null> {
  const queries: string[] = [];

  // Phone search first — phone number uniquely identifies a business
  if (phone) {
    for (const v of phoneVariants(phone).slice(0, 2)) {
      queries.push(v);
    }
  }
  // Name + city fallback
  queries.push(`${name} ${city}`);

  for (const q of queries) {
    const searchHtml = await fetchText(`https://www.vconnect.com/search?q=${encodeURIComponent(q)}`, 6000);
    if (!searchHtml) continue;

    // Scan search results page directly
    const directEmail = pickEmail(searchHtml, ['vconnect.com']);
    if (directEmail) return { email: directEmail, source: 'vconnect' };

    // Follow first listing link
    const listingMatch = searchHtml.match(/href="(\/listing\/[^"]+)"/i)
      ?? searchHtml.match(/href="(\/[a-zA-Z0-9/_-]+-(?:lagos|abuja|nigeria|ph|ibadan|kano|enugu|benin)[a-zA-Z0-9/_-]*)"/i);
    if (listingMatch) {
      const listingHtml = await fetchText(`https://www.vconnect.com${listingMatch[1]}`, 5000);
      const email = pickEmail(listingHtml, ['vconnect.com']);
      if (email) return { email, source: 'vconnect' };
    }
  }

  return null;
}

// ── BusinessList Nigeria ──
async function tryBusinessList(name: string, city: string, phone?: string): Promise<{ email: string; source: string } | null> {
  const queries: string[] = [];

  if (phone) {
    for (const v of phoneVariants(phone).slice(0, 2)) {
      queries.push(v);
    }
  }
  queries.push(`${name} ${city}`);

  for (const q of queries) {
    const searchHtml = await fetchText(`https://www.businesslist.com.ng/search/?query=${encodeURIComponent(q)}`, 6000);
    if (!searchHtml) continue;

    const directEmail = pickEmail(searchHtml, ['businesslist.com.ng', 'businesslist.com']);
    if (directEmail) return { email: directEmail, source: 'directory' };

    const linkMatch = searchHtml.match(/href="(\/company\/[^"]+)"/i);
    if (linkMatch) {
      const pageHtml = await fetchText(`https://www.businesslist.com.ng${linkMatch[1]}`, 5000);
      const email = pickEmail(pageHtml, ['businesslist.com.ng', 'businesslist.com']);
      if (email) return { email, source: 'directory' };
    }
  }

  return null;
}

// ── Jiji Nigeria — classifieds where businesses list with contact details ──
async function tryJiji(name: string, city: string, phone?: string): Promise<{ email: string; source: string } | null> {
  const queries: string[] = [];

  if (phone) {
    for (const v of phoneVariants(phone).slice(0, 2)) {
      queries.push(v);
    }
  }
  queries.push(`${name} ${city}`);

  for (const q of queries) {
    const searchHtml = await fetchText(`https://jiji.ng/search?query=${encodeURIComponent(q)}`, 6000);
    if (!searchHtml) continue;

    const directEmail = pickEmail(searchHtml, ['jiji.ng', 'jiji.com']);
    if (directEmail) return { email: directEmail, source: 'directory' };

    // Follow first ad listing
    const linkMatch = searchHtml.match(/href="(\/[a-z-]+\/\d+[^"]*\.html)"/i);
    if (linkMatch) {
      const pageHtml = await fetchText(`https://jiji.ng${linkMatch[1]}`, 4000);
      const email = pickEmail(pageHtml, ['jiji.ng', 'jiji.com']);
      if (email) return { email, source: 'directory' };
    }
  }

  return null;
}

// ── Bing Web Search — more lenient with server IPs than DDG ──
async function tryBing(name: string, city: string, phone?: string): Promise<{ email: string; source: string } | null> {
  const shortName = name.split(' ').slice(0, 4).join(' ');
  const queries: string[] = [];

  if (phone) {
    for (const v of phoneVariants(phone).slice(0, 2)) {
      queries.push(`"${v}" email gmail yahoo`);
    }
  }
  queries.push(`"${shortName}" "${city}" email contact`);
  queries.push(`"${shortName}" Nigeria gmail.com OR yahoo.com`);

  for (const q of queries) {
    const html = await fetchText(`https://www.bing.com/search?q=${encodeURIComponent(q)}&mkt=en-NG`, 6000);
    if (!html || html.includes('CAPTCHA') || html.length < 500) continue;

    // Scan snippets first
    const snippetEmail = pickEmail(html, ['bing.com', 'microsoft.com']);
    if (snippetEmail) return { email: snippetEmail, source: 'web_search' };

    // Extract result URLs from Bing HTML
    const urlMatches = Array.from(html.matchAll(/href="(https?:\/\/(?!www\.bing\.com)[^"]+)"/g));
    const resultUrls = urlMatches
      .map((m) => m[1])
      .filter((u) => !u.includes('bing.com') && !u.includes('microsoft.com') && !u.includes('msn.com'))
      .slice(0, 3);

    for (const resultUrl of resultUrls) {
      try {
        const pageHost = new URL(resultUrl).hostname.replace('www.', '');
        const pageHtml = await fetchText(resultUrl, 4000);
        const pageEmail = pickEmail(pageHtml, [pageHost]);
        if (pageEmail) return { email: pageEmail, source: 'web_search' };
      } catch { continue; }
    }
  }
  return null;
}

// ── DuckDuckGo Lite — fallback free web search ──
async function tryDuckDuckGo(name: string, city: string, phone?: string): Promise<{ email: string; source: string } | null> {
  const shortName = name.split(' ').slice(0, 4).join(' ');
  const queries: string[] = [];

  if (phone) {
    for (const v of phoneVariants(phone).slice(0, 2)) {
      queries.push(`"${v}" email gmail yahoo`);
    }
  }
  queries.push(`"${shortName}" "${city}" email contact`);

  for (const q of queries) {
    const html = await fetchText(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`, 6000);
    // DDG Lite returns CAPTCHA/empty when rate-limited — detect and skip
    if (!html || html.length < 500 || html.includes('CAPTCHA') || html.includes('robot')) continue;

    const snippetEmail = pickEmail(html, ['duckduckgo.com', 'duck.com']);
    if (snippetEmail) return { email: snippetEmail, source: 'web_search' };

    const uddgMatches = Array.from(html.matchAll(/uddg=([^&"]+)/g));
    const resultUrls = uddgMatches
      .map((m) => { try { return decodeURIComponent(m[1]); } catch { return ''; } })
      .filter((u) => u.startsWith('http') && !u.includes('duckduckgo.com'))
      .slice(0, 2);

    for (const resultUrl of resultUrls) {
      try {
        const pageHost = new URL(resultUrl).hostname.replace('www.', '');
        const pageHtml = await fetchText(resultUrl, 4000);
        const pageEmail = pickEmail(pageHtml, [pageHost]);
        if (pageEmail) return { email: pageEmail, source: 'web_search' };
      } catch { continue; }
    }
  }
  return null;
}

// ── Real website ──
async function tryWebsite(url: string): Promise<{ email: string; source: string } | null> {
  let base = url.trim();
  if (!/^https?:\/\//.test(base)) base = 'https://' + base;
  let origin = base;
  try { origin = new URL(base).origin; } catch { return null; }
  // The business's own domain is what we are looking for, so it is NOT excluded here.
  for (const u of [base, `${origin}/contact`, `${origin}/contact-us`, `${origin}/contact.html`, `${origin}/about`, `${origin}/about-us`]) {
    const email = pickSiteEmail(await fetchText(u));
    if (email) return { email, source: 'website' };
  }
  return null;
}

// ── RUNVAX email engine: reads the business's own site (contact/about/team pages, mailto, hidden and Cloudflare-protected
// addresses, structured data). Only addresses actually PUBLISHED on the site are returned; it never returns a guess. ──
type EngineEmail = { email: string; onSiteDomain?: boolean; sources: Array<{ url: string; method: string }>; verification: { status: string; confidence: number; reasons: string[] } };
const engineFind = engineFindJs as unknown as (o: Record<string, unknown>) => Promise<{ discovered: EngineEmail[] }>;
const ENGINE_UA = 'RunvaxEmailBot/1.0 (+https://runvax.com; respects robots.txt)';

async function engineFetch(url: string) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 7000);
  try {
    const res = await safeFetch(url, { signal: ctl.signal, headers: { 'user-agent': ENGINE_UA, accept: 'text/html,*/*;q=0.5' } });
    return { ok: res.ok, status: res.status, text: (await res.text()).slice(0, 1_000_000), contentType: res.headers.get('content-type') || '' };
  } finally { clearTimeout(t); }
}

async function tryEngine(website: string): Promise<{ email: string; source: string; sourceUrl?: string; status?: string } | null> {
  const domain = normalizeDomain(website);
  if (!domain) return null;
  const run = engineFind({ domain, name: null, smtp: false, verifyCandidates: false, maxPeopleGuesses: 0, crawlOptions: { fetchImpl: engineFetch, maxPages: 5, delayMs: 300, ua: ENGINE_UA } });
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), 25_000)); // never let one site hold the request
  const r = await Promise.race([run.catch(() => null), timeout]);
  if (!r) return null;
  const usable = r.discovered.filter((e) => !['INVALID', 'DISPOSABLE'].includes(e.verification.status));
  // The business's own domain first, then the strongest evidence.
  usable.sort((a, b) => Number(!!b.onSiteDomain) - Number(!!a.onSiteDomain) || b.verification.confidence - a.verification.confidence);
  const best = usable[0];
  return best ? { email: best.email, source: 'website', sourceUrl: best.sources[0]?.url, status: best.verification.status } : null;
}

// ── Snov fallback: only when the site publishes no email, the account is on a paid plan, the user agreed to spend
// reveals, and a reveal is in hand. Charged 1 reveal only when an email is actually returned. ──
async function trySnov(userId: string, website: string): Promise<{ email: string; source: string; person?: string; title?: string; balance: number | null; status?: string; statusNote?: string } | null> {
  const domain = normalizeDomain(website);
  if (!domain || !snovEnabled()) return null;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  if (!u || u.plan === 'free') return null;
  if ((await loadCredits(userId)).total <= 0) return null;
  if (!rateLimit(`enrich-email-snov:${userId}`, { maxRequests: 100, windowMs: 3_600_000 }).ok) return null;
  let contacts;
  try { contacts = await domainContacts(domain, { max: 1 }); } catch (e) { console.error('[enrich-email] snov', e instanceof Error ? e.message : e); return null; }
  const c = contacts.find((x) => x.email);
  if (!c?.email) return null;
  const charge = await chargeReveals(userId, [c.email]);
  if (charge.unaffordable.length) return null;
  return { email: c.email, source: 'snov', person: c.name, title: c.position, balance: charge.summary.total, ...(c.smtpStatus === 'valid' ? { status: 'VERIFIED', statusNote: 'Snov confirmed the mailbox.' } : {}) };
}

// ── Facebook About page ──
async function tryFacebook(url: string): Promise<{ email: string; source: string } | null> {
  const base = url.replace(/\/$/, '').split('?')[0];
  const mobile = base.replace('www.facebook.com', 'm.facebook.com');
  for (const u of [`${mobile}/about`, mobile, `${base}/about`]) {
    const email = pickEmail(await fetchText(u, 6000));
    if (email) return { email, source: 'facebook' };
  }
  return null;
}

// ── Instagram bio JSON ──
async function tryInstagram(url: string): Promise<{ email: string; source: string } | null> {
  const html = await fetchText(url, 6000);
  const bioMatch = html.match(/"biography":"([^"]{0,500})"/);
  const bioText = (bioMatch?.[1] ?? '').replace(/\\n/g, ' ').replace(/\\u0040/g, '@');
  const email = pickEmail(bioText) ?? pickEmail(html);
  return email ? { email, source: 'instagram' } : null;
}

// ── Brave Search API — OPTIONAL, dormant unless BRAVE_SEARCH_KEY is set ──
async function tryBraveSearch(name: string, city: string, phone?: string): Promise<{ email: string; source: string } | null> {
  const apiKey = process.env.BRAVE_SEARCH_KEY;
  if (!apiKey || apiKey.includes('your-') || !apiKey.trim()) return null;

  const queries: string[] = [];
  if (phone) {
    for (const v of phoneVariants(phone).slice(0, 2)) {
      queries.push(`"${v}" email gmail yahoo`);
    }
  }
  queries.push(`"${name}" "${city}" gmail.com OR yahoo.com`);
  queries.push(`"${name}" ${city} contact email`);

  for (const q of queries) {
    try {
      const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=5&country=ng`, {
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey,
        },
      });
      if (!res.ok) break;
      const json = await res.json() as { web?: { results?: Array<{ title?: string; description?: string; url?: string }> } };
      for (const r of json.web?.results ?? []) {
        const email = pickEmail(`${r.title ?? ''} ${r.description ?? ''}`);
        if (email) return { email, source: 'web_search' };
      }
      for (const r of (json.web?.results ?? []).slice(0, 3)) {
        if (!r.url) continue;
        try {
          const pageHost = new URL(r.url).hostname.replace('www.', '');
          const email = pickEmail(await fetchText(r.url, 4000), [pageHost]);
          if (email) return { email, source: 'web_search' };
        } catch { continue; }
      }
    } catch { break; }
  }
  return null;
}

// ── Google Custom Search API — OPTIONAL, dormant unless GOOGLE_CSE_KEY set ──
async function tryGoogleCSE(name: string, city: string, phone?: string): Promise<{ email: string; source: string } | null> {
  const apiKey = process.env.GOOGLE_CSE_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !apiKey.trim() || apiKey.includes('your-') || !cseId || cseId.includes('your-')) return null;

  const queries: string[] = [];
  if (phone) {
    for (const v of phoneVariants(phone).slice(0, 2)) {
      queries.push(`"${v}" (gmail OR yahoo OR email)`);
    }
  }
  queries.push(`"${name}" "${city}" (gmail.com OR yahoo.com)`);

  for (const q of queries) {
    try {
      const res = await fetch(`https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${encodeURIComponent(q)}&num=5`);
      if (!res.ok) return null;
      const json = await res.json() as { items?: Array<{ snippet?: string; link?: string; title?: string }> };
      for (const item of json.items ?? []) {
        const email = pickEmail(`${item.title ?? ''} ${item.snippet ?? ''}`);
        if (email) return { email, source: 'google_search' };
      }
      for (const item of (json.items ?? []).slice(0, 3)) {
        if (!item.link) continue;
        try {
          const pageHost = new URL(item.link).hostname.replace('www.', '');
          const email = pickEmail(await fetchText(item.link, 4000), [pageHost]);
          if (email) return { email, source: 'google_search' };
        } catch { continue; }
      }
    } catch { return null; }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user.ok) return user.response;
  if (!rateLimit(`enrich-email:${user.userId}`, { maxRequests: 120, windowMs: 60_000 }).ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const { website, name, location, phone, useCredits, skipEngine } = await req.json() as {
    website?: string;
    name?: string;
    location?: string;
    phone?: string;
    /** The user agreed to spend email reveals on a Snov lookup when nothing free finds an email. */
    useCredits?: boolean;
    /** Admin Prospect Lab: run the old sources only, to compare them with the engine. */
    skipEngine?: boolean;
  };
  const isSite = !!website && !/facebook\.com|instagram\.com/i.test(website) && /^https?:\/\/|\./.test(website);

  if (!website && !name) return NextResponse.json({ email: null, source: null });

  const city = extractCity(location ?? '');

  // ── 1. Social / website URLs — most direct source ──
  if (website) {
    const lower = website.toLowerCase();
    if (lower.includes('facebook.com')) {
      const r = await tryFacebook(website);
      if (r) return NextResponse.json(await withStatus(r));
    } else if (lower.includes('instagram.com')) {
      const r = await tryInstagram(website);
      if (r) return NextResponse.json(await withStatus(r));
    } else if (/^https?:\/\/|\./.test(website)) {
      const e = skipEngine === true ? null : await tryEngine(website);
      if (e) return NextResponse.json(await withStatus(e));
      const r = await tryWebsite(website); // the original scraper stays as a safety net
      if (r) return NextResponse.json(await withStatus(r));
    }
  }

  // Last resort for a business with a website: Snov (paid, only with the user's consent).
  const snovLast = async () => {
    if (useCredits !== true || !isSite || skipEngine === true) return null;
    await useUserKeys(user.userId);
    return trySnov(user.userId, website!);
  };

  if (!name) { const sv = await snovLast(); return NextResponse.json(sv ? await withStatus(sv) : { email: null, source: null }); }

  // ── 2. Nigerian directories ──
  // Phone number is the key link: the number they registered with Google is the
  // same one on the directory listing.
  //
  // VConnect and BusinessList are disabled by default. Probed 2026-08-15:
  // VConnect is unreachable entirely (connection times out, even the root
  // domain), and BusinessList still serves its homepage but every search URL
  // pattern 404s. Left behind an env flag rather than deleted, so they can be
  // re-enabled cheaply if either comes back.
  //
  // This matters for latency, not just hit rate: with all three enabled every
  // lookup paid ~7s of timeouts per dead source, which made a single enrichment
  // take ~20s. Jiji alone answers in about a second.
  const directories = [
    tryJiji(name, city, phone),
    ...(process.env.ENRICH_ENABLE_LEGACY_DIRECTORIES === 'true'
      ? [tryVConnect(name, city, phone), tryBusinessList(name, city, phone)]
      : []),
  ];
  for (const r of await Promise.allSettled(directories)) {
    if (r.status === 'fulfilled' && r.value) return NextResponse.json(await withStatus(r.value));
  }

  // ── 3. Web search strategies in parallel ──
  // Bing is the only free scrape that still works from a server IP. DuckDuckGo
  // is dropped: its html/ and lite/ endpoints both answer 202 with a ~14KB bot
  // challenge page whose only email address is DDG's own error contact, so it
  // returned pure noise. Brave and Google CSE stay — both are dormant unless
  // their keys are set, and CSE in particular is the best available source once
  // GOOGLE_CSE_KEY is configured (GOOGLE_CSE_ID alone is not enough).
  const settled = await Promise.allSettled([
    tryBing(name, city, phone),
    tryBraveSearch(name, city, phone),
    tryGoogleCSE(name, city, phone),
    ...(process.env.ENRICH_ENABLE_LEGACY_DIRECTORIES === 'true'
      ? [tryDuckDuckGo(name, city, phone)]
      : []),
  ]);

  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value) return NextResponse.json(await withStatus(r.value));
  }

  const sv = await snovLast();
  if (sv) return NextResponse.json(await withStatus(sv));
  return NextResponse.json({ email: null, source: null });
}
