export interface SearchHistoryEntry {
  industry: string;
  location: string;
  totalCount: number;
  noWebsiteCount: number;
  timestamp: string;
}

export async function saveToHistory(entry: Omit<SearchHistoryEntry, 'timestamp'>) {
  try {
    await fetch('/api/user/search-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
  } catch {
    // non-critical — ignore network failures
  }
}

export async function getSearchHistory(): Promise<SearchHistoryEntry[]> {
  try {
    const res = await fetch('/api/user/search-history');
    if (!res.ok) return [];
    return await res.json() as SearchHistoryEntry[];
  } catch {
    return [];
  }
}

export async function getTopIndustries(): Promise<Array<{
  industry: string; searches: number; total: number; noWebsite: number; rate: number;
}>> {
  const history = await getSearchHistory();
  const map: Record<string, { total: number; noWebsite: number; searches: number }> = {};
  for (const h of history) {
    if (!map[h.industry]) map[h.industry] = { total: 0, noWebsite: 0, searches: 0 };
    map[h.industry].total += h.totalCount;
    map[h.industry].noWebsite += h.noWebsiteCount;
    map[h.industry].searches += 1;
  }
  return Object.entries(map)
    .map(([industry, d]) => ({
      industry, ...d,
      rate: d.total > 0 ? Math.round((d.noWebsite / d.total) * 100) : 0,
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 6);
}

// Nigeria is UTC+1
export function getNigeriaHour(): number {
  return (new Date().getUTCHours() + 1) % 24;
}

// Representative IANA timezone per supported country (US/CA use Eastern)
const COUNTRY_TZ: Record<string, string> = {
  NG: 'Africa/Lagos',      GH: 'Africa/Accra',        KE: 'Africa/Nairobi',
  ZA: 'Africa/Johannesburg', UG: 'Africa/Kampala',    TZ: 'Africa/Dar_es_Salaam',
  RW: 'Africa/Kigali',     SN: 'Africa/Dakar',        CM: 'Africa/Douala',
  US: 'America/New_York',  GB: 'Europe/London',       CA: 'America/Toronto',
};

// Current hour (0–23) in the selected country's timezone.
// Falls back to the browser's local time when the country is unknown.
export function getLocalHour(country?: string): number {
  const timeZone = country ? COUNTRY_TZ[country] : undefined;
  try {
    const hour = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit', hourCycle: 'h23', timeZone,
    }).format(new Date());
    return parseInt(hour, 10) % 24;
  } catch {
    return getNigeriaHour();
  }
}

export function getBestTimeStatus(country?: string): { label: string; color: string; dot: string; level: 'good' | 'decent' | 'low' } {
  const h = getLocalHour(country);
  if ((h >= 8 && h < 10) || (h >= 19 && h < 21)) {
    return { label: 'Great time to send', color: 'text-green-400', dot: 'bg-green-400', level: 'good' };
  }
  if (h >= 10 && h < 19) {
    return { label: 'Decent time to send', color: 'text-amber-600', dot: 'bg-amber-500', level: 'decent' };
  }
  return { label: 'Low response time', color: 'text-red-400', dot: 'bg-red-400', level: 'low' };
}
