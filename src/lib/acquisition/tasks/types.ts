import { z } from 'zod';
import type { AgentKey } from '../models';

/**
 * The seven agents' task types. Namespaced "acq." and stored in
 * AcquisitionTask only — the existing AgentTask queue never sees them.
 */
export const TASK_TYPES = {
  'acq.discover': 'discovery',
  'acq.research_contacts': 'contacts',
  'acq.audit': 'audit',
  'acq.strategize': 'strategy',
  'acq.draft_outreach': 'outreach',
  'acq.classify_reply': 'followup',
  'acq.follow_up': 'followup',
  'acq.qualify': 'conversion',
} as const satisfies Record<string, AgentKey>;

export type AcqTaskType = keyof typeof TASK_TYPES;

export function isTaskType(t: string): t is AcqTaskType {
  return t in TASK_TYPES;
}

// Every task names its industry. `runKey` lets a caller deliberately request a
// fresh run of otherwise-identical work (e.g. a monthly re-audit) without
// defeating idempotency for accidental repeats. Agent-specific fields are
// added per type as each agent is built.
const base = z.strictObject({
  industryKey: z.string().min(1),
  runKey: z.string().max(64).optional(),
});

export const TASK_INPUT_SCHEMAS: Record<AcqTaskType, z.ZodType<Record<string, unknown>>> = {
  // Discovery names the area (the run route requires both; the handler skips a task that lacks them) (one of the industry's priority areas) and which of its search queries to run.
  'acq.discover': base.extend({ area: z.string().min(2).max(60).optional(), queryIndex: z.number().int().min(0).max(20).optional() }),
  'acq.research_contacts': base,
  'acq.audit': base,
  'acq.strategize': base,
  'acq.draft_outreach': base,
  'acq.classify_reply': base,
  'acq.follow_up': base,
  'acq.qualify': base,
};

export interface AcqTaskContext {
  taskId: string;
  runId: string;
  userId: string;
  acqProspectId: string | null;
  input: Record<string, unknown>;
  attempt: number;
  signal: AbortSignal;
}

export interface AcqNextTask {
  type: AcqTaskType;
  acqProspectId?: string;
  input: Record<string, unknown>;
  delayMs?: number;
}

/** A handler returns data and follow-up tasks — never free-form instructions. */
export interface AcqTaskOutcome {
  status: 'completed' | 'skipped';
  /** Budget exhausted / provider paused: retry at this time without spending an attempt. */
  deferUntil?: Date;
  output?: Record<string, unknown>;
  evidenceRefs?: string[];
  next?: AcqNextTask[];
}

export type AcqTaskHandler = (ctx: AcqTaskContext) => Promise<AcqTaskOutcome>;
