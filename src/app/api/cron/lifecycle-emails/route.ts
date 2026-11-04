import { NextRequest, NextResponse } from 'next/server';
import { guardCron } from '@/lib/cron';
import { runLifecycle } from '@/lib/lifecycleRunner';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// New-user email workflow, run by Vercel Cron (and by the admin dashboard button, which calls
// the same runLifecycle()). See src/lib/lifecycle.ts for the rules.
export async function GET(req: NextRequest) {
  if (!guardCron(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await runLifecycle());
}
