'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, ArrowRight, X, Search, Mail, Globe, Trophy,
  MapPin, Zap, Users, TrendingUp,
} from 'lucide-react';

interface Props {
  onComplete: () => void;
}

type Step = 1 | 2 | 3;

const INDUSTRIES = [
  'Restaurants', 'Salons', 'Clinics', 'Schools', 'Hotels',
  'Pharmacies', 'Law Firms', 'Churches', 'Gyms', 'Supermarkets',
  'Auto Mechanics', 'Event Centres', 'Tailors', 'Opticians', 'Bakeries',
];

const WORKFLOW = [
  {
    icon: Search,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    step: '01',
    title: 'Find prospects',
    desc: 'Search any city, any industry. We surface businesses with no website — your ideal clients.',
  },
  {
    icon: Mail,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20',
    step: '02',
    title: 'AI-powered outreach',
    desc: 'One click generates a personalised email or WhatsApp pitch written in your voice.',
  },
  {
    icon: Globe,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/20',
    step: '03',
    title: 'Generate site prompt',
    desc: 'Instantly create a Lovable / Webflow-ready brief for their exact business. Build in minutes.',
  },
  {
    icon: Trophy,
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/20',
    step: '04',
    title: 'Close & get paid',
    desc: 'Track every lead from Found → Proposal → Won. Know your pipeline value at a glance.',
  },
];

const MOCK_RESULTS = [
  { name: "Mama Tunde's Kitchen", category: 'Restaurant', score: 9, city: 'Ikeja' },
  { name: 'Royal Care Clinic',    category: 'Clinic',     score: 8, city: 'Surulere' },
  { name: 'Glam House Salon',     category: 'Salon',      score: 9, city: 'Lekki' },
];

