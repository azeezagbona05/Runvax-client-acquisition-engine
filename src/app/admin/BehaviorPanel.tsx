'use client';

import { useState, useEffect } from 'react';
import { Loader2, Users, Phone, Trophy, Wallet, Search, MapPin, TrendingUp, TrendingDown, BarChart3, X } from 'lucide-react';
import { formatPrice } from '@/lib/scoring';

type Range = 'week' | 'month' | 'year' | 'all';

interface Industry {
  key: string; saved: number; savedPrev: number; growthPct: number | null; isNew: boolean;
  contacted: number; won: number; saveRatePct: number; winRatePct: number;
}
interface Analytics {
  range: string;
  totals: {
    prospects: number; prospectsPrev: number; prospectsGrowthPct: number | null;
    searchers: number; searchRows: number; contacted: number; won: number;
    winRatePct: number; saveToWonPct: number; wonValue: number; pipelineValue: number;
  };
  industries: Industry[];
  searchedIndustries: { key: string; count: number }[];
  searchedAreas: { key: string; count: number }[];
  searchedTerms: { industry: string; location: string; count: number }[];
}

const RANGES: { id: Range; label: string }[] = [
  { id: 'week', label: 'This week' }, { id: 'month', label: 'This month' },
  { id: 'year', label: 'This year' }, { id: 'all', label: 'All time' },
];

function GrowthPill({ pct, isNew }: { pct: number | null; isNew?: boolean }) {
  if (isNew) return <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300">NEW</span>;
  if (pct == null) return <span className="text-[10px] text-gray-600">—</span>;
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${up ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
      {up ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}{Math.abs(pct)}%
    </span>
  );
}

function Bar({ value, max, color = 'bg-purple-500' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return <div className="h-1.5 bg-white/5 rounded-full overflow-hidden"><div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} /></div>;
}

