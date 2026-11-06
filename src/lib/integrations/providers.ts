import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { prisma } from '@/lib/prisma';
import { safeFetch } from '@/lib/safeFetch';
import { getConnection, markStatus, saveConnection, removeConnection, type Provider } from './store';
import { open, seal } from './crypto';
import { verifyTokenFor, webhookUrlFor } from '@/lib/waWebhook';

export type IntegrationId = 'wa' | 'gmail' | 'smtp' | 'apollo' | 'snov' | 'gcal' | 'airtable' | 'webhooks';
export type State = 'connected' | 'not_connected' | 'error';
export interface IntegrationStatus { id: IntegrationId; state: State; summary: string; detail?: string; lastCheckedAt?: string | null; lastSyncAt?: string | null; extra?: Record<string, unknown> }
export interface Result { ok: boolean; message: string; data?: Record<string, unknown> }

const fail = (message: string): Result => ({ ok: false, message });
const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message.slice(0, 200) : fallback);
const imapHostFor = (h: string): string => (/^smtp\./i.test(h) ? h.replace(/^smtp\./i, 'imap.') : h);
const isGoogleHost = (h?: string | null) => !!h && /(^|\.)(gmail|googlemail|google)\.com$/i.test(h);

// ───────────────────────── status (read from real state) ─────────────────────────

export async function allStatuses(userId: string): Promise<IntegrationStatus[]> {
  const [s, rows] = await Promise.all([
    prisma.userSettings.findUnique({ where: { userId }, select: { waPhoneNumberId: true, waAccessToken: true, waDisplayPhone: true, waTemplateStatus: true, smtpHost: true, smtpUser: true, smtpPass: true } }),
    prisma.integrationConnection.findMany({ where: { userId } }).catch(() => []),
  ]);
  const by = new Map(rows.map((r) => [r.provider, r]));
  const mailbox = !!(s?.smtpHost && s.smtpUser && s.smtpPass);
  const out: IntegrationStatus[] = [];

  out.push(s?.waPhoneNumberId && s.waAccessToken
    ? { id: 'wa', state: 'connected', summary: `${s.waDisplayPhone ? `Sending from ${s.waDisplayPhone}` : 'WhatsApp Business connected'}. ${s.waTemplateStatus === 'APPROVED' ? 'Message template approved.' : s.waTemplateStatus === 'PENDING' ? 'Message template waiting for Meta review.' : s.waTemplateStatus === 'REJECTED' ? 'Message template was rejected by Meta.' : 'Message template not created yet.'}`, extra: { waTemplateStatus: s.waTemplateStatus ?? '', webhookUrl: webhookUrlFor(userId), verifyToken: verifyTokenFor(userId), repliesOn: by.has('wa') } }
    : { id: 'wa', state: 'not_connected', summary: 'Not connected yet' });
  const gOauth = by.get('gmail');
  out.push(gOauth
    ? (gOauth.status === 'connected'
      ? { id: 'gmail', state: 'connected', summary: `Signed in with Google as ${(gOauth.meta as Record<string, unknown> | null)?.email ?? 'your account'}. Sending and reading replies.`, lastCheckedAt: gOauth.lastCheckedAt?.toISOString() ?? null }
      : { id: 'gmail', state: 'error', summary: 'Needs attention', detail: gOauth.statusDetail ?? undefined })
    : mailbox && isGoogleHost(s?.smtpHost)
    ? { id: 'gmail', state: 'connected', summary: `Sending and reading replies as ${s!.smtpUser} (app password)` }
    : { id: 'gmail', state: 'not_connected', summary: 'Not connected yet' });
  out.push(mailbox && !isGoogleHost(s?.smtpHost)
    ? { id: 'smtp', state: 'connected', summary: `${s!.smtpUser} via ${s!.smtpHost}` }
    : { id: 'smtp', state: 'not_connected', summary: mailbox ? 'Using your Gmail connection' : 'Not connected yet' });

  const row = (p: Provider, summaryOf: (meta: Record<string, unknown>) => string): IntegrationStatus => {
    const r = by.get(p);
    if (r) return { id: p as IntegrationId, state: r.status === 'connected' ? 'connected' : 'error', summary: r.status === 'connected' ? summaryOf((r.meta ?? {}) as Record<string, unknown>) : 'Needs attention', detail: r.status === 'error' ? r.statusDetail ?? undefined : undefined, lastCheckedAt: r.lastCheckedAt?.toISOString() ?? null, lastSyncAt: r.lastSyncAt?.toISOString() ?? null, extra: p === 'webhooks' ? { url: (r.meta as Record<string, unknown> | null)?.url } : undefined };
    return { id: p as IntegrationId, state: 'not_connected', summary: 'Not connected yet' };
  };
  out.push(row('apollo', () => 'Your Apollo key is in use'));
  out.push(row('snov', () => 'Your email finder account is in use'));
  out.push(row('gcal', (m) => `Calendar of ${m.email ?? 'your Google account'}`));
  out.push(row('airtable', (m) => `Syncing to ${m.table ?? 'your table'}`));
  out.push(row('webhooks', (m) => `Posting to ${hostOf(String(m.url ?? ''))}`));
  return out;
}

