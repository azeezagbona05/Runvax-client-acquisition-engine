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
  { code: 'OTHER', name: 'Other',      flag: '🌍' },
];

const AREAS: Array<{
  name: string;
  city: string;
  tier: 'high' | 'mid' | 'budget';
  note: string;
  country: string;
}> = [
  // ── Nigeria · Lagos High-ticket ──
  { country: 'NG', name: 'Ikoyi, Lagos',              city: 'Lagos',         tier: 'high',   note: 'Wealthiest district · ₦800k–₦3M' },
  { country: 'NG', name: 'Victoria Island, Lagos',    city: 'Lagos',         tier: 'high',   note: 'Corporate & luxury · ₦600k–₦2M' },
  { country: 'NG', name: 'Banana Island, Lagos',      city: 'Lagos',         tier: 'high',   note: 'Ultra-premium · ₦1M+' },
  { country: 'NG', name: 'Lekki Phase 1, Lagos',      city: 'Lagos',         tier: 'high',   note: 'Growing premium · ₦400k–₦1.5M' },
  { country: 'NG', name: 'Eti-Osa, Lagos',            city: 'Lagos',         tier: 'high',   note: 'Tech & corporate hub · ₦400k–₦1M' },
  // ── Nigeria · Lagos Mid-range ──
  { country: 'NG', name: 'Ikeja GRA, Lagos',          city: 'Lagos',         tier: 'mid',    note: 'Established SMEs · ₦200k–₦500k' },
  { country: 'NG', name: 'Maryland, Lagos',           city: 'Lagos',         tier: 'mid',    note: 'Commercial · ₦150k–₦400k' },
  { country: 'NG', name: 'Gbagada, Lagos',            city: 'Lagos',         tier: 'mid',    note: 'Residential-commercial mix · ₦150k–₦350k' },
  { country: 'NG', name: 'Magodo, Lagos',             city: 'Lagos',         tier: 'mid',    note: 'Educated middle class · ₦200k–₦400k' },
  { country: 'NG', name: 'Lekki Phase 2, Lagos',      city: 'Lagos',         tier: 'mid',    note: 'Developing market · ₦200k–₦500k' },
  { country: 'NG', name: 'Ajah, Lagos',               city: 'Lagos',         tier: 'mid',    note: 'Fast-growing area · ₦150k–₦350k' },
  { country: 'NG', name: 'Yaba, Lagos',               city: 'Lagos',         tier: 'mid',    note: 'Tech hub & students · ₦100k–₦300k' },
  { country: 'NG', name: 'Surulere, Lagos',           city: 'Lagos',         tier: 'mid',    note: 'Dense market · ₦100k–₦300k' },
  { country: 'NG', name: 'Sangotedo, Lagos',          city: 'Lagos',         tier: 'mid',    note: 'New estates · ₦150k–₦400k' },
  // ── Nigeria · Lagos Budget ──
  { country: 'NG', name: 'Ikeja, Lagos',              city: 'Lagos',         tier: 'budget', note: 'High volume · ₦80k–₦200k' },
  { country: 'NG', name: 'Ikorodu, Lagos',            city: 'Lagos',         tier: 'budget', note: 'Large market · ₦50k–₦150k' },
  { country: 'NG', name: 'Alimosho, Lagos',           city: 'Lagos',         tier: 'budget', note: 'Highest density · ₦50k–₦150k' },
  { country: 'NG', name: 'Ayobo, Lagos',              city: 'Lagos',         tier: 'budget', note: 'Very price-sensitive · ₦40k–₦120k' },
  { country: 'NG', name: 'Ipaja, Lagos',              city: 'Lagos',         tier: 'budget', note: 'High volume needed · ₦40k–₦120k' },
  { country: 'NG', name: 'Mushin, Lagos',             city: 'Lagos',         tier: 'budget', note: 'Budget market · ₦30k–₦100k' },
  { country: 'NG', name: 'Oshodi, Lagos',             city: 'Lagos',         tier: 'budget', note: 'Trade-focused · ₦50k–₦120k' },
  { country: 'NG', name: 'Agege, Lagos',              city: 'Lagos',         tier: 'budget', note: 'Price-sensitive · ₦30k–₦100k' },
  // ── Nigeria · Abuja ──
  { country: 'NG', name: 'Maitama, Abuja',            city: 'Abuja',         tier: 'high',   note: 'Ministers & executives · ₦800k–₦3M' },
  { country: 'NG', name: 'Asokoro, Abuja',            city: 'Abuja',         tier: 'high',   note: 'Government elite · ₦600k–₦2M' },
  { country: 'NG', name: 'Wuse 2, Abuja',             city: 'Abuja',         tier: 'high',   note: 'Corporate hub · ₦400k–₦1.2M' },
  { country: 'NG', name: 'Jabi, Abuja',               city: 'Abuja',         tier: 'high',   note: 'Premium retail · ₦400k–₦1M' },
  { country: 'NG', name: 'Garki, Abuja',              city: 'Abuja',         tier: 'mid',    note: 'Established business · ₦200k–₦500k' },
  { country: 'NG', name: 'Gwarinpa, Abuja',           city: 'Abuja',         tier: 'mid',    note: 'Growing estates · ₦150k–₦400k' },
  { country: 'NG', name: 'Karu, Abuja',               city: 'Abuja',         tier: 'mid',    note: 'Dense SME market · ₦100k–₦300k' },
  { country: 'NG', name: 'Kubwa, Abuja',              city: 'Abuja',         tier: 'mid',    note: 'Satellite town · ₦100k–₦250k' },
  // ── Nigeria · Other cities ──
  { country: 'NG', name: 'GRA, Port Harcourt',        city: 'Port Harcourt', tier: 'high',   note: 'Oil-money area · ₦500k–₦1.5M' },
  { country: 'NG', name: 'Rumuola, Port Harcourt',    city: 'Port Harcourt', tier: 'mid',    note: 'Commercial district · ₦150k–₦400k' },
  { country: 'NG', name: 'Trans Amadi, Port Harcourt',city: 'Port Harcourt', tier: 'mid',    note: 'Industrial/SME · ₦150k–₦400k' },
  { country: 'NG', name: 'GRA, Enugu',                city: 'Enugu',         tier: 'high',   note: 'Premium clients · ₦300k–₦800k' },
  { country: 'NG', name: 'Independence Layout, Enugu',city: 'Enugu',         tier: 'mid',    note: 'Established businesses · ₦150k–₦350k' },
  { country: 'NG', name: 'Bodija, Ibadan',            city: 'Ibadan',        tier: 'high',   note: 'Educated professionals · ₦200k–₦600k' },
  { country: 'NG', name: 'Dugbe, Ibadan',             city: 'Ibadan',        tier: 'mid',    note: 'Dense commercial · ₦100k–₦300k' },
  { country: 'NG', name: 'Nassarawa, Kano',           city: 'Kano',          tier: 'high',   note: 'Wealthy traders · ₦300k–₦800k' },
  { country: 'NG', name: 'Sabon Gari, Kano',          city: 'Kano',          tier: 'mid',    note: 'Active commerce · ₦100k–₦300k' },
  { country: 'NG', name: 'GRA, Benin City',           city: 'Benin City',    tier: 'high',   note: 'Premium clients · ₦250k–₦700k' },
  { country: 'NG', name: 'Sapele Road, Benin City',   city: 'Benin City',    tier: 'mid',    note: 'Commercial strip · ₦100k–₦300k' },

  // ── Ghana ──
  { country: 'GH', name: 'East Legon, Accra, Ghana',      city: 'Accra',    tier: 'high',   note: 'Wealthy residential · GH₵8k–₵25k' },
  { country: 'GH', name: 'Airport Residential, Accra, Ghana', city: 'Accra',tier: 'high',   note: 'Expats & executives · GH₵10k–₵30k' },
  { country: 'GH', name: 'Cantonments, Accra, Ghana',     city: 'Accra',    tier: 'high',   note: 'Diplomatic & corporate · GH₵8k–₵20k' },
  { country: 'GH', name: 'Labone, Accra, Ghana',          city: 'Accra',    tier: 'high',   note: 'Affluent professionals · GH₵6k–₵15k' },
  { country: 'GH', name: 'Osu, Accra, Ghana',             city: 'Accra',    tier: 'mid',    note: 'Busy commercial strip · GH₵3k–₵8k' },
  { country: 'GH', name: 'Adabraka, Accra, Ghana',        city: 'Accra',    tier: 'mid',    note: 'Active SME area · GH₵2k–₵6k' },
  { country: 'GH', name: 'Dansoman, Accra, Ghana',        city: 'Accra',    tier: 'budget', note: 'High density · GH₵1k–₵3k' },
  { country: 'GH', name: 'Adum, Kumasi, Ghana',           city: 'Kumasi',   tier: 'mid',    note: 'Kumasi city centre · GH₵2k–₵6k' },
  { country: 'GH', name: 'Takoradi, Ghana',               city: 'Takoradi', tier: 'mid',    note: 'Oil & port city · GH₵3k–₵8k' },

  // ── Kenya ──
  { country: 'KE', name: 'Karen, Nairobi, Kenya',          city: 'Nairobi',  tier: 'high',   note: 'Expat & wealthy suburb · KSh80k–₵250k' },
  { country: 'KE', name: 'Westlands, Nairobi, Kenya',      city: 'Nairobi',  tier: 'high',   note: 'Corporate & retail hub · KSh60k–₵200k' },
  { country: 'KE', name: 'Kilimani, Nairobi, Kenya',       city: 'Nairobi',  tier: 'high',   note: 'Upmarket residential · KSh60k–₵180k' },
  { country: 'KE', name: 'Lavington, Nairobi, Kenya',      city: 'Nairobi',  tier: 'high',   note: 'Premium professionals · KSh70k–₵200k' },
  { country: 'KE', name: 'Parklands, Nairobi, Kenya',      city: 'Nairobi',  tier: 'mid',    note: 'Established business · KSh30k–₵80k' },
  { country: 'KE', name: 'South B, Nairobi, Kenya',        city: 'Nairobi',  tier: 'mid',    note: 'Residential SMEs · KSh20k–₵60k' },
  { country: 'KE', name: 'Nairobi CBD, Kenya',             city: 'Nairobi',  tier: 'mid',    note: 'High-volume commerce · KSh20k–₵50k' },
  { country: 'KE', name: 'Mombasa CBD, Kenya',             city: 'Mombasa',  tier: 'mid',    note: 'Coastal commercial · KSh20k–₵60k' },
  { country: 'KE', name: 'Nyali, Mombasa, Kenya',          city: 'Mombasa',  tier: 'high',   note: 'Upmarket coastal · KSh50k–₵150k' },
  { country: 'KE', name: 'Kisumu CBD, Kenya',              city: 'Kisumu',   tier: 'mid',    note: 'Lake region hub · KSh15k–₵40k' },

  // ── South Africa ──
  { country: 'ZA', name: 'Sandton, Johannesburg, South Africa',   city: 'Johannesburg', tier: 'high',   note: 'Africa\'s richest sq mile · R15k–₵80k' },
  { country: 'ZA', name: 'Rosebank, Johannesburg, South Africa',  city: 'Johannesburg', tier: 'high',   note: 'Corporate & lifestyle · R10k–₵50k' },
  { country: 'ZA', name: 'Fourways, Johannesburg, South Africa',  city: 'Johannesburg', tier: 'high',   note: 'Suburban premium · R10k–₵40k' },
  { country: 'ZA', name: 'Midrand, South Africa',                 city: 'Midrand',      tier: 'mid',    note: 'Tech corridor · R6k–₵20k' },
  { country: 'ZA', name: 'Pretoria East, South Africa',           city: 'Pretoria',     tier: 'mid',    note: 'Affluent suburbs · R8k–₵25k' },
  { country: 'ZA', name: 'V&A Waterfront, Cape Town, South Africa', city: 'Cape Town',  tier: 'high',   note: 'Tourism & premium retail · R15k–₵60k' },
  { country: 'ZA', name: 'Claremont, Cape Town, South Africa',    city: 'Cape Town',    tier: 'mid',    note: 'Southern suburbs · R8k–₵25k' },
  { country: 'ZA', name: 'Umhlanga, Durban, South Africa',        city: 'Durban',       tier: 'high',   note: 'Upmarket coastal · R10k–₵35k' },

  // ── Uganda ──
  { country: 'UG', name: 'Kololo, Kampala, Uganda',    city: 'Kampala', tier: 'high',   note: 'Elite residential · USh3M–₵8M' },
  { country: 'UG', name: 'Nakasero, Kampala, Uganda',  city: 'Kampala', tier: 'high',   note: 'Corporate & embassy · USh2M–₵6M' },
  { country: 'UG', name: 'Ntinda, Kampala, Uganda',    city: 'Kampala', tier: 'mid',    note: 'Growing suburb · USh800k–₵2M' },
  { country: 'UG', name: 'Kampala CBD, Uganda',        city: 'Kampala', tier: 'mid',    note: 'High-volume commerce · USh600k–₵1.5M' },
  { country: 'UG', name: 'Muyenga, Kampala, Uganda',   city: 'Kampala', tier: 'mid',    note: 'Residential commercial · USh700k–₵2M' },

  // ── Tanzania ──
  { country: 'TZ', name: 'Masaki, Dar es Salaam, Tanzania',    city: 'Dar es Salaam', tier: 'high',   note: 'Expat & elite · TSh500k–₵1.5M' },
  { country: 'TZ', name: 'Oyster Bay, Dar es Salaam, Tanzania',city: 'Dar es Salaam', tier: 'high',   note: 'Diplomatic suburb · TSh400k–₵1.2M' },
  { country: 'TZ', name: 'Mikocheni, Dar es Salaam, Tanzania', city: 'Dar es Salaam', tier: 'mid',    note: 'Growing commercial · TSh200k–₵500k' },
  { country: 'TZ', name: 'Arusha CBD, Tanzania',               city: 'Arusha',        tier: 'mid',    note: 'Safari & tourism hub · TSh200k–₵600k' },

  // ── Rwanda ──
  { country: 'RW', name: 'Kiyovu, Kigali, Rwanda',    city: 'Kigali', tier: 'high',   note: 'Premium Kigali · RWF600k–₵1.5M' },
  { country: 'RW', name: 'Nyarutarama, Kigali, Rwanda',city:'Kigali', tier: 'high',   note: 'Expat & exec suburb · RWF500k–₵1.2M' },
  { country: 'RW', name: 'Kimihurura, Kigali, Rwanda',city: 'Kigali', tier: 'mid',    note: 'Growing commercial · RWF200k–₵600k' },

  // ── Senegal ──
  { country: 'SN', name: 'Plateau, Dakar, Senegal',   city: 'Dakar',  tier: 'high',   note: 'Business district · XOF600k–₵1.5M' },
  { country: 'SN', name: 'Almadies, Dakar, Senegal',  city: 'Dakar',  tier: 'high',   note: 'Upmarket & expat · XOF500k–₵1.2M' },
  { country: 'SN', name: 'Mermoz, Dakar, Senegal',    city: 'Dakar',  tier: 'mid',    note: 'Professional class · XOF200k–₵500k' },

  // ── Cameroon ──
  { country: 'CM', name: 'Bastos, Yaoundé, Cameroon',  city: 'Yaoundé',  tier: 'high',   note: 'Diplomatic & elite · XAF500k–₵1.2M' },
  { country: 'CM', name: 'Bonanjo, Douala, Cameroon',  city: 'Douala',   tier: 'high',   note: 'Business district · XAF400k–₵1M' },
  { country: 'CM', name: 'Akwa, Douala, Cameroon',     city: 'Douala',   tier: 'mid',    note: 'Commercial centre · XAF150k–₵400k' },
];

