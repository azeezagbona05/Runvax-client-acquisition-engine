/**
 * A small in-memory stand-in for the Prisma client — just enough of the query
 * surface (equality / in / lt / lte / gt / gte / not filters, increment,
 * orderBy, take, unique constraints) for the queue and route tests. It is not
 * a Prisma emulator: tests that need anything richer should stub explicitly.
 */

type Row = Record<string, unknown>;

// Column defaults mirrored from prisma/schema.prisma for the models tests create.
const DEFAULTS: Record<string, () => Row> = {
  agentTask: () => ({ status: 'pending', attempts: 0, maxAttempts: 3, scheduledAt: new Date(), startedAt: null, completedAt: null, error: null, output: null, parentTaskId: null }),
  acquisitionTask: () => ({ status: 'pending', attempts: 0, maxAttempts: 3, scheduledAt: new Date(), lockedUntil: null, completedAt: null, error: null, output: null, parentTaskId: null, acqProspectId: null }),
  acquisitionProspect: () => ({ state: 'discovered', fitScore: null, scoreIsEstimate: true, discoveredAt: new Date(), lastVerifiedAt: null, updatedAt: new Date(), candidateId: null, importBatchId: null, area: null, orgDomain: null, crmConflict: null, lastScoredAt: null }),
  acquisitionAgentRun: () => ({ startedAt: new Date(), finishedAt: null, durationMs: null, error: null, provider: null, model: null, evidenceRefs: null }),
  acquisitionProviderUsage: () => ({ calls: 0, consecutiveFailures: 0, lastFailureAt: null, pausedUntil: null, updatedAt: new Date() }),
  acquisitionSuppression: () => ({ value: null, expiresAt: null }),
  acquisitionDecisionMaker: () => ({ name: null, role: null, email: null, phone: null, channel: 'email', verification: 'unverified', confidence: 'low', kind: 'role_inbox', contactKey: null, sourceUrl: null, sourceNote: null, evidenceQuote: null, mxValid: null, lastVerifiedAt: null, lawfulBasis: 'legitimate_interest_b2b', retainUntil: null, flags: null, observedAt: new Date() }),
  acquisitionSignal: () => ({ supersededAt: null, observedAt: new Date(), lastVerifiedAt: new Date(), sourceId: null, sourceUrl: null, evidenceQuote: null, value: null }),
  acquisitionCandidate: () => ({ status: 'pending_research', acqProspectId: null, area: null, queryIndex: null, discoveredAt: new Date(), updatedAt: new Date() }),
  acquisitionImportBatch: () => ({ status: 'previewed', rowCount: 0, acceptedCount: 0, duplicateCount: 0, rejectedCount: 0, rows: null, results: null, attestedBy: null, attestedAt: null }),
  // `conversations` stands in for `include: { conversations }`, which the fake does not implement (empty = none logged).
  prospect: () => ({ stage: 'found', notes: null, outreachSentAt: null, source: null, campaignId: null, savedAt: new Date(), updatedAt: new Date(), conversations: [] }),
};

// Unique constraints mirrored from the schema, so P2002 behaviour is testable.
const UNIQUE: Record<string, string[][]> = {
  prospect: [['userId', 'businessId']],
  acquisitionTask: [['userId', 'idempotencyKey']],
  acquisitionDraft: [['userId', 'idempotencyKey']],
  acquisitionSuppression: [['userId', 'kind', 'valueHash']],
  acquisitionProspect: [['prospectId']],
  acquisitionCandidate: [['userId', 'placeId']],
  acquisitionImportBatch: [['userId', 'fileHash']],
  acquisitionIdentity: [['userId', 'kind', 'value']],
  acquisitionSignal: [['acqProspectId', 'code', 'contentHash']],
  acquisitionScore: [['acqProspectId', 'inputHash']],
  acquisitionPageCache: [['userId', 'urlHash']],
  acquisitionProviderUsage: [['provider', 'day']],
  acquisitionDecisionMaker: [['acqProspectId', 'email'], ['acqProspectId', 'contactKey']],
  acquisitionFinding: [['acqProspectId', 'findingKey']],
  acquisitionRecommendation: [['acqProspectId', 'scoreId']],
  acquisitionSource: [['acqProspectId', 'kind', 'contentHash']],
};

const store = new Map<string, Row[]>();
let seq = 0;

function table(model: string): Row[] {
  if (!store.has(model)) store.set(model, []);
  return store.get(model)!;
}

function cmp(a: unknown, b: unknown): number {
  const x = a instanceof Date ? a.getTime() : (a as number);
  const y = b instanceof Date ? b.getTime() : (b as number);
  return x < y ? -1 : x > y ? 1 : 0;
}

function matchValue(value: unknown, cond: unknown): boolean {
  if (cond === null || typeof cond !== 'object' || cond instanceof Date) {
    if (cond instanceof Date && value instanceof Date) return value.getTime() === cond.getTime();
    return (value ?? null) === cond;
  }
  const c = cond as Record<string, unknown>;
  if ('in' in c && !(c.in as unknown[]).includes(value)) return false;
  if ('notIn' in c && (c.notIn as unknown[]).includes(value)) return false;
  if ('not' in c && matchValue(value, c.not)) return false;
  if ('lt' in c && !(value != null && cmp(value, c.lt) < 0)) return false;
  if ('lte' in c && !(value != null && cmp(value, c.lte) <= 0)) return false;
  if ('gt' in c && !(value != null && cmp(value, c.gt) > 0)) return false;
  if ('gte' in c && !(value != null && cmp(value, c.gte) >= 0)) return false;
  return true;
}

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([k, cond]) => {
    if (k === 'OR') return (cond as Row[]).some((w) => matches(row, w));
    if (k === 'AND') return (cond as Row[]).every((w) => matches(row, w));
    // Compound unique selector, e.g. { userId_idempotencyKey: { userId, idempotencyKey } }
    if (k.includes('_') && cond && typeof cond === 'object' && !(cond instanceof Date) && !('in' in (cond as Row))) {
      const parts = k.split('_');
      if (parts.every((p) => p in (cond as Row))) return matches(row, cond as Row);
    }
    return matchValue(row[k], cond);
  });
}

