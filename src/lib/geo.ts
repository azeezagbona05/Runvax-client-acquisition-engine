/**
 * Every country and its regions (states, provinces, counties), for the prospect finder's dropdowns.
 * Server-side only: the dataset is large, so the browser asks /api/finder/geo for the bit it needs.
 */
import { allCountries } from 'country-region-data';

export interface GeoCountry { code: string; name: string }
export interface GeoRegion { code: string; name: string }

type Row = readonly [string, string, ReadonlyArray<readonly [string, string]>];
const rows = allCountries as unknown as ReadonlyArray<Row>;

export function listCountries(): GeoCountry[] {
  return rows.map(([name, code]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name));
}

/** The country's regions, alphabetically. [] for an unknown code or a country with none. */
export function regionsOf(code: string): GeoRegion[] {
  const hit = rows.find((r) => r[1] === code.toUpperCase());
  return hit ? hit[2].map(([name, c]) => ({ code: c, name })).sort((a, b) => a.name.localeCompare(b.name)) : [];
}
