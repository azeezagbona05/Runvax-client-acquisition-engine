import { prisma } from '@/lib/prisma';
import { loadCareer, logEvent } from '@/lib/career/store';
import { ground } from '@/lib/career/parse';
import { profileText, tailor, type Tailored } from '@/lib/career/tailor';
import { sanitizeProfile, type CareerProfileData } from '@/lib/career/types';

/**
 * Prepare one application: a tailored CV, a cover letter and answers for one matched job.
 * The tailored CV is the confirmed profile re-ordered and re-summarised for the job. It can only contain what the profile contains:
 * after it is built, `ground` checks every employer, title, skill, number and bullet against the profile text again.
 */
const words = (t: string) => new Set(t.toLowerCase().match(/[a-z][a-z0-9+#.]{2,}/g) ?? []);

export function buildTailoredCv(profile: CareerProfileData, t: Pick<Tailored, 'summary' | 'matchedSkills'>, jobText: string): { cv: CareerProfileData; dropped: string[] } {
  const jw = words(jobText); const rel = (s: string) => Array.from(words(s)).filter((w) => jw.has(w)).length;
  const matched = new Set(t.matchedSkills.map((s) => s.toLowerCase()));
  const draft: CareerProfileData = {
    ...profile,
    summary: t.summary || profile.summary,
    skills: [...profile.skills.filter((s) => matched.has(s.toLowerCase()) || rel(s) > 0), ...profile.skills.filter((s) => !(matched.has(s.toLowerCase()) || rel(s) > 0))],
    experience: profile.experience.map((r) => ({ ...r, bullets: r.bullets.map((b, i) => ({ b, i, s: rel(b) })).sort((a, b) => b.s - a.s || a.i - b.i).slice(0, 5).map((x) => x.b) })),
  };
  // Re-verify against the profile itself. A summary that cannot be backed falls back to the candidate's own.
  const g = ground(sanitizeProfile(draft), profileText(profile));
  if (!g.profile.summary) g.profile.summary = profile.summary;
  return { cv: g.profile, dropped: g.removed };
}

export type PrepareOutcome = { ok: true; applicationId: string; reused: boolean } | { ok: false; error: string };

export async function prepareApplication(userId: string, matchId: string): Promise<PrepareOutcome> {
  const c = await loadCareer(userId);
  if (!c.profile || !c.profileConfirmed) return { ok: false, error: 'Confirm your profile first. Applications are only written from a confirmed profile.' };
  const m = await prisma.jobMatch.findFirst({ where: { id: matchId, userId }, include: { listing: true, application: { select: { id: true, status: true } } } });
  if (!m) return { ok: false, error: 'Job not found.' };
  if (m.application && m.application.status !== 'rejected') return { ok: true, applicationId: m.application.id, reused: true };

  const jobText = `${m.listing.title} at ${m.listing.company}\n${m.listing.location}\n${m.listing.description}`;
  const p = c.preferences;
  const t = await tailor(c.profile, jobText, m.listing.title, p.salaryMin ? `${p.currency} ${p.salaryMin}${p.salaryMax ? `-${p.salaryMax}` : '+'}` : 'no figure given');
  const { cv, dropped } = buildTailoredCv(c.profile, t, jobText);
  const flags = [...t.flags, ...dropped.map((d) => `Left out of the tailored CV (not in your profile): ${d}`)];
  const data = { status: 'prepared', cv: cv as object, coverLetter: t.coverLetter, answers: t.answers as object, gaps: t.gaps as object, flags: flags as object, source: t.source, edited: false, approvedAt: null, appliedAt: null, appliedBy: null };
  const app = m.application ? await prisma.jobApplication.update({ where: { id: m.application.id }, data }) : await prisma.jobApplication.create({ data: { ...data, userId, matchId } });
  await logEvent(userId, 'application_writer', 'application_prepared', `${m.listing.title} at ${m.listing.company}: tailored CV, cover letter and ${t.answers.length} answer(s) (${t.source === 'ai' ? 'AI' : 'basic'} writer)${t.gaps.length ? `; ${t.gaps.length} requirement(s) not in your profile` : ''}${flags.length ? `; ${flags.length} claim(s) removed by the accuracy check` : ''}`);
  return { ok: true, applicationId: app.id, reused: false };
}
