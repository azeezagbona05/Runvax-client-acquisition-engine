'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, User, Search, Star, ArrowRight, X } from 'lucide-react';

interface Props {
  onComplete: () => void;
}

type Step = 1 | 2 | 3;

const STEPS = [
  { id: 1 as Step, icon: User,   title: 'Set up your profile',       sub: 'So AI writes in your voice'     },
  { id: 2 as Step, icon: Search, title: 'Do your first search',      sub: 'Find businesses near you'       },
  { id: 3 as Step, icon: Star,   title: 'Save your first prospect',  sub: 'Start your pipeline'            },
];

export default function OnboardingWizard({ onComplete }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);

  // Step 1 profile fields
  const [senderName, setSenderName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [city, setCity] = useState('');

  const dismiss = async () => {
    await markDone();
    onComplete();
  };

  const markDone = async () => {
    await fetch('/api/user/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboardingDone: true }),
    });
  };

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

  const goPipeline = async () => {
    await markDone();
    onComplete();
    router.push('/pipeline');
  };

  const inputCls = 'w-full bg-gray-800/80 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 transition-colors';
  const labelCls = 'block text-xs font-semibold text-gray-400 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <div>
            <h2 className="text-white font-black text-lg">Welcome to AI Prospect Finder</h2>
            <p className="text-gray-500 text-xs mt-0.5">3 quick steps to your first client</p>
          </div>
          <button onClick={dismiss} className="text-gray-600 hover:text-gray-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 px-5 py-4">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                step > s.id ? 'bg-green-500 text-white'
                : step === s.id ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-500'
              }`}>
                {step > s.id ? '✓' : s.id}
              </div>
              <div className="hidden sm:block flex-1 min-w-0">
                <div className={`text-xs font-semibold truncate ${step === s.id ? 'text-white' : 'text-gray-600'}`}>{s.title}</div>
              </div>
              {i < STEPS.length - 1 && <div className={`h-px flex-1 mx-1 ${step > s.id ? 'bg-green-500/40' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="p-5 space-y-4">

          {/* ── STEP 1: Profile ── */}
          {step === 1 && (
            <>
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 text-xs text-purple-300">
                Your profile is used in all AI-generated outreach, proposals, and emails — so they sound like they came from YOU, not a template.
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>WhatsApp Number</label>
                  <input className={inputCls} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+234 803..." />
                </div>
                <div>
                  <label className={labelCls}>Your City</label>
                  <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Lagos" />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleProfileSave}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  {saving ? 'Saving…' : 'Save & continue'}
                </button>
                <button onClick={() => setStep(2)} className="px-4 text-gray-500 hover:text-gray-300 text-sm">
                  Skip
                </button>
              </div>
            </>
          )}

          {/* ── STEP 2: First search ── */}
          {step === 2 && (
            <>
              <div className="text-center py-4">
                <Search className="w-12 h-12 text-purple-400 mx-auto mb-3" />
                <p className="text-white font-semibold mb-1">Time to find your first prospects</p>
                <p className="text-gray-400 text-sm">Search for businesses in any Nigerian city that don&apos;t have websites yet. You can filter by industry — restaurants, salons, schools, clinics, etc.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={goSearch}
                  className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
                >
                  <Search className="w-4 h-4" /> Start searching
                </button>
                <button onClick={() => setStep(3)} className="px-4 text-gray-500 hover:text-gray-300 text-sm">
                  Skip
                </button>
              </div>
            </>
          )}

          {/* ── STEP 3: Pipeline ── */}
          {step === 3 && (
            <>
              <div className="text-center py-4">
                <Star className="w-12 h-12 text-orange-400 mx-auto mb-3" />
                <p className="text-white font-semibold mb-1">You&apos;re all set!</p>
                <p className="text-gray-400 text-sm">
                  Once you save a prospect from your search results, they&apos;ll appear in your Pipeline where you can track them from <span className="text-purple-300">Found → Contacted → Interested → Proposal → Won</span>.
                </p>
              </div>
              <button
                onClick={goPipeline}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-orange-500 hover:from-purple-500 hover:to-orange-400 text-white font-bold py-2.5 rounded-xl text-sm transition-all"
              >
                <Star className="w-4 h-4" /> Go to Pipeline
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
