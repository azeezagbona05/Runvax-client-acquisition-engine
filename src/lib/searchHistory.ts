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

export function getBestTimeStatus(): { label: string; color: string; dot: string; level: 'good' | 'decent' | 'low' } {
  const h = getNigeriaHour();
  if ((h >= 8 && h < 10) || (h >= 19 && h < 21)) {
    return { label: 'Great time to send', color: 'text-green-400', dot: 'bg-green-400', level: 'good' };
  }
  if (h >= 10 && h < 19) {
    return { label: 'Decent time to send', color: 'text-yellow-400', dot: 'bg-yellow-400', level: 'decent' };
  }
  return { label: 'Low response time', color: 'text-red-400', dot: 'bg-red-400', level: 'low' };
}
