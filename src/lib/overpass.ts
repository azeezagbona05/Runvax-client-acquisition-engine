import type { Business } from '@/types';

// Keyword → OSM tag pairs. First match wins.
const QUERY_TAG_MAP: Record<string, [string, string][]> = {
  'hair salon':      [['shop', 'hairdresser']],
  'car repair':      [['shop', 'car_repair']],
  'car wash':        [['amenity', 'car_wash']],
  'filling station': [['amenity', 'fuel']],
  'gas station':     [['amenity', 'fuel']],
  'real estate':     [['office', 'estate_agent']],
  'estate agent':    [['office', 'estate_agent']],
  'guest house':     [['tourism', 'guest_house']],
  restaurant:  [['amenity', 'restaurant'], ['amenity', 'fast_food']],
  food:        [['amenity', 'restaurant'], ['amenity', 'cafe'], ['amenity', 'fast_food']],
  eatery:      [['amenity', 'restaurant'], ['amenity', 'fast_food']],
  buka:        [['amenity', 'restaurant']],
  hotel:       [['tourism', 'hotel'], ['tourism', 'guest_house'], ['tourism', 'hostel']],
  motel:       [['tourism', 'motel']],
  hostel:      [['tourism', 'hostel']],
  pharmacy:    [['amenity', 'pharmacy']],
  chemist:     [['shop', 'chemist'], ['amenity', 'pharmacy']],
  hospital:    [['amenity', 'hospital']],
  clinic:      [['amenity', 'clinic'], ['healthcare', 'clinic']],
  doctor:      [['amenity', 'doctors']],
  dentist:     [['amenity', 'dentist']],
  optician:    [['shop', 'optician']],
  bank:        [['amenity', 'bank']],
  school:      [['amenity', 'school']],
  college:     [['amenity', 'college']],
  university:  [['amenity', 'university']],
  church:      [['amenity', 'place_of_worship']],
  mosque:      [['amenity', 'place_of_worship']],
  salon:       [['shop', 'hairdresser'], ['shop', 'beauty']],
  barber:      [['shop', 'hairdresser']],
  spa:         [['leisure', 'spa'], ['shop', 'beauty']],
  gym:         [['leisure', 'fitness_centre'], ['leisure', 'sports_centre']],
  fitness:     [['leisure', 'fitness_centre']],
  supermarket: [['shop', 'supermarket']],
  grocery:     [['shop', 'grocery'], ['shop', 'convenience']],
  market:      [['amenity', 'marketplace']],
  mechanic:    [['shop', 'car_repair']],
  lawyer:      [['office', 'lawyer']],
  accountant:  [['office', 'accountant']],
  cafe:        [['amenity', 'cafe']],
  coffee:      [['amenity', 'cafe']],
  bakery:      [['shop', 'bakery']],
  fuel:        [['amenity', 'fuel']],
  photography: [['craft', 'photographer']],
  tailor:      [['craft', 'tailor']],
  fashion:     [['shop', 'clothes']],
  electronics: [['shop', 'electronics']],
  jewelry:     [['shop', 'jewelry']],
  insurance:   [['office', 'insurance']],
  travel:      [['office', 'travel_agent']],
  courier:     [['office', 'courier']],
  printing:    [['shop', 'copyshop']],
  event:       [['amenity', 'events_venue'], ['amenity', 'community_centre']],
  venue:       [['amenity', 'events_venue']],
};

interface OsmElement {
  id: number;
  type: 'node' | 'way' | 'relation';
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function resolveOsmTags(query: string): [string, string][] {
  const q = query.toLowerCase();
  for (const [keyword, tags] of Object.entries(QUERY_TAG_MAP)) {
    if (q.includes(keyword)) return tags;
  }
  const word = q.split(/\s+/)[0];
  return [['amenity', word], ['shop', word]];
}

function buildAddress(tags: Record<string, string>): string {
  return [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:suburb'] ?? tags['addr:city'],
    tags['addr:state'],
  ].filter(Boolean).join(', ');
}

function osmToBusiness(el: OsmElement, queryCategory: string): Business | null {
  const tags = el.tags ?? {};
  if (!tags.name) return null;

  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (!lat || !lon) return null;

  const website = tags.website ?? tags['contact:website'];
  const phone   = tags.phone ?? tags['contact:phone'] ?? tags['contact:mobile'];
  const isSocial = !!website && (website.includes('facebook.com') || website.includes('instagram.com'));
  const hasWebsite = !!website && !isSocial;

  const rawCategory =
    tags.amenity ?? tags.shop ?? tags.tourism ?? tags.healthcare ??
    tags.leisure ?? tags.office ?? tags.craft ?? queryCategory;

  return {
    id: `osm_${el.id}`,
    name: tags.name,
    address: buildAddress(tags) || 'Address not listed',
    phone:   phone ?? undefined,
    website: website ?? undefined,
    hasWebsite,
    category: rawCategory.replace(/_/g, ' '),
    location: { latitude: lat, longitude: lon },
    status: 'OPERATIONAL',
    source: 'osm',
  };
}

export async function searchOverpass(
  query: string,
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<Business[]> {
  try {
    const tags = resolveOsmTags(query);
    const radiusM = radiusKm * 1000;
    const around = `around:${radiusM},${lat},${lng}`;

    const filters = tags
      .map(([k, v]) => `node["${k}"="${v}"](${around});\nway["${k}"="${v}"](${around});`)
      .join('\n');

    const ql = `[out:json][timeout:20];\n(\n${filters}\n);\nout body center;`;

    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(ql)}`,
    });

    if (!res.ok) return [];

    const data = (await res.json()) as { elements?: OsmElement[] };
    return (data.elements ?? [])
      .map(el => osmToBusiness(el, query))
      .filter((b): b is Business => b !== null);
  } catch {
    return [];
  }
}

export function normalizeForDedup(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
}
