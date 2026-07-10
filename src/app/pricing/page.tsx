'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, Zap, Building2, Sparkles, Loader2, CheckCircle, AlertCircle, LucideIcon } from 'lucide-react';
import { ALL_FEATURES, FeatureId } from '@/lib/features';

// ── Plan config fetched from /api/plans (admin-editable, DB-backed) ──
interface ApiPlan {
  planId: string;
  name: string;
  price: string | null;
  priceNote: string;
  searchesPerDay: number | null;   // null = unlimited
  resultsPerSearch: number | null;
  aiCallsPerDay: number | null;
  maxProspects: number | null;
  features: FeatureId[];
  highlight: boolean;
}

// Static presentation (icons, colors, always-on bullets) keyed by plan id. Only
// the limits, price and gateable features come from the DB.
interface Presentation {
  icon: LucideIcon;
  iconClass: string;
  cardClass: string;
  badgeClass: string;
  ctaClass: string;
  alwaysOn: string[];
}

const PRESENTATION: Record<string, Presentation> = {
  free: {
    icon: Sparkles, iconClass: 'text-gray-400', cardClass: 'border-white/10',
    badgeClass: 'bg-gray-700 text-gray-300', ctaClass: 'bg-white/10 hover:bg-white/15 text-white',
    alwaysOn: ['AI outreach (WhatsApp + Email)', 'AI reply suggestions', 'Pipeline view', 'Export to CSV'],
  },
  pro: {
    icon: Zap, iconClass: 'text-purple-400', cardClass: 'border-purple-500/50 ring-1 ring-purple-500/30',
    badgeClass: 'bg-purple-600 text-white', ctaClass: 'bg-purple-600 hover:bg-purple-700 text-white',
    alwaysOn: ['AI outreach (WhatsApp + Email)', 'AI reply suggestions', 'Pipeline + Dashboard', 'Export to CSV'],
  },
  agency: {
    icon: Building2, iconClass: 'text-orange-400', cardClass: 'border-orange-500/30',
    badgeClass: 'bg-orange-500 text-white', ctaClass: 'bg-orange-500 hover:bg-orange-600 text-white',
    alwaysOn: ['Everything in Pro', 'Priority support', 'Early access to new features'],
  },
};

const DEFAULT_PRESENTATION: Presentation = {
  icon: Sparkles, iconClass: 'text-gray-400', cardClass: 'border-white/10',
  badgeClass: 'bg-gray-700 text-gray-300', ctaClass: 'bg-white/10 hover:bg-white/15 text-white',
  alwaysOn: [],
};

// Marketing bullet text for each gateable feature (unlocked = green check, locked = strikethrough).
const FEATURE_BULLET: Record<FeatureId, string> = {
  emailBlast: 'Email blast (bulk send)',
  proposals: 'AI proposals (PDF-ready)',
  marketBrief: 'Market intelligence briefs',
  weaknessAnalysis: 'Website weakness analysis',
};

// Sensible defaults shown instantly while the live config loads (and if it fails).
const FALLBACK_PLANS: ApiPlan[] = [
  { planId: 'free',   name: 'Free',   price: null,      priceNote: 'No credit card needed', searchesPerDay: 5,  resultsPerSearch: 20,   aiCallsPerDay: 15,   maxProspects: 30,   features: [],                 highlight: false },
  { planId: 'pro',    name: 'Pro',    price: '₦9,999',  priceNote: 'per month',             searchesPerDay: 20, resultsPerSearch: 60,   aiCallsPerDay: 200,  maxProspects: null, features: [...ALL_FEATURES],  highlight: true  },
  { planId: 'agency', name: 'Agency', price: '₦24,999', priceNote: 'per month',             searchesPerDay: null, resultsPerSearch: null, aiCallsPerDay: null, maxProspects: null, features: [...ALL_FEATURES], highlight: false },
];

