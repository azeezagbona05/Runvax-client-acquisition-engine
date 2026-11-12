import { prisma } from '@/lib/prisma';
import { loadCareer, logEvent } from '@/lib/career/store';
import { dedupeKey, fetchArbeitnow, fetchCompanyBoard, searchRemotive, SOURCE_LABEL, type Job } from './sources';
import { scoreJob } from './match';

export const FLOOR = 35;            // below this a job is not worth keeping at all
const MAX_LISTINGS = 1500;
const MAX_PER_RUN = 150;

export interface DiscoveryResult { fetched: number; added: number; duplicates: number; matched: number; sources: Array<{ name: string; ok: boolean; count: number; error?: string }>; noBoard: string[]; skipped?: string }

/** One search for one user: fetch from the chosen sources, drop repeats, score every job against the confirmed profile, keep the relevant ones. */
export async function runDiscovery(userId: string): Promise<DiscoveryResult> {
  const c = await loadCareer(userId);
  const out: DiscoveryResult = { fetched: 0, added: 0, duplicates: 0, matched: 0, sources: [], noBoard: [] };
  if (!c.profile || !c.profileConfirmed) return { ...out, skipped: 'Confirm your profile first. The agent only searches on behalf of a verified profile.' };
  const { discovery: d, preferences: prefs, profile } = c;

  const all: Job[] = [];
  const track = async (name: string, f: () => Promise<Job[] | null>) => {
    try { const j = await f(); if (j === null) out.noBoard.push(name); else { all.push(...j); out.sources.push({ name, ok: true, count: j.length }); } }
    catch (e) { out.sources.push({ name, ok: false, count: 0, error: e instanceof Error ? e.message.slice(0, 120) : 'failed' }); }
  };
  const tasks: Array<Promise<void>> = [];
  if (d.sources.includes('job_feeds')) {
    const q = (prefs.titles[0] ?? profile.experience[0]?.title ?? '').trim();
    if (q) tasks.push(track(`${SOURCE_LABEL.remotive} (${q})`, () => searchRemotive(q)));
    tasks.push(track(SOURCE_LABEL.arbeitnow, fetchArbeitnow));
  }
  if (d.sources.includes('company_careers')) for (const e of d.employers.slice(0, 10)) tasks.push(track(`${e} careers`, () => fetchCompanyBoard(e)));
  await Promise.all(tasks);
  out.fetched = all.length;

  // Score, drop the irrelevant, and collapse repeats inside this batch (highest score wins).
  const scored = new Map<string, { job: Job; score: number; reasons: string[] }>();
  for (const job of all) {
    if (!job.company || !job.title) continue;
    const key = dedupeKey(job); const fit = scoreJob(job, profile, prefs);
    if (fit.score < FLOOR) continue;
    const prev = scored.get(key); if (prev) { out.duplicates++; if (prev.score >= fit.score) continue; }
    scored.set(key, { job, ...fit });
  }
  const top = Array.from(scored.entries()).sort((a, b) => b[1].score - a[1].score).slice(0, MAX_PER_RUN);

  const existing = await prisma.jobListing.findMany({ where: { userId, dedupeKey: { in: top.map(([k]) => k) } }, select: { id: true, dedupeKey: true, match: { select: { id: true, status: true } } } });
  const have = new Map(existing.map((e) => [e.dedupeKey, e]));
  for (const [key, { job, score, reasons }] of top) {
    const ex = have.get(key);
    if (ex) { out.duplicates++; if (ex.match && ex.match.status !== 'dismissed') await prisma.jobMatch.update({ where: { id: ex.match.id }, data: { score, reasons } }); continue; }
    try {
      await prisma.jobListing.create({ data: { userId, source: job.source, externalId: job.externalId, dedupeKey: key, title: job.title, company: job.company, location: job.location, remote: job.remote, url: job.url, description: job.description, postedAt: job.postedAt, match: { create: { userId, score, reasons } } } });
      out.added++;
    } catch { out.duplicates++; /* a parallel run stored it first */ }
  }
  out.matched = await prisma.jobMatch.count({ where: { userId, status: { not: 'dismissed' }, score: { gte: d.minScore } } });

  // Keep storage bounded: forget the oldest listings that were never saved.
  const total = await prisma.jobListing.count({ where: { userId } });
  if (total > MAX_LISTINGS) {
    const old = await prisma.jobListing.findMany({ where: { userId, OR: [{ match: null }, { match: { status: { not: 'saved' }, application: null } }] }, orderBy: { createdAt: 'asc' }, take: total - MAX_LISTINGS + 200, select: { id: true } });
    await prisma.jobListing.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  }

  const failed = out.sources.filter((s) => !s.ok);
  await logEvent(userId, 'job_discovery', 'discovery_run', `${out.fetched} jobs read from ${out.sources.filter((s) => s.ok).length} source(s); ${out.added} new, ${out.duplicates} repeats; ${out.matched} at or above ${d.minScore}%${out.noBoard.length ? `; no public job board found for ${out.noBoard.join(', ')}` : ''}${failed.length ? `; failed: ${failed.map((f) => f.name).join(', ')}` : ''}`, failed.length === 0 || out.added > 0);
  return out;
}
