import { NextRequest, NextResponse } from 'next/server';

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Domains that appear in every page's header/footer — never a real business email
const SITE_NOISE = [
  'example.com', 'sentry.io', 'wixpress.com', 'godaddy.com', 'yourdomain',
  'noreply', 'no-reply', 'donotreply', 'mailer', 'bounce', 'support@jiji',
  'schema.org', 'w3.org', 'openid', 'cloudflare', 'wordpress.com',
  'nairaland.com', 'jiji.ng', 'jiji.com', 'vconnect.com', 'businesslist.com',
  'facebook.com', 'fb.com', 'meta.com', 'instagram.com', 'twitter.com',
  'google.com', 'googleapis.com', 'bing.com', 'microsoft.com', 'yahoo.com/help',
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
  // Prefer common contact prefixes
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

// Extract just the city from a full address like "15 Broad St, Marina, Lagos Island 102273, Lagos, Nigeria"
function extractCity(address: string): string {
  const parts = address.split(',').map((s) => s.trim()).filter((s) => s.length > 1);
  // Remove trailing "Nigeria" and postcode-only parts
  const meaningful = parts.filter((p) => !/^[\d\s]+$/.test(p) && p.toLowerCase() !== 'nigeria');
  // Return 2nd-to-last as it's usually the city
  return meaningful[meaningful.length - 2] ?? meaningful[meaningful.length - 1] ?? 'Nigeria';
}

// Nigerian phone number variants: 08031234567, 0803 123 4567, +2348031234567
function phoneVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, '');
  const variants: string[] = [digits, phone.trim()];
  // 234XXXXXXXXXX → 0XXXXXXXXX
  if (digits.startsWith('234') && digits.length === 13) {
    const national = '0' + digits.slice(3);
    variants.push(national);
    variants.push(`${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7)}`);
  }
  // 0XXXXXXXXXX → +234XXXXXXXXXX
  if (digits.startsWith('0') && digits.length === 11) {
    variants.push('+234' + digits.slice(1));
    variants.push(`+234 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`);
  }
  return Array.from(new Set(variants)).filter((v) => v.length > 7);
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

// ── Facebook About (mobile is less JS-heavy) ──
async function tryFacebook(url: string): Promise<{ email: string; source: string } | null> {
  const base = url.replace(/\/$/, '').split('?')[0];
  const mobile = base.replace('www.facebook.com', 'm.facebook.com');
  for (const u of [`${mobile}/about`, mobile, `${base}/about`]) {
    const email = pickEmail(await fetchText(u));
    if (email) return { email, source: 'facebook' };
  }
  return null;
}

// ── Instagram bio JSON ──
async function tryInstagram(url: string): Promise<{ email: string; source: string } | null> {
  const html = await fetchText(url);
  const bioMatch = html.match(/"biography":"([^"]{0,500})"/);
  const bioText = (bioMatch?.[1] ?? '').replace(/\\n/g, ' ').replace(/\\u0040/g, '@');
  const email = pickEmail(bioText) ?? pickEmail(html);
  return email ? { email, source: 'instagram' } : null;
}

// ── Nairaland: search by phone variants (most specific) ──
async function tryNairaland(phone?: string, name?: string): Promise<{ email: string; source: string } | null> {
  const terms: string[] = [];
  if (phone) terms.push(...phoneVariants(phone).slice(0, 2).map((v) => `"${v}"`));
  if (name) terms.push(`"${name.split(' ').slice(0, 3).join(' ')}"`);

  for (const q of terms) {
    const url = `https://www.nairaland.com/search/keyword=${encodeURIComponent(q)}/results`;
    const html = await fetchText(url);
    // Nairaland shows posts inline — look for email in post text only
    const postSection = html.match(/id="body"[\s\S]{0,50000}/)?.[0] ?? html;
    const email = pickEmail(postSection);
    if (email) return { email, source: 'nairaland' };
  }
  return null;
}

// ── Jiji.ng: search for business ads ──
async function tryJiji(name: string, city: string, phone?: string): Promise<{ email: string; source: string } | null> {
  const shortName = name.split(' ').slice(0, 3).join(' ');
  const queries = [
    phone ? phoneVariants(phone)[0] : null,
    `${shortName} ${city}`,
    shortName,
  ].filter(Boolean) as string[];

  for (const q of queries) {
    const url = `https://jiji.ng/search?query=${encodeURIComponent(q)}`;
    const html = await fetchText(url);
    const email = pickEmail(html);
    if (email) return { email, source: 'jiji' };
  }
  return null;
}

