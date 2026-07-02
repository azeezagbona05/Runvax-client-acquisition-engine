import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CATEGORIES: [string, string[]][] = [
  ['Restaurant / Food', ['restaurant', 'food', 'kitchen', 'dining', 'cafe', 'catering', 'pizza', 'burger', 'bakery', 'eatery', 'suya', 'shawarma', 'menu']],
  ['Real Estate', ['real estate', 'property', 'realty', 'homes', 'housing', 'apartment', 'estate', 'mortgage', 'land']],
  ['Healthcare', ['hospital', 'clinic', 'health', 'medical', 'pharmacy', 'dental', 'doctor', 'wellness', 'diagnostic']],
  ['Fashion & Retail', ['fashion', 'clothing', 'wear', 'boutique', 'apparel', 'accessories', 'footwear', 'store', 'shop']],
  ['Education', ['school', 'academy', 'education', 'learning', 'training', 'college', 'university', 'tutorial', 'institute']],
  ['Logistics', ['logistics', 'delivery', 'transport', 'shipping', 'courier', 'freight', 'haulage', 'dispatch']],
  ['Finance', ['finance', 'bank', 'loan', 'investment', 'insurance', 'fintech', 'accounting', 'microfinance']],
  ['Technology', ['software', 'app development', 'web design', 'it services', 'cybersecurity', 'tech solutions', 'digital agency']],
  ['Hospitality', ['hotel', 'resort', 'guest house', 'accommodation', 'lodge', 'shortlet', 'airbnb', 'inn']],
  ['Beauty & Wellness', ['beauty', 'salon', 'spa', 'hair', 'nail', 'makeup', 'skincare', 'cosmetic', 'barber']],
  ['Church / NGO', ['church', 'ministry', 'gospel', 'ngo', 'foundation', 'charity', 'nonprofit', 'mission', 'parish']],
  ['Construction', ['construction', 'building', 'contractor', 'architecture', 'engineering', 'interior', 'renovation']],
  ['Agriculture', ['farm', 'agriculture', 'agro', 'livestock', 'poultry', 'crop', 'fishing']],
  ['E-commerce', ['online store', 'ecommerce', 'e-commerce', 'marketplace', 'buy online', 'shop online']],
];

function detectCategory(text: string): string {
  const lower = text.toLowerCase();
  for (const [cat, keywords] of CATEGORIES) {
    if (keywords.some((k) => lower.includes(k))) return cat;
  }
  return 'Other';
}

function getAttr(tag: string, attr: string): string {
  const m = new RegExp(`${attr}=["']([^"']{1,500})["']`, 'i').exec(tag);
  return m?.[1]?.trim() ?? '';
}

function extractMeta(html: string, baseUrl: string) {
  const titleMatch = /<title[^>]*>([^<]{1,200})<\/title>/i.exec(html);
  const rawTitle = titleMatch?.[1]?.trim() ?? '';

  let description = '';
  let ogTitle = '';
  let ogDesc = '';
  let favicon = '';

  for (const tag of html.match(/<meta[^>]+>/gi) ?? []) {
    const name = getAttr(tag, 'name').toLowerCase();
    const prop = getAttr(tag, 'property').toLowerCase();
    const content = getAttr(tag, 'content');
    if (!content) continue;
    if (name === 'description') description = content;
    if (prop === 'og:title') ogTitle = content;
    if (prop === 'og:description') ogDesc = content;
  }

  for (const tag of html.match(/<link[^>]+>/gi) ?? []) {
    const rel = getAttr(tag, 'rel').toLowerCase();
    const href = getAttr(tag, 'href');
    if (rel.includes('icon') && href) { favicon = href; break; }
  }

  try {
    const origin = new URL(baseUrl).origin;
    if (!favicon) {
      favicon = `${origin}/favicon.ico`;
    } else if (!favicon.startsWith('http')) {
      favicon = favicon.startsWith('/') ? `${origin}${favicon}` : `${origin}/${favicon}`;
    }
  } catch { /* bad URL */ }

  const title = ogTitle || rawTitle;
  const metaDesc = ogDesc || description;
  const category = detectCategory(title + ' ' + metaDesc);

  return { title, metaDesc, favicon, category };
}

export async function POST(req: NextRequest) {
  const { url } = await req.json() as { url: string };
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });

  const normalised = url.startsWith('http') ? url : `https://${url}`;

  try {
    const res = await fetch(normalised, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BeamAI/1.0)' },
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    return NextResponse.json(extractMeta(html, normalised));
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch' },
      { status: 500 }
    );
  }
}
