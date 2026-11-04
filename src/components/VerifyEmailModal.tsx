'use client';

import Link from 'next/link';
import { X, Lock } from 'lucide-react';
import VerifyEmailPanel from './VerifyEmailPanel';

interface Props {
  /** 'verify': signed in but unverified. 'signup': not signed in at all. */
  mode: 'verify' | 'signup';
  onClose: () => void;
  headline?: string;
}

/** Shown when someone tries to open a prospect without a verified email. */
export default function VerifyEmailModal({ mode, onClose, headline }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl relative">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        {mode === 'verify' ? (
          <VerifyEmailPanel
            headline={headline ?? 'Verify your email to open this prospect'}
            onVerified={onClose}
          />
        ) : (
          <div>
            <div className="w-12 h-12 mb-4 rounded-2xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center"><Lock className="w-6 h-6 text-purple-400" /></div>
            <h3 className="text-xl font-black text-white">Create a free account to open prospects</h3>
            <p className="text-gray-400 text-sm mt-2 leading-relaxed">Sign up, verify your email, and you can open any business, see who to contact and write your first message.</p>
            <Link href="/auth/signup" className="mt-5 w-full flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl text-sm transition-colors">Create free account</Link>
            <Link href="/auth/signin" className="mt-2 block text-center text-sm text-gray-500 hover:text-gray-300 py-2">Already have an account? Sign in</Link>
          </div>
        )}
      </div>
    </div>
  );
}
