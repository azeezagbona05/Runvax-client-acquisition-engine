/**
 * Snov.io: an optional paid source for the email address of a named person at a
 * business's own domain, plus an email verifier. It never replaces the existing
 * sources and only runs when SNOV_CLIENT_ID and SNOV_CLIENT_SECRET are both set.
 *
 * Snov's v2 methods are asynchronous: a "start" call returns a task hash and a
 * "result" call is polled until it reports `completed`. Endpoints and response
 * shapes follow https://snov.io/api as last read (2026-11): confirm against the
 * docs before relying on edge cases. The API is limited to 60 requests/minute.
 *
 * Credits: Email Finder charges 1 credit per email found with a valid or unknown
 * status. Nothing here is called unless a user asks for a deeper search.
 */

const BASE = 'https://api.snov.io';
const TIMEOUT_MS = 8000;

export interface SnovOpts {
  /** Result polls before giving up (default 8). */
  tries?: number;
  /** Wait between polls in ms (default 1200). Tests pass 0. */
  pollMs?: number;
}

export type SmtpStatus = 'valid' | 'not_valid' | 'unknown';

export interface SnovEmail {
  email: string;
  smtpStatus: SmtpStatus;
  disposable: boolean;
  webmail: boolean;
  /** Why Snov could not decide, when smtpStatus is "unknown". */
  reason?: string;
}

export function snovEnabled(): boolean {
  return !!process.env.SNOV_CLIENT_ID?.trim() && !!process.env.SNOV_CLIENT_SECRET?.trim();
}

let cached: { token: string; expires: number } | null = null;

/** Test hook: forget the cached access token. */
export function resetSnovToken(): void { cached = null; }

async function accessToken(): Promise<string> {
  if (cached && cached.expires > Date.now() + 30_000) return cached.token;
  const res = await fetch(`${BASE}/v1/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: process.env.SNOV_CLIENT_ID, client_secret: process.env.SNOV_CLIENT_SECRET }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Snov.io sign-in failed (${res.status}). Check SNOV_CLIENT_ID and SNOV_CLIENT_SECRET.`);
  const json = await res.json() as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error('Snov.io sign-in returned no token.');
  cached = { token: json.access_token, expires: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cached.token;
}

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, retried = false): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  // An expired token is the one error worth a single retry.
  if (res.status === 401 && !retried) { cached = null; return call<T>(method, path, body, true); }
  if (!res.ok) throw new Error(`Snov.io ${res.status}`);
  return res.json() as Promise<T>;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface Polled { status?: string }

async function poll<T extends Polled>(path: string, { tries = 8, pollMs = 1200 }: SnovOpts): Promise<T | null> {
  for (let i = 0; i < tries; i++) {
    const r = await call<T>('GET', path);
    if (r.status === 'completed') return r;
    if (r.status === 'not_enough_credits') throw new Error('Snov.io: not enough credits.');
    if (pollMs > 0) await sleep(pollMs);
  }
  return null;
}

interface RawEmail {
  email?: string; smtp_status?: string; is_disposable?: boolean; is_webmail?: boolean; is_gibberish?: boolean; unknown_status_reason?: string;
}

function toEmail(r: RawEmail | undefined): SnovEmail | null {
  if (!r?.email) return null;
  const smtp = r.smtp_status === 'valid' || r.smtp_status === 'not_valid' ? r.smtp_status : 'unknown';
  return { email: r.email.toLowerCase(), smtpStatus: smtp, disposable: !!r.is_disposable, webmail: !!r.is_webmail, reason: r.unknown_status_reason };
}

/** "Dr. Ada Okafor" → ["Ada", "Okafor"]. Needs a first and last name. */
export function splitName(full: string): [string, string] | null {
  const parts = full.replace(/^(dr|mr|mrs|ms|miss|prof|engr|barr)\.?\s+/i, '').trim().split(/\s+/);
  return parts.length < 2 ? null : [parts[0], parts[parts.length - 1]];
}

/**
 * The email address of one named person at a domain, or null when Snov has none.
 * An address Snov marks `not_valid` is treated as not found.
 */
export async function findEmail(domain: string, fullName: string, opts: SnovOpts = {}): Promise<SnovEmail | null> {
  const name = splitName(fullName);
  if (!name || !domain) return null;
  const start = await call<{ data?: { task_hash?: string } }>('POST', '/v2/emails-by-domain-by-name/start', {
    rows: [{ first_name: name[0], last_name: name[1], domain }],
  });
  const hash = start.data?.task_hash;
  if (!hash) return null;
  const done = await poll<{ status?: string; data?: Array<{ result?: RawEmail[] }> }>(`/v2/emails-by-domain-by-name/result?task_hash=${encodeURIComponent(hash)}`, opts);
  const found = (done?.data?.[0]?.result ?? []).map(toEmail).find((e): e is SnovEmail => !!e && e.smtpStatus !== 'not_valid');
  return found ?? null;
}

/** Check one address. Returns null if Snov did not answer in time. */
export async function verifyEmail(email: string, opts: SnovOpts = {}): Promise<SnovEmail | null> {
  const start = await call<{ data?: { task_hash?: string } }>('POST', '/v2/email-verification/start', { emails: [email] });
  const hash = start.data?.task_hash;
  if (!hash) return null;
  const done = await poll<{ status?: string; data?: Array<{ email?: string; result?: RawEmail }> }>(`/v2/email-verification/result?task_hash=${encodeURIComponent(hash)}`, opts);
  const row = done?.data?.[0];
  return toEmail(row ? { ...row.result, email: row.result?.email ?? row.email } : undefined);
}
