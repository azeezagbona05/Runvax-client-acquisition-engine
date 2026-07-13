'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Search, MapPin, Loader2, Clock, Sparkles, ChevronDown, X, ArrowLeft, Navigation } from 'lucide-react';
import { SearchFormData } from '@/types';
import { getSearchHistory, getBestTimeStatus, SearchHistoryEntry } from '@/lib/searchHistory';
import { AREAS, STATES, TIER_CONFIG, Area } from '@/lib/areas';

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
  { code: 'NG', name: 'Nigeria',        flag: '🇳🇬' },
  { code: 'GH', name: 'Ghana',          flag: '🇬🇭' },
  { code: 'KE', name: 'Kenya',          flag: '🇰🇪' },
  { code: 'ZA', name: 'South Africa',   flag: '🇿🇦' },
  { code: 'UG', name: 'Uganda',         flag: '🇺🇬' },
  { code: 'TZ', name: 'Tanzania',       flag: '🇹🇿' },
  { code: 'RW', name: 'Rwanda',         flag: '🇷🇼' },
  { code: 'SN', name: 'Senegal',        flag: '🇸🇳' },
  { code: 'CM', name: 'Cameroon',       flag: '🇨🇲' },
  { code: 'US', name: 'United States',  flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada',         flag: '🇨🇦' },
  { code: 'OTHER', name: 'Other',       flag: '🌍' },
];

// Nigeria first, then alphabetical, Other last
const COUNTRIES_SORTED = [
  COUNTRIES.find((c) => c.code === 'NG')!,
  ...COUNTRIES.filter((c) => c.code !== 'NG' && c.code !== 'OTHER').sort((a, b) => a.name.localeCompare(b.name)),
  COUNTRIES.find((c) => c.code === 'OTHER')!,
];

interface SearchFormProps {
  onSearch: (data: SearchFormData) => void;
  loading: boolean;
  landing?: boolean;
}

