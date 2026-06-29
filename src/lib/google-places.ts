const BASE = 'https://places.googleapis.com/v1';

const SEARCH_FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.primaryTypeDisplayName',
  'places.location',
  'places.businessStatus',
  'nextPageToken',
].join(',');

const DETAIL_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'nationalPhoneNumber',
  'internationalPhoneNumber',
  'websiteUri',
  'rating',
  'userRatingCount',
  'primaryTypeDisplayName',
  'location',
  'businessStatus',
  'currentOpeningHours',
  'editorialSummary',
  'types',
  'reviews',
].join(',');

export async function searchPlaces(params: {
  query: string;
  lat?: number;
  lng?: number;
  radius: number;
  maxPages?: number;
}) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY is not set in .env.local');

  const maxPages = Math.min(params.maxPages ?? 3, 3);
  const allPlaces: unknown[] = [];
  let pageToken: string | undefined;

  const baseBody: Record<string, unknown> = {
    textQuery: params.query,
    maxResultCount: 20,
    languageCode: 'en',
    ...(params.lat !== undefined && params.lng !== undefined
      ? {
          locationBias: {
            circle: {
              center: { latitude: params.lat, longitude: params.lng },
              radius: params.radius * 1000,
            },
          },
        }
      : {}),
  };

  for (let page = 0; page < maxPages; page++) {
    const body: Record<string, unknown> = pageToken
      ? { ...baseBody, pageToken }
      : baseBody;

    const res = await fetch(`${BASE}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': SEARCH_FIELDS,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Google Places error: ${res.statusText}`);
    }

    const data = await res.json();
    allPlaces.push(...(data.places || []));
    pageToken = data.nextPageToken as string | undefined;

    if (!pageToken) break;

    // Small delay between page requests to avoid hitting rate limits
    if (page < maxPages - 1) await new Promise((r) => setTimeout(r, 300));
  }

  return { places: allPlaces };
}

export async function getPlaceDetails(placeId: string) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error('GOOGLE_PLACES_API_KEY is not set in .env.local');

  const res = await fetch(`${BASE}/places/${placeId}`, {
    headers: {
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': DETAIL_FIELDS,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Google Places error: ${res.statusText}`);
  }

  return res.json();
}
