/**
 * The RUNVAX email engine (src/lib/emailEngine, plain JS) as the app uses it: typed, fetching through safeFetch,
 * mailbox (SMTP) checks off. Every check here is DNS-level only: nothing is sent and no mailbox is probed.
 */
import { safeFetch } from '@/lib/safeFetch';
import { findEmails as engineFindJs } from '@/lib/emailEngine/engine.js';
import { normalizeDomain } from '@/lib/emailEngine/shared/normalize.js';
import { createVerifier } from '@/lib/emailEngine/email_verification/verify.js';

type Verification = { status: string; confidence: number; reasons: string[] };
export type EngineEmail = { email: string; onSiteDomain?: boolean; sources: Array<{ url: string; method: string }>; verification: Verification };
type EngineCandidate = { email: string; provenance: string; basis?: string; verification?: Verification; sources?: Array<{ url: string }> };
export type EnginePerson = { name: string; title?: string; sourceUrl?: string; decisionMaker?: boolean; candidates?: EngineCandidate[] };
type EngineResult = { discovered: EngineEmail[]; peopleCandidates?: EnginePerson[] };

export const engineFind = engineFindJs as unknown as (o: Record<string, unknown>) => Promise<EngineResult>;
export const engineDomain = normalizeDomain as unknown as (s: string) => string | null;
export const ENGINE_UA = 'RunvaxEmailBot/1.0 (+https://runvax.com; respects robots.txt)';

export async function engineFetch(url: string) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 7000);
  try {
    const res = await safeFetch(url, { signal: ctl.signal, headers: { 'user-agent': ENGINE_UA, accept: 'text/html,*/*;q=0.5' } });
    return { ok: res.ok, status: res.status, text: (await res.text()).slice(0, 1_000_000), contentType: res.headers.get('content-type') || '' };
  } finally { clearTimeout(t); }
}

/** Runs the engine on one site, giving up after `ms` so one slow site never holds a request. */
export async function runEngine(website: string, opts: { peopleGuesses?: number; ms?: number } = {}): Promise<EngineResult | null> {
  const domain = engineDomain(website);
  if (!domain) return null;
  const guesses = opts.peopleGuesses ?? 0;
  const run = engineFind({ domain, name: null, smtp: false, verifyCandidates: guesses > 0, maxPeopleGuesses: guesses, crawlOptions: { fetchImpl: engineFetch, maxPages: 5, delayMs: 300, ua: ENGINE_UA } });
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), opts.ms ?? 25_000));
  return Promise.race([run.catch(() => null), timeout]);
}

const verifier = createVerifier() as unknown as { verify: (email: string, ctx: { discovered: boolean }) => Promise<Verification> };

/** The status badge for one address (DNS-level check). `discovered` = seen published, not guessed. */
export async function emailStatusOf(email: string, discovered: boolean): Promise<{ status: string; statusNote?: string }> {
  try { const v = await verifier.verify(email, { discovered }); return { status: v.status, statusNote: v.reasons[v.reasons.length - 1] }; }
  catch { return { status: 'UNKNOWN' }; }
}
