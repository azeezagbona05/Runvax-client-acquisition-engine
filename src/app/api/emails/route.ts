import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Must end with a valid TLD — 2+ alpha chars only
const EMAIL_RE = /[a-zA-Z0-9._+\-']+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const NOISE_DOMAINS = [
  'example.com', 'sentry.io', 'wixpress.com', 'godaddy.com', 'squarespace.com',
  'wordpress.com', 'cloudflare.com', 'schema.org', 'w3.org', 'openid.net',
  'facebook.com', 'fb.com', 'meta.com', 'instagram.com', 'twitter.com', 'x.com',
  'google.com', 'googleapis.com', 'bing.com', 'microsoft.com', 'apple.com',
  'amazonaws.com', 'sendgrid.net', 'mailchimp.com', 'constant-contact.com',
];
const NOISE_LOCAL = ['noreply', 'no-reply', 'donotreply', 'bounce', 'postmaster', 'mailer', 'daemon',
  'privacy', 'abuse', 'spam', 'unsubscribe', 'support@wix', 'emailprotected'];

const SOCIAL_HOSTS = ['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'tiktok.com', 'linkedin.com'];

// Standard fallback paths to try if homepage links don't lead anywhere
const FALLBACK_PATHS = ['/contact', '/contact-us', '/about', '/about-us', '/team', '/our-team', '/reach-us', '/get-in-touch'];

// URL patterns that suggest a contact/about page
const CONTACT_PATTERN = /contact|about|team|staff|reach|touch|hello|email|info|meet-us|find-us|location/i;

export interface DiscoveredEmail {
  email: string;
  page: string;
  path: string;
}

async function fetchPage(url: string, ms = 9000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        Referer: 'https://www.google.com/',
      },
    });
    if (!res.ok) return '';
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('html') && !ct.includes('text')) return '';
    return (await res.text()).slice(0, 400_000);
  } catch {
    return '';
  } finally {
    clearTimeout(t);
  }
}

// ── Cloudflare Email Protection decoder ─────────────────────────────────────
// CF replaces emails with data-cfemail="<hex>" XOR-encoded with first byte as key
function decodeCFEmail(hex: string): string {
  try {
    const key = parseInt(hex.slice(0, 2), 16);
    let result = '';
    for (let i = 2; i < hex.length; i += 2) {
      result += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
    }
    return result;
  } catch { return ''; }
}

