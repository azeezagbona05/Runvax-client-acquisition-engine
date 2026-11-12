/**
 * Career Agent submission worker. Takes queued applications and submits them on the employer's own Greenhouse or Lever form, one at a time.
 * Needs Chromium, so it runs on a machine you control, NOT inside the web app.
 *
 *   CAREER_AUTOSUBMIT=1 npm run career:executor              # keep running
 *   CAREER_AUTOSUBMIT=1 npm run career:executor -- --once    # drain the queue once, then exit
 *
 * Safety: refuses to start unless CAREER_AUTOSUBMIT=1, and refuses a non-local database unless you pass --yes (the repo's .env points at production).
 */
import { claimNext, finishSubmission, submitEnabled } from '@/lib/career/submit/queue';
import { runExecutor } from '@/lib/career/submit/executor';
import { PLATFORM_LABEL } from '@/lib/career/submit/platform';

const args = process.argv.slice(2); const once = args.includes('--once');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MIN_GAP_MS = 20_000, MAX_GAP_MS = 45_000;          // be gentle: never fire applications back to back

async function main() {
  if (!submitEnabled()) { console.error('Automatic submitting is off. Set CAREER_AUTOSUBMIT=1 to run the worker.'); process.exit(1); }
  const host = (() => { try { return new URL(process.env.DATABASE_URL ?? '').hostname; } catch { return '(unknown)'; } })();
  console.log(`[career-executor] database host: ${host}`);
  if (!['127.0.0.1', 'localhost'].includes(host) && !args.includes('--yes')) { console.error('That is not a local database. Pass --yes to confirm you mean to submit real applications from it.'); process.exit(1); }
  for (;;) {
    const job = await claimNext();
    if (!job) { if (once) break; await sleep(15_000); continue; }
    const { submission: s, target } = job;
    console.log(`[career-executor] ${s.trigger === 'check' ? 'checking' : 'submitting'} ${job.label}${target ? ` on ${PLATFORM_LABEL[target.platform]}` : ''}`);
    const res = target
      ? await runExecutor({ applyUrl: target.applyUrl, platform: target.platform, cv: job.cv, coverLetter: job.coverLetter, answers: job.answers, standing: job.standing, mode: s.trigger === 'check' ? 'check' : 'submit' })
      : { status: 'failed' as const, reason: 'No supported application form for this job.', questions: [], steps: [], evidence: '', finalUrl: '' };
    await finishSubmission(s.id, res, job.label);
    console.log(`[career-executor]   -> ${res.status}: ${res.reason}`);
    if (s.trigger !== 'check') await sleep(MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS));
  }
  console.log('[career-executor] queue empty, done.');
}
main().then(() => process.exit(0)).catch((e) => { console.error('[career-executor] fatal:', e instanceof Error ? e.message : e); process.exit(1); });