const hostOf = (u: string) => { try { return new URL(u).host; } catch { return 'your endpoint'; } };

// ───────────────────────── WhatsApp ─────────────────────────

export async function selectWhatsAppPhone(userId: string, f: { id?: string; number?: string; wabaId?: string }): Promise<Result> {
  const s = await prisma.userSettings.findUnique({ where: { userId }, select: { waAccessToken: true } });
  if (!s?.waAccessToken) return fail('Paste your access token and detect your numbers first.');
  if (!f.id || !/^\d{6,}$/.test(f.id)) return fail('Pick one of the detected numbers.');
  await prisma.userSettings.update({ where: { userId }, data: { waPhoneNumberId: f.id, wabaId: f.wabaId || null, waDisplayPhone: f.number || null, waTemplateName: null, waTemplateStatus: null } });
  return { ok: true, message: 'Number selected.' };
}

export async function testWhatsApp(userId: string): Promise<Result> {
  const s = await prisma.userSettings.findUnique({ where: { userId }, select: { waPhoneNumberId: true, waAccessToken: true } });
  if (!s?.waPhoneNumberId || !s.waAccessToken) return fail('WhatsApp is not connected. Connect it in Settings → WhatsApp Business.');
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${s.waPhoneNumberId}?fields=display_phone_number,verified_name,quality_rating`, { headers: { Authorization: `Bearer ${s.waAccessToken}` }, signal: AbortSignal.timeout(10_000) });
    const d = await res.json() as { display_phone_number?: string; verified_name?: string; quality_rating?: string; error?: { message?: string } };
    if (!res.ok || d.error) return fail(d.error?.message ?? 'Meta rejected the saved access token. Reconnect WhatsApp.');
    return { ok: true, message: `Working: ${d.verified_name ?? 'your number'} (${d.display_phone_number ?? ''}), quality ${d.quality_rating ?? 'unknown'}.` };
  } catch (e) { return fail(errText(e, 'Could not reach Meta.')); }
}

// ───────────────────────── Email (Gmail / SMTP) ─────────────────────────

async function checkMailbox(host: string, port: number, user: string, pass: string): Promise<Result> {
  try {
    await nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass }, connectionTimeout: 10_000, greetingTimeout: 10_000 }).verify();
  } catch (e) { return fail(`Sending failed: ${errText(e, 'could not sign in')}`); }
  const imap = new ImapFlow({ host: imapHostFor(host), port: 993, secure: true, auth: { user, pass }, logger: false });
  try { await imap.connect(); await imap.logout(); } catch (e) {
    try { await imap.logout(); } catch { /* closed */ }
    return { ok: true, message: `Sending works. Reading replies did not: ${errText(e, 'IMAP sign-in failed')}. In Gmail, turn on IMAP in Settings → Forwarding and POP/IMAP.` };
  }
  return { ok: true, message: 'Sending and reading replies both work.' };
}

export async function connectMailbox(userId: string, kind: 'gmail' | 'smtp', f: { email?: string; password?: string; host?: string; port?: number }): Promise<Result> {
  const user = (f.email ?? '').trim();
  const pass = (f.password ?? '').replace(/\s+/g, kind === 'gmail' ? '' : '$&');
  const host = kind === 'gmail' ? 'smtp.gmail.com' : (f.host ?? '').trim();
  const port = kind === 'gmail' ? 465 : Number(f.port) || 587;
  if (!user || !pass || !host) return fail(kind === 'gmail' ? 'Enter your Gmail address and an app password.' : 'Enter the server, login and password.');
  if (kind === 'gmail' && !/@(gmail|googlemail)\.com$|@.+\..+/i.test(user)) return fail('Enter a valid email address.');
  const r = await checkMailbox(host, port, user, pass);
  if (!r.ok) return kind === 'gmail' ? fail(`${r.message} For Gmail, use an app password (Google Account → Security → 2-Step Verification → App passwords), not your normal password.`) : r;
  await prisma.userSettings.upsert({ where: { userId }, create: { userId, smtpHost: host, smtpPort: port, smtpUser: user, smtpPass: pass }, update: { smtpHost: host, smtpPort: port, smtpUser: user, smtpPass: pass } });
  return { ok: true, message: `Connected. ${r.message}` };
}

export async function testMailbox(userId: string): Promise<Result> {
  const g = await getConnection(userId, 'gmail');
  if (g) {
    const a = await gmailAccessToken(userId);
    if (!('token' in a)) return a;
    try {
      await nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { type: 'OAuth2', user: a.email, accessToken: a.token } }).verify();
    } catch (e) { return fail(`Gmail would not let us send: ${errText(e, 'sign-in failed')}`); }
    const imap = new ImapFlow({ host: 'imap.gmail.com', port: 993, secure: true, auth: { user: a.email, accessToken: a.token }, logger: false });
    try { await imap.connect(); await imap.logout(); } catch (e) {
      try { await imap.logout(); } catch { /* closed */ }
      return { ok: true, message: `Sending works. Reading replies did not: ${errText(e, 'IMAP sign-in failed')}. Turn on IMAP in Gmail settings → Forwarding and POP/IMAP.` };
    }
    await markStatus(userId, 'gmail', 'connected', null);
    return { ok: true, message: 'Sending and reading replies both work.' };
  }
  const s = await prisma.userSettings.findUnique({ where: { userId }, select: { smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true } });
  if (!s?.smtpHost || !s.smtpUser || !s.smtpPass) return fail('No mailbox is connected yet.');
  return checkMailbox(s.smtpHost, s.smtpPort ?? 587, s.smtpUser, s.smtpPass);
}

export async function disconnectMailbox(userId: string): Promise<Result> {
  await removeConnection(userId, 'gmail');
  await prisma.userSettings.updateMany({ where: { userId }, data: { smtpHost: null, smtpPort: null, smtpUser: null, smtpPass: null } });
  return { ok: true, message: 'Mailbox disconnected. Campaigns will not send until you connect one.' };
}

// ───────────────────────── Apollo ─────────────────────────

export async function checkApollo(apiKey: string): Promise<Result> {
  try {
    const res = await fetch('https://api.apollo.io/api/v1/auth/health', { headers: { 'x-api-key': apiKey, 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(10_000) });
    const d = await res.json().catch(() => ({})) as { is_logged_in?: boolean; healthy?: boolean };
    if (res.status === 401 || res.status === 403 || d.is_logged_in === false) return fail('Apollo did not accept that API key.');
    if (!res.ok) return fail(`Apollo answered ${res.status}. Try again in a moment.`);
    return { ok: true, message: 'Apollo accepted the key.' };
  } catch (e) { return fail(errText(e, 'Could not reach Apollo.')); }
}

// ───────────────────────── Snov.io ─────────────────────────

export async function checkSnov(id: string, secret: string): Promise<Result> {
  try {
    const res = await fetch('https://api.snov.io/v1/oauth/access_token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grant_type: 'client_credentials', client_id: id, client_secret: secret }), signal: AbortSignal.timeout(10_000) });
    const t = await res.json().catch(() => ({})) as { access_token?: string };
    if (!res.ok || !t.access_token) return fail('That API User ID and Secret were not accepted.');
    const b = await fetch('https://api.snov.io/v1/get-balance', { headers: { Authorization: `Bearer ${t.access_token}` }, signal: AbortSignal.timeout(10_000) });
    const d = await b.json().catch(() => ({})) as { data?: { balance?: string | number } };
    const bal = Number(d.data?.balance);
    return { ok: true, message: Number.isFinite(bal) ? `Keys accepted. ${bal} credits left.` : 'Keys accepted.' };
  } catch (e) { return fail(errText(e, 'Could not reach the email finder.')); }
}

// ───────────────────────── Airtable ─────────────────────────

const AT = 'https://api.airtable.com/v0';
export const AIRTABLE_FIELDS = ['Email', 'Name', 'Business', 'Website', 'Campaign', 'Status', 'Reply type', 'Stage'];

async function airtableCall(secrets: Record<string, string>, meta: Record<string, unknown>, init: RequestInit = {}, query = '') {
  const url = `${AT}/${encodeURIComponent(String(meta.baseId))}/${encodeURIComponent(String(meta.table))}${query}`;
  return fetch(url, { ...init, headers: { Authorization: `Bearer ${secrets.token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) }, signal: AbortSignal.timeout(15_000) });
}

