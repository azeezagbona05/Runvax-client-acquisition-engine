'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Search, MapPin, Loader2, Clock, Sparkles, ChevronDown, X } from 'lucide-react';
import { SearchFormData } from '@/types';
import { getSearchHistory, getBestTimeStatus, SearchHistoryEntry } from '@/lib/searchHistory';
import { AREAS, TIER_CONFIG } from '@/lib/areas';

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

const COUNTRIES = [
  { code: 'NG', name: 'Nigeria',       flag: '🇳🇬' },
  { code: 'GH', name: 'Ghana',         flag: '🇬🇭' },
  { code: 'KE', name: 'Kenya',         flag: '🇰🇪' },
  { code: 'ZA', name: 'South Africa',  flag: '🇿🇦' },
  { code: 'UG', name: 'Uganda',        flag: '🇺🇬' },
  { code: 'TZ', name: 'Tanzania',      flag: '🇹🇿' },
  { code: 'RW', name: 'Rwanda',        flag: '🇷🇼' },
  { code: 'SN', name: 'Senegal',       flag: '🇸🇳' },
  { code: 'CM', name: 'Cameroon',      flag: '🇨🇲' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada',        flag: '🇨🇦' },
  { code: 'OTHER', name: 'Other',      flag: '🌍' },
];

interface SearchFormProps {
  onSearch: (data: SearchFormData) => void;
  loading: boolean;
  /** Show the Quick Industry / Recent Searches panels (landing state only) */
  landing?: boolean;
}

export default function SearchForm({ onSearch, loading, landing = true }: SearchFormProps) {
  const [industry, setIndustry] = useState('');
  const [country, setCountry] = useState('NG');
  const [location, setLocation] = useState('');
  const [selectedTier, setSelectedTier] = useState<'high' | 'mid' | 'budget' | null>(null);
  const [lat, setLat] = useState<number | undefined>();
  const [lng, setLng] = useState<number | undefined>();
  const radius = 5;
  const [geoLoading, setGeoLoading] = useState(false);
  const [showIndSug, setShowIndSug] = useState(false);
  const [showLocSug, setShowLocSug] = useState(false);
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [timeStatus, setTimeStatus] = useState<ReturnType<typeof getBestTimeStatus>>({
    label: 'Checking…', color: 'text-gray-500', dot: 'bg-gray-500', level: 'decent',
  });
  const [industryError, setIndustryError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [geoError, setGeoError] = useState('');

  const locationRef = useRef<HTMLInputElement>(null);

  useEffect(() => { getSearchHistory().then(setHistory); }, []);

  // Recompute "best time to send" in the selected country's timezone
  useEffect(() => { setTimeStatus(getBestTimeStatus(country)); }, [country]);

  const selectedCountry = COUNTRIES.find((c) => c.code === country) ?? COUNTRIES[0];
  const countryAreas = AREAS.filter((a) => a.country === country);

  // Show all categories when the field is empty/focused, filter as the user types
  const indSuggestions = industry.trim()
    ? INDUSTRIES.filter((s) => s.toLowerCase().includes(industry.toLowerCase()))
    : INDUSTRIES;

  const query = location.toLowerCase().trim();
  const matchedAreas = query
    ? countryAreas.filter((a) => a.name.toLowerCase().includes(query) || a.city.toLowerCase().includes(query))
    : countryAreas;

  const groupedAreas = (['high', 'mid', 'budget'] as const).map((tier) => ({
    tier,
    areas: matchedAreas.filter((a) => a.tier === tier).slice(0, 4),
  })).filter((g) => g.areas.length > 0);

  const runSearch = (ind: string, loc: string, lt?: number, ln?: number) => {
    if (!ind.trim() || (!loc.trim() && !lt)) return;
    const q = lt ? `${ind} near me` : `${ind} in ${loc}`;
    onSearch({ industry: ind, location: loc, country, lat: lt, lng: ln, radius, query: q });
  };

  const handleCountryChange = (code: string) => {
    setCountry(code);
    setLocation('');
    setSelectedTier(null);
    setLat(undefined);
    setLng(undefined);
    setLocationError('');
    setTimeout(() => locationRef.current?.focus(), 50);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIndustryError('');
    setLocationError('');
    if (!industry.trim()) { setIndustryError('Please enter an industry or business type.'); return; }
    if (!location.trim() && !lat) { setLocationError('Please enter a location or use your GPS.'); return; }
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
    setGeoError('');
    if (!navigator.geolocation) { setGeoError('Geolocation is not supported by your browser.'); return; }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude); setLng(pos.coords.longitude);
        setLocation('My current location'); setSelectedTier(null);
        setGeoLoading(false); setLocationError('');
      },
      () => { setGeoError('Could not get your location — please type it manually.'); setGeoLoading(false); }
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
    <>
    <div className="bg-gradient-to-br from-purple-950/60 via-gray-900 to-gray-950 border-b border-white/5">
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">

        {/* Hero */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-2 bg-purple-500/20 border border-purple-500/30 rounded-full px-4 py-1.5 text-purple-300 text-sm font-semibold mb-4">
            🎯 AI Prospect Discovery
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white mb-2 leading-tight">
            Find Businesses That<br className="hidden md:block" />{' '}
            <span className="bg-gradient-to-r from-purple-500 to-purple-400 bg-clip-text text-transparent">Need a Website</span>
          </h1>
          <p className="text-gray-400 text-sm md:text-base max-w-lg mx-auto">
            Search any business type, in any city, worldwide. Find your next client in seconds.
          </p>
        </div>

        {/* Status row */}
        <div className="flex items-center justify-center gap-3 mb-5 flex-wrap">
          <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-colors ${
            timeStatus.level === 'low'
              ? 'bg-red-500/10 border-red-500/30'
              : timeStatus.level === 'good'
              ? 'bg-green-500/10 border-green-500/25'
              : 'bg-amber-500/10 border-amber-500/30'
          }`}>
            <span className="relative flex w-2 h-2">
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${timeStatus.dot} ${
                timeStatus.level === 'low' ? 'animate-ping' : 'animate-pulse'
              }`} />
              <span className={`relative inline-flex w-2 h-2 rounded-full ${timeStatus.dot}`} />
            </span>
            <span className={`font-semibold ${timeStatus.color}`}>{timeStatus.label}</span>
            <span className="text-gray-600">· {selectedCountry.flag} {selectedCountry.name}</span>
          </div>
          <Link href="/market-brief"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-purple-600/15 hover:bg-purple-600/25 text-purple-400 border border-purple-500/20 font-semibold transition-colors">
            <Sparkles className="w-3.5 h-3.5" /> Market Intelligence Brief
          </Link>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white/[0.04] backdrop-blur border border-white/10 rounded-2xl p-5 md:p-6 space-y-4">

          {/* Country selector row */}
          <div>
            <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
              Country
            </label>
            <div className="flex gap-2 flex-wrap">
              {COUNTRIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  title={c.name}
                  onClick={() => handleCountryChange(c.code)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${
                    country === c.code
                      ? 'bg-purple-600/30 border-purple-500/50 text-white'
                      : 'bg-gray-800/60 border-white/10 text-gray-400 hover:border-purple-500/30 hover:text-gray-200'
                  }`}
                >
                  <span>{c.flag}</span>
                  <span className="sm:hidden text-[11px] font-bold tracking-wide">
                    {c.code === 'OTHER' ? 'Other' : c.code}
                  </span>
                  <span className="hidden sm:inline">{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">

            {/* Industry — searchable dropdown */}
            <div className="relative">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                Industry / Business Type
              </label>
              <div className="relative">
                <input type="text" value={industry}
                  onChange={(e) => { setIndustry(e.target.value); setShowIndSug(true); setIndustryError(''); }}
                  onFocus={() => setShowIndSug(true)}
                  onBlur={() => setTimeout(() => setShowIndSug(false), 150)}
                  placeholder="Select or search a category…"
                  className={`w-full bg-gray-800/80 border rounded-xl pl-4 pr-16 py-3 text-white placeholder-gray-600 focus:outline-none transition-colors text-sm ${industryError ? 'border-red-500 focus:border-red-400' : 'border-white/10 focus:border-purple-500'}`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                  {industry && (
                    <button type="button" onMouseDown={(e) => { e.preventDefault(); setIndustry(''); setShowIndSug(true); }}
                      className="pointer-events-auto text-gray-500 hover:text-gray-300 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showIndSug ? 'rotate-180' : ''}`} />
                </div>
              </div>
              {industryError && (
                <p className="text-red-400 text-xs font-semibold mt-1.5 flex items-center gap-1">
                  <span>⚠</span> {industryError}
                </p>
              )}
              {showIndSug && indSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-white/10 rounded-xl shadow-2xl z-20 max-h-60 overflow-y-auto">
                  {industry.trim() && !INDUSTRIES.includes(industry) && (
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-600 border-b border-white/5 bg-white/[0.02]">
                      Suggestions
                    </div>
                  )}
                  {!industry.trim() && (
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-600 border-b border-white/5 bg-white/[0.02]">
                      All Categories
                    </div>
                  )}
                  {indSuggestions.map((s) => (
                    <button key={s} type="button" onMouseDown={() => pickIndustry(s)}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-b border-white/5 last:border-0 ${
                        industry === s
                          ? 'bg-purple-600/25 text-purple-200 font-semibold'
                          : 'text-gray-300 hover:bg-purple-600/20 hover:text-white'
                      }`}>
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
                  onChange={(e) => { setLocation(e.target.value); setSelectedTier(null); setLat(undefined); setLng(undefined); setShowLocSug(true); setLocationError(''); }}
                  onFocus={() => setShowLocSug(true)}
                  onBlur={() => setTimeout(() => setShowLocSug(false), 200)}
                  placeholder={country === 'OTHER' ? 'Type any city or area…' : `Type an area in ${selectedCountry.name}…`}
                  className={`flex-1 bg-gray-800/80 border rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none transition-colors text-sm ${locationError ? 'border-red-500 focus:border-red-400' : 'border-white/10 focus:border-purple-500'}`}
                />
                <button type="button" onClick={handleGeolocate} disabled={geoLoading} title="Use GPS"
                  className="bg-gray-700 hover:bg-gray-600 border border-white/10 rounded-xl px-3.5 transition-colors disabled:opacity-50 flex items-center">
                  {geoLoading ? <Loader2 className="w-4 h-4 text-gray-400 animate-spin" /> : <MapPin className="w-4 h-4 text-gray-400" />}
                </button>
              </div>

              {locationError && (
                <p className="text-red-400 text-xs font-semibold mt-1.5 flex items-center gap-1">
                  <span>⚠</span> {locationError}
                </p>
              )}
              {geoError && (
                <p className="text-red-400 text-xs font-semibold mt-1.5 flex items-center gap-1">
                  <span>⚠</span> {geoError}
                </p>
              )}

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
                      Type to search any area in {selectedCountry.name}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-3 text-base shadow-lg shadow-purple-900/40">
            {loading
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Searching Google Maps…</>
              : <><Search className="w-5 h-5" /> Find Prospects Now</>}
          </button>
        </form>
      </div>
    </div>

    {/* ── Recent Searches + SEO content strip ── */}
    {landing && (
    <div className="max-w-5xl mx-auto px-4 py-5 flex flex-col gap-6">

      {/* Recent Searches — single row */}
      {history.length > 0 && (
        <div>
          <p className="text-[11px] text-gray-500 uppercase tracking-widest font-bold mb-2.5">Recent Searches</p>
          <div className="flex flex-wrap gap-2">
            {history.slice(0, 5).map((h, i) => (
              <button key={i} onClick={() => pickHistory(h)} disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/30 rounded-full text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-40">
                <Clock className="w-3 h-3 text-gray-500" />
                <span className="font-medium">{h.industry}</span>
                <span className="text-gray-600">·</span>
                <span>{h.location.split(',')[0]}</span>
                {h.noWebsiteCount > 0 && (
                  <span className="bg-orange-500/20 text-orange-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {h.noWebsiteCount}🎯
                  </span>
                )}
                <span className="text-gray-600">{timeAgoShort(h.timestamp)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SEO / AEO content strip — visible text for search engines and AI crawlers */}
      <div className="border-t border-white/5 pt-6 space-y-6">

        {/* How it works */}
        <div>
          <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest mb-3">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { step: '1', title: 'Search any industry, any city', body: 'Find local businesses — restaurants, salons, law firms, clinics, gyms, and more — in any city in Nigeria, Ghana, Kenya, South Africa, UK, USA, Canada, or worldwide.' },
              { step: '2', title: 'Identify businesses with no website', body: 'ProspectAI flags every business that has no website. These are your highest-priority leads — businesses actively missing online presence and most likely to need your services.' },
              { step: '3', title: 'Send AI-generated cold outreach', body: 'Generate a personalized cold email, WhatsApp message, or business proposal for each lead in one click, tailored to the specific business name, industry, and location.' },
            ].map(({ step, title, body }) => (
              <div key={step} className="bg-white/[0.03] border border-white/8 rounded-2xl p-4">
                <div className="w-6 h-6 rounded-full bg-purple-600/20 text-purple-400 text-xs font-black flex items-center justify-center mb-2">{step}</div>
                <h3 className="text-white text-sm font-bold mb-1">{title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>


      </div>
    </div>
    )}
    </>
  );
}