export default function SearchForm({ onSearch, loading, landing = true }: SearchFormProps) {
  const [industry, setIndustry]           = useState('');
  const [country, setCountry]             = useState('NG');
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [location, setLocation]           = useState('');
  const [selectedTier, setSelectedTier]   = useState<'high' | 'mid' | 'budget' | null>(null);
  const [lat, setLat]                     = useState<number | undefined>();
  const [lng, setLng]                     = useState<number | undefined>();
  const radius = 5;
  const [geoLoading, setGeoLoading]       = useState(false);
  const [showIndSug, setShowIndSug]       = useState(false);
  const [showLocSug, setShowLocSug]       = useState(false);
  const [history, setHistory]             = useState<SearchHistoryEntry[]>([]);
  const [timeStatus, setTimeStatus]       = useState<ReturnType<typeof getBestTimeStatus>>({
    label: 'Checking…', color: 'text-gray-500', dot: 'bg-gray-500', level: 'decent',
  });
  const [industryError, setIndustryError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [geoError, setGeoError]           = useState('');
  const [countrySearch, setCountrySearch]         = useState('');
  const [showCountryDd, setShowCountryDd]         = useState(false);
  const [showMobileLocPicker, setShowMobileLocPicker] = useState(false);
  const [mobileLocSearch, setMobileLocSearch]     = useState('');
  const [mobileExpanded, setMobileExpanded]       = useState(false);
  const [activeHowStep, setActiveHowStep]         = useState(0);
  const howCarouselRef = useRef<HTMLDivElement>(null);

  const locationRef      = useRef<HTMLInputElement>(null);
  const mobileLocRef     = useRef<HTMLInputElement>(null);
  const countryDdRef     = useRef<HTMLDivElement>(null);
  const stateSelectRef   = useRef<HTMLSelectElement>(null);

  useEffect(() => { getSearchHistory().then(setHistory); }, []);
  useEffect(() => { setTimeStatus(getBestTimeStatus(country)); }, [country]);

  useEffect(() => {
    if (!showCountryDd) return;
    const handle = (e: MouseEvent) => {
      if (countryDdRef.current && !countryDdRef.current.contains(e.target as Node)) {
        setShowCountryDd(false);
        setCountrySearch('');
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showCountryDd]);

  const selectedCountry = COUNTRIES.find((c) => c.code === country) ?? COUNTRIES[0];

  // States/regions for this country
  const countryStates = STATES.filter((s) => s.country === country);

  // All areas for this country, optionally filtered by selected state
  const stateCities = selectedState
    ? (STATES.find((s) => s.code === selectedState)?.cities ?? [])
    : null;

  const countryAreas = AREAS.filter((a) => {
    if (a.country !== country) return false;
    if (stateCities) return stateCities.includes(a.city);
    return true;
  });

  const filteredCountries = countrySearch.trim()
    ? COUNTRIES_SORTED.filter((c) =>
        c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
        c.code.toLowerCase().includes(countrySearch.toLowerCase()),
      )
    : COUNTRIES_SORTED;

  const indSuggestions = industry.trim()
    ? INDUSTRIES.filter((s) => s.toLowerCase().includes(industry.toLowerCase()))
    : INDUSTRIES;

  const query = location.toLowerCase().trim();
  const matchedAreas = query
    ? countryAreas.filter((a) =>
        a.name.toLowerCase().includes(query) ||
        a.city.toLowerCase().includes(query) ||
        a.note.toLowerCase().includes(query),
      )
    : countryAreas;

  // Browse mode (no query): group by LGA if areas have lga field, otherwise by city
  // Search mode (has query): flat list, show tier hint + LGA badge
  const browseGroups: { label: string; areas: Area[] }[] = [];
  if (!query) {
    const groupMap = new Map<string, Area[]>();
    matchedAreas.forEach((a) => {
      const key = a.lga ?? a.city;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(a);
    });
    groupMap.forEach((areas, label) => browseGroups.push({ label, areas }));
  }
  // Keep alias for backward compat in JSX
  const cityGroups = browseGroups;

  // ── Mobile picker computed values ──
  const mobileLocQuery = mobileLocSearch.toLowerCase().trim();
  const mobileMatchedAreas = mobileLocQuery
    ? countryAreas.filter((a) =>
        a.name.toLowerCase().includes(mobileLocQuery) ||
        a.city.toLowerCase().includes(mobileLocQuery) ||
        a.note.toLowerCase().includes(mobileLocQuery),
      )
    : countryAreas;
  const mobileBrowseGroups: { label: string; areas: Area[] }[] = [];
  if (!mobileLocQuery) {
    const mobileGroupMap = new Map<string, Area[]>();
    mobileMatchedAreas.forEach((a) => {
      const key = a.lga ?? a.city;
      if (!mobileGroupMap.has(key)) mobileGroupMap.set(key, []);
      mobileGroupMap.get(key)!.push(a);
    });
    mobileGroupMap.forEach((areas, label) => mobileBrowseGroups.push({ label, areas }));
  }

  const openMobilePicker = () => {
    setMobileLocSearch(location);
    setShowMobileLocPicker(true);
    setTimeout(() => mobileLocRef.current?.focus(), 80);
  };

  const closeMobilePicker = () => {
    setShowMobileLocPicker(false);
    setMobileLocSearch('');
  };

  const pickLocationMobile = (area: Area) => {
    setLocation(area.name);
    setSelectedTier(area.tier);
    setLat(undefined); setLng(undefined);
    setLocationError('');
    closeMobilePicker();
    if (industry.trim()) runSearch(industry, area.name);
  };

  const showFullForm = landing || mobileExpanded;

  const runSearch = (ind: string, loc: string, lt?: number, ln?: number) => {
    if (!ind.trim() || (!loc.trim() && !lt)) return;
    setMobileExpanded(false);
    const q = lt ? `${ind} near me` : `${ind} in ${loc}`;
    onSearch({ industry: ind, location: loc, country, lat: lt, lng: ln, radius, query: q });
  };

  const handleCountryChange = (code: string) => {
    setCountry(code);
    setSelectedState(null);
    setLocation('');
    setSelectedTier(null);
    setLat(undefined);
    setLng(undefined);
    setLocationError('');
    setShowCountryDd(false);
    setCountrySearch('');
    // Auto-focus state if country has states, otherwise focus location
    setTimeout(() => {
      if (stateSelectRef.current) stateSelectRef.current.focus();
      else locationRef.current?.focus();
    }, 80);
  };

  const handleStateChange = (stateCode: string | null) => {
    setSelectedState(stateCode);
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
    if (!industry.trim()) { setIndustryError('Please select a business category.'); return; }
    const isValidCategory = INDUSTRIES.some(
      (s) => s.toLowerCase() === industry.toLowerCase()
    );
    if (!isValidCategory) {
      setIndustryError('Please pick a category from the list — use Google to search for a specific business name.');
      return;
    }
    if (!location.trim() && !lat) { setLocationError('Please enter a location or use your GPS.'); return; }
    setMobileExpanded(false);
    runSearch(industry, location, lat, lng);
  };

  const pickIndustry = (s: string) => {
    setIndustry(s); setShowIndSug(false);
    if (location.trim() || lat) runSearch(s, location, lat, lng);
    else setTimeout(() => locationRef.current?.focus(), 50);
  };

  const pickLocation = (area: Area) => {
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
    if (!navigator.geolocation) { setGeoError('Geolocation not supported by your browser.'); return; }
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

  const TIER_DOT: Record<string, string> = {
    high: 'bg-yellow-400', mid: 'bg-blue-400', budget: 'bg-gray-500',
  };
  const TIER_TEXT: Record<string, string> = {
    high: 'text-yellow-400', mid: 'text-blue-400', budget: 'text-gray-500',
  };

  return (
    <>
    {/* Mobile compact bar — replaces full form on mobile after first search */}
    {!showFullForm && (
      <div className="sm:hidden border-b border-white/8 bg-gray-900/95 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setMobileExpanded(true)}
          className="flex-1 bg-gray-800/80 border border-white/10 rounded-xl px-4 py-2.5 text-left flex items-center gap-3 active:bg-gray-700/80 transition-colors"
        >
          <Search className="w-4 h-4 text-purple-400 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-semibold truncate">{industry || 'Search prospects'}</p>
            <p className="text-gray-500 text-xs truncate">
              {location || 'Any location'} · {selectedCountry.flag} {selectedCountry.name}
            </p>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-600 flex-shrink-0" />
        </button>
      </div>
    )}

    <div className={`bg-gradient-to-br from-purple-950/60 via-gray-900 to-gray-950 border-b border-white/5 ${!showFullForm ? 'hidden sm:block' : ''}`}>
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-8">

        {/* Hero */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center gap-2 bg-purple-500/20 border border-purple-500/30 rounded-full px-4 py-1.5 text-purple-300 text-sm font-semibold mb-4">
            🎯 AI Business Discovery
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white mb-2 leading-tight">
            <span className="bg-gradient-to-r from-purple-500 to-purple-400 bg-clip-text text-transparent">Runvax</span> — Find businesses<br className="hidden md:block" />{' '}
            that need your service
          </h1>
          <p className="text-gray-400 text-sm md:text-base max-w-lg mx-auto">
            Search by industry, location, reviews, and online presence to discover high-potential businesses you can confidently approach.
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

          {/* ── Step 1: Country + Step 2: State ── */}
          <div className="grid sm:grid-cols-2 gap-4">

            {/* Country */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                1 · Country
              </label>

              {/* Desktop: flag chip grid */}
              <div className="hidden sm:flex flex-wrap gap-2">
                {COUNTRIES_SORTED.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    title={c.name}
                    onClick={() => handleCountryChange(c.code)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all duration-150 ${
                      country === c.code
                        ? 'bg-purple-600/20 border-purple-500/50 text-white font-semibold ring-1 ring-purple-500/30'
                        : 'bg-gray-800/60 border-white/8 text-gray-400 hover:border-purple-500/30 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    <span className="text-xl leading-none">{c.flag}</span>
                    <span className="text-xs font-semibold">{c.name}</span>
                  </button>
                ))}
              </div>

              {/* Mobile: searchable dropdown */}
              <div className="sm:hidden relative" ref={countryDdRef}>
                <button
                  type="button"
                  onClick={() => setShowCountryDd((v) => !v)}
                  className={`w-full bg-gray-800/80 border rounded-xl pl-4 pr-10 py-3 text-sm text-left flex items-center gap-2.5 transition-colors ${showCountryDd ? 'border-purple-500 text-white' : 'border-white/10 text-white hover:border-purple-500/40'}`}
                >
                  <span className="text-base leading-none">{selectedCountry.flag}</span>
                  <span className="flex-1 truncate">{selectedCountry.name}</span>
                  <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 transition-transform ${showCountryDd ? 'rotate-180' : ''}`} />
                </button>

                {showCountryDd && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-white/10 rounded-xl shadow-2xl z-30 overflow-hidden">
                    <div className="p-2 border-b border-white/8">
                      <input
                        type="text"
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                        placeholder="Search country…"
                        autoFocus
                        className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                      {filteredCountries.length === 0 && (
                        <p className="text-center text-gray-600 text-sm py-4">No match</p>
                      )}
                      {filteredCountries.map((c, i) => (
                        <button
                          key={c.code}
                          type="button"
                          onMouseDown={() => handleCountryChange(c.code)}
                          className={`w-full text-left px-4 py-2.5 flex items-center gap-3 text-sm transition-colors border-b border-white/5 last:border-0 ${
                            country === c.code
                              ? 'bg-purple-600/25 text-purple-200 font-semibold'
                              : 'text-gray-300 hover:bg-purple-600/20 hover:text-white'
                          }`}
                        >
                          <span className="text-base leading-none">{c.flag}</span>
                          <span className="flex-1">{c.name}</span>
                          {i === 0 && !countrySearch && (
                            <span className="text-[10px] text-purple-400 font-bold">Popular</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* State / Region */}
            {country !== 'OTHER' && countryStates.length > 0 && (
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                  2 · State / Region
                </label>
                <div className="relative">
                  <select
                    ref={stateSelectRef}
                    value={selectedState ?? ''}
                    onChange={(e) => handleStateChange(e.target.value || null)}
                    className="w-full bg-gray-800/80 border border-white/10 rounded-xl pl-4 pr-10 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors text-sm appearance-none cursor-pointer"
                  >
                    <option value="">All states</option>
                    {countryStates.map((s) => (
                      <option key={s.code} value={s.code}>{s.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                </div>
              </div>
            )}
          </div>

          {/* ── Step 3: Industry + Area ── */}
          <div className="grid md:grid-cols-2 gap-4">

            {/* Industry */}
            <div className="relative">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                {country !== 'OTHER' && countryStates.length > 0 ? '3' : '2'} · Industry / Business Type
              </label>
              <div className="relative">
                <input type="text" value={industry}
                  onChange={(e) => { setIndustry(e.target.value); setShowIndSug(true); setIndustryError(''); }}
                  onFocus={() => setShowIndSug(true)}
                  onBlur={() => setTimeout(() => {
                    setShowIndSug(false);
                    // Clear if typed text doesn't match any category
                    if (industry.trim() && !INDUSTRIES.some((s) => s.toLowerCase() === industry.toLowerCase())) {
                      setIndustry('');
                    }
                  }, 200)}
                  placeholder="Select a business category…"
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

            {/* Location / Area */}
            <div className="relative">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                <span>{country !== 'OTHER' && countryStates.length > 0 ? '4' : '3'} · Area / Location</span>
                {selectedTier && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${TIER_CONFIG[selectedTier].badge}`}>
                    {TIER_CONFIG[selectedTier].label}
                  </span>
                )}
              </label>
              <div className="flex gap-2">
                {/* Mobile: tapping opens full-screen picker */}
                <button
                  type="button"
                  onClick={openMobilePicker}
                  className={`sm:hidden flex-1 bg-gray-800/80 border rounded-xl px-4 py-3 text-sm text-left transition-colors ${
                    location ? 'text-white' : 'text-gray-600'
                  } ${locationError ? 'border-red-500' : 'border-white/10'}`}
                >
                  {location || (selectedState
                    ? `Search in ${STATES.find(s => s.code === selectedState)?.name}…`
                    : country === 'OTHER' ? 'Type any city or area…'
                    : `Search areas in ${selectedCountry.name}…`)}
                </button>

                {/* Desktop: normal text input with dropdown */}
                <input ref={locationRef} type="text" value={location}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    setSelectedTier(null);
                    setLat(undefined); setLng(undefined);
                    setShowLocSug(true);
                    setLocationError('');
                  }}
                  onFocus={() => setShowLocSug(true)}
                  onBlur={() => setTimeout(() => setShowLocSug(false), 200)}
                  placeholder={
                    selectedState
                      ? `Type an area in ${STATES.find(s => s.code === selectedState)?.name}…`
                      : country === 'OTHER'
                        ? 'Type any city or area…'
                        : `Search areas in ${selectedCountry.name}…`
                  }
                  className={`hidden sm:block flex-1 bg-gray-800/80 border rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none transition-colors text-sm ${locationError ? 'border-red-500 focus:border-red-400' : 'border-white/10 focus:border-purple-500'}`}
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

              {/* Area dropdown — desktop only */}
              {showLocSug && (query ? matchedAreas.length > 0 : cityGroups.length > 0) && (
                <div className="hidden sm:block absolute top-full left-0 right-[52px] mt-1 bg-gray-900 border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden max-h-80 overflow-y-auto">

                  {/* SEARCH MODE — flat results with tier badge + LGA hint */}
                  {query && matchedAreas.map((area) => (
                    <button key={`${area.lga ?? area.city}-${area.name}`} type="button" onMouseDown={() => pickLocation(area)}
                      className="w-full text-left px-4 py-2.5 hover:bg-purple-600/20 transition-colors border-b border-white/5 last:border-0 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm text-gray-200 font-medium truncate">{area.name}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">
                          {area.lga ? <span className="text-purple-400/70">{area.lga} · </span> : null}
                          {area.note}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`w-1.5 h-1.5 rounded-full ${TIER_DOT[area.tier]}`} />
                        <span className={`text-[10px] font-semibold ${TIER_TEXT[area.tier]}`}>
                          {TIER_CONFIG[area.tier].label}
                        </span>
                      </div>
                    </button>
                  ))}

                  {/* BROWSE MODE — grouped by LGA (when available) or city */}
                  {!query && cityGroups.map(({ label, areas }) => (
                    <div key={label}>
                      <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-purple-400 border-b border-white/5 bg-purple-900/20 flex items-center gap-2">
                        <span>{label}</span>
                        <span className="text-gray-600 font-normal normal-case tracking-normal">
                          {areas.length} area{areas.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {areas.map((area) => (
                        <button key={`${area.lga ?? area.city}-${area.name}`} type="button" onMouseDown={() => pickLocation(area)}
                          className="w-full text-left px-4 py-2.5 hover:bg-purple-600/20 transition-colors border-b border-white/5 last:border-0 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm text-gray-200 font-medium truncate">{area.name}</div>
                            <div className="text-[10px] text-gray-500 mt-0.5">{area.note}</div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className={`w-1.5 h-1.5 rounded-full ${TIER_DOT[area.tier]}`} />
                            <span className={`text-[10px] font-semibold ${TIER_TEXT[area.tier]}`}>
                              {TIER_CONFIG[area.tier].label}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ))}

                  {!query && !selectedState && (
                    <div className="px-4 py-2.5 text-[11px] text-gray-600 border-t border-white/5">
                      Pick a state to narrow down · or type to search all of {selectedCountry.name}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-3 text-base shadow-lg shadow-purple-900/40">
            {loading
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Searching prospects…</>
              : <><Search className="w-5 h-5" /> Find Prospects Now</>}
          </button>
        </form>
      </div>
    </div>

    {/* ── Recent Searches + SEO content strip ── */}
    {landing && (
    <div className="max-w-5xl mx-auto px-4 py-5 flex flex-col gap-6">

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

      {/* ── How It Works ── */}
      <div className="border-t border-white/5 pt-10 pb-4">
        <div className="text-center mb-8">
          <p className="text-[11px] font-black text-purple-400 uppercase tracking-[0.2em] mb-2">How It Works</p>
          <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
            From zero to signed client<br className="hidden sm:block" />{' '}
            <span className="bg-gradient-to-r from-purple-400 to-orange-400 bg-clip-text text-transparent">in under 60 seconds</span>
          </h2>
        </div>

        {/* ── Mobile swipeable carousel ── */}
        <div className="sm:hidden relative -mx-4">
          <div
            ref={howCarouselRef}
            onScroll={() => {
              const el = howCarouselRef.current;
              if (!el) return;
              const cardW = (el.children[0] as HTMLElement)?.offsetWidth ?? 0;
              setActiveHowStep(Math.min(2, Math.round(el.scrollLeft / (cardW + 16))));
            }}
            className="flex overflow-x-auto snap-x snap-mandatory scroll-smooth gap-4 pl-4 pr-6 pb-2"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', scrollPaddingLeft: '1rem' } as React.CSSProperties}
          >
            {/* Step 1 */}
            <div className="snap-start flex-shrink-0 w-[78vw]">
              <div className="how-card rounded-2xl border border-white/8 shadow-md p-5" style={{ borderLeft: '3px solid rgb(124,58,237)' }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-lg flex-shrink-0">🔍</div>
                  <span className="text-[10px] font-black text-purple-500 uppercase tracking-[0.15em]">Step 1</span>
                </div>
                <h3 className="text-white text-[17px] font-black leading-snug mb-2">Type. Search. Done.</h3>
                <p className="text-gray-400 text-[13px] leading-relaxed">
                  Pick any industry and city worldwide. Restaurants in Lagos, salons in Nairobi, law firms in London — scanned instantly.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="snap-start flex-shrink-0 w-[78vw]">
              <div className="how-card rounded-2xl border border-white/8 shadow-md p-5" style={{ borderLeft: '3px solid rgb(249,115,22)' }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center text-lg flex-shrink-0">🎯</div>
                  <span className="text-[10px] font-black text-orange-500 uppercase tracking-[0.15em]">Step 2</span>
                </div>
                <h3 className="text-white text-[17px] font-black leading-snug mb-2">No Website = They Need You.</h3>
                <p className="text-gray-400 text-[13px] leading-relaxed">
                  Every business without a website is flagged as a hot lead — scored by rating, reviews, and category.
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="snap-start flex-shrink-0 w-[78vw]">
              <div className="how-card rounded-2xl border border-white/8 shadow-md p-5" style={{ borderLeft: '3px solid rgb(124,58,237)' }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-orange-500 flex items-center justify-center text-lg flex-shrink-0">⚡</div>
                  <span className="text-[10px] font-black text-purple-500 uppercase tracking-[0.15em]">Step 3</span>
                </div>
                <h3 className="text-white text-[17px] font-black leading-snug mb-2">AI Writes It. You Send It.</h3>
                <p className="text-gray-400 text-[13px] leading-relaxed">
                  One tap generates a personalised WhatsApp, cold email, or proposal — named after their business, city, and industry.
                </p>
              </div>
            </div>
          </div>

          {/* Dots */}
          <div className="flex items-center justify-center gap-2 mt-4 px-4">
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                onClick={() => {
                  const el = howCarouselRef.current;
                  if (!el) return;
                  const cardW = (el.children[0] as HTMLElement)?.offsetWidth ?? 0;
                  el.scrollTo({ left: i * (cardW + 16), behavior: 'smooth' });
                  setActiveHowStep(i);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === activeHowStep ? 'w-7 bg-purple-500' : 'w-1.5 bg-gray-700'}`}
              />
            ))}
          </div>
        </div>

        {/* ── Desktop grid ── */}
        <div className="hidden sm:grid grid-cols-3 gap-5">
          {/* Step 1 */}
          <div className="how-card rounded-2xl border border-white/8 shadow-sm p-6 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5" style={{ borderTop: '3px solid rgb(124,58,237)' }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-purple-600 flex items-center justify-center text-2xl flex-shrink-0">🔍</div>
              <div>
                <p className="text-[10px] font-black text-purple-500 uppercase tracking-[0.15em]">Step 1</p>
                <p className="text-gray-500 text-[11px]">Search</p>
              </div>
            </div>
            <h3 className="text-white text-xl font-black leading-snug mb-2">Type. Search. Done.</h3>
            <p className="text-gray-400 text-sm leading-relaxed">Pick any industry and city worldwide. Restaurants in Lagos, salons in Nairobi, law firms in London — we scan for prospects instantly.</p>
          </div>

          {/* Step 2 */}
          <div className="how-card rounded-2xl border border-white/8 shadow-sm p-6 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5" style={{ borderTop: '3px solid rgb(249,115,22)' }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-orange-500 flex items-center justify-center text-2xl flex-shrink-0">🎯</div>
              <div>
                <p className="text-[10px] font-black text-orange-500 uppercase tracking-[0.15em]">Step 2</p>
                <p className="text-gray-500 text-[11px]">Identify</p>
              </div>
            </div>
            <h3 className="text-white text-xl font-black leading-snug mb-2">No Website = They Need You.</h3>
            <p className="text-gray-400 text-sm leading-relaxed">Every business without a website is flagged as a hot lead. Scored by rating, reviews, and category — your best prospects rise to the top.</p>
          </div>

          {/* Step 3 */}
          <div className="how-card rounded-2xl border border-white/8 shadow-sm p-6 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5" style={{ borderTop: '3px solid rgb(124,58,237)' }}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-600 to-orange-500 flex items-center justify-center text-2xl flex-shrink-0">⚡</div>
              <div>
                <p className="text-[10px] font-black text-purple-500 uppercase tracking-[0.15em]">Step 3</p>
                <p className="text-gray-500 text-[11px]">Close</p>
              </div>
            </div>
            <h3 className="text-white text-xl font-black leading-snug mb-2">AI Writes It. You Send It.</h3>
            <p className="text-gray-400 text-sm leading-relaxed">One tap generates a personalised WhatsApp message, cold email, or full proposal — named after their business, city, and industry.</p>
          </div>
        </div>

        {/* Bottom trust line */}
        <div className="flex items-center justify-center gap-6 mt-8 flex-wrap">
          {['🌍 Works in 50+ countries', '⚡ Results in seconds', '🤖 AI-powered outreach'].map((t) => (
            <div key={t} className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold">{t}</div>
          ))}
        </div>
      </div>
    </div>
    )}

    {/* ── Mobile full-screen location picker ── */}
    {showMobileLocPicker && (
      <div
        className="sm:hidden fixed inset-0 z-[100] flex flex-col bg-gray-950"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Header */}
        <div className="bg-gray-900 border-b border-white/8 px-4 pt-3 pb-3 space-y-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={closeMobilePicker}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 active:bg-white/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">Choose Area</p>
              <p className="text-gray-500 text-xs truncate">{selectedCountry.flag} {selectedCountry.name}{selectedState ? ` · ${STATES.find(s => s.code === selectedState)?.name}` : ''}</p>
            </div>
            {mobileLocSearch && (
              <button type="button" onClick={() => setMobileLocSearch('')} className="text-gray-500 p-1">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <input
              ref={mobileLocRef}
              type="text"
              value={mobileLocSearch}
              onChange={(e) => setMobileLocSearch(e.target.value)}
              placeholder={selectedState
                ? `Search in ${STATES.find(s => s.code === selectedState)?.name}…`
                : `Search areas in ${selectedCountry.name}…`}
              className="w-full bg-gray-800 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 text-sm"
            />
          </div>
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto">

          {/* GPS option */}
          <button
            type="button"
            onClick={() => { handleGeolocate(); closeMobilePicker(); }}
            className="w-full flex items-center gap-4 px-4 py-4 border-b border-white/5 active:bg-white/5"
          >
            <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
              <Navigation className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-white text-sm font-semibold">Use my current location</p>
              <p className="text-gray-500 text-xs mt-0.5">GPS auto-detect</p>
            </div>
          </button>

          {/* Results */}
          {mobileLocQuery ? (
            /* Search mode — flat list */
            mobileMatchedAreas.length === 0 ? (
              <div className="text-center py-16 text-gray-600">
                <p className="text-base mb-1">No areas found</p>
                <p className="text-sm">Try a different search term</p>
              </div>
            ) : (
              mobileMatchedAreas.map((area) => (
                <button
                  key={`${area.lga ?? area.city}-${area.name}`}
                  type="button"
                  onClick={() => pickLocationMobile(area)}
                  className={`w-full flex items-center justify-between gap-4 px-4 py-4 border-b border-white/5 active:bg-purple-600/10 ${location === area.name ? 'bg-purple-600/10' : ''}`}
                >
                  <div className="min-w-0 text-left">
                    <p className="text-white text-sm font-medium">{area.name}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {area.lga ? <span className="text-purple-400/70">{area.lga} · </span> : null}
                      {area.note}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full border ${TIER_CONFIG[area.tier].badge}`}>
                    {TIER_CONFIG[area.tier].label}
                  </span>
                </button>
              ))
            )
          ) : (
            /* Browse mode — grouped */
            mobileBrowseGroups.length === 0 ? (
              <div className="text-center py-16 text-gray-600 text-sm">No areas available</div>
            ) : (
              mobileBrowseGroups.map(({ label, areas }) => (
                <div key={label}>
                  <div className="px-4 py-2.5 bg-gray-900/80 border-b border-white/5 sticky top-0 z-10">
                    <p className="text-[11px] font-black uppercase tracking-widest text-purple-400">{label}</p>
                    <p className="text-[10px] text-gray-600">{areas.length} area{areas.length !== 1 ? 's' : ''}</p>
                  </div>
                  {areas.map((area) => (
                    <button
                      key={`${area.lga ?? area.city}-${area.name}`}
                      type="button"
                      onClick={() => pickLocationMobile(area)}
                      className={`w-full flex items-center justify-between gap-4 px-4 py-4 border-b border-white/5 active:bg-purple-600/10 ${location === area.name ? 'bg-purple-600/10' : ''}`}
                    >
                      <div className="min-w-0 text-left">
                        <p className="text-white text-sm font-medium">{area.name}</p>
                        <p className="text-gray-500 text-xs mt-0.5">{area.note}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {location === area.name && <span className="text-purple-400 text-xs">✓</span>}
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${TIER_CONFIG[area.tier].badge}`}>
                          {TIER_CONFIG[area.tier].label}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              ))
            )
          )}
        </div>
      </div>
    )}
    </>
  );
}
