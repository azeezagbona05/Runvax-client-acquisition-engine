'use client';

import { useEffect, useState } from 'react';
import { getProviders, signIn } from 'next-auth/react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

/** "Continue with Google" plus its divider. Renders nothing until the Google provider is configured on the server. */
export default function GoogleButton({ callbackUrl, dividerLabel, showTerms }: { callbackUrl: string; dividerLabel: string; showTerms?: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getProviders().then((p) => setEnabled(!!p?.google)).catch(() => {});
  }, []);

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => { setBusy(true); void signIn('google', { callbackUrl }); }}
        className="w-full h-11 flex items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 font-semibold text-[14px] transition-colors disabled:opacity-60 focus:outline-none focus-visible:ring-4 focus-visible:ring-purple-100"
      >
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : (
          <svg className="w-5 h-5" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.6 5.9c4.4-4.1 6.9-10.1 6.9-17.6z"/>
            <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/>
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
          </svg>
        )}
        Continue with Google
      </button>
      {showTerms && (
        <p className="text-[12px] text-slate-500 text-center mt-2.5 leading-relaxed">
          By continuing with Google you agree to the{' '}
          <Link href="/terms" target="_blank" className="text-purple-700 font-medium hover:underline">Terms</Link> and{' '}
          <Link href="/privacy" target="_blank" className="text-purple-700 font-medium hover:underline">Privacy Policy</Link>.
        </p>
      )}
      <div className="flex items-center gap-3 my-5">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-[12px] text-slate-400 font-medium">{dividerLabel}</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>
    </>
  );
}