export async function connectAirtable(userId: string, f: { token?: string; baseId?: string; table?: string }): Promise<Result> {
  const token = (f.token ?? '').trim(), baseId = (f.baseId ?? '').trim(), table = (f.table ?? '').trim();
  if (!token || !baseId || !table) return fail('Enter the access token, base ID and table name.');
  if (!/^app[A-Za-z0-9]{8,}$/.test(baseId)) return fail('The base ID starts with "app" (find it in your base URL).');
  try {
    const res = await airtableCall({ token }, { baseId, table }, {}, '?maxRecords=1');
    const d = await res.json().catch(() => ({})) as { error?: { message?: string } | string };
    if (!res.ok) return fail(`Airtable said: ${typeof d.error === 'string' ? d.error : d.error?.message ?? res.status}. Check the token has data.records read and write access to this base, and the table name is exact.`);
  } catch (e) { return fail(errText(e, 'Could not reach Airtable.')); }
  await saveConnection(userId, 'airtable', { token }, { baseId, table });
  return { ok: true, message: `Connected to ${table}. Press "Sync leads now" to send your leads. The table needs these columns (text): ${AIRTABLE_FIELDS.join(', ')}.` };
}

export async function syncAirtable(userId: string): Promise<Result> {
  const c = await getConnection(userId, 'airtable');
  if (!c) return fail('Airtable is not connected.');
  const leads = await prisma.outreachLead.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 1000, select: { email: true, name: true, business: true, website: true, status: true, replyClass: true, stage: true, campaign: { select: { name: true } } } });
  if (!leads.length) return { ok: true, message: 'You have no leads in campaigns yet, so there is nothing to sync.' };
  let done = 0;
  for (let i = 0; i < leads.length; i += 10) {
    const records = leads.slice(i, i + 10).map((l) => ({ fields: { Email: l.email, Name: l.name ?? '', Business: l.business ?? '', Website: l.website ?? '', Campaign: l.campaign.name, Status: l.status, 'Reply type': l.replyClass ?? '', Stage: l.stage ?? '' } }));
    const res = await airtableCall(c.secrets, c.metaObj, { method: 'PATCH', body: JSON.stringify({ performUpsert: { fieldsToMergeOn: ['Email'] }, typecast: true, records }) });
    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as { error?: { message?: string; type?: string } };
      const msg = `Airtable stopped after ${done} lead${done === 1 ? '' : 's'}: ${d.error?.message ?? d.error?.type ?? res.status}`;
      await markStatus(userId, 'airtable', 'error', msg);
      return fail(`${msg}. Make sure the table has the columns: ${AIRTABLE_FIELDS.join(', ')}.`);
    }
    done += records.length;
    if (i + 10 < leads.length) await new Promise((r) => setTimeout(r, 220)); // Airtable allows 5 requests a second
  }
  await markStatus(userId, 'airtable', 'connected', null, { synced: true });
  return { ok: true, message: `Synced ${done} lead${done === 1 ? '' : 's'} to Airtable (existing rows were updated by email, not duplicated).` };
}

