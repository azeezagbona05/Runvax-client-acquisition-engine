import { NextRequest, NextResponse } from 'next/server';
import { requireCampaignUser } from '@/lib/campaignAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { loadCareer, logEvent } from '@/lib/career/store';
import { tailor } from '@/lib/career/tailor';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** POST { job, role? }: tailor the profile to one pasted job description. Uses the saved profile only, writes nothing, and sends nothing anywhere. */
export async function POST(req: NextRequest) {
  const u = await requireCampaignUser(req); if (!u.ok) return u.response;
  if (!rateLimit(`career-test:${u.userId}`, { maxRequests: 12, windowMs: 60 * 60 * 1000 }).ok) return NextResponse.json({ error: 'That is a lot of tests in an hour. Try again later.' }, { status: 429 });
  const b = await req.json().catch(() => ({})) as { job?: unknown; role?: unknown };
  const job = typeof b.job === 'string' ? b.job.trim() : ''; const role = typeof b.role === 'string' ? b.role.trim().slice(0, 120) : '';
  if (job.length < 80) return NextResponse.json({ error: 'Paste the full job description (at least a few lines) so the agent has something to tailor to.' }, { status: 400 });
  const c = await loadCareer(u.userId);
  if (!c.profile) return NextResponse.json({ error: 'Upload your CV first.' }, { status: 400 });
  const p = c.preferences;
  const line = p.salaryMin ? `${p.currency} ${p.salaryMin}${p.salaryMax ? `-${p.salaryMax}` : '+'}` : 'no figure given';
  const t = await tailor(c.profile, job, role, line);
  await logEvent(u.userId, 'application_writer', 'test_run', `Tailored a sample for ${role || 'a pasted job'} (${t.source === 'ai' ? 'AI' : 'basic'} writer)${t.flags.length ? `; ${t.flags.length} unsupported claim(s) removed` : ''}`);
  return NextResponse.json({ result: t, confirmed: c.profileConfirmed });
}
