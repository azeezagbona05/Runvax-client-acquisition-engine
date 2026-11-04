import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { acquisitionEnabled } from '../flag';
import { errorMessage } from '../redact';
import { acqHandlers } from './handlers';
import { reserve } from '../budget';
import { runMaintenance } from '../maintenance';
import { assertSuppressionKey } from '../suppression';
import { TASK_TYPES, TASK_INPUT_SCHEMAS, isTaskType } from './types';
import type { AcqTaskType, AcqTaskHandler, AcqTaskContext } from './types';

/**
 * The acquisition engine's own queue, modelled on src/lib/tasks/queue.ts but
 * on a separate table, with its own budget, so neither queue can starve or
 * double-process the other. Differences from the original, all deliberate:
 *   - idempotency is a DB unique key, not a "same type still open" check;
 *   - claims carry a lease (lockedUntil) instead of a fixed stale window;
 *   - handlers run under a timeout with an AbortSignal;
 *   - backoff is exponential and exhausted tasks go to "dead";
 *   - every attempt is recorded as an AcquisitionAgentRun.
 */

const DEFAULT_BUDGET = 10;
const MAX_BUDGET = 50;
const DEFAULT_TIMEOUT_MS = 45_000; // inside Vercel's 60s function limit
const LEASE_GRACE_MS = 15_000;
const BASE_BACKOFF_MS = 10 * 60 * 1000;
const MAX_BACKOFF_MS = 2 * 60 * 60 * 1000;

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export function resolveBudget(requested?: number): number {
  const configured = clampInt(process.env.IA_TASK_BUDGET, DEFAULT_BUDGET, 1, MAX_BUDGET);
  return requested == null ? configured : clampInt(requested, configured, 1, MAX_BUDGET);
}

export function resolveTimeoutMs(): number {
  return clampInt(process.env.IA_TASK_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 1_000, 55_000);
}

export function backoffMs(attempt: number): number {
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempt - 1));
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().filter((k) => obj[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export function hashInput(input: unknown): string {
  return crypto.createHash('sha256').update(stableStringify(input)).digest('hex');
}

export function idempotencyKeyFor(type: AcqTaskType, acqProspectId: string | null | undefined, input: unknown): string {
  return `${type}:${acqProspectId ?? '-'}:${hashInput(input).slice(0, 32)}`;
}

/**
 * Adds a task, or returns the existing one if identical work (same type,
 * prospect and input) was ever queued — repeats never create duplicates.
 */
export async function enqueueAcqTask(params: {
  userId: string;
  type: AcqTaskType;
  acqProspectId?: string | null;
  parentTaskId?: string;
  input: Record<string, unknown>;
  delayMs?: number;
  maxAttempts?: number;
}): Promise<{ id: string; created: boolean }> {
  if (!isTaskType(params.type)) throw new Error(`Unknown acquisition task type "${params.type}"`);
  const input = TASK_INPUT_SCHEMAS[params.type].parse(params.input);
  const idempotencyKey = idempotencyKeyFor(params.type, params.acqProspectId, input);

  try {
    const task = await prisma.acquisitionTask.create({
      data: {
        userId: params.userId,
        type: params.type,
        acqProspectId: params.acqProspectId ?? null,
        parentTaskId: params.parentTaskId,
        idempotencyKey,
        input: input as Prisma.InputJsonValue,
        maxAttempts: clampInt(params.maxAttempts, 3, 1, 5),
        scheduledAt: new Date(Date.now() + Math.max(0, params.delayMs ?? 0)),
      },
    });
    return { id: task.id, created: true };
  } catch (err) {
    if ((err as { code?: string }).code !== 'P2002') throw err;
    const existing = await prisma.acquisitionTask.findFirst({
      where: { userId: params.userId, idempotencyKey },
      select: { id: true },
    });
    if (!existing) throw err;
    return { id: existing.id, created: false };
  }
}

/** Cancels a prospect's not-yet-started work, e.g. after an opt-out. */
export async function cancelAcqTasks(userId: string, acqProspectId: string, reason: string): Promise<number> {
  const res = await prisma.acquisitionTask.updateMany({
    where: { userId, acqProspectId, status: 'pending' },
    data: { status: 'cancelled', error: `cancelled: ${reason}`.slice(0, 1000), completedAt: new Date() },
  });
  return res.count;
}

const OutcomeSchema = z.strictObject({
  status: z.enum(['completed', 'skipped']),
  // Budget exhausted / provider paused: put the task back for later without
  // spending one of its attempts.
  deferUntil: z.date().optional(),
  output: z.record(z.string(), z.unknown()).optional(),
  evidenceRefs: z.array(z.string()).max(200).optional(),
  next: z.array(z.strictObject({
    type: z.string().refine(isTaskType, 'unknown task type'),
    acqProspectId: z.string().optional(),
    input: z.record(z.string(), z.unknown()),
    delayMs: z.number().int().min(0).max(30 * 24 * 60 * 60 * 1000).optional(),
  })).max(10).optional(),
});

function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      // Reject before aborting: a handler that settles on abort must not win the race.
      reject(new Error(`Task timed out after ${ms}ms`));
      controller.abort();
    }, ms);
  });
  return Promise.race([run(controller.signal), timeout]).finally(() => clearTimeout(timer));
}

