import crypto from 'node:crypto';
import { safeFetch } from '@/lib/safeFetch';
import type { VisibilityConfig } from './kinds';
import type { AgentSecrets } from './store';

export interface PushResult { dest: 'webhook' | 'wordpress'; ok: boolean; detail: string }
export interface PostOut { id: string; slug: string; title: string; summary: string; body: string; keywords: string[]; publishedAt: string }

const sign = (secret: string, body: string) => 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
async function timed(url: string, init: RequestInit, ms = 10_000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try { return await safeFetch(url, { ...init, signal: ctl.signal }, { maxRedirects: 2 }); } finally { clearTimeout(t); }
}
const msg = (e: unknown) => (e instanceof Error ? e.message : 'failed').slice(0, 160);

export async function pushWebhook(url: string, secret: string | undefined, event: string, agent: { id: string; name: string }, post: PostOut | null): Promise<PushResult> {
  const body = JSON.stringify({ event, agent, post });
  try {
    const res = await timed(url, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'RUNVAX-Agent/1.0', ...(secret ? { 'x-runvax-signature': sign(secret, body) } : {}) }, body });
    return { dest: 'webhook', ok: res.ok, detail: res.ok ? `Delivered (${res.status})` : `Your endpoint answered ${res.status}` };
  } catch (e) { return { dest: 'webhook', ok: false, detail: msg(e) }; }
}

const wpAuth = (user: string, pass: string) => 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');

export async function pushWordPress(wp: NonNullable<VisibilityConfig['destinations']['wordpress']>, password: string | undefined, post: PostOut): Promise<PushResult> {
  if (!password) return { dest: 'wordpress', ok: false, detail: 'No application password saved yet' };
  try {
    const res = await timed(`${wp.siteUrl}/wp-json/wp/v2/posts`, { method: 'POST', headers: { authorization: wpAuth(wp.username, password), 'content-type': 'application/json' }, body: JSON.stringify({ title: post.title, content: post.body, excerpt: post.summary, status: wp.status }) });
    if (res.status === 201 || res.status === 200) return { dest: 'wordpress', ok: true, detail: wp.status === 'publish' ? 'Published on WordPress' : 'Saved as a WordPress draft' };
    return { dest: 'wordpress', ok: false, detail: res.status === 401 || res.status === 403 ? 'WordPress refused the login. Check the username and application password.' : `WordPress answered ${res.status}` };
  } catch (e) { return { dest: 'wordpress', ok: false, detail: msg(e) }; }
}

export async function testWordPress(wp: NonNullable<VisibilityConfig['destinations']['wordpress']>, password: string | undefined): Promise<PushResult> {
  if (!password) return { dest: 'wordpress', ok: false, detail: 'Save the application password first' };
  try {
    const res = await timed(`${wp.siteUrl}/wp-json/wp/v2/users/me`, { headers: { authorization: wpAuth(wp.username, password) } });
    if (res.ok) { const j = await res.json().catch(() => ({})) as { name?: string }; return { dest: 'wordpress', ok: true, detail: `Connected as ${j.name ?? wp.username}` }; }
    return { dest: 'wordpress', ok: false, detail: res.status === 404 ? 'No WordPress REST API found at that address' : 'WordPress refused the login. Check the username and application password.' };
  } catch (e) { return { dest: 'wordpress', ok: false, detail: msg(e) }; }
}

/** Sends a published post to every connected destination (webhook, WordPress). The embed, hosted page and RSS need no push. */
export async function pushAll(agent: { id: string; name: string }, cfg: VisibilityConfig, secrets: AgentSecrets, post: PostOut): Promise<PushResult[]> {
  const jobs: Array<Promise<PushResult>> = [];
  if (cfg.destinations.webhookUrl) jobs.push(pushWebhook(cfg.destinations.webhookUrl, secrets.webhookSecret, 'post.published', agent, post));
  if (cfg.destinations.wordpress) jobs.push(pushWordPress(cfg.destinations.wordpress, secrets.wpPassword, post));
  return Promise.all(jobs);
}
