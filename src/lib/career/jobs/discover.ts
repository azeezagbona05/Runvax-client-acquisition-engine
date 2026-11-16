import { prisma } from '@/lib/prisma';
import { loadCareer, logEvent } from '@/lib/career/store';
import { dedupeKey, fetchArbeitnow, fetchCompanyBoard, searchHimalayas, SOURCE_LABEL, type Job } from './sources';
import { EMPLOYER_TTL_DAYS, findEmployers, whereFor } from './employers';
import { isEuropeanCountry, scoreJob } from './match';
import { placeFromLocation } from '@/lib/career/suggest';

/** Below this a job is not a real match. It is still SAVED (the person can browse everything found); only its long description is trimmed. */
export const FLOOR = 35;
export const MAX_LISTINGS = 3000;
const SHORT_DESCRIPTION = 700;
const DAY = 86_400_000;

export interface DiscoveryResult { fetched: number; added: number; duplicates: number; saved: number; relevant: number; matched: number; sources: Array<{ name: string; ok: boolean; count: number; error?: string }>; noBoard: string[]; notes: string[]; skipped?: string }

/** What to search for: the job title without its department or brackets ("Staff Nurse - Intensive Care Unit" -> "Staff Nurse"). */
export const searchWords = (t: string) => t.split(/\s+[-–—|]\s+|\s*\(/)[0].replace(/\s+/g, ' ').trim();

const chunks = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/**
 * One search for one user: read the chosen sources, drop repeats, score EVERY job against the confirmed profile, and save all of them.
 * (It used to keep only the best 150 above a relevance floor, so the person could not see what was found.) Writes are batched: a search reads
 * hundreds of jobs and one row at a time over a remote database timed out.
 */
export async function runDiscovery(userId: string): Promise<DiscoveryResult> {
  const c = await loadCareer(userId);
  const out: DiscoveryResult = { fetched: 0, added: 0, duplicates: 0, saved: 0, relevant: 0, matched: 0, sources: [], noBoard: [], notes: [] };
  if (!c.profile || !c.profileConfirmed) return { ...out, skipped: 'Confirm your profile first. The agent only searches on behalf of a verified profile.' };
  const { discovery: d, preferences: prefs, profile } = c;
  const country = prefs.country || placeFromLocation(profile.location).country;

  const all: Job[] = [];
  const track = async (name: string, f: () => Promise<Job[] | null>) => {
    try { const j = await f(); if (j === null) out.noBoard.push(name); else { all.push(...j); out.sources.push({ name, ok: true, count: j.length }); } }
    catch (e) { out.sources.push({ name, ok: false, count: 0, error: e instanceof Error ? e.message.slice(0, 120) : 'failed' }); }
  };
  const tasks: Array<Promise<void>> = [];
  if (d.sources.includes('job_feeds')) {
    const titles = Array.from(new Set((prefs.titles.length ? prefs.titles : [profile.experience[0]?.title ?? '']).map(searchWords).filter(Boolean))).slice(0, 2);
    for (const t of titles) tasks.push(track(`${SOURCE_LABEL.himalayas} (${t})`, () => searchHimalayas(t)));
    if (!country || isEuropeanCountry(country)) tasks.push(track(SOURCE_LABEL.arbeitnow, fetchArbeitnow)); else out.notes.push('Arbeitnow (mostly German jobs) was skipped because it does not fit where you are.');
  }
  if (d.sources.includes('company_careers')) for (const e of d.employers.slice(0, 10)) tasks.push(track(`${e} careers`, () => fetchCompanyBoard(e)));
  if (d.sources.includes('employers')) {
    const recent = await prisma.jobListing.count({ where: { userId, source: 'places', createdAt: { gte: new Date(Date.now() - 7 * DAY) } } });
    if (!whereFor(prefs, profile)) out.notes.push('Employers near you needs your city and country. Add them in your setup (step 2).');
    else if (recent > 0) out.notes.push('Employers near you were refreshed in the last week, so they were not searched again.');
    else tasks.push(track('Employers near you (Google Maps)', () => findEmployers(prefs, profile)));
  }
  await Promise.all(tasks);
  out.fetched = all.length;

  // Score every job. A job found twice in this batch is kept once, with the better score.
  const scored = new Map<string, { job: Job; score: number; reasons: string[] }>();
  const mine = profile.experience.map((r) => r.company.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()).filter((c) => c.length > 2);
  for (const job of all) {
    if (!job.company || !job.title) continue;
    // Do not suggest an open application to the organisation the person already works (or worked) for.
    const co = job.company.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (job.source === 'places' && mine.some((m) => co.includes(m) || m.includes(co))) continue;
    const key = dedupeKey(job); const fit = scoreJob(job, profile, prefs);
    const reasons = job.source === 'places' ? ['Employer near you. No vacancy is listed: send an open application.', ...fit.reasons] : fit.reasons;
    const score = Math.min(100, fit.score + (job.rank ?? 0));
    const prev = scored.get(key); if (prev) { out.duplicates++; if (prev.score >= score) continue; }
    scored.set(key, { job, score, reasons });
  }
  const rows = Array.from(scored.entries());
  out.relevant = rows.filter(([, v]) => v.score >= FLOOR).length;

  // Which are already saved?
  const have = new Map<string, { id: string; match: { id: string; status: string; score: number } | null }>();
  for (const part of chunks(rows.map(([k]) => k), 400)) {
    for (const e of await prisma.jobListing.findMany({ where: { userId, dedupeKey: { in: part } }, select: { id: true, dedupeKey: true, match: { select: { id: true, status: true, score: true } } } })) have.set(e.dedupeKey, e);
  }
  const fresh = rows.filter(([k]) => !have.has(k));
  out.duplicates += rows.length - fresh.length;

  // New jobs: listings first, then their match rows, in batches.
  for (const part of chunks(fresh, 100)) {
    await prisma.jobListing.createMany({ skipDuplicates: true, data: part.map(([key, { job, score }]) => ({ userId, source: job.source, externalId: job.externalId, dedupeKey: key, title: job.title, company: job.company, location: job.location, remote: job.remote, url: job.url, description: score >= FLOOR ? job.description : job.description.slice(0, SHORT_DESCRIPTION), postedAt: job.postedAt })) });
  }
  const ids = new Map<string, string>();
  for (const part of chunks(fresh.map(([k]) => k), 400)) for (const l of await prisma.jobListing.findMany({ where: { userId, dedupeKey: { in: part } }, select: { id: true, dedupeKey: true } })) ids.set(l.dedupeKey, l.id);
  for (const part of chunks(fresh, 200)) {
    const data = part.flatMap(([k, v]) => (ids.has(k) ? [{ userId, listingId: ids.get(k)!, score: v.score, reasons: v.reasons }] : []));
    if (data.length) await prisma.jobMatch.createMany({ data, skipDuplicates: true });
  }
  out.added = ids.size;

  // Jobs already saved: refresh the score only where it changed (the profile or preferences may have), never for ones the person dismissed.
  const changed = rows.filter(([k, v]) => { const e = have.get(k); return e?.match && e.match.status !== 'dismissed' && e.match.score !== v.score; }).slice(0, 400);
  for (const part of chunks(changed, 25)) await Promise.all(part.map(([k, v]) => prisma.jobMatch.update({ where: { id: have.get(k)!.match!.id }, data: { score: v.score, reasons: v.reasons } })));

  out.saved = await prisma.jobListing.count({ where: { userId } });
  out.matched = await prisma.jobMatch.count({ where: { userId, status: { not: 'dismissed' }, score: { gte: d.minScore } } });

  // Keep storage bounded. Google Maps employers go after 30 days (Google's terms); then the oldest jobs that were never saved or applied to.
  await prisma.jobListing.deleteMany({ where: { userId, source: 'places', createdAt: { lt: new Date(Date.now() - EMPLOYER_TTL_DAYS * DAY) }, OR: [{ match: null }, { match: { status: { not: 'saved' }, application: null } }] } });
  const total = await prisma.jobListing.count({ where: { userId } });
  if (total > MAX_LISTINGS) {
    const old = await prisma.jobListing.findMany({ where: { userId, OR: [{ match: null }, { match: { status: { not: 'saved' }, application: null } }] }, orderBy: { createdAt: 'asc' }, take: total - MAX_LISTINGS + 200, select: { id: true } });
    await prisma.jobListing.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  }

  const failed = out.sources.filter((s) => !s.ok);
  await logEvent(userId, 'job_discovery', 'discovery_run', `${out.fetched} jobs read from ${out.sources.filter((s) => s.ok).length} source(s); all saved (${out.added} new, ${out.duplicates} already known); ${out.relevant} relevant, ${out.matched} at or above ${d.minScore}%${out.noBoard.length ? `; no public job board found for ${out.noBoard.join(', ')}` : ''}${failed.length ? `; failed: ${failed.map((f) => f.name).join(', ')}` : ''}`, failed.length === 0 || out.added > 0);
  return out;
}
