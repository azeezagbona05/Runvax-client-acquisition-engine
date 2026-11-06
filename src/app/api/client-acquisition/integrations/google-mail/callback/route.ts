import { NextRequest, NextResponse } from 'next/server';
import { gmailFinish } from '@/lib/integrations/providers';

export const dynamic = 'force-dynamic';

/** Google sends the person back here after they sign in for Gmail. */
export async function GET(req: NextRequest) {
  const base = (process.env.NEXTAUTH_URL ?? req.nextUrl.origin).replace(/\/$/, '');
  const dest = (q: string) => NextResponse.redirect(`${base}/client-acquisition/integrations?${q}`);
  const code = req.nextUrl.searchParams.get('code'), state = req.nextUrl.searchParams.get('state');
  if (req.nextUrl.searchParams.get('error') || !code || !state) return dest('gmail=cancelled');
  try {
    const r = await gmailFinish(code, state);
    return r.ok ? dest('gmail=connected') : dest(`gmail=failed&msg=${encodeURIComponent(r.message)}`);
  } catch { return dest('gmail=failed&msg=Could%20not%20finish%20connecting.'); }
}