// ───────────────────────── Webhooks ─────────────────────────

export const WEBHOOK_EVENTS = ['reply.received', 'lead.interested', 'leads.sync', 'test.ping'] as const;
export type WebhookEvent = typeof WEBHOOK_EVENTS[number];

async function deliver(url: string, secret: string, event: WebhookEvent, data: unknown): Promise<{ ok: boolean; status?: number; error?: string }> {
  const body = JSON.stringify({ event, createdAt: new Date().toISOString(), data });
  const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
  try {
    const res = await safeFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'RUNVAX-Webhooks/1', 'X-Runvax-Event': event, 'X-Runvax-Signature': `sha256=${sig}` }, body, signal: AbortSignal.timeout(8000) }, { maxRedirects: 0 });
    return { ok: res.ok, status: res.status };
  } catch (e) { return { ok: false, error: errText(e, 'Could not reach that URL.') }; }
}

export async function connectWebhook(userId: string, f: { url?: string }): Promise<Result> {
  const url = (f.url ?? '').trim();
  if (!/^https:\/\//i.test(url)) return fail('The endpoint must be a public https:// address.');
  const secret = crypto.randomBytes(24).toString('hex');
  const r = await deliver(url, secret, 'test.ping', { message: 'RUNVAX is connected.' });
  if (!r.ok) return fail(r.error ?? `Your endpoint answered ${r.status}. It must reply with a 2xx status.`);
  await saveConnection(userId, 'webhooks', { secret }, { url });
  return { ok: true, message: 'Connected. Your endpoint received a test ping. Copy the signing secret now; it is not shown again.', data: { secret } };
}

export async function testWebhook(userId: string): Promise<Result> {
  const c = await getConnection(userId, 'webhooks');
  if (!c) return fail('Webhooks are not connected.');
  const r = await deliver(String(c.metaObj.url), c.secrets.secret, 'test.ping', { message: 'RUNVAX test ping.' });
  await markStatus(userId, 'webhooks', r.ok ? 'connected' : 'error', r.ok ? null : r.error ?? `Endpoint answered ${r.status}`);
  return r.ok ? { ok: true, message: `Your endpoint answered ${r.status}.` } : fail(r.error ?? `Your endpoint answered ${r.status}.`);
}

export async function syncWebhook(userId: string): Promise<Result> {
  const c = await getConnection(userId, 'webhooks');
  if (!c) return fail('Webhooks are not connected.');
  const leads = await prisma.outreachLead.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 1000, select: { id: true, email: true, name: true, business: true, website: true, status: true, replyClass: true, stage: true, campaign: { select: { name: true } } } });
  let sent = 0;
  for (let i = 0; i < leads.length; i += 100) {
    const r = await deliver(String(c.metaObj.url), c.secrets.secret, 'leads.sync', { leads: leads.slice(i, i + 100).map((l) => ({ id: l.id, email: l.email, name: l.name, business: l.business, website: l.website, status: l.status, replyType: l.replyClass, stage: l.stage, campaign: l.campaign.name })) });
    if (!r.ok) { await markStatus(userId, 'webhooks', 'error', r.error ?? `Endpoint answered ${r.status}`); return fail(`Stopped after ${sent} lead${sent === 1 ? '' : 's'}: ${r.error ?? `your endpoint answered ${r.status}`}.`); }
    sent += Math.min(100, leads.length - i);
  }
  await markStatus(userId, 'webhooks', 'connected', null, { synced: true });
  return { ok: true, message: `Sent ${sent} lead${sent === 1 ? '' : 's'} to your endpoint.` };
}

