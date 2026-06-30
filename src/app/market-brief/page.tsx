'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, Sparkles, MapPin, ChevronRight, Copy, Check,
  TrendingUp, MessageCircle, Lightbulb, FileSearch, Lock, ExternalLink, Globe,
} from 'lucide-react';
import { useHandleAIResponse, useUpgrade } from '@/context/UpgradeContext';
import { useFeature } from '@/context/PlanFeaturesContext';

const INDUSTRIES = [
  'Restaurants & Eateries', 'Beauty Salons & Spas', 'Barbers & Hair Salons',
  'Schools & Private Tutors', 'Clinics & Hospitals', 'Pharmacies & Chemists',
  'Real Estate Agencies', 'Hotels & Guesthouses', 'Event Centers & Halls',
  'Law Firms', 'Auto Workshops & Mechanics', 'Fashion & Boutiques',
  'Photography Studios', 'Gyms & Fitness Centers', 'Construction & Contractors',
  'Catering Services', 'Churches & Ministries', 'Travel & Tour Agencies',
];

const AREAS = [
  'Victoria Island, Lagos', 'Lekki Phase 1, Lagos', 'Ikoyi, Lagos',
  'Ikeja, Lagos', 'Surulere, Lagos', 'Yaba, Lagos', 'Ajah, Lagos',
  'Abuja FCT', 'Wuse 2, Abuja', 'Maitama, Abuja', 'Port Harcourt',
  'Enugu', 'Kano', 'Ibadan', 'Benin City',
];