function StatCard({ icon, label, value, sub, color = 'text-white' }: { icon: React.ReactNode; label: string; value: string | number; sub?: React.ReactNode; color?: string }) {
  return (
    <div className="bg-gray-900 border border-white/10 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2 text-gray-500">{icon}<span className="text-[11px] font-semibold uppercase tracking-widest">{label}</span></div>
      <div className={`text-2xl font-black ${color}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function BehaviorPanel() {
  const [range, setRange] = useState<Range>('month');
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/analytics?range=${range}`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setData(d); })
      .finally(() => setLoading(false));
  }, [range]);

  const q = filter.toLowerCase().trim();

  const filteredIndustries = q
    ? (data?.searchedIndustries ?? []).filter((s) => s.key.toLowerCase().includes(q))
    : (data?.searchedIndustries ?? []);

  const filteredAreas = q
    ? (data?.searchedAreas ?? []).filter((s) => s.key.toLowerCase().includes(q))
    : (data?.searchedAreas ?? []);

  const filteredFunnel = q
    ? (data?.industries ?? []).filter((s) => s.key.toLowerCase().includes(q))
    : (data?.industries ?? []);

  const maxSearchInd  = Math.max(1, ...filteredIndustries.map((s) => s.count));
  const maxSearchArea = Math.max(1, ...filteredAreas.map((s) => s.count));
  const maxSaved      = Math.max(1, ...filteredFunnel.map((s) => s.saved));

  return (
    <div className="space-y-6">
      {/* Controls row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-900 border border-white/10 rounded-xl p-1">
          {RANGES.map((r) => (
            <button key={r.id} onClick={() => setRange(r.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${range === r.id ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              {r.label}
            </button>
          ))}
        </div>
        {/* Keyword filter */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by industry or area…"
            className="w-full bg-gray-900 border border-white/10 rounded-xl pl-8 pr-8 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
          />
          {filter && (
            <button onClick={() => setFilter('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {loading && <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />}
      </div>

      {!data ? (
        <div className="text-center py-16 text-gray-500 text-sm">{loading ? 'Loading behaviour data…' : 'No data yet.'}</div>
      ) : (
        <>
          {/* Headline cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={<Users className="w-4 h-4" />} label="Prospects saved" value={data.totals.prospects}
              sub={<GrowthPill pct={data.totals.prospectsGrowthPct} />} />
            <StatCard icon={<Phone className="w-4 h-4 text-yellow-400" />} label="Contacted" value={data.totals.contacted}
              sub={`${data.totals.searchers} active searchers`} color="text-yellow-400" />
            <StatCard icon={<Trophy className="w-4 h-4 text-green-400" />} label="Won" value={data.totals.won}
              sub={`${data.totals.winRatePct}% of contacted`} color="text-green-400" />
            <StatCard icon={<Wallet className="w-4 h-4 text-purple-400" />} label="Won value" value={formatPrice(data.totals.wonValue)}
              sub={`${formatPrice(data.totals.pipelineValue)} in pipeline`} color="text-purple-400" />
          </div>

          {/* What people search */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-5">
              <h3 className="font-black text-white mb-1 flex items-center gap-2"><Search className="w-4 h-4 text-purple-400" /> Most-searched industries</h3>
              <p className="text-[11px] text-gray-600 mb-4">What categories people are hunting for</p>
              <div className="space-y-2.5">
                {filteredIndustries.length === 0 && <p className="text-sm text-gray-500">{q ? `No results for "${filter}"` : 'Not enough data.'}</p>}
                {filteredIndustries.map((s) => (
                  <div key={s.key}>
                    <div className="flex items-center justify-between text-sm mb-1"><span className="text-gray-300 truncate">{s.key}</span><span className="text-gray-500 font-bold flex-shrink-0 ml-2">{s.count}</span></div>
                    <Bar value={s.count} max={maxSearchInd} />
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-5">
              <h3 className="font-black text-white mb-1 flex items-center gap-2"><MapPin className="w-4 h-4 text-orange-400" /> Most-searched areas</h3>
              <p className="text-[11px] text-gray-600 mb-4">Where the attention is going</p>
              <div className="space-y-2.5">
                {filteredAreas.length === 0 && <p className="text-sm text-gray-500">{q ? `No results for "${filter}"` : 'Not enough data.'}</p>}
                {filteredAreas.map((s) => (
                  <div key={s.key}>
                    <div className="flex items-center justify-between text-sm mb-1"><span className="text-gray-300 truncate">{s.key}</span><span className="text-gray-500 font-bold flex-shrink-0 ml-2">{s.count}</span></div>
                    <Bar value={s.count} max={maxSearchArea} color="bg-orange-500" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* What converts — industry funnel */}
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-5">
            <h3 className="font-black text-white mb-1 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-green-400" /> What&apos;s getting attention &amp; converting</h3>
            <p className="text-[11px] text-gray-600 mb-4">By category — saved prospects, growth vs previous period, and how they convert</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] text-gray-600 uppercase tracking-widest text-left">
                    <th className="pb-2 font-bold">Category</th>
                    <th className="pb-2 font-bold w-40">Saved</th>
                    <th className="pb-2 font-bold text-center">Growth</th>
                    <th className="pb-2 font-bold text-center">Contacted</th>
                    <th className="pb-2 font-bold text-center">Won</th>
                    <th className="pb-2 font-bold text-center">Win rate</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFunnel.length === 0 && (
                    <tr><td colSpan={6} className="py-4 text-gray-500 text-center">{q ? `No results for "${filter}"` : 'No saved prospects in this period yet.'}</td></tr>
                  )}
                  {filteredFunnel.map((ind) => (
                    <tr key={ind.key} className="border-t border-white/5">
                      <td className="py-2.5 pr-3 text-gray-200 font-medium">{ind.key}</td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2"><span className="text-white font-bold w-6">{ind.saved}</span><div className="flex-1"><Bar value={ind.saved} max={maxSaved} /></div></div>
                      </td>
                      <td className="py-2.5 text-center"><GrowthPill pct={ind.growthPct} isNew={ind.isNew} /></td>
                      <td className="py-2.5 text-center text-gray-300">{ind.contacted}</td>
                      <td className="py-2.5 text-center text-green-400 font-bold">{ind.won}</td>
                      <td className="py-2.5 text-center text-gray-300">{ind.winRatePct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Note about trends */}
          <p className="text-[11px] text-gray-600 leading-relaxed bg-white/[0.02] border border-white/8 rounded-xl px-4 py-3">
            <strong className="text-gray-500">Note:</strong> Category growth &amp; conversion above are computed from saved-prospect activity (real timestamps). Search popularity reflects the latest search per user (a demand signal, not a full event count). True week-over-week search trends &amp; area growth % arrive in Phase 2 once search events are logged.
          </p>
        </>
      )}
    </div>
  );
}
