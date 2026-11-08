import type { CustomAgent } from '@prisma/client';
import { getAppUrl } from '@/lib/url';
import { sanitizeConfig, type AgentKind } from './kinds';
import { openSecrets, secretFlags } from './store';

export const MAX_AGENTS = 6;

/** The JSON the builder pages get: settings and links, never a secret value. */
export function presentAgent(a: CustomAgent, counts?: { posts?: number; drafts?: number; chats?: number; leads?: number }) {
  const app = getAppUrl().replace(/\/$/, ''); const kind = a.kind as AgentKind;
  return {
    id: a.id, kind, name: a.name, status: a.status, publicKey: a.publicKey, config: sanitizeConfig(kind, a.config), secrets: secretFlags(openSecrets(a.secret)),
    lastRunAt: a.lastRunAt?.toISOString() ?? null, nextRunAt: a.nextRunAt?.toISOString() ?? null, createdAt: a.createdAt.toISOString(), counts: counts ?? {},
    deploy: kind === 'visibility' ? {
      embed: `<div id="runvax-posts"></div>\n<script async src="${app}/runvax-agent.js" data-key="${a.publicKey}"></script>`,
      hosted: `${app}/a/${a.publicKey}`, rss: `${app}/api/site-agent/${a.publicKey}/feed.xml`, json: `${app}/api/site-agent/${a.publicKey}/posts`,
    } : {
      embed: `<script async src="${app}/runvax-chat.js" data-key="${a.publicKey}"></script>`, hosted: `${app}/chat/${a.publicKey}`,
    },
  };
}
