export interface SearchHistoryEntry {
  industry: string;
  location: string;
  totalCount: number;
  noWebsiteCount: number;
  timestamp: string;
}

const KEY = 'aip_search_history';
const MAX = 15;

export function getSearchHistory(): SearchHistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
  catch { return []; }
}

export function saveToHistory(entry: Omit<SearchHistoryEntry, 'timestamp'>) {
  const history = getSearchHistory();
  const idx = history.findIndex(
    (h) => h.industry.toLowerCase() === entry.industry.toLowerCase() &&
            h.location.toLowerCase() === entry.location.toLowerCase()
  );
  if (idx >= 0) history.splice(idx, 1);
  history.unshift({ ...entry, timestamp: new Date().toISOString() });
  try { localStorage.setItem(KEY, JSON.stringify(history.slice(0, MAX))); } catch {}
}

export function getTopIndustries(): Array<{
  industry: string; searches: number; total: number; noWebsite: number; rate: number;
}> {
  const history = getSearchHistory();
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

export function getBestTimeStatus(): { label: string; color: string; dot: string } {
  const h = getNigeriaHour();
  if ((h >= 8 && h < 10) || (h >= 19 && h < 21)) {
    return { label: 'Great time to send', color: 'text-green-400', dot: 'bg-green-400' };
  }
  if (h >= 10 && h < 19) {
    return { label: 'Decent time to send', color: 'text-yellow-400', dot: 'bg-yellow-400' };
  }
  return { label: 'Low response time', color: 'text-gray-500', dot: 'bg-gray-500' };
}
