'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2, MailCheck, MailWarning, CheckCircle2 } from 'lucide-react';

interface Props {
  /** Called once the account's email is verified (the moment the session reflects it). */
  onVerified?: () => void;
  headline?: string;
  body?: ReactNode;
}

const COOLDOWN_S = 60;
const primary = 'w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm transition-colors';
const secondary = 'w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-60 text-gray-200 font-semibold py-3 rounded-xl text-sm transition-colors';

/**
 * "Verify your email" block used wherever an unverified account hits a wall: onboarding, and the
 * prompt that appears when they try to open a prospect. It re-sends the link, and picks up the
 * verification as soon as the session refreshes (it refreshes when they return from their inbox).
 */
export default function VerifyEmailPanel({ onVerified, headline = 'Verify your email to continue', body }: Props) {
  const { data: session, update } = useSession();
  const email = session?.user?.email ?? '';
  const verified = !!(session?.user as { emailVerified?: unknown } | undefined)?.emailVerified;

  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [cooldown, setCooldown] = useState(0);
  const [checking, setChecking] = useState(false);
  const [notYet, setNotYet] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    if (verified && !fired.current) { fired.current = true; onVerified?.(); }
  }, [verified, onVerified]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const send = async () => {
    if (!email || cooldown > 0) return;
    setState('sending');
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
      });
      setState(res.ok ? 'sent' : 'error');
      if (res.ok) setCooldown(COOLDOWN_S);
    } catch { setState('error'); }
  };

  const recheck = async () => {
    setChecking(true); setNotYet(false);
    const next = await update();
    if (!(next?.user as { emailVerified?: unknown } | undefined)?.emailVerified) setNotYet(true);
    setChecking(false);
  };

  return (
    <div>
      <div className="w-12 h-12 mb-4 rounded-2xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center">
        <MailWarning className="w-6 h-6 text-orange-400" />
      </div>
      <h3 className="text-xl font-black text-white">{headline}</h3>
      <p className="text-gray-400 text-sm mt-2 leading-relaxed">
        {body ?? <>We sent a verification link to <strong className="text-gray-200">{email || 'your email'}</strong>. Open it to unlock your prospects.</>}
      </p>
      <p className="text-xs text-gray-500 mt-2">Can&apos;t see it? Check your spam or junk folder.</p>

      {state === 'sent' && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-green-500/25 bg-green-500/10 p-3">
          <MailCheck className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-300">A new link is on its way to {email}. Open it, then come back here.</p>
        </div>
      )}
      {state === 'error' && <p role="alert" className="text-xs text-red-400 mt-3">We couldn&apos;t send it. Try again in a minute.</p>}

      <div className="mt-4 space-y-2">
        <button onClick={() => void send()} disabled={state === 'sending' || cooldown > 0 || !email} className={primary}>
          {state === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MailCheck className="w-4 h-4" />}
          {state === 'sending' ? 'Sending…' : cooldown > 0 ? `Link sent. Resend in ${cooldown}s` : state === 'sent' ? 'Send another link' : 'Send me a new verification link'}
        </button>
        <button onClick={() => void recheck()} disabled={checking} className={secondary}>
          {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          I&apos;ve verified. Continue
        </button>
      </div>
      {notYet && <p role="status" className="text-xs text-orange-400 mt-2">We can&apos;t see your verification yet. Open the link in your email first, then try again.</p>}
    </div>
  );
}
