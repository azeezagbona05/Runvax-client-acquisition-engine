import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkAndIncrementSearchForUser } from '@/lib/usage';
import { runAutoProspectSearch } from '@/lib/autoProspect';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { industry, location, noWebsiteOnly = true, minRating = 0 } = await req.json() as {
      industry: string;
      location: string;
      noWebsiteOnly?: boolean;
      minRating?: number;
    };

    if (!industry?.trim() || !location?.trim()) {
      return NextResponse.json({ error: 'Industry and location are required' }, { status: 400 });
    }

    const plan = (session.user as { plan?: string }).plan ?? 'free';
    const usage = await checkAndIncrementSearchForUser(session.user.id, plan);
    if (!usage.ok) {
      const status = usage.code === 'SUSPENDED' ? 403 : 402;
      const error = usage.code === 'SUSPENDED'
        ? 'This account has been suspended.'
        : 'Daily search limit reached. Upgrade for more searches.';
      return NextResponse.json({ error, code: usage.code }, { status });
    }

    const result = await runAutoProspectSearch({ userId: session.user.id, industry, location, noWebsiteOnly, minRating });
    return NextResponse.json(result);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/prospects/auto-search]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