/** Fire-and-forget from the reply pipeline. Never throws and never delays the caller. */
export function emitWebhook(userId: string, event: WebhookEvent, data: unknown): void {
  void (async () => {
    try {
      const c = await getConnection(userId, 'webhooks');
      if (!c || c.status !== 'connected') return;
      const r = await deliver(String(c.metaObj.url), c.secrets.secret, event, data);
      if (!r.ok) await markStatus(userId, 'webhooks', 'error', r.error ?? `Endpoint answered ${r.status}`);
    } catch { /* never break reply handling */ }
  })();
}

// ───────────────────────── Gmail sign-in (OAuth) ─────────────────────────

export const GMAIL_SCOPES = ['https://mail.google.com/', 'openid', 'email'];
export const gmailRedirect = () => `${(process.env.NEXTAUTH_URL ?? '').replace(/\/$/, '')}/api/client-acquisition/integrations/google-mail/callback`;

export function gmailStartUrl(userId: string): string | null {
  const base = (process.env.NEXTAUTH_URL ?? '').replace(/\/$/, '');
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !base) return null;
  const state = seal({ userId, kind: 'gmail', exp: Date.now() + 10 * 60_000 });
  const q = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: gmailRedirect(), response_type: 'code', scope: GMAIL_SCOPES.join(' '), access_type: 'offline', prompt: 'consent', state });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export async function gmailFinish(code: string, state: string): Promise<Result> {
  const st = open<{ userId: string; kind: string; exp: number }>(state);
  if (!st || st.kind !== 'gmail' || st.exp < Date.now()) return fail('That connection link expired. Start again from Integrations.');
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID ?? '', client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '', redirect_uri: gmailRedirect(), grant_type: 'authorization_code' }) });
  const t = await res.json().catch(() => ({})) as { refresh_token?: string; id_token?: string; scope?: string; error_description?: string };
  if (!res.ok || !t.refresh_token) return fail(t.error_description ?? 'Google did not return mailbox access. Try again and allow every permission.');
  if (!(t.scope ?? '').includes('mail.google.com')) return fail('Mail permission was not granted. Try again and tick the Gmail box.');
  let email = '';
  try { email = (JSON.parse(Buffer.from((t.id_token ?? '').split('.')[1], 'base64url').toString()) as { email?: string }).email ?? ''; } catch { /* checked below */ }
  if (!email) return fail('Google did not tell us which address signed in. Try again.');
  await saveConnection(st.userId, 'gmail', { refreshToken: t.refresh_token }, { email });
  return { ok: true, message: 'Connected' };
}

