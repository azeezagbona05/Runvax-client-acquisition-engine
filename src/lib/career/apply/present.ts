import { SOURCE_LABEL } from '@/lib/career/jobs/sources';
import { sanitizeProfile } from '@/lib/career/types';

/** Shape of one prepared application as the page sees it. Lives here, not in the route file, because Next.js route files may only export request handlers. */
export type SubRow = { id: string; status: string; trigger: string; reason: string; questions: unknown; evidence: string; finalUrl: string; platform: string; createdAt: Date; finishedAt: Date | null };
export const presentApplication = (a: { submissions?: SubRow[]; id: string; status: string; cv: unknown; coverLetter: string; answers: unknown; gaps: unknown; flags: unknown; source: string; edited: boolean; approvedAt: Date | null; appliedAt: Date | null; appliedBy: string | null; updatedAt: Date; match: { score: number; listing: { title: string; company: string; location: string; remote: boolean; url: string; source: string } } }) => ({
  id: a.id, status: a.status, cv: sanitizeProfile(a.cv), coverLetter: a.coverLetter, answers: a.answers as Array<{ question: string; answer: string }>, gaps: a.gaps as string[], flags: a.flags as string[],
  submission: a.submissions?.[0] ? { ...a.submissions[0], questions: (a.submissions[0].questions as Array<{ label: string; reason: string }> | null) ?? [] } : null,
  source: a.source, edited: a.edited, approvedAt: a.approvedAt, appliedAt: a.appliedAt, appliedBy: a.appliedBy, updatedAt: a.updatedAt, score: a.match.score,
  job: { ...a.match.listing, source: SOURCE_LABEL[a.match.listing.source] ?? a.match.listing.source },
});

