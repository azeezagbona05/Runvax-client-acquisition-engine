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

import { keyStore } from '@/lib/integrations/keys';
import { splitName } from '@/lib/personName';

const BASE = 'https://api.snov.io';

const snovCreds = (): { id: string; secret: string } => keyStore.getStore()?.snov ?? { id: process.env.SNOV_CLIENT_ID?.trim() ?? '', secret: process.env.SNOV_CLIENT_SECRET?.trim() ?? '' };
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
  const c = snovCreds();
  return !!c.id && !!c.secret;
}

let cached: { token: string; expires: number; id: string } | null = null;

/** Test hook: forget the cached access token. */
export function resetSnovToken(): void { cached = null; }

async function accessToken(): Promise<string> {
  const creds = snovCreds();
  if (cached && cached.id === creds.id && cached.expires > Date.now() + 30_000) return cached.token;
  const res = await fetch(`${BASE}/v1/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', client_id: creds.id, client_secret: creds.secret }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Snov.io sign-in failed (${res.status}). Check SNOV_CLIENT_ID and SNOV_CLIENT_SECRET.`);
  const json = await res.json() as { access_token?: string; expires_in?: number };
  if (!json.access_token) throw new Error('The email service sign-in returned no token.');
  cached = { token: json.access_token, expires: Date.now() + (json.expires_in ?? 3600) * 1000, id: creds.id };
  return cached.token;
}

