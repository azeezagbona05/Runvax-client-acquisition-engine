import { prisma } from '@/lib/prisma';
import { safeFetch } from '@/lib/safeFetch';
import { hasSkill, type AssistantConfig } from './kinds';
import { SKILLS, CHAT_SKILLS } from './skills';

export interface ToolCheck { skill: string; label: string; state: 'ok' | 'warn' | 'off'; detail: string }
export interface Capabilities { can: string[]; cannot: string[]; checks: ToolCheck[] }

const emailReady = () => !!(process.env.RESEND_API_KEY || process.env.SMTP_HOST);

async function reachable(url: string): Promise<boolean> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000);
  try { const r = await safeFetch(url, { method: 'GET', signal: ctl.signal, headers: { 'user-agent': 'RUNVAX-AgentCheck/1.0' } }, { maxRedirects: 3 }); return r.status < 400; }
  catch { return false; } finally { clearTimeout(t); }
}

/** What this chat agent can and cannot do with its current skills, and whether each connected tool answers. Read-only: sends nothing to anyone. */
export async function chatCapabilities(userId: string, cfg: AssistantConfig): Promise<Capabilities> {
  const can: string[] = [], cannot: string[] = [], checks: ToolCheck[] = [];
  for (const s of CHAT_SKILLS) {
    const info = SKILLS[s];
    if (hasSkill(cfg, s)) can.push(...info.tools.filter((x) => !x.soon).map((x) => x.t));
    else if (info.status === 'soon') cannot.push(`${info.label}: coming soon`);
    else if (info.status === 'campaign') cannot.push(`${info.label}: done by RUNVAX campaigns, not by this agent`);
    else cannot.push(`${info.label}: switched off for this agent`);
    for (const x of info.tools) if (x.soon && hasSkill(cfg, s)) cannot.push(`${x.t}: coming soon`);
  }
  cannot.push('Make up prices, offers or facts you have not given it');

  const sources = cfg.knowledgeIds.length ? await prisma.knowledgeSource.findMany({ where: { userId, id: { in: cfg.knowledgeIds } }, select: { kind: true, status: true } }).catch(() => []) : [];
  const ready = sources.filter((x) => x.status === 'ready');
  checks.push({ skill: 'knowledge', label: SKILLS.knowledge.label, state: ready.length || cfg.knowledge.length > 80 ? 'ok' : 'warn', detail: `${ready.length} knowledge source${ready.length === 1 ? '' : 's'} connected${cfg.knowledge ? ', plus what you wrote' : ''}.${sources.length > ready.length ? ` ${sources.length - ready.length} could not be read.` : ''}${!ready.length && cfg.knowledge.length <= 80 ? ' Add more: it can only answer from what it knows.' : ''}` });
  if (hasSkill(cfg, 'leadCapture') || hasSkill(cfg, 'handoff')) checks.push({ skill: 'alerts', label: 'Lead and handoff emails', state: emailReady() ? 'ok' : 'warn', detail: emailReady() ? `Sent to ${cfg.notifyEmail || 'your account email'}.` : 'Email sending is not set up on this server: leads still appear under Conversations.' });
  if (hasSkill(cfg, 'booking')) {
    const opens = cfg.calendarUrl ? await reachable(cfg.calendarUrl) : false;
    checks.push({ skill: 'booking', label: SKILLS.booking.label, state: opens ? 'ok' : 'warn', detail: !cfg.calendarUrl ? 'Add your booking page link.' : opens ? 'Your booking page opens. Availability and confirmations come from your booking tool.' : 'Your booking page did not open. Check the link.' });
  }
  if (hasSkill(cfg, 'productSearch')) { const tables = ready.filter((x) => x.kind === 'table').length; checks.push({ skill: 'productSearch', label: SKILLS.productSearch.label, state: tables ? 'ok' : 'warn', detail: tables ? `${tables} catalogue table${tables === 1 ? '' : 's'} connected${cfg.shopUrl || cfg.business.url ? `, links to ${cfg.shopUrl || cfg.business.url}` : ''}.` : 'Upload your product catalogue as a CSV in Knowledge.' }); }
  if (hasSkill(cfg, 'crm')) checks.push({ skill: 'crm', label: SKILLS.crm.label, state: cfg.crmWebhookUrl ? 'ok' : 'warn', detail: cfg.crmWebhookUrl ? 'Webhook address set. Send a test from the Deploy tab after saving.' : 'Add the webhook address that should receive leads.' });
  if (cfg.template === 'internal') checks.push({ skill: 'access', label: 'Staff access code', state: cfg.accessCode.length >= 4 ? 'ok' : 'warn', detail: cfg.accessCode.length >= 4 ? 'Only people with the code can chat.' : 'Set a code of at least 4 characters.' });
  return { can: Array.from(new Set(can)), cannot: Array.from(new Set(cannot)), checks };
}
