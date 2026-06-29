import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { checkAndIncrementAI } from '@/lib/usage';
import { Business } from '@/types';

export const dynamic = 'force-dynamic';

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40) || 'site';
}

function cityFromAddress(addr: string): string {
  // Best-effort: second-to-last comma segment is usually the city
  const parts = addr.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : (parts[0] ?? '');
}

interface DemoContent {
  headline: string;
  subheadline: string;
  about: string;
  services: { title: string; desc: string }[];
  whyChooseUs: string[];
  ctaText: string;
  accent: string;
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not set' }, { status: 500 });
    }

    const token = await getToken({ req });
    const userId = (token?.id ?? token?.sub) as string | undefined;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Counts as an AI generation against the daily quota
    const usage = await checkAndIncrementAI(req);
    if (!usage.ok) return usage.error!;

    const { business }: { business: Business } = await req.json();
    if (!business?.name) return NextResponse.json({ error: 'Business data required' }, { status: 400 });

    const city = cityFromAddress(business.address || '');
    const reviewsText = business.reviews?.length
      ? business.reviews.map((r) => `"${r.text.slice(0, 140)}" — ${r.author} (${r.rating}★)`).join('\n')
      : 'No reviews available';

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1100,
      temperature: 0.8,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a senior conversion copywriter building a one-page marketing website for a local business. ' +
            'Write warm, specific, benefit-led copy (no fluff, no lorem ipsum). Use the real business name and location. ' +
            'Return ONLY JSON matching the requested schema.',
        },
        {
          role: 'user',
          content:
            `Business: ${business.name}\n` +
            `Category: ${business.category}\n` +
            `Location: ${city || business.address}\n` +
            `Rating: ${business.rating ?? 'n/a'} (${business.reviewCount ?? 0} reviews)\n` +
            `Sample reviews:\n${reviewsText}\n\n` +
            `Produce JSON with this exact shape:\n` +
            `{\n` +
            `  "headline": "punchy hero headline (max 8 words)",\n` +
            `  "subheadline": "1 sentence value proposition",\n` +
            `  "about": "2-3 sentence about paragraph in a confident, friendly tone",\n` +
            `  "services": [{"title":"...","desc":"one short sentence"}, ... 3 to 4 items relevant to the category],\n` +
            `  "whyChooseUs": ["short benefit", ... 3 to 4 items],\n` +
            `  "ctaText": "short call-to-action button label",\n` +
            `  "accent": "a hex color that fits the industry mood, e.g. #7c3aed"\n` +
            `}`,
        },
      ],
    });

    let content: DemoContent;
    try {
      content = JSON.parse(completion.choices[0]?.message?.content || '{}');
    } catch {
      return NextResponse.json({ error: 'Failed to generate site content' }, { status: 502 });
    }

    // Validate / sanitise accent
    const accent = /^#[0-9a-fA-F]{6}$/.test(content.accent || '') ? content.accent : '#7c3aed';

    const data = {
      content: { ...content, accent },
      business: {
        name: business.name,
        category: business.category,
        address: business.address,
        city,
        phone: business.phone ?? null,
        phoneIntl: business.phoneIntl ?? null,
        rating: business.rating ?? null,
        reviewCount: business.reviewCount ?? null,
        location: business.location ?? null,
        openingHours: business.openingHours ?? [],
        reviews: (business.reviews ?? []).slice(0, 4),
      },
      generatedAt: new Date().toISOString(),
    };

    const baseSlug = slugify(business.name);
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`;

    const demo = await prisma.demoSite.upsert({
      where: { userId_businessId: { userId, businessId: business.id } },
      create: {
        slug,
        userId,
        businessId: business.id,
        businessName: business.name,
        data,
      },
      update: { data, businessName: business.name },
      select: { slug: true },
    });

    return NextResponse.json({ slug: demo.slug, url: `/demo/${demo.slug}` });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[/api/demo]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