// Snov allows 60 requests a minute; keep at least this long between calls so a long bulk run never trips it.
let gapMs = 1000;
let lastCall = 0;
/** Test hook: change the spacing between calls (0 disables it). */
export function setSnovGap(ms: number): void { gapMs = ms; lastCall = 0; }

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, retried = false): Promise<T> {
  if (gapMs > 0) {
    const wait = lastCall + gapMs - Date.now();
    lastCall = Date.now() + Math.max(0, wait);
    if (wait > 0) await new Promise<void>((r) => setTimeout(r, wait));
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  // An expired token is the one error worth a single retry.
  if (res.status === 401 && !retried) { cached = null; return call<T>(method, path, body, true); }
  if (!res.ok) throw new SnovHttpError(res.status, await res.json().catch(() => null));
  return res.json() as Promise<T>;
}

/** A Snov.io HTTP error, keeping the status and body so callers can show Snov's own suggestions. */
export class SnovHttpError extends Error {
  constructor(public status: number, public body: unknown) { super(`Email service ${status}`); Object.setPrototypeOf(this, new.target.prototype); }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface Polled { status?: string }

async function poll<T extends Polled>(path: string, { tries = 8, pollMs = 1200 }: SnovOpts): Promise<T | null> {
  for (let i = 0; i < tries; i++) {
    const r = await call<T>('GET', path);
    if (r.status === 'completed') return r;
    if (r.status === 'not_enough_credits') throw new Error('Not enough credits.');
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
export { splitName };

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

// ── Bulk ─────────────────────────────────────────────────────────────────────

/** Snov accepts at most 10 emails (verifier) or 10 rows (finder) per request. */
const CHUNK = 10;
const chunks = <T,>(xs: T[]): T[][] => { const out: T[][] = []; for (let i = 0; i < xs.length; i += CHUNK) out.push(xs.slice(i, i + CHUNK)); return out; };

/**
 * Check many addresses at once, 10 per request. Returns a map keyed by lowercase address.
 * An address Snov did not answer for is simply absent. Stops early (keeping what it has) if credits run out.
 * `onProgress` lets a caller report how far along a long list is.
 */
export async function verifyEmails(emails: string[], opts: SnovOpts & { onProgress?: (done: number, total: number) => void } = {}): Promise<Map<string, SnovEmail>> {
  const out = new Map<string, SnovEmail>();
  const unique = Array.from(new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)));
  let done = 0;
  for (const group of chunks(unique)) {
    try {
      const start = await call<{ data?: { task_hash?: string } }>('POST', '/v2/email-verification/start', { emails: group });
      const hash = start.data?.task_hash;
      const res = hash ? await poll<{ status?: string; data?: Array<{ email?: string; result?: RawEmail }> }>(`/v2/email-verification/result?task_hash=${encodeURIComponent(hash)}`, opts) : null;
      for (const row of res?.data ?? []) {
        const e = toEmail(row.result || row.email ? { ...row.result, email: row.result?.email ?? row.email } : undefined);
        if (e) out.set(e.email, e);
      }
    } catch (err) {
      if (err instanceof Error && /not enough credits/i.test(err.message)) break;
      // Any other failure on one group: leave those addresses unchecked and carry on.
    }
    done += group.length;
    opts.onProgress?.(done, unique.length);
  }
  return out;
}

export interface FindRow { domain: string; fullName: string }

/** Find the email of many named people at their domains, 10 per request. Keyed by `${domain}|${full name}` lowercase. */
export async function findEmails(rows: FindRow[], opts: SnovOpts = {}): Promise<Map<string, SnovEmail>> {
  const out = new Map<string, SnovEmail>();
  const usable = rows.map((r) => ({ r, n: splitName(r.fullName) })).filter((x): x is { r: FindRow; n: [string, string] } => !!x.n && !!x.r.domain);
  for (const group of chunks(usable)) {
    try {
      const start = await call<{ data?: { task_hash?: string } }>('POST', '/v2/emails-by-domain-by-name/start', {
        rows: group.map(({ r, n }) => ({ first_name: n[0], last_name: n[1], domain: r.domain })),
      });
      const hash = start.data?.task_hash;
      const done = hash ? await poll<{ status?: string; data?: Array<{ result?: RawEmail[] }> }>(`/v2/emails-by-domain-by-name/result?task_hash=${encodeURIComponent(hash)}`, opts) : null;
      // Results come back in the order the rows were sent.
      group.forEach(({ r }, i) => {
        const found = (done?.data?.[i]?.result ?? []).map(toEmail).find((e): e is SnovEmail => !!e && e.smtpStatus !== 'not_valid');
        if (found) out.set(`${r.domain}|${r.fullName}`.toLowerCase(), found);
      });
    } catch (err) {
      if (err instanceof Error && /not enough credits/i.test(err.message)) break;
    }
  }
  return out;
}

export interface DomainContact {
  name: string;
  position: string;
  email?: string;
  smtpStatus?: SmtpStatus;
  /** Where Snov saw this person. */
  sourcePage?: string;
}

/**
 * The people Snov knows at a business's domain (optionally only certain job titles), each with an email when found.
 * This is how a website alone yields several decision-makers: one list request (1 credit), then one
 * email lookup per person (1 credit each that returns an address), capped by `max`.
 */
export async function domainContacts(domain: string, opts: SnovOpts & { positions?: string[]; max?: number } = {}): Promise<DomainContact[]> {
  const max = Math.max(1, Math.min(opts.max ?? 3, 10));
  const start = await call<{ meta?: { task_hash?: string } }>('POST', '/v2/domain-search/prospects/start', {
    domain, ...(opts.positions?.length ? { positions: opts.positions.slice(0, 10) } : {}), page: 1,
  });
  const hash = start.meta?.task_hash;
  if (!hash) return [];
  const list = await poll<{ status?: string; data?: Array<{ first_name?: string; last_name?: string; position?: string; source_page?: string; search_emails_start?: string }> }>(
    `/v2/domain-search/prospects/result/${encodeURIComponent(hash)}`, opts);
  const people = (list?.data ?? []).filter((p) => p.first_name && p.last_name).slice(0, max);

  const out: DomainContact[] = [];
  for (const p of people) {
    const c: DomainContact = { name: `${p.first_name} ${p.last_name}`.trim(), position: p.position ?? '', sourcePage: p.source_page };
    // search_emails_start is a full URL (or path) to POST to; only follow it if it is on Snov's own host.
    const path = p.search_emails_start ? (() => { try { const u = new URL(p.search_emails_start, BASE); return u.origin === BASE ? u.pathname : null; } catch { return null; } })() : null;
    if (path) {
      try {
        const s = await call<{ meta?: { task_hash?: string } }>('POST', path);
        const h = s.meta?.task_hash;
        const r = h ? await poll<{ status?: string; data?: { emails?: RawEmail[] } }>(`/v2/domain-search/prospects/search-emails/result/${encodeURIComponent(h)}`, opts) : null;
        const e = toEmail(r?.data?.emails?.[0]);
        if (e && e.smtpStatus !== 'not_valid') { c.email = e.email; c.smtpStatus = e.smtpStatus; }
      } catch (err) {
        if (err instanceof Error && /not enough credits/i.test(err.message)) { out.push(c); break; }
      }
    }
    out.push(c);
  }
  return out;
}


// ── Database Search: find people at companies by industry, place and seniority ──
// Starting a search and reading prospects is free. Revealing a person's email costs 1 credit if one is found.

export type ManagementLevel = 'c_level' | 'vp_level' | 'director_level' | 'manager_level' | 'staff';

export interface DbSearchFilters {
  industry?: string;
  specialties?: string[];
  /** Snov's own wording, e.g. { locality: 'Lagos, Nigeria', type: 'state' }. */
  location?: { locality: string; type: 'city' | 'state' | 'country' | 'region' | 'subregion' };
  levels?: ManagementLevel[];
  jobTitles?: string[];
  size?: string;
}

export interface DbProspect {
  firstName: string;
  /** Partly hidden ("Or***") until the email is revealed. */
  lastName: string;
  jobTitle: string;
  location: string;
  industry: string;
  company: { name: string; domain: string; location: string; industry: string; size: string };
  /** POST here (through revealEmail) to get the email. */
  revealUrl: string;
}

export interface DbSearchResult { total: number; page: number; totalPages: number; prospects: DbProspect[] }

/** Snov rejected a filter value; `suggestions` are the values it would accept. */
export class SnovFilterError extends Error {
  constructor(message: string, public field: 'location' | 'industries' | 'other', public suggestions: unknown[]) { super(message); Object.setPrototypeOf(this, new.target.prototype); }
}

/** The request body Snov expects, from our friendlier filter object. */
export function dbFilters(f: DbSearchFilters): Record<string, unknown> {
  const company: Record<string, unknown> = {};
  if (f.industry) company.industries = { include: [f.industry] };
  if (f.location) company.locations = { include: [{ locality: f.location.locality, location_type: f.location.type }] };
  if (f.size) company.size = [f.size];
  if (f.specialties?.length) company.specialities = f.specialties;
  const prospect: Record<string, unknown> = {};
  if (f.levels?.length) prospect.management_levels = { include: f.levels };
  if (f.jobTitles?.length) prospect.job_titles = { include: f.jobTitles };
  return { ...(Object.keys(prospect).length ? { prospect } : {}), ...(Object.keys(company).length ? { company } : {}) };
}

interface RawProspect {
  first_name?: string; last_name?: string; job_title?: string; location?: string; industry?: string; email_and_hidden_info_reveal?: string;
  company?: { name?: string; domain?: string; location?: string; industry?: string; size?: string };
}

export async function searchProspects(f: DbSearchFilters, page = 1, opts: SnovOpts = {}): Promise<DbSearchResult> {
  const filters = dbFilters(f);
  if (!Object.keys(filters).length) throw new SnovFilterError('Choose at least one filter.', 'other', []);
  let hash: string | undefined;
  try {
    const start = await call<{ meta?: { task_hash?: string } }>('POST', '/v2/database-search/prospects/start', { page, filters });
    hash = start.meta?.task_hash;
  } catch (e) {
    if (e instanceof SnovHttpError && e.status === 422) {
      const err = (Array.isArray(e.body) ? e.body[0] : e.body) as { errors?: { message?: string; suggestion?: unknown[] } } | null;
      const msg = err?.errors?.message ?? 'That filter was not accepted.';
      throw new SnovFilterError(msg, /'location'/.test(msg) ? 'location' : /'industries'/.test(msg) ? 'industries' : 'other', err?.errors?.suggestion ?? []);
    }
    throw e;
  }
  if (!hash) throw new Error('The search did not start.');
  const done = await poll<{ status?: string; data?: { total?: number; page?: number; total_pages?: number; prospects?: RawProspect[] } }>(`/v2/database-search/prospects/result/${encodeURIComponent(hash)}`, { tries: 12, ...opts });
  const d = done?.data;
  return {
    total: d?.total ?? 0, page: d?.page ?? page, totalPages: d?.total_pages ?? 0,
    prospects: (d?.prospects ?? []).filter((p) => p.email_and_hidden_info_reveal).map((p) => ({
      firstName: p.first_name ?? '', lastName: p.last_name ?? '', jobTitle: p.job_title ?? '', location: p.location ?? '', industry: p.industry ?? '',
      company: { name: p.company?.name ?? '', domain: p.company?.domain ?? '', location: p.company?.location ?? '', industry: p.company?.industry ?? '', size: p.company?.size ?? '' },
      revealUrl: p.email_and_hidden_info_reveal as string,
    })),
  };
}

/** Our own reveal links only: Snov's host and its prospect email-search path. */
export function revealPath(url: string): string | null {
  try {
    const u = new URL(url, BASE);
    return u.origin === BASE && /^\/v2\/database-search\/prospects\/search-emails\/start\/[A-Za-z0-9]+$/.test(u.pathname) ? u.pathname : null;
  } catch { return null; }
}

export interface RevealedPerson { name?: string; linkedin?: string; email?: string; smtpStatus?: SmtpStatus }

/** Pulls the person's name, LinkedIn and first email out of Snov's result, whatever nesting it uses. */
export function readReveal(data: unknown): RevealedPerson {
  const out: RevealedPerson = {};
  const walk = (n: unknown, depth = 0) => {
    if (!n || typeof n !== 'object' || depth > 5) return;
    if (Array.isArray(n)) { n.forEach((x) => walk(x, depth + 1)); return; }
    const o = n as Record<string, unknown>;
    if (!out.email && typeof o.email === 'string' && o.email.includes('@')) { out.email = o.email.toLowerCase(); out.smtpStatus = o.smtp_status === 'valid' || o.smtp_status === 'not_valid' ? o.smtp_status : 'unknown'; }
    if (!out.name && typeof o.full_name === 'string') out.name = o.full_name;
    if (!out.name && typeof o.first_name === 'string' && typeof o.last_name === 'string' && !o.last_name.includes('*')) out.name = `${o.first_name} ${o.last_name}`;
    if (!out.linkedin && typeof o.linkedin_url === 'string') out.linkedin = o.linkedin_url;
    Object.values(o).forEach((x) => walk(x, depth + 1));
  };
  walk(data);
  return out;
}

/** Reveal one person (1 credit if an email is found). Returns null when the link is not ours or nothing came back. */
export async function revealEmail(url: string, opts: SnovOpts = {}): Promise<RevealedPerson | null> {
  const path = revealPath(url);
  if (!path) return null;
  const start = await call<{ meta?: { task_hash?: string } }>('POST', path);
  const hash = start.meta?.task_hash;
  if (!hash) return null;
  const done = await poll<{ status?: string; data?: unknown }>(`/v2/database-search/prospects/search-emails/result/${encodeURIComponent(hash)}`, opts);
  return done ? readReveal(done.data) : null;
}

/** Credits left on the Snov.io account (free call). null if it could not be read. */
export async function snovBalance(): Promise<number | null> {
  try {
    const r = await call<{ data?: { balance?: string | number } }>('GET', '/v1/get-balance');
    const n = Number(r.data?.balance);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}
