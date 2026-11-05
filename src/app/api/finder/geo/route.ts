import { NextRequest, NextResponse } from 'next/server';
import { listCountries, regionsOf } from '@/lib/geo';

export const dynamic = 'force-dynamic';

/** GET → every country; GET ?country=NG → that country's regions. Static reference data, safe to cache. */
export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get('country');
  const headers = { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' };
  if (country) {
    if (!/^[A-Za-z]{2}$/.test(country)) return NextResponse.json({ error: 'Bad country code' }, { status: 400 });
    return NextResponse.json({ regions: regionsOf(country) }, { headers });
  }
  return NextResponse.json({ countries: listCountries() }, { headers });
}