/** A fresh Gmail access token for this user's signed-in Google account. */
export async function gmailAccessToken(userId: string): Promise<{ token: string; email: string } | Result> {
  const c = await getConnection(userId, 'gmail');
  if (!c?.secrets.refreshToken) return fail('Gmail is not connected.');
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ refresh_token: c.secrets.refreshToken, client_id: process.env.GOOGLE_CLIENT_ID ?? '', client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '', grant_type: 'refresh_token' }) });
  const t = await res.json().catch(() => ({})) as { access_token?: string };
  if (!res.ok || !t.access_token) {
    await markStatus(userId, 'gmail', 'error', 'Google no longer accepts the saved sign-in. Sign in with Google again.');
    return fail('Google no longer accepts the saved sign-in. Sign in with Google again.');
  }
  return { token: t.access_token, email: String(c.metaObj.email ?? '') };
}

// ───────────────────────── Google Calendar ─────────────────────────

export const GCAL_SCOPES = ['https://www.googleapis.com/auth/calendar.freebusy', 'https://www.googleapis.com/auth/calendar.events', 'openid', 'email'];
const appUrl = () => (process.env.NEXTAUTH_URL ?? '').replace(/\/$/, '');
export const gcalRedirect = () => `${appUrl()}/api/client-acquisition/integrations/google-calendar/callback`;

export function gcalStartUrl(userId: string, tz: string): string | null {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !appUrl()) return null;
  const state = seal({ userId, tz, exp: Date.now() + 10 * 60_000 });
  const q = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID, redirect_uri: gcalRedirect(), response_type: 'code', scope: GCAL_SCOPES.join(' '), access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export async function gcalFinish(code: string, state: string): Promise<Result & { userId?: string }> {
  const st = open<{ userId: string; tz: string; exp: number }>(state);
  if (!st || st.exp < Date.now()) return fail('That connection link expired. Start again from Integrations.');
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID ?? '', client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '', redirect_uri: gcalRedirect(), grant_type: 'authorization_code' }) });
  const t = await res.json().catch(() => ({})) as { refresh_token?: string; id_token?: string; scope?: string; error_description?: string };
  if (!res.ok || !t.refresh_token) return fail(t.error_description ?? 'Google did not return calendar access. Try again and allow every permission.');
  if (!(t.scope ?? '').includes('calendar.events')) return fail('Calendar permission was not granted. Try again and tick the calendar boxes.');
  let email = '';
  try { email = (JSON.parse(Buffer.from((t.id_token ?? '').split('.')[1], 'base64url').toString()) as { email?: string }).email ?? ''; } catch { /* optional */ }
  await saveConnection(st.userId, 'gcal', { refreshToken: t.refresh_token }, { email, tz: st.tz || 'UTC' });
  return { ok: true, message: 'Connected', userId: st.userId };
}