const TIER_CONFIG = {
  high:   { label: '🏆 High-ticket',  color: 'text-yellow-400', dot: 'bg-yellow-400', badge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/20' },
  mid:    { label: '💼 Mid-range',    color: 'text-blue-400',   dot: 'bg-blue-400',   badge: 'bg-blue-500/15 text-blue-300 border-blue-500/20' },
  budget: { label: '💰 Budget market',color: 'text-gray-400',   dot: 'bg-gray-500',   badge: 'bg-gray-500/15 text-gray-300 border-gray-500/20' },
};

interface SearchFormProps {
  onSearch: (data: SearchFormData) => void;
  loading: boolean;
  onBrief?: () => void;
  /** Show the stats row + Quick Industry / Recent Searches panels (landing state only) */
  landing?: boolean;
}

export default function SearchForm({ onSearch, loading, onBrief, landing = true }: SearchFormProps) {
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
    label: 'Checking…', color: 'text-gray-500', dot: 'bg-gray-500',
  });
  useEffect(() => { setTimeStatus(getBestTimeStatus()); }, []);
  const [industryError, setIndustryError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [geoError, setGeoError] = useState('');

  const locationRef = useRef<HTMLInputElement>(null);

  useEffect(() => { getSearchHistory().then(setHistory); }, []);

  const selectedCountry = COUNTRIES.find((c) => c.code === country) ?? COUNTRIES[0];
  const countryAreas = AREAS.filter((a) => a.country === country);

  const indSuggestions = INDUSTRIES.filter(
    (s) => industry && s.toLowerCase().includes(industry.toLowerCase())
  );

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
    onSearch({ industry: ind, location: loc, lat: lt, lng: ln, radius, query: q });
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
            Search any industry, any city. Surface businesses with zero online presence — your next paying clients.
          </p>
        </div>

        {/* Status row */}
        <div className="flex items-center justify-center gap-3 mb-5 flex-wrap">
          <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            <span className={`w-2 h-2 rounded-full ${timeStatus.dot} animate-pulse`} />
            <span className={timeStatus.color}>{timeStatus.label}</span>
            <span className="text-gray-600">· {selectedCountry.flag} {selectedCountry.name}</span>
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
                  onClick={() => handleCountryChange(c.code)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${
                    country === c.code
                      ? 'bg-purple-600/30 border-purple-500/50 text-white'
                      : 'bg-gray-800/60 border-white/10 text-gray-400 hover:border-purple-500/30 hover:text-gray-200'
                  }`}
                >
                  <span>{c.flag}</span>
                  <span className="hidden sm:inline">{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">

            {/* Industry */}
            <div className="relative">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                Industry / Business Type
              </label>
              <input type="text" value={industry}
                onChange={(e) => { setIndustry(e.target.value); setShowIndSug(true); setIndustryError(''); }}
                onFocus={() => setShowIndSug(true)}
                onBlur={() => setTimeout(() => setShowIndSug(false), 150)}
                placeholder="e.g. Real Estate, Salons…"
                className={`w-full bg-gray-800/80 border rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none transition-colors text-sm ${industryError ? 'border-red-500 focus:border-red-400' : 'border-white/10 focus:border-purple-500'}`}
              />
              {industryError && (
                <p className="text-red-400 text-xs font-semibold mt-1.5 flex items-center gap-1">
                  <span>⚠</span> {industryError}
                </p>
              )}
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

    {/* ── Quick Industry Select (left) + Recent Searches (right) ── */}
    {landing && (
    <div className="max-w-5xl mx-auto px-4 py-5">
      <div className={`grid gap-x-8 gap-y-5 ${history.length > 0 ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>

        {/* Quick Industry Select (left — fills the row when no recent searches) */}
        <div>
          <p className="text-[11px] text-gray-500 uppercase tracking-widest font-bold mb-2.5">Quick Industry Select</p>
          <div className="flex flex-wrap gap-2">
            {INDUSTRIES.slice(0, 12).map((s) => (
              <button key={s} type="button" disabled={loading} onClick={() => pickIndustry(s)}
                className={`px-3 py-1.5 border rounded-full text-xs font-semibold transition-all disabled:opacity-40 ${
                  industry === s
                    ? 'bg-purple-600/30 border-purple-500/50 text-purple-300'
                    : 'bg-white/5 hover:bg-purple-600/20 border-white/10 hover:border-purple-500/30 text-gray-400 hover:text-white'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Recent Searches (right — only when there's history, max 5) */}
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
      </div>
    </div>
    )}
    </>
  );
}
