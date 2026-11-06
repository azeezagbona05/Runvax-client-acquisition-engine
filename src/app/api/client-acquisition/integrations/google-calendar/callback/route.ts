import { NextRequest, NextResponse } from 'next/server';
import { gcalFinish } from '@/lib/integrations/providers';

export const dynamic = 'force-dynamic';

/** Google sends the person back here after they allow calendar access. */
export async function GET(req: NextRequest) {
  const base = (process.env.NEXTAUTH_URL ?? req.nextUrl.origin).replace(/\/$/, '');
  const dest = (q: string) => NextResponse.redirect(`${base}/client-acquisition/integrations?${q}`);
  const code = req.nextUrl.searchParams.get('code'), state = req.nextUrl.searchParams.get('state');
  if (req.nextUrl.searchParams.get('error') || !code || !state) return dest('gcal=cancelled');
  try {
    const r = await gcalFinish(code, state);
    return r.ok ? dest('gcal=connected') : dest(`gcal=failed&msg=${encodeURIComponent(r.message)}`);
  } catch { return dest('gcal=failed&msg=Could%20not%20finish%20connecting.'); }
}
