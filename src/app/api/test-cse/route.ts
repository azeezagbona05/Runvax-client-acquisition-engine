import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // Allow testing a brand-new key without editing .env: /api/test-cse?key=XXXX
  const overrideKey = req.nextUrl.searchParams.get('key');
  const apiKey = overrideKey || process.env.GOOGLE_CSE_KEY || process.env.GOOGLE_PLACES_API_KEY;
  const cseId = req.nextUrl.searchParams.get('cx') || process.env.GOOGLE_CSE_ID;

  if (!apiKey || !cseId || cseId.includes('your-')) {
    return NextResponse.json({ ok: false, error: 'GOOGLE_CSE_ID or API key not set' });
  }

  try {
    const res = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cseId}&q=%22nigeria%22+%22gmail.com%22&num=1`
    );
    const json = await res.json() as { error?: { message?: string }; items?: unknown[] };

    if (!res.ok) {
      return NextResponse.json({ ok: false, status: res.status, error: json.error?.message ?? `HTTP ${res.status}` });
    }
    return NextResponse.json({ ok: true, resultsFound: (json.items ?? []).length, usingKey: apiKey.slice(0, 12) + '…' });
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'Unknown error' });
  }
}
