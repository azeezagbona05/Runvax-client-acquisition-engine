/**
 * Code-level activation switches for anything that reaches the outside world.
 *
 * These are deliberately constants, not environment variables: turning one on
 * requires a reviewed code change, so no env misconfiguration, API request,
 * UI action or task retry can activate a live call. Each also has its own
 * env gate (IA_PLACES_ENABLED, IA_CRAWLER_ENABLED + IA_CRAWLER_POLICY_URL);
 * both must be satisfied.
 *
 * Phase 2 (approved 2026-10-14): everything off. Google Places is pending legal
 * review (docs/places-activation-dependencies.md); live website, PageSpeed and
 * DNS access need separate approval of a live run.
 * tests/acquisition/activation.test.ts fails if any of these is changed, so a
 * flip can't slip through unnoticed.
 */
export const ACTIVATION = {
  googlePlaces: false,
  liveWebFetch: false,
  pagespeedApi: false,
  liveDns: false,
} as const;

export type ActivationKey = keyof typeof ACTIVATION;

export class ActivationError extends Error {
  constructor(public key: ActivationKey, detail: string) {
    super(`${key} is not activated: ${detail}`);
  }
}