function applyData(row: Row, data: Row) {
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && !(v instanceof Date) && 'increment' in (v as Row)) {
      row[k] = ((row[k] as number) ?? 0) + ((v as Row).increment as number);
    } else if (v && typeof v === 'object' && !(v instanceof Date) && 'decrement' in (v as Row)) {
      row[k] = ((row[k] as number) ?? 0) - ((v as Row).decrement as number);
    } else if (v !== undefined) {
      row[k] = v;
    }
  }
}

function checkUnique(model: string, candidate: Row, selfId?: unknown) {
  for (const cols of UNIQUE[model] ?? []) {
    const clash = table(model).find(
      (r) => r.id !== selfId && cols.every((c) => candidate[c] != null && r[c] === candidate[c]),
    );
    if (clash) {
      const err = new Error(`Unique constraint failed on ${cols.join(',')}`) as Error & { code: string };
      err.code = 'P2002';
      throw err;
    }
  }
}

function sortRows(rows: Row[], orderBy?: Row | Row[]): Row[] {
  if (!orderBy) return rows;
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((a, b) => {
    for (const o of orders) {
      const [k, dir] = Object.entries(o)[0];
      const c = cmp(a[k], b[k]);
      if (c !== 0) return dir === 'desc' ? -c : c;
    }
    return 0;
  });
}

function delegate(model: string) {
  const findMany = async (args: Row = {}) => {
    let rows = table(model).filter((r) => matches(r, args.where as Row));
    rows = sortRows(rows, args.orderBy as Row);
    if (typeof args.take === 'number') rows = rows.slice(0, args.take);
    return rows.map((r) => ({ ...r }));
  };
  const create = async (args: { data: Row }) => {
    const row: Row = { id: `${model}_${++seq}`, createdAt: new Date(), ...(DEFAULTS[model]?.() ?? {}) };
    applyData(row, args.data);
    checkUnique(model, row);
    table(model).push(row);
    return { ...row };
  };
  return {
    findMany,
    create,
    createMany: async (args: { data: Row[]; skipDuplicates?: boolean }) => {
      let count = 0;
      for (const d of args.data) {
        try { await create({ data: d }); count++; } catch (e) { if (!args.skipDuplicates) throw e; }
      }
      return { count };
    },
    upsert: async (args: { where: Row; create: Row; update: Row }) => {
      const row = table(model).find((r) => matches(r, args.where));
      if (row) { applyData(row, args.update); return { ...row }; }
      return create({ data: args.create });
    },
    delete: async (args: { where: Row }) => {
      const t = table(model);
      const i = t.findIndex((r) => matches(r, args.where));
      if (i < 0) {
        const err = new Error('Record to delete does not exist') as Error & { code: string };
        err.code = 'P2025';
        throw err;
      }
      return t.splice(i, 1)[0];
    },
    findFirst: async (args: Row = {}) => (await findMany({ ...args, take: 1 }))[0] ?? null,
    findUnique: async (args: Row) => (await findMany({ where: args.where, take: 1 }))[0] ?? null,
    count: async (args: Row = {}) => (await findMany({ where: args.where })).length,
    update: async (args: { where: Row; data: Row }) => {
      const row = table(model).find((r) => matches(r, args.where));
      if (!row) {
        const err = new Error('Record to update not found') as Error & { code: string };
        err.code = 'P2025';
        throw err;
      }
      const next = { ...row };
      applyData(next, args.data);
      checkUnique(model, next, row.id);
      Object.assign(row, next);
      return { ...row };
    },
    updateMany: async (args: { where?: Row; data: Row }) => {
      const rows = table(model).filter((r) => matches(r, args.where));
      // Enforce unique constraints like MySQL: all-or-nothing for the batch.
      const next = rows.map((r) => { const n = { ...r }; applyData(n, args.data); return n; });
      next.forEach((n) => checkUnique(model, n, n.id));
      rows.forEach((r, i) => Object.assign(r, next[i]));
      return { count: rows.length };
    },
    deleteMany: async (args: { where?: Row } = {}) => {
      const keep = table(model).filter((r) => !matches(r, args.where));
      const count = table(model).length - keep.length;
      store.set(model, keep);
      return { count };
    },
  };
}

const delegates = new Map<string, ReturnType<typeof delegate>>();

export const fakePrisma = new Proxy({} as Record<string, unknown>, {
  get(_t, prop: string) {
    if (prop === '$transaction') {
      return async (arg: unknown) =>
        typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(fakePrisma) : Promise.all(arg as unknown[]);
    }
    if (prop === 'then') return undefined; // not a thenable
    if (!delegates.has(prop)) delegates.set(prop, delegate(prop));
    return delegates.get(prop);
  },
}) as any; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Direct access to stored rows, for seeding and assertions. */
export function rows(model: string): Row[] {
  return table(model);
}

export function seed(model: string, data: Row): Row {
  const row: Row = { id: `${model}_${++seq}`, createdAt: new Date(), ...(DEFAULTS[model]?.() ?? {}), ...data };
  table(model).push(row);
  return row;
}

export function resetFakePrisma() {
  store.clear();
  delegates.clear();
  seq = 0;
}