async function gcalToken(userId: string): Promise<{ token: string; tz: string } | Result> {
  const c = await getConnection(userId, 'gcal');
  if (!c?.secrets.refreshToken) return fail('Google Calendar is not connected.');
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ refresh_token: c.secrets.refreshToken, client_id: process.env.GOOGLE_CLIENT_ID ?? '', client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '', grant_type: 'refresh_token' }) });
  const t = await res.json().catch(() => ({})) as { access_token?: string; error?: string };
  if (!res.ok || !t.access_token) {
    await markStatus(userId, 'gcal', 'error', 'Google no longer accepts the saved access. Reconnect your calendar.');
    return fail('Google no longer accepts the saved access. Reconnect your calendar.');
  }
  return { token: t.access_token, tz: String(c.metaObj.tz ?? 'UTC') };
}

function localParts(d: Date, tz: string) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', minute: 'numeric', weekday: 'short', hourCycle: 'h23' }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return { h: Number(g('hour')) + Number(g('minute')) / 60, wd: g('weekday') };
}

/** Free half-hour-aligned slots in working hours (Mon-Fri, 9:00-17:00 in the calendar's time zone) over the next days. */
export async function freeSlots(userId: string, opts: { days?: number; minutes?: number; max?: number } = {}): Promise<Result & { slots?: string[] }> {
  const a = await gcalToken(userId);
  if (!('token' in a)) return a;
  const days = Math.min(opts.days ?? 5, 14), mins = opts.minutes ?? 30, max = opts.max ?? 6;
  const from = new Date(Date.now() + 2 * 3600_000); from.setMinutes(Math.ceil(from.getMinutes() / 30) * 30, 0, 0);
  const to = new Date(from.getTime() + days * 86_400_000);
  const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', { method: 'POST', headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{ id: 'primary' }] }) });
  const d = await res.json().catch(() => ({})) as { calendars?: { primary?: { busy?: { start: string; end: string }[] } }; error?: { message?: string } };
  if (!res.ok) return fail(d.error?.message ?? `Google answered ${res.status}.`);
  const busy = (d.calendars?.primary?.busy ?? []).map((b) => [Date.parse(b.start), Date.parse(b.end)] as const);
  const slots: string[] = [];
  for (let t = from.getTime(); t + mins * 60_000 <= to.getTime() && slots.length < max; t += 30 * 60_000) {
    const { h, wd } = localParts(new Date(t), a.tz);
    if (wd === 'Sat' || wd === 'Sun' || h < 9 || h + mins / 60 > 17) continue;
    if (busy.some(([s, e]) => t < e && t + mins * 60_000 > s)) continue;
    slots.push(new Date(t).toISOString());
  }
  return { ok: true, message: slots.length ? `${slots.length} free times found.` : 'No free working-hour times in the next few days.', slots };
}

export async function bookMeeting(userId: string, f: { start: string; minutes?: number; attendeeEmail?: string; title?: string; notes?: string }): Promise<Result> {
  const a = await gcalToken(userId);
  if (!('token' in a)) return a;
  const start = new Date(f.start);
  if (isNaN(start.getTime()) || start.getTime() < Date.now()) return fail('Pick a time in the future.');
  const end = new Date(start.getTime() + (f.minutes ?? 30) * 60_000);
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all', {
    method: 'POST', headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary: f.title || 'Intro call', description: f.notes, start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() }, ...(f.attendeeEmail ? { attendees: [{ email: f.attendeeEmail }] } : {}), conferenceData: { createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } } } }),
  });
  const d = await res.json().catch(() => ({})) as { htmlLink?: string; hangoutLink?: string; error?: { message?: string } };
  if (!res.ok) return fail(d.error?.message ?? `Google answered ${res.status}.`);
  return { ok: true, message: 'Meeting booked.', data: { link: d.htmlLink, meet: d.hangoutLink } };
}

export async function testCalendar(userId: string): Promise<Result> {
  const r = await freeSlots(userId, { max: 3 });
  if (!r.ok) { await markStatus(userId, 'gcal', 'error', r.message); return r; }
  await markStatus(userId, 'gcal', 'connected', null);
  return { ok: true, message: r.slots?.length ? `Working. Next free times: ${r.slots.map((s) => new Date(s).toUTCString().slice(0, 22) + ' UTC').join('; ')}.` : r.message, data: { slots: r.slots } };
}

// ───────────────────────── dispatch ─────────────────────────

