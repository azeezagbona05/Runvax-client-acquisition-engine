'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, MapPin, Loader2, Clock, Sparkles } from 'lucide-react';
import { SearchFormData } from '@/types';
import { getSearchHistory, getBestTimeStatus, SearchHistoryEntry } from '@/lib/searchHistory';

const INDUSTRIES = [
  'Restaurants & Eateries', 'Beauty Salons & Spas', 'Barbers & Hair Salons',
  'Schools & Private Tutors', 'Clinics & Hospitals', 'Pharmacies & Chemists',
  'Real Estate Agencies', 'Hotels & Guesthouses', 'Event Centers & Halls',
  'Law Firms', 'Auto Workshops & Mechanics', 'Fashion & Boutiques',
  'Photography Studios', 'Gyms & Fitness Centers', 'Construction & Contractors',
  'Catering Services', 'Churches & Ministries', 'Travel & Tour Agencies',
  'Supermarkets & Stores', 'Laundry & Dry Cleaning', 'Printing & Design Shops',
  'Accounting & Tax Firms',
];

// Pre-researched Nigerian areas by business purchasing power
// High-ticket = businesses that invest ₦400k+ in digital
// Mid-range = ₦150k–₦400k
// Budget = ₦50k–₦150k (price-sensitive, high volume needed)
const AREAS: Array<{
  name: string;
  city: string;
  tier: 'high' | 'mid' | 'budget';
  note: string;
}> = [
  // ── Lagos High-ticket ──
  { name: 'Ikoyi, Lagos',             city: 'Lagos', tier: 'high',   note: 'Wealthiest district · ₦800k–₦3M' },
  { name: 'Victoria Island, Lagos',   city: 'Lagos', tier: 'high',   note: 'Corporate & luxury · ₦600k–₦2M' },
  { name: 'Banana Island, Lagos',     city: 'Lagos', tier: 'high',   note: 'Ultra-premium · ₦1M+' },
  { name: 'Lekki Phase 1, Lagos',     city: 'Lagos', tier: 'high',   note: 'Growing premium · ₦400k–₦1.5M' },
  { name: 'Eti-Osa, Lagos',           city: 'Lagos', tier: 'high',   note: 'Tech & corporate hub · ₦400k–₦1M' },
  // ── Lagos Mid-range ──
  { name: 'Ikeja GRA, Lagos',         city: 'Lagos', tier: 'mid',    note: 'Established SMEs · ₦200k–₦500k' },
  { name: 'Maryland, Lagos',          city: 'Lagos', tier: 'mid',    note: 'Commercial · ₦150k–₦400k' },
  { name: 'Gbagada, Lagos',           city: 'Lagos', tier: 'mid',    note: 'Residential-commercial mix · ₦150k–₦350k' },
  { name: 'Magodo, Lagos',            city: 'Lagos', tier: 'mid',    note: 'Educated middle class · ₦200k–₦400k' },
  { name: 'Lekki Phase 2, Lagos',     city: 'Lagos', tier: 'mid',    note: 'Developing market · ₦200k–₦500k' },
  { name: 'Ajah, Lagos',              city: 'Lagos', tier: 'mid',    note: 'Fast-growing area · ₦150k–₦350k' },
  { name: 'Yaba, Lagos',              city: 'Lagos', tier: 'mid',    note: 'Tech hub & students · ₦100k–₦300k' },
  { name: 'Surulere, Lagos',          city: 'Lagos', tier: 'mid',    note: 'Dense market · ₦100k–₦300k' },
  { name: 'Sangotedo, Lagos',         city: 'Lagos', tier: 'mid',    note: 'New estates · ₦150k–₦400k' },
  // ── Lagos Budget ──
  { name: 'Ikeja, Lagos',             city: 'Lagos', tier: 'budget', note: 'High volume · ₦80k–₦200k' },
  { name: 'Ikorodu, Lagos',           city: 'Lagos', tier: 'budget', note: 'Large market · ₦50k–₦150k' },
  { name: 'Alimosho, Lagos',          city: 'Lagos', tier: 'budget', note: 'Highest density · ₦50k–₦150k' },
  { name: 'Ayobo, Lagos',             city: 'Lagos', tier: 'budget', note: 'Very price-sensitive · ₦40k–₦120k' },
  { name: 'Ipaja, Lagos',             city: 'Lagos', tier: 'budget', note: 'High volume needed · ₦40k–₦120k' },
  { name: 'Mushin, Lagos',            city: 'Lagos', tier: 'budget', note: 'Budget market · ₦30k–₦100k' },
  { name: 'Oshodi, Lagos',            city: 'Lagos', tier: 'budget', note: 'Trade-focused · ₦50k–₦120k' },
  { name: 'Agege, Lagos',             city: 'Lagos', tier: 'budget', note: 'Price-sensitive · ₦30k–₦100k' },
  // ── Abuja High-ticket ──
  { name: 'Maitama, Abuja',           city: 'Abuja', tier: 'high',   note: 'Ministers & executives · ₦800k–₦3M' },
  { name: 'Asokoro, Abuja',           city: 'Abuja', tier: 'high',   note: 'Government elite · ₦600k–₦2M' },
  { name: 'Wuse 2, Abuja',            city: 'Abuja', tier: 'high',   note: 'Corporate hub · ₦400k–₦1.2M' },
  { name: 'Jabi, Abuja',              city: 'Abuja', tier: 'high',   note: 'Premium retail · ₦400k–₦1M' },
  // ── Abuja Mid-range ──
  { name: 'Garki, Abuja',             city: 'Abuja', tier: 'mid',    note: 'Established business · ₦200k–₦500k' },
  { name: 'Gwarinpa, Abuja',          city: 'Abuja', tier: 'mid',    note: 'Growing estates · ₦150k–₦400k' },
  { name: 'Karu, Abuja',              city: 'Abuja', tier: 'mid',    note: 'Dense SME market · ₦100k–₦300k' },
  { name: 'Kubwa, Abuja',             city: 'Abuja', tier: 'mid',    note: 'Satellite town · ₦100k–₦250k' },
  // ── Other cities ──
  { name: 'GRA, Port Harcourt',       city: 'Port Harcourt', tier: 'high',   note: 'Oil-money area · ₦500k–₦1.5M' },
  { name: 'Rumuola, Port Harcourt',   city: 'Port Harcourt', tier: 'mid',    note: 'Commercial district · ₦150k–₦400k' },
  { name: 'Trans Amadi, Port Harcourt',city:'Port Harcourt', tier: 'mid',    note: 'Industrial/SME · ₦150k–₦400k' },
  { name: 'GRA, Enugu',               city: 'Enugu',         tier: 'high',   note: 'Premium clients · ₦300k–₦800k' },
  { name: 'Independence Layout, Enugu',city:'Enugu',          tier: 'mid',    note: 'Established businesses · ₦150k–₦350k' },
  { name: 'Bodija, Ibadan',           city: 'Ibadan',        tier: 'high',   note: 'Educated professionals · ₦200k–₦600k' },
  { name: 'Dugbe, Ibadan',            city: 'Ibadan',        tier: 'mid',    note: 'Dense commercial · ₦100k–₦300k' },
  { name: 'Nassarawa, Kano',          city: 'Kano',          tier: 'high',   note: 'Wealthy traders · ₦300k–₦800k' },
  { name: 'Sabon Gari, Kano',         city: 'Kano',          tier: 'mid',    note: 'Active commerce · ₦100k–₦300k' },
  { name: 'GRA, Benin City',          city: 'Benin City',    tier: 'high',   note: 'Premium clients · ₦250k–₦700k' },
  { name: 'Sapele Road, Benin City',  city: 'Benin City',    tier: 'mid',    note: 'Commercial strip · ₦100k–₦300k' },
];

