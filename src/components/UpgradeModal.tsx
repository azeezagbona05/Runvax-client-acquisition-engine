'use client';

import { Zap, X, Lock } from 'lucide-react';
import Link from 'next/link';

interface Props {
  reason: 'ai_limit' | 'prospect_limit' | 'feature';
  featureName?: string;
  onClose: () => void;
}

const MESSAGES = {
  ai_limit: {
    title: "Daily AI limit reached",
    body: "You've used all 15 AI messages on the Free plan today. Upgrade to Pro for 200 messages per day, or Agency for unlimited.",
    cta: "Upgrade to Pro — ₦9,999/month",
  },
  prospect_limit: {
    title: "Prospect limit reached",
    body: "Free accounts can save up to 30 prospects. Upgrade to Pro for unlimited saved prospects, pipeline tracking, and all AI features.",
    cta: "Upgrade to Pro — ₦9,999/month",
  },
  feature: {
    title: "Pro feature",
    body: null,
    cta: "Unlock with Pro — ₦9,999/month",
  },
};

export default function UpgradeModal({ reason, featureName, onClose }: Props) {
  const msg = MESSAGES[reason];

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

        <div className="flex flex-col gap-2">
          <Link
            href="/pricing"
            onClick={onClose}
            className="w-full text-center bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
          >
            {msg.cta}
          </Link>
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