export async function runAction(userId: string, id: IntegrationId, action: string, body: Record<string, unknown>): Promise<Result> {
  const str = (k: string) => (typeof body[k] === 'string' ? (body[k] as string) : undefined);
  const touch = async (p: Provider, r: Result) => { await markStatus(userId, p, r.ok ? 'connected' : 'error', r.ok ? null : r.message); return r; };
  switch (`${id}:${action}`) {
    case 'wa:test': return testWhatsApp(userId);
    case 'wa:webhook': {
      const secret = (str('appSecret') ?? '').trim();
      if (!/^[a-f0-9]{16,}$/i.test(secret)) return fail('Paste your Meta app secret (App settings → Basic → App secret).');
      await saveConnection(userId, 'wa', { appSecret: secret });
      return { ok: true, message: 'Saved. WhatsApp replies from your campaign contacts will now appear in your Inbox.' };
    }
    case 'wa:select': return selectWhatsAppPhone(userId, { id: str('id'), number: str('number'), wabaId: str('wabaId') });
    case 'wa:disconnect': await removeConnection(userId, 'wa'); await prisma.userSettings.updateMany({ where: { userId }, data: { waPhoneNumberId: null, waAccessToken: null, waDisplayPhone: null, wabaId: null, waTemplateName: null, waTemplateStatus: null } }); return { ok: true, message: 'WhatsApp disconnected.' };
    case 'gmail:connect': return connectMailbox(userId, 'gmail', { email: str('email'), password: str('password') });
    case 'smtp:connect': return connectMailbox(userId, 'smtp', { email: str('email'), password: str('password'), host: str('host'), port: Number(body.port) });
    case 'gmail:test': case 'smtp:test': return testMailbox(userId);
    case 'gmail:disconnect': case 'smtp:disconnect': return disconnectMailbox(userId);
    case 'apollo:connect': {
      const key = (str('apiKey') ?? '').trim(); if (!key) return fail('Paste your Apollo API key.');
      const r = await checkApollo(key); if (r.ok) await saveConnection(userId, 'apollo', { apiKey: key }); return r;
    }
    case 'apollo:test': { const c = await getConnection(userId, 'apollo'); if (!c) return fail('Apollo is not connected.'); return touch('apollo', await checkApollo(c.secrets.apiKey)); }
    case 'snov:connect': {
      const cid = (str('clientId') ?? '').trim(), cs = (str('clientSecret') ?? '').trim(); if (!cid || !cs) return fail('Enter both the API User ID and API Secret.');
      const r = await checkSnov(cid, cs); if (r.ok) await saveConnection(userId, 'snov', { clientId: cid, clientSecret: cs }); return r;
    }
    case 'snov:test': { const c = await getConnection(userId, 'snov'); if (!c) return fail('The email finder is not connected.'); return touch('snov', await checkSnov(c.secrets.clientId, c.secrets.clientSecret)); }
    case 'airtable:connect': return connectAirtable(userId, { token: str('token'), baseId: str('baseId'), table: str('table') });
    case 'airtable:test': { const c = await getConnection(userId, 'airtable'); if (!c) return fail('Airtable is not connected.'); const res = await airtableCall(c.secrets, c.metaObj, {}, '?maxRecords=1').catch(() => null); const r = res?.ok ? { ok: true, message: 'Airtable is reachable and the table can be read.' } : fail('Airtable rejected the saved token or table. Reconnect it.'); return touch('airtable', r); }
    case 'airtable:sync': return syncAirtable(userId);
    case 'webhooks:connect': return connectWebhook(userId, { url: str('url') });
    case 'webhooks:test': return testWebhook(userId);
    case 'webhooks:sync': return syncWebhook(userId);
    case 'gcal:test': return testCalendar(userId);
    case 'gcal:slots': { const r = await freeSlots(userId); return { ok: r.ok, message: r.message, data: { slots: r.slots } }; }
    case 'gcal:book': return bookMeeting(userId, { start: str('start') ?? '', minutes: Number(body.minutes) || undefined, attendeeEmail: str('attendeeEmail'), title: str('title'), notes: str('notes') });
    case 'apollo:disconnect': case 'snov:disconnect': case 'airtable:disconnect': case 'webhooks:disconnect': case 'gcal:disconnect':
      await removeConnection(userId, id as Provider); return { ok: true, message: 'Disconnected.' };
    default: return fail('That action is not available for this integration.');
  }
}