// ── VConnect ──
async function tryVConnect(name: string, city: string): Promise<{ email: string; source: string } | null> {
  const q = encodeURIComponent(`${name.split(' ').slice(0, 3).join(' ')} ${city}`);
  const html = await fetchText(`https://www.vconnect.com/search?q=${q}`);
  const email = pickEmail(html);
  return email ? { email, source: 'vconnect' } : null;
}

// ── BusinessList.com.ng ──
async function tryBusinessList(name: string): Promise<{ email: string; source: string } | null> {
  const q = encodeURIComponent(name.split(' ').slice(0, 3).join(' '));
  const html = await fetchText(`https://www.businesslist.com.ng/search?q=${q}`);
  const email = pickEmail(html);
  return email ? { email, source: 'businesslist' } : null;
}

// ── Brave Search API (free 2000/month, no billing setup needed) ──
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
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey,
        },
      });
      if (!res.ok) { console.error('[Brave]', res.status); break; }
      const json = await res.json() as { web?: { results?: Array<{ title?: string; description?: string; url?: string }> } };
      const results = json.web?.results ?? [];

      // Scan snippets first
      for (const r of results) {
        const email = pickEmail(`${r.title ?? ''} ${r.description ?? ''}`);
        if (email) return { email, source: 'web_search' };
      }
      // Fetch top pages
      for (const r of results.slice(0, 3)) {
        if (!r.url) continue;
        try {
          const pageUrl = new URL(r.url);
          const email = pickEmail(await fetchText(r.url, 5000), [pageUrl.hostname.replace('www.', '')]);
          if (email) return { email, source: 'web_search' };
        } catch { /* skip */ }
      }
    } catch { break; }
  }
  return null;
}

// ── Google Custom Search API (needs GOOGLE_CSE_ID + API enabled) ──
async function tryGoogleCSE(name: string, city: string, phone?: string): Promise<{ email: string; source: string } | null> {
  // Dormant: Google deprecated "search entire web", so CSE adds nothing over the
  // direct directory scrapers. Only runs if a dedicated GOOGLE_CSE_KEY is set.
  const apiKey = process.env.GOOGLE_CSE_KEY;
  const cseId = process.env.GOOGLE_CSE_ID;
  if (!apiKey || !apiKey.trim() || apiKey.includes('your-') || !cseId || cseId.includes('your-')) return null;

  const queries: string[] = [];
  // Phone-based queries are most specific
  if (phone) {
    for (const v of phoneVariants(phone).slice(0, 2)) {
      queries.push(`"${v}" (gmail OR yahoo OR email)`);
    }
  }
  queries.push(`"${name}" "${city}" (gmail.com OR yahoo.com)`);
  queries.push(`"${name}" ${city} email contact`);

  for (const q of queries) {
    try {
      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=${encodeURIComponent(q)}&num=5`;
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json() as { error?: { message?: string } };
        console.error('[CSE]', err?.error?.message ?? res.status);
        return null; // API disabled — stop trying
      }
      const json = await res.json() as { items?: Array<{ snippet?: string; link?: string; title?: string }> };
      // First scan snippets — fast and free
      for (const item of json.items ?? []) {
        const email = pickEmail(`${item.title ?? ''} ${item.snippet ?? ''}`);
        if (email) return { email, source: 'google_search' };
      }
      // Then fetch top result pages
      for (const item of (json.items ?? []).slice(0, 3)) {
        if (!item.link) continue;
        try {
          const pageUrl = new URL(item.link);
          const email = pickEmail(await fetchText(item.link, 5000), [pageUrl.hostname.replace('www.', '')]);
          if (email) return { email, source: 'google_search' };
        } catch { /* skip bad URLs */ }
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

  // ── Social / website URLs ──
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

  // ── Run all text-based strategies in parallel ──
  const settled = await Promise.allSettled([
    tryBraveSearch(name, city, phone),
    tryGoogleCSE(name, city, phone),
    tryNairaland(phone, name),
    tryJiji(name, city, phone),
    tryVConnect(name, city),
    tryBusinessList(name),
  ]);

  for (const r of settled) {
    if (r.status === 'fulfilled' && r.value) return NextResponse.json(r.value);
  }

  return NextResponse.json({ email: null, source: null });
}
