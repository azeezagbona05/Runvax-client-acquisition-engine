'use client';

import { useState } from 'react';
import { Zap, X, Lock, Loader2 } from 'lucide-react';

interface Props {
  reason: 'ai_limit' | 'prospect_limit' | 'feature';
  featureName?: string;
  onClose: () => void;
}

const MESSAGES = {
  ai_limit: {
    title: 'Daily AI limit reached',
    body: "You've used all 15 AI messages on the Free plan today. Upgrade to Pro for 200 messages/day.",
    cta: 'Upgrade to Pro — ₦9,999/mo',
  },
  prospect_limit: {
    title: 'Prospect limit reached',
    body: 'Free accounts can save up to 30 prospects. Upgrade to Pro for unlimited prospects and all AI features.',
    cta: 'Upgrade to Pro — ₦9,999/mo',
  },
  feature: {
    title: 'Pro feature',
    body: null,
    cta: 'Unlock with Pro — ₦9,999/mo',
  },
};

export default function UpgradeModal({ reason, featureName, onClose }: Props) {
  const msg = MESSAGES[reason];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheckout = async (plan: 'pro' | 'agency') => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Failed to start payment');
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-purple-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl">

        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 bg-purple-600/20 rounded-xl flex items-center justify-center">
            <Lock className="w-5 h-5 text-purple-400" />
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <h3 className="text-white font-bold text-lg mb-2">{msg.title}</h3>
        <p className="text-gray-400 text-sm mb-1">
          {msg.body ?? (featureName
            ? `${featureName} is available on Pro and Agency plans.`
            : 'This feature requires a Pro or Agency plan.'
          )}
        </p>

        <div className="bg-purple-600/10 border border-purple-500/20 rounded-xl p-3 mb-5 mt-3">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-purple-400" />
            <span className="text-purple-300 text-sm font-semibold">Pro plan includes:</span>
          </div>
          <ul className="space-y-1">
            {[
              '200 AI messages/day',
              'Unlimited saved prospects',
              'Email blast to 100+ businesses',
              'AI proposals & market briefs',
            ].map((f) => (
              <li key={f} className="text-xs text-gray-300 flex items-center gap-1.5">
                <span className="text-green-400">✓</span> {f}
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <p className="text-red-400 text-xs mb-3">{error}</p>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={() => handleCheckout('pro')}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            {loading ? 'Redirecting to payment…' : msg.cta}
          </button>
          <button
            onClick={() => handleCheckout('agency')}
            disabled={loading}
            className="w-full text-center bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 font-semibold py-2 rounded-xl text-xs transition-colors border border-orange-500/20"
          >
            Agency plan — ₦24,999/mo (Unlimited everything)
          </button>
          <button
            onClick={onClose}
            className="w-full text-center text-gray-500 hover:text-gray-300 text-sm py-2"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