const TIER_CONFIG = {
  high:   { label: '🏆 High-ticket',   color: 'text-yellow-400', dot: 'bg-yellow-400', badge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20' },
  mid:    { label: '💼 Mid-range',      color: 'text-blue-400',   dot: 'bg-blue-400',   badge: 'bg-blue-500/15 text-blue-300 border-blue-500/20' },
  budget: { label: '💰 Budget market',  color: 'text-gray-400',   dot: 'bg-gray-500',   badge: 'bg-gray-500/15 text-gray-300 border-gray-500/20' },
};

interface SearchFormProps {
  onSearch: (data: SearchFormData) => void;
  loading: boolean;
  onBrief?: () => void;
}

export default function SearchForm({ onSearch, loading, onBrief }: SearchFormProps) {
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [selectedTier, setSelectedTier] = useState<'high' | 'mid' | 'budget' | null>(null);
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const [radius, setRadius] = useState(5);
  const [geoLoading, setGeoLoading] = useState(false);
  const [showIndSug, setShowIndSug] = useState(false);
  const [showLocSug, setShowLocSug] = useState(false);
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [timeStatus] = useState(getBestTimeStatus());

  const locationRef = useRef<HTMLInputElement>(null);

  useEffect(() => { getSearchHistory().then(setHistory); }, []);

  const indSuggestions = INDUSTRIES.filter(
    (s) => industry && s.toLowerCase().includes(industry.toLowerCase())
  );

  // Filter areas by search text, group by tier
  const query = location.toLowerCase().trim();
  const matchedAreas = query
    ? AREAS.filter((a) => a.name.toLowerCase().includes(query) || a.city.toLowerCase().includes(query))
    : AREAS;

  const groupedAreas = (['high', 'mid', 'budget'] as const).map((tier) => ({
    tier,
    areas: matchedAreas.filter((a) => a.tier === tier).slice(0, 4),
  })).filter((g) => g.areas.length > 0);

  const runSearch = (ind: string, loc: string, lt?: number, ln?: number) => {
    if (!ind.trim() || (!loc.trim() && !lt)) return;
    const q = lt ? `${ind} near me` : `${ind} in ${loc}`;
    onSearch({ industry: ind, location: loc, lat: lt, lng: ln, radius, query: q });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!industry.trim()) { alert('Please enter an industry or business type.'); return; }
    if (!location.trim() && !lat) { alert('Please enter a location or use your GPS.'); return; }
    runSearch(industry, location, lat, lng);
  };

  const pickIndustry = (s: string) => {
    setIndustry(s); setShowIndSug(false);
    if (location.trim() || lat) runSearch(s, location, lat, lng);
    else setTimeout(() => locationRef.current?.focus(), 50);
  };

  const pickLocation = (area: typeof AREAS[0]) => {
    setLocation(area.name);
    setSelectedTier(area.tier);
    setLat(undefined); setLng(undefined);
    setShowLocSug(false);
    if (industry.trim()) runSearch(industry, area.name);
  };

  const pickHistory = (h: SearchHistoryEntry) => {
    setIndustry(h.industry); setLocation(h.location);
    setLat(undefined); setLng(undefined);
    runSearch(h.industry, h.location);
  };

  const handleGeolocate = () => {
    if (!navigator.geolocation) { alert('Geolocation not supported.'); return; }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); setLocation('My current location'); setSelectedTier(null); setGeoLoading(false); },
      () => { alert('Could not get location. Please type it manually.'); setGeoLoading(false); }
    );
  };

  function timeAgoShort(iso: string) {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div className="bg-gradient-to-br from-purple-950/60 via-gray-900 to-gray-950 border-b border-white/5">
      <div className="max-w-3xl mx-auto px-4 py-10 md:py-14">

        {/* Hero */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center gap-2 bg-purple-500/20 border border-purple-500/30 rounded-full px-4 py-1.5 text-purple-300 text-sm font-semibold mb-4">
            🎯 AI Prospect Discovery
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white mb-2 leading-tight">
            Find Businesses That<br className="hidden md:block" /> Need a Website
          </h1>
          <p className="text-gray-400 text-sm md:text-base max-w-lg mx-auto">
            Search any industry, any city. Surface businesses with zero online presence — your next paying clients.
          </p>
        </div>

        {/* Status row */}
        <div className="flex items-center justify-center gap-3 mb-5 flex-wrap">
          <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            <span className={`w-2 h-2 rounded-full ${timeStatus.dot} animate-pulse`} />
            <span className={timeStatus.color}>{timeStatus.label}</span>
            <span className="text-gray-600">· Nigeria</span>
          </div>
          {onBrief && (
            <button onClick={onBrief}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-purple-600/15 hover:bg-purple-600/25 text-purple-400 border border-purple-500/20 font-semibold transition-colors">
              <Sparkles className="w-3.5 h-3.5" /> Market Intelligence Brief
            </button>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white/[0.04] backdrop-blur border border-white/10 rounded-2xl p-5 md:p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">

            {/* Industry */}
            <div className="relative">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                Industry / Business Type
              </label>
              <input type="text" value={industry}
                onChange={(e) => { setIndustry(e.target.value); setShowIndSug(true); }}
                onFocus={() => setShowIndSug(true)}
                onBlur={() => setTimeout(() => setShowIndSug(false), 150)}
                placeholder="e.g. Real Estate, Salons…"
                className="w-full bg-gray-800/80 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors text-sm"
              />
              {showIndSug && indSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden">
                  {indSuggestions.slice(0, 6).map((s) => (
                    <button key={s} type="button" onMouseDown={() => pickIndustry(s)}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-purple-600/30 hover:text-white transition-colors border-b border-white/5 last:border-0">
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Location */}
            <div className="relative">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                <span>Location / Area</span>
                {selectedTier && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${TIER_CONFIG[selectedTier].badge}`}>
                    {TIER_CONFIG[selectedTier].label}
                  </span>
                )}
              </label>
              <div className="flex gap-2">
                <input ref={locationRef} type="text" value={location}
                  onChange={(e) => { setLocation(e.target.value); setSelectedTier(null); setLat(undefined); setLng(undefined); setShowLocSug(true); }}
                  onFocus={() => setShowLocSug(true)}
                  onBlur={() => setTimeout(() => setShowLocSug(false), 200)}
                  placeholder="Type an area or city…"
                  className="flex-1 bg-gray-800/80 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors text-sm"
                />
                <button type="button" onClick={handleGeolocate} disabled={geoLoading} title="Use GPS"
                  className="bg-gray-700 hover:bg-gray-600 border border-white/10 rounded-xl px-3.5 transition-colors disabled:opacity-50 flex items-center">
                  {geoLoading ? <Loader2 className="w-4 h-4 text-gray-400 animate-spin" /> : <MapPin className="w-4 h-4 text-gray-400" />}
                </button>
              </div>

              {/* Smart location dropdown */}
              {showLocSug && groupedAreas.length > 0 && (
                <div className="absolute top-full left-0 right-[52px] mt-1 bg-gray-900 border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden max-h-72 overflow-y-auto">
                  {groupedAreas.map(({ tier, areas }) => (
                    <div key={tier}>
                      <div className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border-b border-white/5 ${TIER_CONFIG[tier].color} bg-white/[0.02]`}>
                        {TIER_CONFIG[tier].label}
                      </div>
                      {areas.map((area) => (
                        <button key={area.name} type="button" onMouseDown={() => pickLocation(area)}
                          className="w-full text-left px-4 py-2.5 hover:bg-purple-600/20 transition-colors border-b border-white/5 last:border-0 flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm text-gray-200 font-medium">{area.name}</div>
                            <div className="text-[10px] text-gray-500 mt-0.5">{area.note}</div>
                          </div>
                          <span className={`flex-shrink-0 w-2 h-2 rounded-full mt-1.5 ${TIER_CONFIG[tier].dot}`} />
                        </button>
                      ))}
                    </div>
                  ))}
                  {!query && (
                    <div className="px-4 py-2.5 text-[11px] text-gray-600 border-t border-white/5">
                      Type to search any Nigerian area
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Radius */}
          <div>
            <label className="flex items-center justify-between text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
              <span>Search Radius</span>
              <span className="text-purple-400 normal-case font-bold text-sm tracking-normal">{radius} km</span>
            </label>
            <input type="range" min={1} max={50} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
            <div className="flex justify-between text-xs text-gray-600 mt-1 select-none">
              <span>1 km</span><span>25 km</span><span>50 km</span>
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-3 text-base shadow-lg shadow-purple-900/40">
            {loading
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Searching Google Maps…</>
              : <><Search className="w-5 h-5" /> Find Prospects Now</>}
          </button>
        </form>

        {/* Recent searches */}
        {history.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] text-gray-600 uppercase tracking-widest font-bold text-center mb-2">Recent Searches</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {history.slice(0, 5).map((h, i) => (
                <button key={i} onClick={() => pickHistory(h)} disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-40">
                  <Clock className="w-3 h-3 text-gray-600" />
                  <span className="font-medium">{h.industry}</span>
                  <span className="text-gray-600">·</span>
                  <span>{h.location.split(',')[0]}</span>
                  {h.noWebsiteCount > 0 && (
                    <span className="bg-orange-500/20 text-orange-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {h.noWebsiteCount}🎯
                    </span>
                  )}
                  <span className="text-gray-700">{timeAgoShort(h.timestamp)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Industry quick picks */}
        <div className="mt-4 space-y-2">
          <p className="text-center text-[11px] text-gray-600 uppercase tracking-widest font-bold">Quick Industry Select</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {INDUSTRIES.slice(0, 10).map((s) => (
              <button key={s} type="button" disabled={loading} onClick={() => pickIndustry(s)}
                className={`px-3 py-1.5 border rounded-full text-xs font-semibold transition-all disabled:opacity-40 ${
                  industry === s
                    ? 'bg-purple-600/30 border-purple-500/50 text-purple-300'
                    : 'bg-white/5 hover:bg-purple-600/20 border-white/10 hover:border-purple-500/30 text-gray-500 hover:text-gray-200'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
