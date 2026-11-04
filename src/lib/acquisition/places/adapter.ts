import { prisma } from '@/lib/prisma';
import { ACTIVATION, ActivationError } from '../activation';
import type { IndustryConfig } from '../config/schema';

import { reserve, recordSuccess, recordFailure } from '../budget';

/**
 * Google Places discovery: built but DISABLED.
 *
 * It runs only when BOTH the code-level switch (ACTIVATION.googlePlaces, a reviewed
 * change guarded by tests) and the env flag IA_PLACES_ENABLED are on. Activation
 * also depends on unresolved legal questions (prospecting use, the "listings or
 * directory service" restriction, storing a website URL first learned from
 * Places); see docs/places-activation-dependencies.md. Storing only place_id does
 * not by itself make the overall use permissible.
 *
 * What a run does: one Text Search with the minimal field mask, after reserving
 * the daily budget. Results are used in memory to exclude suppliers, labs and
 * closed businesses and then dropped; only place_id plus our own metadata is
 * written (ingestPlacesResults). A clinic found this way has no website of its
 * own on file: it needs an independent source before it can become a prospect
 * (see candidates.ts).
 */

/** The only fields a future Text Search would request. No coordinates, contact, rating or review fields. */
export const PLACES_FIELD_MASK = 'places.id,places.displayName,places.types,places.businessStatus';

export function placesActivation(): { allowed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!ACTIVATION.googlePlaces) reasons.push('ACTIVATION.googlePlaces is false (code-level switch)');
  if (process.env.IA_PLACES_ENABLED !== 'true') reasons.push('IA_PLACES_ENABLED is not "true"');
  if (!ACTIVATION.googlePlaces) reasons.push('legal review pending (docs/places-activation-dependencies.md)');
  return { allowed: reasons.length === 0, reasons };
}

export function buildTextSearchRequest(industry: IndustryConfig, area: string, queryIndex: number) {
  const q = industry.discovery.placesQueries[queryIndex];
  if (!q) throw new Error(`No discovery query at index ${queryIndex}`);
  return {
    textQuery: `${q} in ${area}, ${industry.geography.city}`,
    pageSize: 20,
    fieldMask: PLACES_FIELD_MASK,
  };
}

/** A Places result as held in memory for one task. Never persisted as-is. */
export interface TransientPlace {
  id: string;
  displayName?: { text?: string };
  types?: string[];
  businessStatus?: string;
}

export type PlacesTransport = (req: { textQuery: string; pageSize: number; fieldMask: string }) => Promise<TransientPlace[]>;

/** The one live call. Only reached through searchPlaces() once every gate is open. */
export const livePlacesTransport: PlacesTransport = async (req) => {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY is not set');
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': req.fieldMask },
    body: JSON.stringify({ textQuery: req.textQuery, pageSize: req.pageSize }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw Object.assign(new Error(`Places HTTP ${res.status}`), { status: res.status });
  const json = await res.json() as { places?: TransientPlace[] };
  return Array.isArray(json.places) ? json.places : [];
};

export type SearchOutcome =
  | { ok: true; kept: number; excluded: number; found: number }
  | { ok: false; reason: 'cap_reached' | 'provider_paused'; retryAt: Date }
  | { ok: false; reason: 'failed'; transient: boolean; detail: string };

/**
 * One discovery search for an area. Throws ActivationError before anything else
 * (no budget reserved, no request) unless both gates are open.
 */
export async function searchPlaces(params: {
  userId: string; industry: IndustryConfig; area: string; queryIndex: number; transport?: PlacesTransport;
}): Promise<SearchOutcome> {
  const a = placesActivation();
  if (!a.allowed) throw new ActivationError('googlePlaces', a.reasons.join('; '));
  const request = buildTextSearchRequest(params.industry, params.area, params.queryIndex);
  const slot = await reserve('google_places');
  if (!slot.ok) return { ok: false, reason: slot.reason, retryAt: slot.retryAt };
  let places: TransientPlace[];
  try {
    places = await (params.transport ?? livePlacesTransport)(request);
  } catch (err) {
    const status = (err as { status?: number }).status;
    const quota = status === 429 || status === 403;
    await recordFailure('google_places', quota ? 'quota' : 'transient');
    return { ok: false, reason: 'failed', transient: !quota, detail: status ? `Places HTTP ${status}` : 'Places request failed' };
  }
  await recordSuccess('google_places');
  const { kept, excluded } = await ingestPlacesResults({ userId: params.userId, industry: params.industry, area: params.area, queryIndex: params.queryIndex, results: places });
  return { ok: true, kept, excluded, found: places.length };
}


/**
 * The ingestion rule for a future activation: only place_id plus OUR OWN
 * metadata (the industry, the area we searched, our query index, our status)
 * is written. Name, types and status are used in memory to exclude
 * suppliers / labs / closed businesses and are then dropped.
 */
export async function ingestPlacesResults(params: {
  userId: string; industry: IndustryConfig; area: string; queryIndex: number; results: TransientPlace[];
}): Promise<{ kept: number; excluded: number }> {
  let kept = 0;
  let excluded = 0;
  const excludeWords = params.industry.discovery.excludeKeywords.map((w) => w.toLowerCase());
  for (const p of params.results) {
    if (!p?.id || !/^[A-Za-z0-9_-]{10,300}$/.test(p.id)) { excluded++; continue; }
    const name = (p.displayName?.text ?? '').toLowerCase();
    const closed = p.businessStatus && p.businessStatus !== 'OPERATIONAL';
    const wrongType = params.industry.discovery.placesTypes.length > 0 && p.types && !p.types.some((t) => params.industry.discovery.placesTypes.includes(t));
    const status = closed || wrongType || excludeWords.some((w) => name.includes(w)) ? 'excluded' : 'no_independent_source';
    if (status === 'excluded') excluded++; else kept++;
    try {
      await prisma.acquisitionCandidate.create({
        data: { userId: params.userId, industryKey: params.industry.id, placeId: p.id, area: params.area, queryIndex: params.queryIndex, status },
      });
    } catch (err) {
      if ((err as { code?: string }).code !== 'P2002') throw err;
    }
  }
  return { kept, excluded };
}
