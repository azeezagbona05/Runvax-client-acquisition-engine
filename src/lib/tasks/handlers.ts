import { prisma } from '@/lib/prisma';
import { detectOpportunities } from '@/lib/opportunity/detect';
import { composeOutreach } from '@/lib/outreach/compose';
import { checkAndIncrementAIForUser } from '@/lib/usage';
import { remember } from '@/lib/prospectMemory';
import { logAgentActivity } from '@/lib/agentActivity';
import type { Business } from '@/types';
import type { TaskHandler, TaskType } from './types';

async function loadProspect(userId: string, prospectId: string | null) {
  if (!prospectId) return null;
  const prospect = await prisma.prospect.findFirst({ where: { id: prospectId, userId } });
  return prospect;
}

// Ava: deterministic opportunity detection. No prospect worth pitching → the
// chain stops here and no AI quota is spent.
const detectOpportunity: TaskHandler = async ({ userId, prospectId }) => {
  const prospect = await loadProspect(userId, prospectId);
  if (!prospect) return { status: 'skipped', output: { reason: 'prospect_missing' } };

  const { primary, all, signals } = detectOpportunities(prospect.businessData as unknown as Business);
  if (!primary) return { status: 'skipped', output: { reason: 'no_opportunity' } };

  await logAgentActivity({
    userId,
    agentKey: 'research',
    action: 'opportunity_flagged',
    title: `Found an opportunity at ${prospect.businessName}: ${primary.title}`,
  });

  await remember({
    userId,
    prospectId: prospect.id,
    kind: 'opportunity',
    content: `${primary.title}: ${primary.reason}`,
    source: 'ava_detection',
    confidence: primary.confidence,
  });

  return {
    status: 'completed',
    output: {
      primary: { type: primary.type, title: primary.title, score: primary.score },
      offers: all.map((o) => o.type),
      signalCodes: signals.map((s) => s.code),
    },
    next: [{ type: 'draft_outreach', prospectId: prospect.id }],
  };
};

// Rex: composes a message and parks it as a pending draft. Never sends.
const draftOutreach: TaskHandler = async ({ userId, prospectId }) => {
  const prospect = await loadProspect(userId, prospectId);
  if (!prospect) return { status: 'skipped', output: { reason: 'prospect_missing' } };
  if (prospect.outreachSentAt) return { status: 'skipped', output: { reason: 'already_contacted' } };

  const pending = await prisma.outreachDraft.count({ where: { prospectId: prospect.id, status: 'pending' } });
  if (pending > 0) return { status: 'skipped', output: { reason: 'draft_exists' } };

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { plan: true } });
  if (!user) return { status: 'skipped', output: { reason: 'user_missing' } };

  const usage = await checkAndIncrementAIForUser(userId, user.plan);
  if (!usage.ok) return { status: 'skipped', output: { reason: 'ai_quota_reached' } };

  const result = await composeOutreach({ business: prospect.businessData as unknown as Business, userId });

  const draft = await prisma.outreachDraft.create({
    data: {
      userId,
      prospectId: prospect.id,
      channel: 'whatsapp',
      whatsapp: result.whatsapp,
      emailSubject: result.emailSubject,
      emailBody: result.emailBody,
      framework: result.framework,
      opportunityTitle: result.opportunity?.title,
      opportunityReason: result.opportunity?.reason,
      priorContext: result.priorContext ?? undefined,
      status: 'pending',
    },
  });

  await logAgentActivity({
    userId,
    agentKey: 'outreach',
    action: 'draft_prepared',
    title: `Prepared a message for ${prospect.businessName}`,
  });

  return { status: 'completed', output: { draftId: draft.id, framework: result.framework } };
};

export const handlers: Record<TaskType, TaskHandler> = {
  detect_opportunity: detectOpportunity,
  draft_outreach: draftOutreach,
};
