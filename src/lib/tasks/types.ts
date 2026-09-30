export type TaskType = 'detect_opportunity' | 'draft_outreach';

export interface TaskContext {
  taskId: string;
  userId: string;
  prospectId: string | null;
  input: Record<string, unknown>;
}

export interface NextTask {
  type: TaskType;
  prospectId?: string;
  input?: Record<string, unknown>;
}

/** Structured result — an agent hands over data and follow-up tasks, never prose. */
export interface TaskOutcome {
  status: 'completed' | 'skipped';
  output?: Record<string, unknown>;
  next?: NextTask[];
}

export type TaskHandler = (ctx: TaskContext) => Promise<TaskOutcome>;
