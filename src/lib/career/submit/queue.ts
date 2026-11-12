import { prisma } from '@/lib/prisma';
import { loadCareer, logEvent } from '@/lib/career/store';
import { prepareApplication } from '@/lib/career/apply/prepare';
import { sanitizeProfile, sanitizePreferences } from '@/lib/career/types';
import { targetFor, PLATFORM_LABEL, type Target } from './platform';
import type { ExecResult } from './executor';

/**
 * The submission queue. The web app only QUEUES (and reads results); a separate worker process with Chromium does the submitting.
 * Everything here is scoped to one user, and every refusal is a plain sentence the page can show.
 */
export const submitEnabled = () => process.env.CAREER_AUTOSUBMIT === '1';
export const OFF_MESSAGE = 'Automatic submitting is switched off on this server. You can still apply yourself with the prepared CV and letter.';
const DAY = 86_400_000;
export const DAILY_CAP = 15;          // hard ceiling per user per day, whatever the settings say
const MAX_ATTEMPTS = 3;
const STALE_MS = 10 * 60_000;

export type Trigger = 'user' | 'rules' | 'check';
export interface QueueResult { applicationId: string; ok: boolean; error?: string; submissionId?: string }

export async function queueSubmissions(userId: string, applicationIds: string[], trigger: Trigger): Promise<QueueResult[]> {
  const out: QueueResult[] = [];
  const fail = (applicationId: string, error: string) => out.push({ applicationId, ok: false, error });
  if (!submitEnabled()) return applicationIds.map((applicationId) => ({ applicationId, ok: false, error: OFF_MESSAGE }));
  const c = await loadCareer(userId);
  if (c.status !== 'active') return applicationIds.map((a) => ({ applicationId: a, ok: false, error: c.status === 'paused' ? 'The agent is paused. Resume it first.' : 'Deploy your Career Agent first.' }));
  if (!c.profileConfirmed) return applicationIds.map((a) => ({ applicationId: a, ok: false, error: 'Confirm your profile first.' }));
  if (trigger === 'user' && c.permissions.mode === 'prepare') return applicationIds.map((a) => ({ applicationId: a, ok: false, error: 'Your permission is "Prepare applications only". Change it to "Submit after batch approval" in Edit setup (step 4) to let the agent submit.' }));

  const since = new Date(Date.now() - DAY);
  let today = await prisma.applicationSubmission.count({ where: { userId, trigger: { not: 'check' }, createdAt: { gte: since } } });
  let todayRules = await prisma.applicationSubmission.count({ where: { userId, trigger: 'rules', createdAt: { gte: since } } });

  for (const id of Array.from(new Set(applicationIds)).slice(0, 20)) {
    const a = await prisma.jobApplication.findFirst({ where: { id, userId }, include: { match: { include: { listing: true } }, submissions: { select: { status: true, attempts: true } } } });
    if (!a) { fail(id, 'Application not found.'); continue; }
    const label = `${a.match.listing.title} at ${a.match.listing.company}`;
    if (a.status === 'applied') { fail(id, `${label}: already ${a.appliedBy === 'agent' ? 'submitted by the agent' : 'marked as applied'}.`); continue; }
    if (trigger === 'check' ? !['prepared', 'approved'].includes(a.status) : a.status !== 'approved') { fail(id, trigger === 'check' ? `${label}: only prepared or approved applications can be checked.` : `${label}: approve it first. The agent only submits what you approved.`); continue; }
    const t: Target | null = targetFor(a.match.listing);
    if (!t) { fail(id, `${label}: no supported application form. The agent only submits on Greenhouse and Lever hosted forms. Use the posting link.`); continue; }
    if (a.submissions.some((s) => s.status === 'queued' || s.status === 'running')) { fail(id, `${label}: already waiting to be submitted.`); continue; }
    if (trigger !== 'check') {
      if (a.submissions.some((s) => s.status === 'submitted')) { fail(id, `${label}: already submitted.`); continue; }
      if (a.submissions.some((s) => s.status === 'unconfirmed')) { fail(id, `${label}: An earlier attempt could not be confirmed and may have gone through. Check your email, then mark it applied yourself if it did.`); continue; }
      if (a.submissions.filter((s) => s.attempts > 0).length >= MAX_ATTEMPTS) { fail(id, `${label}: tried ${MAX_ATTEMPTS} times already. Apply yourself using the posting link.`); continue; }
      if (today >= DAILY_CAP) { fail(id, `The daily limit of ${DAILY_CAP} submissions was reached. Try again tomorrow.`); continue; }
      if (trigger === 'rules') {
        if (todayRules >= c.permissions.autoMaxPerDay) { fail(id, 'Your automatic daily limit was reached.'); continue; }
        if (c.permissions.autoBlockedEmployers.some((e) => a.match.listing.company.toLowerCase().includes(e.toLowerCase()))) { fail(id, `${label}: this employer is on your never-auto-apply list.`); continue; }
        if (a.match.score < c.permissions.autoMinScore) { fail(id, `${label}: below your automatic minimum score.`); continue; }
      }
    }
    const s = await prisma.applicationSubmission.create({ data: { userId, applicationId: id, platform: t.platform, trigger } });
    if (trigger !== 'check') { today++; if (trigger === 'rules') todayRules++; }
    await logEvent(userId, 'application_executor', trigger === 'check' ? 'form_check_queued' : 'submission_queued', `${label} on ${PLATFORM_LABEL[t.platform]} (${trigger === 'rules' ? 'by your automatic rules' : trigger === 'user' ? 'you asked' : 'dry run'})`);
    out.push({ applicationId: id, ok: true, submissionId: s.id });
  }
  return out;
}