function limitBullets(p: ApiPlan): string[] {
  const searches  = p.searchesPerDay   == null ? 'Unlimited searches'         : `${p.searchesPerDay} searches/day`;
  const results   = p.resultsPerSearch == null ? 'unlimited results'          : `${p.resultsPerSearch} results per search`;
  const ai        = p.aiCallsPerDay    == null ? 'Unlimited AI messages'      : `${p.aiCallsPerDay} AI messages/day`;
  const prospects = p.maxProspects     == null ? 'Unlimited saved prospects'  : `Save up to ${p.maxProspects} prospects`;
  return [`${searches} · ${results}`, ai, prospects];
}

function PricingContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const currentPlan = (session?.user as { plan?: string })?.plan ?? 'free';
  const [plans, setPlans] = useState<ApiPlan[]>(FALLBACK_PLANS);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    fetch('/api/plans')
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data: ApiPlan[]) => { if (Array.isArray(data) && data.length) setPlans(data); })
      .catch(() => { /* keep fallback */ });
  }, []);

  useEffect(() => {
    if (searchParams.get('upgraded') === '1') {
      setFlash({ type: 'success', msg: 'Payment successful — your plan has been upgraded!' });
    } else if (searchParams.get('error')) {
      const err = searchParams.get('error');
      const msgs: Record<string, string> = {
        payment_failed: 'Payment was not completed. Please try again.',
        verify_failed: 'Could not verify payment. Contact support if you were charged.',
        missing_reference: 'Something went wrong. Please try again.',
      };
      setFlash({ type: 'error', msg: msgs[err ?? ''] ?? 'Payment error. Please try again.' });
    }
  }, [searchParams]);

  const handleUpgrade = async (planId: string) => {
    if (!session?.user) {
      window.location.href = '/auth/signin?callbackUrl=/pricing';
      return;
    }
    setLoadingPlan(planId);
    try {
      const res = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Failed to start payment');
      window.location.href = data.url;
    } catch (err: unknown) {
      setFlash({ type: 'error', msg: err instanceof Error ? err.message : 'Payment failed' });
      setLoadingPlan(null);
    }
  };

  // For the comparison table — look up the three core plans by id.
  const byId = (id: string) => plans.find((p) => p.planId === id);
  const corePlans = ['free', 'pro', 'agency'].map(byId).filter((p): p is ApiPlan => !!p);
  const cell = (n: number | null) => (n == null ? 'Unlimited' : String(n));
  const feat = (p: ApiPlan | undefined, f: FeatureId) => (p?.features.includes(f) ? '✓' : '—');

  return (
    <div className="min-h-screen bg-gray-950 py-16 px-4">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-white mb-3">Simple, honest pricing</h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            Find leads. Send outreach. Close deals — all from one tool built for Nigerian web developers.
          </p>
        </div>

        {/* Flash message */}
        {flash && (
          <div className={`flex items-center gap-3 p-4 rounded-xl mb-8 text-sm font-medium ${
            flash.type === 'success'
              ? 'bg-green-500/10 border border-green-500/20 text-green-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}>
            {flash.type === 'success'
              ? <CheckCircle className="w-5 h-5 flex-shrink-0" />
              : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            {flash.msg}
          </div>
        )}

        {/* Plan cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {plans.map((plan) => {
            const pres = PRESENTATION[plan.planId] ?? DEFAULT_PRESENTATION;
            const Icon = pres.icon;
            const isCurrent = currentPlan === plan.planId;
            const isLoading = loadingPlan === plan.planId;

            const unlocked = ALL_FEATURES.filter((f) => plan.features.includes(f)).map((f) => FEATURE_BULLET[f]);
            const locked = ALL_FEATURES.filter((f) => !plan.features.includes(f)).map((f) => FEATURE_BULLET[f]);
            const bullets = [...limitBullets(plan), ...pres.alwaysOn, ...unlocked];

            return (
              <div
                key={plan.planId}
                className={`relative bg-gray-900 rounded-2xl border p-6 flex flex-col ${pres.cardClass} ${plan.highlight ? 'md:-mt-4 md:-mb-4 md:py-10' : ''}`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-4">
                  <Icon className={`w-5 h-5 ${pres.iconClass}`} />
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pres.badgeClass}`}>
                    {plan.name.toUpperCase()}
                  </span>
                </div>

                <div className="mb-6">
                  {plan.price ? (
                    <>
                      <div className="text-3xl font-black text-white">{plan.price}</div>
                      <div className="text-gray-500 text-sm">{plan.priceNote}</div>
                    </>
                  ) : (
                    <>
                      <div className="text-3xl font-black text-white">Free</div>
                      <div className="text-gray-500 text-sm">{plan.priceNote}</div>
                    </>
                  )}
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {bullets.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                      <Check className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                  {locked.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600 line-through">
                      <span className="w-4 h-4 flex-shrink-0 mt-0.5 text-center text-xs">—</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isCurrent ? (
                  <div className="w-full text-center py-2.5 rounded-xl text-sm font-bold bg-white/5 text-gray-400 border border-white/10">
                    Current plan
                  </div>
                ) : plan.planId === 'free' ? (
                  <Link
                    href="/"
                    className={`w-full text-center py-2.5 rounded-xl text-sm font-bold transition-colors ${pres.ctaClass}`}
                  >
                    Get started free
                  </Link>
                ) : (
                  <button
                    disabled={isLoading || !!loadingPlan}
                    onClick={() => handleUpgrade(plan.planId)}
                    className={`w-full py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 ${pres.ctaClass}`}
                  >
                    {isLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting…</>
                      : `Upgrade to ${plan.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Secure payment note */}
        <p className="text-center text-gray-600 text-xs mb-8">
          Payments secured by Paystack · Cards, Bank Transfer, USSD supported · Cancel anytime
        </p>

        {/* Compare table */}
        <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden mb-10">
          <div className="p-6 border-b border-white/10">
            <h2 className="text-white font-bold text-lg">Full feature comparison</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-4 text-gray-400 font-medium w-1/2">Feature</th>
                  <th className="text-center p-4 text-gray-400 font-medium">Free</th>
                  <th className="text-center p-4 text-purple-400 font-bold">Pro</th>
                  <th className="text-center p-4 text-orange-400 font-medium">Agency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  ['Searches per day',   ...corePlans.map((p) => cell(p.searchesPerDay))],
                  ['Results per search', ...corePlans.map((p) => cell(p.resultsPerSearch))],
                  ['AI messages/day',    ...corePlans.map((p) => cell(p.aiCallsPerDay))],
                  ['Saved prospects',    ...corePlans.map((p) => cell(p.maxProspects))],
                  ['WhatsApp outreach AI', '✓', '✓', '✓'],
                  ['Email outreach AI', '✓', '✓', '✓'],
                  ['AI reply suggestions', '✓', '✓', '✓'],
                  ['Pipeline tracking', '✓', '✓', '✓'],
                  ['CSV export', '✓', '✓', '✓'],
                  ['Email blast',                ...corePlans.map((p) => feat(p, 'emailBlast'))],
                  ['AI proposals',               ...corePlans.map((p) => feat(p, 'proposals'))],
                  ['Market intelligence briefs', ...corePlans.map((p) => feat(p, 'marketBrief'))],
                  ['Website weakness analysis',  ...corePlans.map((p) => feat(p, 'weaknessAnalysis'))],
                  ['Priority support', '—', '—', '✓'],
                ].map(([feature, free, pro, agency]) => (
                  <tr key={feature} className="hover:bg-white/[0.02]">
                    <td className="p-4 text-gray-300">{feature}</td>
                    <td className="p-4 text-center text-gray-400">{free}</td>
                    <td className="p-4 text-center text-purple-300 font-medium">{pro}</td>
                    <td className="p-4 text-center text-orange-300">{agency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-center text-gray-500 text-sm">
          Questions? Email{' '}
          <a href="mailto:info@runvax.com" className="text-purple-400 hover:underline">
            info@runvax.com
          </a>
        </p>
      </div>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense>
      <PricingContent />
    </Suspense>
  );
}
