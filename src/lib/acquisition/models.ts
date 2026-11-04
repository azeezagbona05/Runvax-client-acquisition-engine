/**
 * Model selection and cost estimation for acquisition agents, in one place.
 * Override per agent with IA_MODEL_<AGENT> (e.g. IA_MODEL_AUDIT=gpt-4o) or
 * globally with IA_MODEL_DEFAULT. Prices are list-price estimates used for
 * the "estimated cost" column only — never treat them as an invoice.
 */

export const AGENTS = ['discovery', 'contacts', 'audit', 'strategy', 'outreach', 'followup', 'conversion'] as const;
export type AgentKey = (typeof AGENTS)[number];

const FALLBACK_MODEL = 'gpt-4o-mini';

export function modelFor(agent: AgentKey): string {
  return process.env[`IA_MODEL_${agent.toUpperCase()}`] || process.env.IA_MODEL_DEFAULT || FALLBACK_MODEL;
}

// USD per 1M tokens [input, output]. Unknown models get no estimate.
const PRICES: Record<string, [number, number]> = {
  'gpt-4o-mini': [0.15, 0.6],
  'gpt-4o': [2.5, 10],
};

/** Estimated cost in micro-dollars, or null when the model has no price entry. */
export function estimateCostMicros(model: string, inputTokens = 0, outputTokens = 0): number | null {
  const p = PRICES[model];
  if (!p) return null;
  return Math.round(inputTokens * p[0] + outputTokens * p[1]);
}