/** The worker takes the oldest queued job. updateMany is the lock: two workers can never both start the same one. */
export async function claimNext() {
  await reapStale();
  let claimed: string | null = null;
  for (let i = 0; i < 5 && !claimed; i++) {                                   // a worker that loses the race simply takes the next job
    const next = await prisma.applicationSubmission.findFirst({ where: { status: 'queued' }, orderBy: { createdAt: 'asc' }, select: { id: true } });
    if (!next) return null;
    const got = await prisma.applicationSubmission.updateMany({ where: { id: next.id, status: 'queued' }, data: { status: 'running', startedAt: new Date(), attempts: { increment: 1 } } });
    if (got.count === 1) claimed = next.id;
  }
  if (!claimed) return null;
  const s = await prisma.applicationSubmission.findUnique({ where: { id: claimed }, include: { application: { include: { match: { include: { listing: true } } } } } });
  if (!s) return null;
  const target = targetFor(s.application.match.listing);                       // recomputed, never trusted from storage
  const pref = await prisma.careerPreference.findUnique({ where: { userId: s.userId }, select: { preferences: true } });
  return { submission: s, target, standing: sanitizePreferences(pref?.preferences).standing, cv: sanitizeProfile(s.application.cv), coverLetter: s.application.coverLetter, answers: s.application.answers as Array<{ question: string; answer: string }>, label: `${s.application.match.listing.title} at ${s.application.match.listing.company}` };
}

/** A worker that died mid-run may have pressed submit, so the honest state is "unconfirmed", never "queued again". */
export async function reapStale() {
  const stale = await prisma.applicationSubmission.findMany({ where: { status: 'running', startedAt: { lt: new Date(Date.now() - STALE_MS) } }, select: { id: true, userId: true } });
  for (const s of stale) {
    await prisma.applicationSubmission.update({ where: { id: s.id }, data: { status: 'unconfirmed', finishedAt: new Date(), reason: 'The worker stopped while this was running. It may or may not have gone through. Check your email before applying again. It will not be retried.' } });
    await logEvent(s.userId, 'application_executor', 'submission_unconfirmed', 'The worker stopped mid-run', false);
  }
}

