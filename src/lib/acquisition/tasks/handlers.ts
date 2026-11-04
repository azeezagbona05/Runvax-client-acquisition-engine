import type { AcqTaskHandler, AcqTaskType } from './types';
import { placesActivation, searchPlaces } from '../places/adapter';
import { getIndustry } from '../config/registry';
import { researchContacts, audit, strategize } from '../research/handlers';

const notImplemented: AcqTaskHandler = async () => ({ status: 'skipped', output: { reason: 'not_implemented' } });

// Places discovery runs only when both activation gates are open. While they are closed the task
// finishes as "skipped" (never "failed", so it is never retried) and reserves no budget or request.
const discover: AcqTaskHandler = async (ctx) => {
  const a = placesActivation();
  if (!a.allowed) return { status: 'skipped', output: { reason: 'places_disabled', detail: a.reasons } };
  const industry = getIndustry(String(ctx.input.industryKey));
  const area = String(ctx.input.area ?? '');
  const queryIndex = Number(ctx.input.queryIndex);
  if (!industry || !industry.geography.priorityAreas.includes(area) || !Number.isInteger(queryIndex)) return { status: 'skipped', output: { reason: 'unknown_area_or_industry' } };
  const r = await searchPlaces({ userId: ctx.userId, industry, area, queryIndex });
  if (r.ok) return { status: 'completed', output: { found: r.found, kept: r.kept, excluded: r.excluded, area, queryIndex } };
  if (r.reason === 'failed') {
    if (r.transient) throw new Error(r.detail); // retried with backoff
    return { status: 'skipped', output: { reason: 'provider_refused', detail: r.detail } };
  }
  return { status: 'skipped', output: { reason: 'budget_exhausted' }, deferUntil: r.retryAt };
};

export const acqHandlers: Record<AcqTaskType, AcqTaskHandler> = {
  'acq.discover': discover,
  // Resolved at call time: research/handlers is part of an import cycle
  // (research → contacts → queue → this registry), so binding the functions
  // when this module loads could capture them before they exist.
  'acq.research_contacts': (ctx) => researchContacts(ctx),
  'acq.audit': (ctx) => audit(ctx),
  'acq.strategize': (ctx) => strategize(ctx),
  // Outreach-phase agents: not part of Phase 2. They stay explicit no-ops and
  // nothing in Phase 2 enqueues them (tests/acquisition/boundaries.test.ts).
  'acq.draft_outreach': notImplemented,
  'acq.classify_reply': notImplemented,
  'acq.follow_up': notImplemented,
  'acq.qualify': notImplemented,
};