export default function OnboardingWizard({ onComplete }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);

  const [senderName, setSenderName]       = useState('');
  const [businessName, setBusinessName]   = useState('');
  const [whatsapp, setWhatsapp]           = useState('');
  const [city, setCity]                   = useState('');

  const markDone = async () => {
    await fetch('/api/user/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboardingDone: true }),
    });
  };

  const dismiss = async () => { await markDone(); onComplete(); };

  const handleProfileSave = async () => {
    setSaving(true);
    await fetch('/api/user/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderName, businessName, whatsapp, city }),
    });
    setSaving(false);
    setStep(2);
  };

  const goSearch = async () => {
    await markDone();
    onComplete();
    router.push('/');
  };

  const inputCls = 'w-full bg-gray-800/80 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/60 transition-colors';
  const labelCls = 'block text-xs font-semibold text-gray-400 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">

        {/* Progress bar */}
        <div className="h-1 bg-white/5 w-full">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-orange-500 transition-all duration-500"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-purple-600 to-orange-500 rounded-md flex items-center justify-center text-xs font-black">A</div>
            <span className="text-xs text-gray-500 font-semibold">Step {step} of 3</span>
          </div>
          <button onClick={dismiss} className="text-gray-600 hover:text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ─── STEP 1: THE GOLDMINE ─── */}
        {step === 1 && (
          <div className="px-5 pb-6 space-y-5">

            {/* Hero headline */}
            <div>
              <div className="inline-flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[11px] font-bold px-2.5 py-1 rounded-full mb-3">
                <Zap className="w-3 h-3" /> Opportunity waiting in your city
              </div>
              <h2 className="text-2xl font-black text-white leading-tight">
                There&apos;s a goldmine of<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-orange-400">
                  clients with no website
                </span>
              </h2>
              <p className="text-gray-400 text-sm mt-2">
                8 in 10 Nigerian SMEs have no web presence — losing customers to competitors
                who do. You&apos;re about to find them, pitch them, and build for them.
              </p>
            </div>

            {/* Industry chips */}
            <div>
              <p className="text-[11px] text-gray-600 font-semibold uppercase tracking-widest mb-2">Industries full of prospects</p>
              <div className="flex flex-wrap gap-1.5">
                {INDUSTRIES.map((ind) => (
                  <span key={ind} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-white/5 border border-white/8 text-gray-400">
                    {ind}
                  </span>
                ))}
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Users,       color: 'text-blue-400',   value: '80%',   label: 'SMEs have no website' },
                { icon: TrendingUp,  color: 'text-purple-400', value: '₦300k+', label: 'avg deal value' },
                { icon: MapPin,      color: 'text-orange-400', value: '36',     label: 'states to prospect' },
              ].map(({ icon: Icon, color, value, label }) => (
                <div key={label} className="bg-white/[0.03] border border-white/8 rounded-xl p-3 text-center">
                  <Icon className={`w-4 h-4 ${color} mx-auto mb-1`} />
                  <div className={`text-lg font-black ${color}`}>{value}</div>
                  <div className="text-[10px] text-gray-600 leading-tight">{label}</div>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="border-t border-white/8 pt-4">
              <p className="text-xs text-gray-500 mb-3 font-semibold">First, let&apos;s set up your profile so AI writes outreach in <span className="text-white">your</span> voice:</p>

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
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleProfileSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-lg shadow-purple-900/30"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                {saving ? 'Saving…' : "Let's go →"}
              </button>
              <button onClick={() => setStep(2)} className="px-4 text-gray-600 hover:text-gray-400 text-sm transition-colors">
                Skip
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 2: YOUR WEAPON ─── */}
        {step === 2 && (
          <div className="px-5 pb-6 space-y-5">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[11px] font-bold px-2.5 py-1 rounded-full mb-3">
                <Zap className="w-3 h-3" /> Your complete client-closing toolkit
              </div>
              <h2 className="text-2xl font-black text-white leading-tight">
                From stranger to<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-orange-400">
                  paying client in 4 steps
                </span>
              </h2>
              <p className="text-gray-400 text-sm mt-2">
                Every tool you need is built in — no juggling between apps.
              </p>
            </div>

            {/* Workflow steps */}
            <div className="space-y-2.5">
              {WORKFLOW.map(({ icon: Icon, color, bg, step: num, title, desc }) => (
                <div key={num} className={`flex items-start gap-3 p-3.5 rounded-xl border ${bg}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${bg}`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-black text-gray-600">{num}</span>
                      <span className={`text-sm font-bold ${color}`}>{title}</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep(3)}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-orange-500 hover:from-purple-500 hover:to-orange-400 text-white font-bold py-3 rounded-xl text-sm transition-all shadow-lg"
            >
              <ArrowRight className="w-4 h-4" /> I&apos;m ready — show me my prospects
            </button>
          </div>
        )}

        {/* ─── STEP 3: START THE HUNT ─── */}
        {step === 3 && (
          <div className="px-5 pb-6 space-y-5">
            <div>
              <div className="inline-flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 text-green-400 text-[11px] font-bold px-2.5 py-1 rounded-full mb-3">
                🏆 Ready to close your first deal
              </div>
              <h2 className="text-2xl font-black text-white leading-tight">
                Your first client is<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-orange-400">
                  10 minutes away
                </span>
              </h2>
              <p className="text-gray-400 text-sm mt-2">
                Right now, businesses like these are losing customers because they have no website.
                You&apos;re about to change that — and get paid for it.
              </p>
            </div>

            {/* Mock prospect preview */}
            <div className="space-y-2">
              <p className="text-[11px] text-gray-600 font-semibold uppercase tracking-widest">Example prospects waiting to be found</p>
              {MOCK_RESULTS.map((r) => (
                <div key={r.name} className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/8 rounded-xl">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-600/30 to-orange-500/20 rounded-lg flex items-center justify-center text-sm font-black text-white flex-shrink-0">
                    {r.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white truncate">{r.name}</div>
                    <div className="text-[11px] text-gray-500">{r.category} · {r.city}</div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="text-[10px] font-black text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">
                      {r.score}/10
                    </span>
                    <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full font-semibold">
                      No website
                    </span>
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-gray-700 text-center pt-1">
                These are illustrative — your real results depend on your search
              </p>
            </div>

            {/* Big CTA */}
            <button
              onClick={goSearch}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 via-purple-600 to-orange-500 hover:from-purple-500 hover:to-orange-400 text-white font-black py-4 rounded-xl text-base transition-all shadow-xl shadow-purple-900/40 animate-pulse hover:animate-none"
            >
              <Search className="w-5 h-5" /> Start Hunting Prospects →
            </button>

            <p className="text-center text-[11px] text-gray-600">
              You can always update your profile and settings later
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