const STORED: Record<ExecResult['status'], string> = { checked: 'checked', submitted: 'submitted', needs_you: 'needs_you', unconfirmed: 'unconfirmed', failed: 'failed' };
export async function finishSubmission(id: string, res: ExecResult, label: string) {
  const s = await prisma.applicationSubmission.findUnique({ where: { id }, select: { userId: true, applicationId: true } }); if (!s) return;
  await prisma.applicationSubmission.update({ where: { id }, data: { status: STORED[res.status], reason: res.reason.slice(0, 600), questions: res.questions as object, steps: res.steps as object, evidence: res.evidence.slice(0, 600), finalUrl: res.finalUrl.slice(0, 600), finishedAt: new Date() } });
  if (res.status === 'submitted') await prisma.jobApplication.updateMany({ where: { id: s.applicationId, userId: s.userId, status: { in: ['approved', 'prepared'] } }, data: { status: 'applied', appliedAt: new Date(), appliedBy: 'agent' } });
  const action = { checked: 'form_checked', submitted: 'application_submitted', needs_you: 'submission_needs_you', unconfirmed: 'submission_unconfirmed', failed: 'submission_failed' }[res.status];
  await logEvent(s.userId, 'application_executor', action, `${label}: ${res.reason}`, res.status === 'submitted' || res.status === 'checked' || res.status === 'needs_you');
}

export async function cancelQueued(userId: string, id?: string): Promise<number> {
  const r = await prisma.applicationSubmission.updateMany({ where: { userId, status: 'queued', ...(id ? { id } : {}) }, data: { status: 'cancelled', finishedAt: new Date(), reason: 'Cancelled before it started.' } });
  if (r.count) await logEvent(userId, 'application_executor', 'submission_cancelled', `${r.count} queued submission(s) cancelled`);
  return r.count;
}

/** When the candidate changes their mind about one application (applied themselves, rejected, re-opened), a waiting submission must not go out. */
export async function cancelQueuedFor(userId: string, applicationId: string): Promise<number> {
  const r = await prisma.applicationSubmission.updateMany({ where: { userId, applicationId, status: 'queued' }, data: { status: 'cancelled', finishedAt: new Date(), reason: 'You changed this application before it was sent.' } });
  if (r.count) await logEvent(userId, 'application_executor', 'submission_cancelled', 'Cancelled because you changed the application first');
  return r.count;
}

/**
 * Automatic mode, inside the candidate's own rules: for strong matches on supported forms, prepare, approve and queue a few per run.
 * The rules are the candidate's approval; a daily cap, a minimum score and a never-apply list all apply (see queueSubmissions).
 */
export async function autoSubmitFor(userId: string): Promise<{ prepared: number; queued: number }> {
  const out = { prepared: 0, queued: 0 };
  if (!submitEnabled()) return out;
  const c = await loadCareer(userId);
  if (c.status !== 'active' || !c.profileConfirmed || c.permissions.mode !== 'auto') return out;
  const todayRules = await prisma.applicationSubmission.count({ where: { userId, trigger: 'rules', createdAt: { gte: new Date(Date.now() - DAY) } } });
  const room = Math.min(3, c.permissions.autoMaxPerDay - todayRules); if (room <= 0) return out;
  const cands = await prisma.jobMatch.findMany({ where: { userId, status: { not: 'dismissed' }, score: { gte: c.permissions.autoMinScore }, application: null }, orderBy: { score: 'desc' }, take: 25, include: { listing: true } });
  for (const m of cands) {
    if (out.queued >= room) break;
    if (!targetFor(m.listing)) continue;
    if (c.permissions.autoBlockedEmployers.some((e) => m.listing.company.toLowerCase().includes(e.toLowerCase()))) continue;
    const p = await prepareApplication(userId, m.id); if (!p.ok) continue;
    out.prepared++;
    await prisma.jobApplication.update({ where: { id: p.applicationId }, data: { status: 'approved', approvedAt: new Date() } });
    await logEvent(userId, 'orchestrator', 'application_auto_approved', `${m.listing.title} at ${m.listing.company} (${m.score}% match, within your automatic rules)`);
    const q = await queueSubmissions(userId, [p.applicationId], 'rules'); if (q[0]?.ok) out.queued++;
  }
  return out;
}