function extractEmails(html: string, hostDomain: string): string[] {
  const collected: string[] = [];

  // 1. Cloudflare Email Protection — data-cfemail="<hex>"
  //    This is the #1 reason emails are invisible: CF encodes them server-side
  const cfRe = /data-cfemail="([a-f0-9]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = cfRe.exec(html)) !== null) {
    const decoded = decodeCFEmail(m[1]);
    if (decoded.includes('@')) collected.push(decoded);
  }

  // 2. mailto: href links — most reliable when present
  const mailtoRe = /mailto:([^"'?&\s<>)]+)/gi;
  while ((m = mailtoRe.exec(html)) !== null) {
    collected.push(m[1].split('?')[0]);
  }

  // 3. data-* attributes that store email (some themes use data-email, data-mail etc.)
  const dataAttrRe = /data-(?:email|mail|address|contact)="([^"@]{1,40}@[^"]{4,60})"/gi;
  while ((m = dataAttrRe.exec(html)) !== null) collected.push(m[1]);

  // 4. Plain-text scan — strip all HTML tags first so split-tag emails are rejoined
  //    e.g. <span>info</span><span>@</span><span>acme.com</span> → "info @acme.com"
  const textOnly = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')           // strip all tags → plain text
    .replace(/&#64;/g, '@').replace(/&#46;/g, '.')
    .replace(/\[at\]/gi, '@').replace(/\[dot\]/gi, '.')
    .replace(/\(at\)/gi, '@').replace(/\(dot\)/gi, '.')
    .replace(/\s+/g, ' ');              // collapse whitespace

  for (const e of textOnly.match(EMAIL_RE) ?? []) collected.push(e);

  // 5. Also scan raw HTML for emails hidden in comments or attributes
  for (const e of html.match(EMAIL_RE) ?? []) collected.push(e);

  const clean = collected
    .map((e) => e.toLowerCase().replace(/[.,;:'"<>\s]+$/, '').replace(/^[.,;:'"<>\s]+/, ''))
    .filter((e) => {
      if (!e.includes('@') || !e.includes('.')) return false;
      if (e.length < 6 || e.length > 80) return false;
      const atIdx = e.lastIndexOf('@');
      const local = e.slice(0, atIdx);
      const domain = e.slice(atIdx + 1);
      if (local.includes('%') || local.includes('=')) return false; // URL-encoded garbage
      if (!domain.includes('.') || domain.length < 4) return false;
      if (NOISE_DOMAINS.some((n) => domain.includes(n))) return false;
      if (NOISE_LOCAL.some((n) => local.includes(n))) return false;
      const isOwn = domain === hostDomain || domain.endsWith('.' + hostDomain);
      const isPublic = ['gmail.com', 'yahoo.com', 'yahoo.co.uk', 'hotmail.com',
        'outlook.com', 'live.com', 'icloud.com', 'protonmail.com',
        'ymail.com', 'googlemail.com'].includes(domain);
      return isOwn || isPublic;
    });

  return Array.from(new Set(clean));
}

// Extract internal links to contact/about pages — match by URL pattern OR link text
function extractContactLinks(html: string, origin: string): string[] {
  const links: string[] = [];
  // Match full <a href="...">text</a> so we can check both URL and visible text
  const anchorRe = /<a\s[^>]*href="([^"#][^"]*)"[^>]*>([\s\S]{0,80}?)<\/a>/gi;
  const TEXT_PATTERN = /contact|about|reach|touch|email\s*us|find\s*us|location|team|staff|hello/i;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    const href = m[1].trim();
    const text = m[2].replace(/<[^>]+>/g, '').trim(); // strip inner tags
    if (!href || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;
    try {
      const full = new URL(href, origin).href;
      if (!full.startsWith(origin)) continue;
      const path = new URL(full).pathname.toLowerCase();
      if (CONTACT_PATTERN.test(path) || TEXT_PATTERN.test(text)) links.push(full);
    } catch { /* ignore */ }
  }
  return Array.from(new Set(links)).slice(0, 8);
}

function labelForUrl(url: string): string {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (/contact/.test(path)) return 'Contact page';
    if (/about/.test(path)) return 'About page';
    if (/team|staff/.test(path)) return 'Team page';
    return 'Website';
  } catch { return 'Website'; }
}

// ── Pass 1: crawl the business website ──────────────────────────────────────
async function crawlWebsite(rawUrl: string, hostDomain: string): Promise<DiscoveredEmail[]> {
  // Normalise origin — try https, fall back to http
  let origin: string;
  try {
    let u = rawUrl.trim();
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    origin = new URL(u).origin;
  } catch { return []; }

  const seen = new Set<string>();
  const results: DiscoveredEmail[] = [];

  function addEmails(emails: string[], page: string, path: string) {
    for (const email of emails) {
      if (!seen.has(email)) { seen.add(email); results.push({ email, page, path }); }
    }
  }

  // Fetch homepage first — and discover internal links from it
  let homepageHtml = await fetchPage(origin + '/');

  // If HTTPS fails, try HTTP
  if (!homepageHtml && origin.startsWith('https://')) {
    const httpOrigin = origin.replace('https://', 'http://');
    homepageHtml = await fetchPage(httpOrigin + '/');
    if (homepageHtml) origin = httpOrigin;
  }

  if (homepageHtml) {
    addEmails(extractEmails(homepageHtml, hostDomain), 'Homepage', origin + '/');

    // Discover real contact/about links from the homepage — much better than guessing paths
    const discovered = extractContactLinks(homepageHtml, origin);

    // Also try standard fallback paths the site might use
    const fallbacks = FALLBACK_PATHS.map((p) => origin + p);
    const allToTry = Array.from(new Set([...discovered, ...fallbacks]));

    await Promise.all(
      allToTry.slice(0, 10).map(async (url) => {
        const html = await fetchPage(url);
        if (!html) return;
        addEmails(extractEmails(html, hostDomain), labelForUrl(url), url);
      }),
    );
  }

  return results;
}

// ── Pass 2: web search for @domain.com mentions ──────────────────────────────
async function searchDomainEmails(hostDomain: string): Promise<DiscoveredEmail[]> {
  const seen = new Set<string>();
  const results: DiscoveredEmail[] = [];

  function addEmails(emails: string[], page: string, path: string) {
    for (const email of emails) {
      if (!seen.has(email)) { seen.add(email); results.push({ email, page, path }); }
    }
  }

  // Build query WITHOUT encodeURIComponent on the quotes — use raw quotes in the q param,
  // only encoding the @ sign. Bing handles this fine and doesn't double-encode.
  const encoded = `%22%40${hostDomain}%22`;     // → "@domain.com" (Bing sees literal quotes)
  const bingUrl = `https://www.bing.com/search?q=${encoded}&mkt=en-GB&count=10&setlang=en`;

  const bingHtml = await fetchPage(bingUrl, 8000);
  if (bingHtml && bingHtml.length > 1000 && !bingHtml.includes('CAPTCHA')) {
    // Extract from snippet text only — don't trust URLs
    const snippetText = bingHtml
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ');
    addEmails(extractEmails(snippetText, hostDomain), 'Web search', 'bing.com');

    // Follow top result pages that contain the domain name
    const urlMatches = Array.from(bingHtml.matchAll(/href="(https?:\/\/(?!www\.bing\.com|go\.microsoft)[^"&]{10,200})"/g));
    const resultUrls = Array.from(new Set(
      urlMatches.map((m) => m[1]).filter((u) => {
        try {
          const host = new URL(u).hostname;
          // Follow pages from the business's own domain OR directories that mention it
          return host.endsWith(hostDomain) || host === hostDomain ||
            u.includes(hostDomain) || host.includes('businesslist') || host.includes('vconnect');
        } catch { return false; }
      }),
    )).slice(0, 5);

    await Promise.all(
      resultUrls.map(async (url) => {
        const html = await fetchPage(url, 6000);
        if (html) addEmails(extractEmails(html, hostDomain), 'Web search', url);
      }),
    );
  }

  if (results.length > 0) return results;

  // DuckDuckGo fallback
  const ddgUrl = `https://lite.duckduckgo.com/lite/?q=%22%40${hostDomain}%22`;
  const ddgHtml = await fetchPage(ddgUrl, 8000);
  if (ddgHtml && ddgHtml.length > 500 && !ddgHtml.includes('CAPTCHA') && !ddgHtml.includes('robot')) {
    const text = ddgHtml.replace(/<[^>]+>/g, ' ');
    addEmails(extractEmails(text, hostDomain), 'Web search', 'duckduckgo.com');

    const uddgMatches = Array.from(ddgHtml.matchAll(/uddg=([^&"]+)/g));
    const ddgUrls = uddgMatches
      .map((m) => { try { return decodeURIComponent(m[1]); } catch { return ''; } })
      .filter((u) => u.startsWith('http') && !u.includes('duckduckgo.com'))
      .slice(0, 3);

    await Promise.all(
      ddgUrls.map(async (url) => {
        const html = await fetchPage(url, 5000);
        if (html) addEmails(extractEmails(html, hostDomain), 'Web search', url);
      }),
    );
  }

  return results;
}

function sortEmails(emails: DiscoveredEmail[], hostDomain: string): DiscoveredEmail[] {
  return emails.sort((a, b) => {
    const aOwn = a.email.endsWith('@' + hostDomain) || a.email.includes('.' + hostDomain);
    const bOwn = b.email.endsWith('@' + hostDomain) || b.email.includes('.' + hostDomain);
    if (aOwn && !bOwn) return -1;
    if (!aOwn && bOwn) return 1;
    return 0;
  });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const placeId = req.nextUrl.searchParams.get('placeId');
  if (!placeId) return NextResponse.json({ error: 'Missing placeId' }, { status: 400 });

  const record = await prisma.cachedBusiness.findUnique({
    where: { placeId },
    select: { website: true, discoveredEmails: true, emailsCrawledAt: true },
  });

  if (!record?.website) {
    return NextResponse.json({ emails: [], noWebsite: true });
  }

  // Skip social-only profiles — no domain to crawl
  if (SOCIAL_HOSTS.some((h) => record.website!.includes(h))) {
    return NextResponse.json({ emails: [], socialOnly: true });
  }

  // Return cached if < 30 days old
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  if (record.emailsCrawledAt && Date.now() - record.emailsCrawledAt.getTime() < THIRTY_DAYS_MS) {
    return NextResponse.json({
      emails: record.discoveredEmails as unknown as DiscoveredEmail[],
      cached: true,
    });
  }

  // Derive host domain
  let hostDomain: string;
  try {
    let u = record.website.trim();
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    hostDomain = new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return NextResponse.json({ emails: [], error: 'Invalid URL' });
  }

  // Run both passes in parallel
  const [crawlResults, searchResults] = await Promise.all([
    crawlWebsite(record.website, hostDomain),
    searchDomainEmails(hostDomain),
  ]);

  // Merge + dedup
  const seen = new Set<string>();
  const merged: DiscoveredEmail[] = [];
  for (const item of [...crawlResults, ...searchResults]) {
    if (!seen.has(item.email)) { seen.add(item.email); merged.push(item); }
  }

  const sorted = sortEmails(merged, hostDomain);

  await prisma.cachedBusiness.update({
    where: { placeId },
    data: {
      discoveredEmails: sorted as unknown as import('@prisma/client').Prisma.InputJsonValue,
      emailsCrawledAt: new Date(),
    },
  });

  return NextResponse.json({ emails: sorted, cached: false });
}
