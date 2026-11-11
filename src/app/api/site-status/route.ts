import { NextResponse } from 'next/server';
import { getSiteSettings } from '@/lib/siteSettings';

export const dynamic = 'force-dynamic';

/** Public, read-only: what the front end needs to know (switches, banner, maintenance). No secrets live in these settings. */
export async function GET() {
  const s = await getSiteSettings();
  return NextResponse.json(s, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=15, stale-while-revalidate=30' } });
}