interface BriefData {
  clientProfile: string;
  pricingTiers: {
    budget: { range: string; who: string; approach: string };
    mid: { range: string; who: string; approach: string };
    premium: { range: string; who: string; approach: string };
  };
  recommendedEntry: 'budget' | 'mid' | 'premium';
  whyNow: string[];
  valueProps: string[];
  objections: Array<{ objection: string; response: string }>;
  messagingTone: string;
  strategicInsight: string;
  openingLine: string;
  sources?: Array<{ title: string; uri: string }>;
  provider?: string;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${copied ? 'bg-green-500/20 text-green-400' : 'bg-white/10 hover:bg-white/20 text-gray-400'}`}>
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

const TIER_STYLES = {
  budget:  { label: 'Budget',  dot: 'bg-gray-400',   card: 'border-gray-500/20 bg-gray-800/40',     badge: 'bg-gray-500/20 text-gray-300' },
  mid:     { label: 'Mid',     dot: 'bg-blue-400',   card: 'border-blue-500/20 bg-blue-900/20',      badge: 'bg-blue-500/20 text-blue-300' },
  premium: { label: 'Premium', dot: 'bg-purple-400', card: 'border-purple-500/25 bg-purple-900/20',  badge: 'bg-purple-500/20 text-purple-300' },
};

export default function MarketBriefPage() {
  const router = useRouter();
  const { triggerUpgrade } = useUpgrade();
  const canBrief = useFeature('marketBrief');
  const handleAIResponse = useHandleAIResponse();
  const [step, setStep] = useState<'pick' | 'loading' | 'results'>('pick');
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [showIndSug, setShowIndSug] = useState(false);
  const [showLocSug, setShowLocSug] = useState(false);
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [error, setError] = useState('');
  const [openObjection, setOpenObjection] = useState<number | null>(null);
  const locationRef = useRef<HTMLInputElement>(null);

  const indSuggestions = INDUSTRIES.filter((s) => industry && s.toLowerCase().includes(industry.toLowerCase()));
  const locSuggestions = AREAS.filter((a) => !location || a.toLowerCase().includes(location.toLowerCase())).slice(0, 6);

  const generate = async () => {
    if (!industry.trim() || !location.trim()) return;
    if (!canBrief) { triggerUpgrade('feature', 'Market Intelligence Briefs'); return; }
    setStep('loading');
    setError('');
    try {
      const res = await fetch('/api/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry, location }),
      });
      const data = await res.json();
      if (handleAIResponse(res, data)) { setStep('pick'); return; }
      if (!res.ok) throw new Error(data.error || 'Failed');
      setBrief(data);
      setStep('results');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate brief');
      setStep('pick');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-2xl bg-purple-600/15 text-purple-400 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white leading-tight">Market Intelligence Brief</h1>
          <p className="text-sm text-gray-500">
            {step === 'results' ? `${industry} · ${location}` : 'Let AI brief you before you pitch a market'}
          </p>
        </div>
        {step === 'results' && brief?.sources && brief.sources.length > 0 && (
          <span className="ml-auto hidden sm:inline-flex items-center gap-1.5 text-[11px] font-bold text-green-400 bg-green-500/15 border border-green-500/25 px-2.5 py-1 rounded-full">
            <Globe className="w-3.5 h-3.5" /> Researched live
          </span>
        )}
      </div>

      {/* ── PICK ── */}
      {(step === 'pick' || step === 'loading') && (
        <div className="bg-gray-800/60 border border-white/8 rounded-2xl p-5 sm:p-6 space-y-5">
          <p className="text-gray-300 text-sm leading-relaxed">
            Get the <strong className="text-white">pricing reality, client mindset, and the best pitch</strong> for any market — so you walk in informed, not blind.
          </p>

          {/* Industry */}
          <div className="relative">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Industry / Niche</label>
            <input
              type="text" value={industry}
              onChange={(e) => { setIndustry(e.target.value); setShowIndSug(true); }}
              onFocus={() => setShowIndSug(true)}
              onBlur={() => setTimeout(() => setShowIndSug(false), 150)}
              placeholder="e.g. Real Estate Agencies, Restaurants…"
              className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors text-sm"
            />
            {showIndSug && indSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden">
                {indSuggestions.slice(0, 6).map((s) => (
                  <button key={s} type="button" onMouseDown={() => { setIndustry(s); setShowIndSug(false); setTimeout(() => locationRef.current?.focus(), 50); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-purple-600/30 hover:text-white transition-colors border-b border-white/5 last:border-0">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {['Real Estate Agencies', 'Beauty Salons & Spas', 'Restaurants & Eateries', 'Clinics & Hospitals', 'Law Firms'].map((s) => (
                <button key={s} type="button" onClick={() => { setIndustry(s); setTimeout(() => locationRef.current?.focus(), 50); }}
                  className={`px-3 py-1.5 border rounded-full text-xs font-semibold transition-all ${
                    industry === s ? 'bg-purple-600/30 border-purple-500/50 text-purple-300' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div className="relative">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Target Area / Location</label>
            <input
              ref={locationRef} type="text" value={location}
              onChange={(e) => { setLocation(e.target.value); setShowLocSug(true); }}
              onFocus={() => setShowLocSug(true)}
              onBlur={() => setTimeout(() => setShowLocSug(false), 150)}
              placeholder="e.g. Lekki, Ikeja, Abuja…"
              className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors text-sm"
            />
            {showLocSug && locSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden">
                {locSuggestions.map((a) => (
                  <button key={a} type="button" onMouseDown={() => { setLocation(a); setShowLocSug(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-purple-600/30 hover:text-white transition-colors border-b border-white/5 last:border-0 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-gray-500" /> {a}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {['Lekki Phase 1, Lagos', 'Victoria Island, Lagos', 'Ikeja, Lagos', 'Abuja FCT', 'Port Harcourt'].map((a) => (
                <button key={a} type="button" onClick={() => setLocation(a)}
                  className={`px-3 py-1.5 border rounded-full text-xs font-semibold transition-all ${
                    location === a ? 'bg-purple-600/30 border-purple-500/50 text-purple-300' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'}`}>
                  {a}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-400 text-sm font-semibold">{error}</p>}

          <button
            onClick={generate}
            disabled={!industry.trim() || !location.trim() || step === 'loading'}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-400 text-white font-bold py-3.5 rounded-xl transition-all text-sm"
          >
            {step === 'loading'
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Analysing {industry} in {location}…</>
              : canBrief
              ? <><Sparkles className="w-4 h-4" /> Generate Market Brief</>
              : <><Lock className="w-4 h-4" /> Unlock with Pro</>}
          </button>

          {step === 'loading' && (
            <div className="bg-purple-900/20 border border-purple-500/20 rounded-xl p-4">
              <p className="text-purple-300 text-sm font-semibold">🔍 AI is researching…</p>
              <p className="text-gray-400 text-sm mt-0.5">Pricing reality · Client mindset · Best pitch angles · Common objections</p>
            </div>
          )}
        </div>
      )}

      {/* ── RESULTS ── */}
      {step === 'results' && brief && (
        <div className="space-y-5">

          {/* Client profile */}
          <div className="bg-gray-800/60 border border-white/8 rounded-2xl p-5">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">👤 Client Profile</div>
            <p className="text-gray-200 text-[15px] leading-relaxed">{brief.clientProfile}</p>
          </div>

          {/* Pricing tiers */}
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">💰 Pricing Reality</div>
            <div className="space-y-2.5">
              {(['budget', 'mid', 'premium'] as const).map((tier) => {
                const t = brief.pricingTiers[tier];
                const style = TIER_STYLES[tier];
                const isRec = brief.recommendedEntry === tier;
                return (
                  <div key={tier} className={`border rounded-xl p-4 ${style.card} ${isRec ? 'ring-1 ring-purple-500/40' : ''}`}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${style.dot} flex-shrink-0`} />
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${style.badge}`}>{style.label}</span>
                        {isRec && <span className="text-[11px] font-black text-purple-400 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-full">★ Start here</span>}
                      </div>
                      <span className="font-black text-white text-base flex-shrink-0">{t.range}</span>
                    </div>
                    <p className="text-gray-300 text-sm mb-1.5"><strong className="text-white">Who pays this:</strong> {t.who}</p>
                    <p className="text-gray-300 text-sm"><strong className="text-white">Pitch angle:</strong> {t.approach}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Why now */}
          <div className="bg-gray-800/60 border border-white/8 rounded-2xl p-5">
            <div className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2.5">🔥 Why They Need a Website NOW</div>
            <ul className="space-y-2">
              {brief.whyNow.map((r, i) => (
                <li key={i} className="text-gray-200 text-[15px] leading-relaxed flex gap-2.5">
                  <span className="text-purple-400 font-black flex-shrink-0">{i + 1}.</span> {r}
                </li>
              ))}
            </ul>
          </div>

          {/* Value props */}
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2.5">✅ Best Value Propositions for This Market</div>
            <div className="space-y-2">
              {brief.valueProps.map((v, i) => (
                <div key={i} className="flex gap-2.5 items-start text-[15px] text-gray-200 bg-purple-900/15 border border-purple-500/20 rounded-xl px-4 py-3">
                  <span className="text-purple-400 font-black flex-shrink-0">✓</span> {v}
                </div>
              ))}
            </div>
          </div>

          {/* Objections */}
          <div>
            <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2.5">🛡️ Common Objections &amp; Responses</div>
            <div className="space-y-2">
              {brief.objections.map((o, i) => (
                <div key={i} className="border border-white/8 rounded-xl overflow-hidden bg-gray-800/60">
                  <button
                    onClick={() => setOpenObjection(openObjection === i ? null : i)}
                    className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-white/5 transition-colors"
                  >
                    <span className="text-white text-sm font-bold">❝ {o.objection}</span>
                    <ChevronRight className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${openObjection === i ? 'rotate-90' : ''}`} />
                  </button>
                  {openObjection === i && (
                    <div className="px-4 pb-4 text-[15px] text-gray-200 border-t border-white/5 pt-3 leading-relaxed">
                      <span className="text-purple-400 font-bold">Response: </span>{o.response}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Tone + Strategic insight */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-blue-900/20 border border-blue-500/20 rounded-2xl p-5">
              <div className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4" /> Messaging Tone
              </div>
              <p className="text-gray-200 text-[15px] leading-relaxed">{brief.messagingTone}</p>
            </div>
            <div className="bg-purple-900/20 border border-purple-500/20 rounded-2xl p-5">
              <div className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4" /> Strategic Insight
              </div>
              <p className="text-gray-200 text-[15px] leading-relaxed">{brief.strategicInsight}</p>
            </div>
          </div>

          {/* Opening line */}
          <div className="bg-purple-900/20 border border-purple-500/25 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-xs font-bold text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                <MessageCircle className="w-4 h-4" /> AI Opening Line for WhatsApp
              </div>
              <CopyBtn text={brief.openingLine} />
            </div>
            <p className="text-white text-base leading-relaxed font-medium">&ldquo;{brief.openingLine}&rdquo;</p>
          </div>

          {/* Sources — live Google Search grounding */}
          {brief.sources && brief.sources.length > 0 && (
            <div className="bg-gray-800/60 border border-white/8 rounded-2xl p-5">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Globe className="w-4 h-4" /> Sources · Researched live via Google
              </div>
              <div className="space-y-1.5">
                {brief.sources.slice(0, 8).map((s, i) => (
                  <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors group">
                    <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 text-gray-500 group-hover:text-blue-400" />
                    <span className="truncate">{s.title}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-white/8">
            <button
              onClick={() => router.push('/')}
              className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3.5 rounded-xl transition-all text-sm"
            >
              <FileSearch className="w-4 h-4" /> Find Prospects in {location}
            </button>
            <button
              onClick={() => setStep('pick')}
              className="px-5 py-3.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 rounded-xl text-sm font-semibold transition-colors"
            >
              New brief
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
