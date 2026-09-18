import { prisma } from '@/lib/prisma';

export type AgentKey = 'research' | 'outreach' | 'seo' | 'support' | 'atlas';

/**
 * Records one real, user-visible thing an agent did, for the Command Centre
 * feed. Never throws — logging must not break the flow that triggered it.
 */
export async function logAgentActivity(params: {
  userId: string;
  agentKey: AgentKey;
  action: string;
  title: string;
  detail?: string;
}) {
  try {
    await prisma.agentActivity.create({
      data: {
        userId: params.userId,
        agentKey: params.agentKey,
        action: params.action,
        title: params.title.slice(0, 200),
        detail: params.detail?.slice(0, 500),
      },
    });
  } catch (e) {
    console.error('logAgentActivity failed', e);
  }
}
