import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { rateLimit } from '@/lib/rateLimiter';
import { safeFetch } from '@/lib/safeFetch';
import { findEmails as findEmailsJs } from '@/lib/emailEngine/engine.js';
import { normalizeDomain } from '@/lib/emailEngine/shared/normalize.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Admin-only experiment (Prospect Lab). Runs the isolated email engine on ONE prospect website and returns what it finds.
 * Reads public pages only (through safeFetch, so private addresses are refused), no database access, nothing is saved,
 * no email is sent. Mailbox (SMTP) checks are OFF here: serverless hosts block port 25, so statuses stop at DNS/MX level.
 * POST { website, name? }  ->  { domain, discovered[], patterns, candidates[], people[], ... }
 */
// The engine is plain JavaScript (copied from the research project); give it a loose call signature here.
const findEmails = findEmailsJs as unknown as (o: { domain: string; name: string | null; smtp: boolean; crawlOptions: Record<string, unknown> }) => Promise<Record<string, unknown>>;
const UA = 'RunvaxEmailResearchBot/0.1 (+research; respects robots.txt)';

async function fetchImpl(url: string) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 8000);
  try {
    const res = await safeFetch(url, { signal: ctl.signal, headers: { 'user-agent': UA, accept: 'text/html,*/*;q=0.5' } });
    const text = (await res.text()).slice(0, 1_000_000);
    return { ok: res.ok, status: res.status, text, contentType: res.headers.get('content-type') || '' };
  } finally { clearTimeout(t); }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(); if (!admin.ok) return admin.response;
  const rl = rateLimit(`email-engine:${admin.userId}`, { maxRequests: 30, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: 'Too many runs. Wait a moment.' }, { status: 429 });

  let body: { website?: unknown; name?: unknown } = {};
  try { body = await req.json(); } catch { /* handled below */ }
  const domain = typeof body.website === 'string' ? normalizeDomain(body.website) : null;
  if (!domain) return NextResponse.json({ error: 'Enter a business website such as acme.com' }, { status: 400 });
  const name = typeof body.name === 'string' && body.name.trim().length <= 80 ? body.name.trim() : null;

  try {
    const r = await findEmails({ domain, name, smtp: false, crawlOptions: { fetchImpl, maxPages: 5, delayMs: 400, ua: UA } });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Engine failed' }, { status: 500 });
  }
}