export interface AcqDrainResult {
  disabled: boolean;
  budget: number;
  claimed: number;
  completed: number;
  skipped: number;
  deferred: number;
  retried: number;
  dead: number;
  /** True when the platform-wide daily task cap (IA_DAILY_TASK_CAP) stopped the run. */
  dailyCapReached: boolean;
  pageCachePurged: number;
  importsExpired: number;
  /** Why the run did not start (e.g. no valid suppression key: fail closed). */
  blocked?: string;
}

export async function drainAcqTasks(opts: {
  budget?: number;
  handlers?: Record<AcqTaskType, AcqTaskHandler>;
} = {}): Promise<AcqDrainResult> {
  const budget = resolveBudget(opts.budget);
  const result: AcqDrainResult = {
    disabled: false, budget, claimed: 0, completed: 0, skipped: 0, deferred: 0, retried: 0, dead: 0,
    dailyCapReached: false, pageCachePurged: 0, importsExpired: 0,
  };
  if (!acquisitionEnabled()) return { ...result, disabled: true };
  try { assertSuppressionKey(); } catch { return { ...result, disabled: true, blocked: 'suppression_key_missing' }; }
  const before = await runMaintenance();

  const handlers = opts.handlers ?? acqHandlers;
  const timeoutMs = resolveTimeoutMs();

  // A lease that ran out means the runner died mid-task (deploy, crash).
  await prisma.acquisitionTask.updateMany({
    where: { status: 'running', lockedUntil: { lt: new Date() } },
    data: { status: 'pending', lockedUntil: null },
  });

  while (result.claimed < budget) {
    const candidate = await prisma.acquisitionTask.findFirst({
      where: { status: 'pending', scheduledAt: { lte: new Date() } },
      orderBy: { scheduledAt: 'asc' },
    });
    if (!candidate) break;

    // Attempts already spent by runs that crashed before recording a result.
    if (candidate.attempts >= candidate.maxAttempts) {
      await prisma.acquisitionTask.updateMany({
        where: { id: candidate.id, status: 'pending' },
        data: { status: 'dead', error: candidate.error ?? 'attempts exhausted', completedAt: new Date() },
      });
      result.dead++;
      continue;
    }

    // Platform-wide daily execution cap, reserved atomically like any provider.
    const slot = await reserve('acq_tasks');
    if (!slot.ok) { result.dailyCapReached = true; break; }

    const claim = await prisma.acquisitionTask.updateMany({
      where: { id: candidate.id, status: 'pending' },
      data: { status: 'running', lockedUntil: new Date(Date.now() + timeoutMs + LEASE_GRACE_MS), attempts: { increment: 1 } },
    });
    if (claim.count === 0) continue;
    result.claimed++;

    const attempt = candidate.attempts + 1;
    const run = await prisma.acquisitionAgentRun.create({
      data: {
        userId: candidate.userId,
        taskId: candidate.id,
        agent: isTaskType(candidate.type) ? TASK_TYPES[candidate.type] : 'unknown',
        attempt,
        status: 'running',
        inputHash: hashInput(candidate.input ?? {}),
      },
    });
    const started = Date.now();

    try {
      if (!isTaskType(candidate.type)) throw new Error(`Unknown acquisition task type "${candidate.type}"`);
      const type = candidate.type;
      const input = TASK_INPUT_SCHEMAS[type].parse(candidate.input ?? {});
      const raw = await withTimeout((signal) => {
        const ctx: AcqTaskContext = {
          taskId: candidate.id,
          runId: run.id,
          userId: candidate.userId,
          acqProspectId: candidate.acqProspectId,
          input,
          attempt,
          signal,
        };
        return handlers[type](ctx);
      }, timeoutMs);
      const outcome = OutcomeSchema.parse(raw);

      if (outcome.deferUntil) {
        await prisma.acquisitionTask.updateMany({
          where: { id: candidate.id, status: 'running' },
          data: { status: 'pending', scheduledAt: outcome.deferUntil, lockedUntil: null, attempts: { decrement: 1 }, error: `deferred: ${String(outcome.output?.reason ?? 'budget')}` },
        });
        await prisma.acquisitionAgentRun.update({
          where: { id: run.id },
          data: { status: 'deferred', finishedAt: new Date(), durationMs: Date.now() - started },
        });
        result.deferred++;
        continue;
      }

      // Conditional on still running: a task cancelled mid-flight stays cancelled.
      const done = await prisma.acquisitionTask.updateMany({
        where: { id: candidate.id, status: 'running' },
        data: {
          status: outcome.status,
          output: (outcome.output ?? {}) as Prisma.InputJsonValue,
          completedAt: new Date(),
          lockedUntil: null,
          error: null,
        },
      });
      await prisma.acquisitionAgentRun.update({
        where: { id: run.id },
        data: {
          status: 'succeeded',
          finishedAt: new Date(),
          durationMs: Date.now() - started,
          evidenceRefs: outcome.evidenceRefs ? (outcome.evidenceRefs as Prisma.InputJsonValue) : undefined,
        },
      });
      result[outcome.status]++;
      if (done.count === 0) continue;

      for (const next of outcome.next ?? []) {
        await enqueueAcqTask({
          userId: candidate.userId,
          type: next.type as AcqTaskType,
          acqProspectId: next.acqProspectId ?? candidate.acqProspectId,
          parentTaskId: candidate.id,
          input: next.input,
          delayMs: next.delayMs,
        });
      }
    } catch (err) {
      const message = errorMessage(err);
      const exhausted = attempt >= candidate.maxAttempts;
      await prisma.acquisitionTask.updateMany({
        where: { id: candidate.id, status: 'running' },
        data: exhausted
          ? { status: 'dead', error: message, completedAt: new Date(), lockedUntil: null }
          : { status: 'pending', error: message, lockedUntil: null, scheduledAt: new Date(Date.now() + backoffMs(attempt)) },
      });
      await prisma.acquisitionAgentRun.update({
        where: { id: run.id },
        data: { status: 'failed', error: message, finishedAt: new Date(), durationMs: Date.now() - started },
      });
      if (exhausted) result.dead++;
      else result.retried++;
      console.error('[acquisition] task failed', candidate.type, candidate.id, message);
    }
  }

  const after = await runMaintenance();
  result.pageCachePurged = before.pagesPurged + after.pagesPurged;
  result.importsExpired = before.importsExpired + after.importsExpired;
  return result;
}
