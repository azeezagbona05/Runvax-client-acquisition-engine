'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, ArrowRight, X, Search, Target, Sparkles, MapPin, TrendingUp,
  MessageCircle, Copy, Check, PartyPopper,
} from 'lucide-react';
import { estimatePrice, formatPrice } from '@/lib/scoring';
import type { Business } from '@/types';

interface Props {
  onComplete: () => void;
}

type Step = 'profile' | 'target' | 'reveal' | 'pitch' | 'win';

const CONFETTI_COLORS = ['#7c3aed', '#2563eb', '#f97316', '#22c55e', '#eab308', '#ec4899'];

function Confetti() {
  const pieces = Array.from({ length: 46 });
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {pieces.map((_, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${Math.random() * 100}%`,
            background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            animationDuration: `${1.8 + Math.random() * 1.6}s`,
            animationDelay: `${Math.random() * 0.7}s`,
            transform: `rotate(${Math.random() * 360}deg)`,
            borderRadius: i % 2 ? '2px' : '50%',
          }}
        />
      ))}
    </div>
  );
}

interface Payload {
  businesses: Business[];
  meta: {
    searchesRemaining: number | null;
    searchesUsed: number | null;
    searchesLimit: number | null;
    plan: string;
    resultsLimit: number | null;
  };
  unlimited: boolean;
}

const INDUSTRIES = [
  'Restaurants', 'Beauty Salons', 'Barbers', 'Clinics', 'Schools',
  'Hotels', 'Pharmacies', 'Law Firms', 'Real Estate', 'Gyms',
  'Event Centres', 'Auto Mechanics',
];

export default function OnboardingWizard({ onComplete }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('profile');
  const [saving, setSaving] = useState(false);

  const [senderName, setSenderName]     = useState('');
  const [businessName, setBusinessName] = useState('');
  const [whatsapp, setWhatsapp]         = useState('');
  const [city, setCity]                 = useState('');

  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState('');

  // Reveal data
  const [total, setTotal]       = useState(0);
  const [noWebsite, setNoWebsite] = useState(0);
  const [samples, setSamples]   = useState<string[]>([]);
  const [payload, setPayload]   = useState<Payload | null>(null);

  // Pitch step
  const [pitchLoading, setPitchLoading] = useState(false);
  const [pitchMsg, setPitchMsg]   = useState('');
  const [pitchErr, setPitchErr]   = useState('');
  const [pitchCopied, setPitchCopied] = useState(false);

  const firstProspect = payload?.businesses.find((b) => !b.hasWebsite) ?? payload?.businesses[0];

  const markDone = () =>
    fetch('/api/user/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboardingDone: true }),
    }).catch(() => {});

  const dismiss = async () => { await markDone(); onComplete(); };

  const saveProfile = async () => {
    setSaving(true);
    await fetch('/api/user/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderName, businessName, whatsapp, city }),
    }).catch(() => {});
    setSaving(false);
    if (city.trim()) setLocation(city.trim());
    setStep('target');
  };

  const runFirstSearch = async () => {
    if (!industry.trim() || !location.trim()) return;
    setSearching(true);
    setSearchErr('');
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `${industry} in ${location}`, radius: 5 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Search failed');
      const list: Business[] = json.businesses || [];
      const noSite = list.filter((b) => !b.hasWebsite);
      setTotal(list.length);
      setNoWebsite(noSite.length);
      setSamples(noSite.slice(0, 6).map((b) => b.name));
      setPayload({
        businesses: list,
        meta: {
          searchesRemaining: json.searchesRemaining ?? null,
          searchesUsed:      json.searchesUsed      ?? null,
          searchesLimit:     json.searchesLimit     ?? null,
          plan:              json.plan              ?? 'free',
          resultsLimit:      json.unlimitedResults ? null : (json.resultsLimit ?? 20),
        },
        unlimited: !!json.unlimitedResults,
      });
      setStep('reveal');
    } catch (e: unknown) {
      setSearchErr(e instanceof Error ? e.message : 'Could not run the search — try a different area.');
    } finally {
      setSearching(false);
    }
  };

  const writePitch = async () => {
    if (!firstProspect) { setStep('win'); return; }
    setStep('pitch');
    setPitchLoading(true);
    setPitchErr('');
    setPitchMsg('');
    try {
      const res = await fetch('/api/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business: firstProspect, framework: 'PAS', competitors: firstProspect.competitors }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setPitchMsg(json.whatsapp || json.emailBody || '');
    } catch (e: unknown) {
      setPitchErr(e instanceof Error ? e.message : 'Could not write the pitch — you can generate it later.');
    } finally {
      setPitchLoading(false);
    }
  };

  const copyPitch = async () => {
    if (!pitchMsg) return;
    try { await navigator.clipboard.writeText(pitchMsg); } catch { /* */ }
    setPitchCopied(true);
    setTimeout(() => setPitchCopied(false), 2500);
  };

  const goProspect = async () => {
    await markDone();
    // Carry the already-fetched results to the search page (no second search = no extra quota)
    try {
      if (payload) {
        sessionStorage.setItem('aip_onboarding_results', JSON.stringify({ ...payload, industry, location }));
      }
    } catch { /* */ }
    onComplete();
    router.push('/');
  };

  // Reveal maths
  const rate = total > 0 ? Math.round((noWebsite / total) * 100) : 0;
  const priceBand = estimatePrice(industry);
  const avgDeal = Math.round((priceBand.min + priceBand.max) / 2);
  const potential = noWebsite * priceBand.min; // conservative: floor price

  const inputCls = 'w-full bg-gray-800/80 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/60 transition-colors';
  const labelCls = 'block text-xs font-semibold text-gray-400 mb-1.5';
  const STEP_ORDER: Step[] = ['profile', 'target', 'reveal', 'pitch', 'win'];
  const stepNum = STEP_ORDER.indexOf(step) + 1;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[92vh] overflow-y-auto">

        {/* Progress bar */}
        <div className="h-1 bg-white/5 w-full">
          <div className="h-full bg-gradient-to-r from-purple-500 to-orange-500 transition-all duration-500" style={{ width: `${(stepNum / STEP_ORDER.length) * 100}%` }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center text-xs font-black text-white">A</div>
            {step !== 'win' && <span className="text-xs text-gray-500 font-semibold">Step {stepNum} of {STEP_ORDER.length}</span>}
          </div>
          <button onClick={dismiss} className="text-gray-600 hover:text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── STEP 1 · PROFILE ── */}
        {step === 'profile' && (
          <div className="px-5 pb-6 space-y-5">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-bold px-2.5 py-1 rounded-full mb-3">
                <Sparkles className="w-3 h-3" /> Welcome
              </div>
              <h2 className="text-2xl font-black text-white leading-tight">
                Let&apos;s find your<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-orange-400">first client — right now</span>
              </h2>
              <p className="text-gray-400 text-sm mt-2">
                Two quick questions and we&apos;ll show you real businesses in your area that need a website today. First, who are you pitching as?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Your Name</label>
                <input className={inputCls} value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="e.g. Azeez" />
              </div>
              <div>
                <label className={labelCls}>Business / Agency</label>
                <input className={inputCls} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. WebCraft NG" />
              </div>
              <div>
                <label className={labelCls}>WhatsApp Number</label>
                <input className={inputCls} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+234 803..." />
              </div>
              <div>
                <label className={labelCls}>Your City</label>
                <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Lagos" />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={saveProfile} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-lg shadow-purple-900/30">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {saving ? 'Saving…' : 'Continue →'}
              </button>
              <button onClick={() => setStep('target')} className="px-4 text-gray-600 hover:text-gray-400 text-sm transition-colors">Skip</button>
            </div>
          </div>
        )}

        {/* ── STEP 2 · TARGET ── */}
        {step === 'target' && (
          <div className="px-5 pb-6 space-y-5">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-bold px-2.5 py-1 rounded-full mb-3">
                <Target className="w-3 h-3" /> Your first mission
              </div>
              <h2 className="text-2xl font-black text-white leading-tight">Who do you want as clients?</h2>
              <p className="text-gray-400 text-sm mt-2">Pick a type of business and an area — we&apos;ll scan it live for prospects with no website.</p>
            </div>

            <div>
              <label className={labelCls}>Business type</label>
              <input className={inputCls} value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Beauty Salons" />
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {INDUSTRIES.map((s) => (
                  <button key={s} type="button" onClick={() => setIndustry(s)}
                    className={`px-2.5 py-1 border rounded-full text-[11px] font-semibold transition-all ${
                      industry === s ? 'bg-purple-600/30 border-purple-500/50 text-purple-300' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelCls}>Area / City</label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input className={`${inputCls} pl-10`} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Lekki, Lagos" />
              </div>
            </div>

            {searchErr && <p className="text-red-400 text-sm font-semibold">{searchErr}</p>}

            <button onClick={runFirstSearch} disabled={!industry.trim() || !location.trim() || searching}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-orange-500 hover:from-purple-500 hover:to-orange-400 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-lg">
              {searching
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Scanning {location} for {industry || 'businesses'}…</>
                : <><Search className="w-4 h-4" /> Find my first clients</>}
            </button>
          </div>
        )}

        {/* ── STEP 3 · REVEAL ── */}
        {step === 'reveal' && (
          <div className="px-5 pb-6 space-y-5">
            <div className="text-center">
              <div className="inline-flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[11px] font-bold px-2.5 py-1 rounded-full mb-3">
                <Target className="w-3 h-3" /> Opportunity found
              </div>
              {noWebsite > 0 ? (
                <>
                  <h2 className="text-3xl font-black text-white leading-tight">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-orange-400">{noWebsite}</span> potential clients
                  </h2>
                  <p className="text-gray-400 text-sm mt-2">
                    {industry} in {location.split(',')[0]} with <strong className="text-orange-400">no website</strong> — out of the top {total} we scanned ({rate}%).
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-black text-white leading-tight">You&apos;re ready to hunt</h2>
                  <p className="text-gray-400 text-sm mt-2">Most {industry || 'businesses'} here already have sites — try a nearby area to find untapped ones. Your tools are ready.</p>
                </>
              )}
            </div>

            {noWebsite > 0 && (
              <>
                {/* Revenue reveal */}
                <div className="bg-gradient-to-br from-purple-900/30 to-orange-900/20 border border-purple-500/25 rounded-2xl p-5 text-center">
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1 flex items-center justify-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" /> Potential revenue in this one search
                  </div>
                  <div className="text-4xl font-black text-white">
                    {formatPrice(potential)}+
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">
                    {noWebsite} clients × ~{formatPrice(avgDeal)} avg website. Land just one and you&apos;ve paid for the year.
                  </p>
                </div>

                {/* Sample prospects */}
                {samples.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-gray-600 font-semibold uppercase tracking-widest">A few of them</p>
                    {samples.map((name) => (
                      <div key={name} className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/8 rounded-xl">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm font-black text-white flex-shrink-0">
                          {name[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0 text-sm font-bold text-white truncate">{name}</div>
                        <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">No website</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            <button onClick={noWebsite > 0 ? writePitch : goProspect}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 via-purple-600 to-orange-500 hover:from-purple-500 hover:to-orange-400 text-white font-black py-4 rounded-xl text-base transition-all shadow-xl shadow-purple-900/40">
              {noWebsite > 0
                ? <><Sparkles className="w-5 h-5" /> Watch AI write your first pitch →</>
                : <><Search className="w-5 h-5" /> Start prospecting →</>}
            </button>
            {noWebsite > 0 && (
              <button onClick={goProspect} className="w-full text-center text-xs text-gray-500 hover:text-gray-300 transition-colors">
                Skip — just show me the prospects
              </button>
            )}
          </div>
        )}

        {/* ── STEP 4 · PITCH (watch AI write) ── */}
        {step === 'pitch' && (
          <div className="px-5 pb-6 space-y-5">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[11px] font-bold px-2.5 py-1 rounded-full mb-3">
                <Sparkles className="w-3 h-3" /> Your AI does the hard part
              </div>
              <h2 className="text-2xl font-black text-white leading-tight">
                {pitchLoading ? 'Writing your pitch…' : 'Your first pitch is ready'}
              </h2>
              <p className="text-gray-400 text-sm mt-2">
                A ready-to-send WhatsApp message for <strong className="text-white">{firstProspect?.name?.split('(')[0].trim()}</strong> — written by AI, personalised to their business.
              </p>
            </div>

            {pitchErr && <p className="text-red-400 text-sm font-semibold">{pitchErr}</p>}

            {/* WhatsApp-style bubble */}
            <div className="bg-gray-800/60 border border-white/8 rounded-2xl p-4 min-h-[140px] flex flex-col">
              <div className="flex items-center gap-2 mb-2 text-green-400">
                <MessageCircle className="w-4 h-4" />
                <span className="text-[11px] font-bold uppercase tracking-widest">WhatsApp message</span>
                {!pitchLoading && pitchMsg && (
                  <button onClick={copyPitch} className={`ml-auto inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg transition-colors ${pitchCopied ? 'bg-green-500/20 text-green-400' : 'bg-white/10 hover:bg-white/20 text-gray-400'}`}>
                    {pitchCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {pitchCopied ? 'Copied' : 'Copy'}
                  </button>
                )}
              </div>
              {pitchLoading ? (
                <div className="flex-1 flex items-center justify-center gap-2 text-gray-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> AI is writing…
                </div>
              ) : (
                <div className="bg-green-600/10 border border-green-500/15 rounded-xl rounded-tl-sm px-4 py-3 text-[15px] text-gray-200 leading-relaxed whitespace-pre-wrap">
                  {pitchMsg || 'No message generated.'}
                </div>
              )}
            </div>

            <button onClick={() => setStep('win')} disabled={pitchLoading}
              className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl text-sm transition-all">
              <ArrowRight className="w-4 h-4" /> Looks good — continue
            </button>
          </div>
        )}

        {/* ── STEP 5 · FIRST WIN (celebration) ── */}
        {step === 'win' && (
          <>
            <Confetti />
            <div className="px-5 pb-6 space-y-5 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-orange-500 flex items-center justify-center mx-auto mt-2">
                <PartyPopper className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white leading-tight">You just lined up<br />your first client 🎉</h2>
                <p className="text-gray-400 text-sm mt-2">
                  In a few minutes you found <strong className="text-white">{noWebsite} prospects</strong> and wrote your first AI pitch. Now do it again — your pipeline grows with every search.
                </p>
              </div>

              {/* Quest checklist (Phase 3 teaser) */}
              <div className="bg-gray-800/60 border border-white/8 rounded-2xl p-4 text-left space-y-2">
                {[
                  { done: true,  label: 'Find your first prospects' },
                  { done: true,  label: 'Generate your first AI pitch' },
                  { done: false, label: 'Send your first WhatsApp message' },
                  { done: false, label: 'Save your first deal as Won' },
                ].map((q) => (
                  <div key={q.label} className="flex items-center gap-2.5 text-sm">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${q.done ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-gray-600 border border-white/10'}`}>
                      {q.done ? <Check className="w-3 h-3" /> : null}
                    </span>
                    <span className={q.done ? 'text-gray-300 line-through' : 'text-gray-400'}>{q.label}</span>
                  </div>
                ))}
              </div>

              <button onClick={goProspect}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-orange-500 hover:from-purple-500 hover:to-orange-400 text-white font-black py-4 rounded-xl text-base transition-all shadow-xl shadow-purple-900/40">
                <Search className="w-5 h-5" /> Show me all my prospects →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
