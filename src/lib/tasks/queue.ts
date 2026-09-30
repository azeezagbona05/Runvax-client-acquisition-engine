import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { handlers } from './handlers';
import type { TaskType, TaskContext } from './types';

const STALE_RUNNING_MS = 5 * 60 * 1000;
const RETRY_BACKOFF_MS = 10 * 60 * 1000;

/**
 * Adds a task unless the same type is already open for that prospect, so a
 * cron that re-scans the same prospects never stacks duplicates.
 */
export async function enqueueTask(params: {
  userId: string;
  type: TaskType;
  prospectId: string;
  parentTaskId?: string;
  input?: Prisma.InputJsonValue;
}): Promise<string | null> {
  const open = await prisma.agentTask.findFirst({
    where: { prospectId: params.prospectId, type: params.type, status: { in: ['pending', 'running'] } },
    select: { id: true },
  });
  if (open) return null;

  const task = await prisma.agentTask.create({
    data: {
      userId: params.userId,
      type: params.type,
      prospectId: params.prospectId,
      parentTaskId: params.parentTaskId,
      input: params.input,
    },
  });
  return task.id;
}

export interface DrainResult { claimed: number; completed: number; skipped: number; retried: number; failed: number }

/**
 * Claims and runs up to `limit` due tasks. Each handler may return follow-up
 * tasks, which are enqueued for a later drain (or this one, if capacity is
 * left) — that is the whole hand-off mechanism.
 */
export async function drainTasks(limit = 20): Promise<DrainResult> {
  const result: DrainResult = { claimed: 0, completed: 0, skipped: 0, retried: 0, failed: 0 };

  // A run that died mid-flight (timeout, deploy) would otherwise sit "running" forever.
  await prisma.agentTask.updateMany({
    where: { status: 'running', startedAt: { lt: new Date(Date.now() - STALE_RUNNING_MS) } },
    data: { status: 'pending' },
  });

  while (result.claimed < limit) {
    const candidate = await prisma.agentTask.findFirst({
      where: { status: 'pending', scheduledAt: { lte: new Date() } },
      orderBy: { scheduledAt: 'asc' },
    });
    if (!candidate) break;

    // Atomic claim: only one runner flips pending → running.
    const claim = await prisma.agentTask.updateMany({
      where: { id: candidate.id, status: 'pending' },
      data: { status: 'running', startedAt: new Date(), attempts: { increment: 1 } },
    });
    if (claim.count === 0) continue;
    result.claimed++;

    const attempts = candidate.attempts + 1;
    const handler = handlers[candidate.type as TaskType];

    try {
      if (!handler) throw new Error(`No handler for task type "${candidate.type}"`);
      const ctx: TaskContext = {
        taskId: candidate.id,
        userId: candidate.userId,
        prospectId: candidate.prospectId,
        input: (candidate.input ?? {}) as Record<string, unknown>,
      };
      const outcome = await handler(ctx);

      await prisma.agentTask.update({
        where: { id: candidate.id },
        data: {
          status: outcome.status,
          output: (outcome.output ?? {}) as Prisma.InputJsonValue,
          completedAt: new Date(),
          error: null,
        },
      });
      result[outcome.status]++;

      for (const next of outcome.next ?? []) {
        await enqueueTask({
          userId: candidate.userId,
          type: next.type,
          prospectId: next.prospectId ?? candidate.prospectId ?? '',
          parentTaskId: candidate.id,
          input: next.input as Prisma.InputJsonValue | undefined,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const exhausted = attempts >= candidate.maxAttempts;
      await prisma.agentTask.update({
        where: { id: candidate.id },
        data: exhausted
          ? { status: 'failed', error: message.slice(0, 1000), completedAt: new Date() }
          : { status: 'pending', error: message.slice(0, 1000), scheduledAt: new Date(Date.now() + RETRY_BACKOFF_MS) },
      });
      exhausted ? result.failed++ : result.retried++;
      console.error('[tasks] handler failed', candidate.type, candidate.id, err);
    }
  }

  return result;
}
