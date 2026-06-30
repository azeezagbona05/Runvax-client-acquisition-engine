// Pure plan→feature mapping. No server-only imports (no prisma), so this file
// is safe to import from both client components and API routes.

export type FeatureId = 'emailBlast' | 'proposals' | 'marketBrief' | 'weaknessAnalysis';

// The full catalog of gateable features — order is what the admin panel renders.
export const ALL_FEATURES: FeatureId[] = ['emailBlast', 'proposals', 'marketBrief', 'weaknessAnalysis'];

// Human-readable names used in upgrade prompts, error messages and the admin UI.
export const FEATURE_LABELS: Record<FeatureId, string> = {
  emailBlast: 'Email Blast',
  proposals: 'AI Proposals',
  marketBrief: 'Market Intelligence Briefs',
  weaknessAnalysis: 'Website Weakness Analysis',
};

// Default features each built-in plan unlocks, used when a plan has no explicit
// `features` value stored in the DB. Mirrors the pricing page: Free gets none;
// Pro and Agency get all of them.
const PLAN_FEATURES: Record<string, FeatureId[]> = {
  free: [],
  pro: [...ALL_FEATURES],
  agency: [...ALL_FEATURES],
};

/** The default feature set for a plan id when nothing is stored in the DB. */
export function defaultFeaturesFor(plan: string | undefined | null): FeatureId[] {
  const p = plan ?? 'free';
  if (p in PLAN_FEATURES) return PLAN_FEATURES[p];
  // Unknown/custom paid plans default to everything; only 'free' is restricted.
  return p === 'free' ? [] : [...ALL_FEATURES];
}

/** Parse a stored CSV value into a clean FeatureId[]. */
export function parseFeatures(raw: string | null | undefined): FeatureId[] {
  if (raw == null) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is FeatureId => (ALL_FEATURES as string[]).includes(s));
}

/** Serialize a FeatureId[] for DB storage. Returns '' (not null) so an empty
 *  admin selection is stored as "explicitly none", distinct from NULL = defaults. */
export function serializeFeatures(features: FeatureId[]): string {
  return ALL_FEATURES.filter((f) => features.includes(f)).join(',');
}

/**
 * Resolve a plan's effective features from its stored CSV value, falling back to
 * code defaults when the value is NULL (never been set by an admin).
 */
export function resolveFeatures(plan: string, raw: string | null | undefined): FeatureId[] {
  return raw == null ? defaultFeaturesFor(plan) : parseFeatures(raw);
}

/**
 * Static fallback used by the client before the live plan config has loaded.
 * Unknown/custom paid plans unlock everything — only 'free' is restricted.
 */
export function planHasFeature(plan: string | undefined | null, feature: FeatureId): boolean {
  return defaultFeaturesFor(plan).includes(feature);
}
