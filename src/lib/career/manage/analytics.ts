import { prisma } from '@/lib/prisma';
import { EMPLOYER_KINDS } from './classify';

const DAY = 86_400_000;
export interface Analytics {
  funnel: { discovered: number; matched: number; prepared: number; approved: number; applied: number; replies: number; interviews: number; offers: number };
  rates: { replyRate: number | null; interviewRate: number | null; avgDaysToReply: number | null };
  bySource: Array<{ source: string; applied: number; replies: number }>;
  appliedPerWeek: Array<{ week: string; count: number }>;
  aiWrites: number;
}
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);

/** The numbers the pilot needs: how many relevant jobs, how many applications, how many replies. All real counts from the user's own records. */
export async function computeAnalytics(userId: string, minScore: number, now = new Date()): Promise<Analytics> {
  const [discovered, matched, apps, responses, interviews, ai] = await Promise.all([
    prisma.jobListing.count({ where: { userId } }),
    prisma.jobMatch.count({ where: { userId, score: { gte: minScore } } }),
    prisma.jobApplication.findMany({ where: { userId }, select: { id: true, status: true, appliedAt: true, match: { select: { listing: { select: { source: true } } } } } }),
    prisma.careerResponse.findMany({ where: { userId }, select: { applicationId: true, kind: true, receivedAt: true } }),
    prisma.careerInterview.count({ where: { userId } }),
    prisma.careerAgentEvent.count({ where: { userId, OR: [{ detail: { contains: '(AI writer)' } }, { detail: { contains: '(AI reader)' } }, { detail: { contains: ' AI ' } }] } }),
  ]);
  const by = (s: string) => apps.filter((a) => a.status === s).length;
  const employer = responses.filter((r) => EMPLOYER_KINDS.includes(r.kind as never));
  const applied = apps.filter((a) => a.status === 'applied' && a.appliedAt);
  const repliedIds = new Set(employer.map((r) => r.applicationId));
  const repliedApplied = applied.filter((a) => repliedIds.has(a.id));
  const gaps = repliedApplied.map((a) => { const first = Math.min(...employer.filter((r) => r.applicationId === a.id).map((r) => r.receivedAt.getTime())); return (first - a.appliedAt!.getTime()) / DAY; }).filter((d) => d >= 0);
  const src = new Map<string, { applied: number; replies: number }>();
  for (const a of applied) { const k = a.match.listing.source; const e = src.get(k) ?? { applied: 0, replies: 0 }; e.applied++; if (repliedIds.has(a.id)) e.replies++; src.set(k, e); }
  const weeks = new Map<string, number>();
  for (let i = 7; i >= 0; i--) { const d = new Date(now.getTime() - i * 7 * DAY); const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7))); weeks.set(monday.toISOString().slice(0, 10), 0); }
  for (const a of applied) { const d = a.appliedAt!; const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7))).toISOString().slice(0, 10); if (weeks.has(monday)) weeks.set(monday, (weeks.get(monday) ?? 0) + 1); }
  return {
    funnel: { discovered, matched, prepared: apps.length, approved: apps.filter((a) => a.status === 'approved' || a.status === 'applied').length, applied: by('applied'), replies: repliedApplied.length, interviews, offers: new Set(responses.filter((r) => r.kind === 'offer').map((r) => r.applicationId)).size },
    rates: { replyRate: pct(repliedApplied.length, applied.length), interviewRate: pct(new Set(responses.filter((r) => r.kind === 'interview').map((r) => r.applicationId)).size, applied.length), avgDaysToReply: gaps.length ? Math.round((gaps.reduce((a, b) => a + b, 0) / gaps.length) * 10) / 10 : null },
    bySource: Array.from(src.entries()).map(([source, v]) => ({ source, ...v })).sort((a, b) => b.applied - a.applied),
    appliedPerWeek: Array.from(weeks.entries()).map(([week, count]) => ({ week, count })),
    aiWrites: ai,
  };
}
