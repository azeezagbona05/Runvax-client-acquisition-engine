import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Emails that appear in every page header/footer — never a real business email
const SITE_NOISE = [
  'example.com', 'sentry.io', 'wixpress.com', 'godaddy.com', 'yourdomain',
  'noreply', 'no-reply', 'donotreply', 'mailer', 'bounce',
  'schema.org', 'w3.org', 'openid', 'cloudflare', 'wordpress.com',
  'nairaland.com', 'jiji.ng', 'jiji.com', 'vconnect.com', 'businesslist.com',
  'facebook.com', 'fb.com', 'meta.com', 'instagram.com', 'twitter.com',
  'google.com', 'googleapis.com', 'bing.com', 'microsoft.com', 'yahoo.com/help',
  'duckduckgo.com', 'duck.com', 'ddg.gg',
  '.png', '.jpg', '.gif', '.webp', '.svg', '.css', '.js',
];

const PREFERRED = /^(info|contact|hello|admin|sales|enquir|hi|support|mail|office|business|shop|store|clinic|hotel|salon|school|church|law|realtor|property|cater|event|manager|ceo|director|booking)/;

function pickEmail(text: string, extraExclude: string[] = []): string | null {
  const raw = text.match(EMAIL_RE);
  if (!raw) return null;
  const exclude = [...SITE_NOISE, ...extraExclude];
  const filtered = raw
    .map((m) => m.toLowerCase().replace(/[.,;:'"<>\s]+$/, '').replace(/^[.,;:'"<>\s]+/, ''))
    .filter((m) => {
      if (!m.includes('@') || !m.includes('.')) return false;
      if (m.length < 6 || m.length > 80) return false;
      if (exclude.some((j) => m.includes(j))) return false;
      const parts = m.split('@');
      const local = parts[0];
      const domain = parts[1];
      if (!local || !domain || !domain.includes('.')) return false;
      if (local.length < 2 || domain.length < 4) return false;
      return true;
    });
  const clean = Array.from(new Set(filtered));
  if (!clean.length) return null;
  return clean.find((m) => PREFERRED.test(m.split('@')[0])) ?? clean[0];
}

async function fetchText(url: string, ms = 8000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
    });
    if (!res.ok) return '';
    return (await res.text()).slice(0, 300_000);
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

// ── DuckDuckGo Lite — free web search, no API key needed ──
// Searches by phone, then name+city. Scans snippets first, then visits top pages.
async function tryDuckDuckGo(name: string, city: string, phone?: string): Promise<{ email: string; source: string } | null> {
  const shortName = name.split(' ').slice(0, 4).join(' ');
  const queries: string[] = [];

  if (phone) {
    for (const v of phoneVariants(phone).slice(0, 2)) {
      queries.push(`"${v}" email gmail yahoo`);
    }
  }
  queries.push(`"${shortName}" "${city}" email contact`);
  queries.push(`"${shortName}" Nigeria email gmail yahoo`);

  for (const q of queries) {
    const html = await fetchText(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`, 7000);
    if (!html) continue;

    // Scan snippets first (fast path — email often appears directly in result text)
    const snippetEmail = pickEmail(html, ['duckduckgo.com', 'duck.com']);
    if (snippetEmail) return { email: snippetEmail, source: 'web_search' };

    // DDG Lite wraps result links as /l/?uddg=ENCODED_URL — decode to get real URLs
    const uddgMatches = Array.from(html.matchAll(/uddg=([^&"]+)/g));
    const resultUrls = uddgMatches
      .map((m) => { try { return decodeURIComponent(m[1]); } catch { return ''; } })
      .filter((u) => u.startsWith('http') && !u.includes('duckduckgo.com'))
      .slice(0, 3);

    for (const resultUrl of resultUrls) {
      try {
        const pageHost = new URL(resultUrl).hostname.replace('www.', '');
        const pageHtml = await fetchText(resultUrl, 5000);
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
  const hostDomain = new URL(origin).hostname.replace('www.', '');
  for (const u of [base, `${origin}/contact`, `${origin}/contact-us`, `${origin}/about`]) {
    const email = pickEmail(await fetchText(u), [hostDomain]);
    if (email) return { email, source: 'website' };
  }
  return null;
}

// ── Facebook About — mobile is less JS-heavy but still often blocked ──
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
          const email = pickEmail(await fetchText(r.url, 5000), [pageHost]);
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
          const email = pickEmail(await fetchText(item.link, 5000), [pageHost]);
          if (email) return { email, source: 'google_search' };
        } catch { continue; }
      }
    } catch { return null; }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { website, name, location, phone } = await req.json() as {
    website?: string;
    name?: string;
    location?: string;
    phone?: string;
  };

  if (!website && !name) return NextResponse.json({ email: null, source: null });

  const city = extractCity(location ?? '');

  // ── Social / website URLs — try first as most direct ──
  if (website) {
    const lower = website.toLowerCase();
    if (lower.includes('facebook.com')) {
      const r = await tryFacebook(website);
      if (r) return NextResponse.json(r);
    } else if (lower.includes('instagram.com')) {
      const r = await tryInstagram(website);
      if (r) return NextResponse.json(r);
    } else if (/^https?:\/\/|\./.test(website)) {
      const r = await tryWebsite(website);
      if (r) return NextResponse.json(r);
    }
  }

  if (!name) return NextResponse.json({ email: null, source: null });

  // ── Run search strategies in parallel ──
  // DuckDuckGo Lite is the primary engine (free, no API key, actually works).
  // Brave/Google CSE are dormant unless their keys are set in .env.local.
  const settled = await Promise.allSettled([
    tryDuckDuckGo(name, city, phone),
    tryBraveSearch(name, city, phone),
    tryGoogleCSE(name, city, phone),
  ]);

  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value) return NextResponse.json(r.value);
  }

  return NextResponse.json({ email: null, source: null });
}
