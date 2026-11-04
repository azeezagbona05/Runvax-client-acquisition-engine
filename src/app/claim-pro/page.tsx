'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Loader2, MailCheck, MailWarning, PartyPopper, Zap, CheckCircle2, Info } from 'lucide-react';
import { TRIAL_DAYS, trialOfferOpen, trialOfferLastDayLabel } from '@/lib/promo';

type Phase = 'idle' | 'starting' | 'started';

const card = 'bg-gray-900 border border-white/10 rounded-2xl p-6 sm:p-8';
const primary = 'w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm transition-colors';
const secondary = 'w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-60 text-gray-200 font-semibold py-3 rounded-xl text-sm transition-colors';

export default function ClaimProPage() {
  const { data: session, update, status } = useSession();
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');
  const [resend, setResend] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [checking, setChecking] = useState(false);
  const [stillUnverified, setStillUnverified] = useState(false);

  const user = session?.user as { email?: string | null; name?: string | null; plan?: string; emailVerified?: string | Date | null } | undefined;
  const verified = !!user?.emailVerified;
  const plan = user?.plan ?? 'free';
  const first = (user?.name ?? '').trim().split(/\s+/)[0];

  const sendLink = async () => {
    if (!user?.email) return;
    setResend('sending');
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email }),
      });
      setResend(res.ok ? 'sent' : 'error');
    } catch { setResend('error'); }
  };

  // After they click the link in their inbox, pull the fresh verification status into this session.
  const recheck = async () => {
    setChecking(true);
    setStillUnverified(false);
    const next = await update();
    const nowVerified = !!(next?.user as { emailVerified?: unknown } | undefined)?.emailVerified;
    setStillUnverified(!nowVerified);
    setChecking(false);
  };

  const start = async () => {
    setPhase('starting');
    setError('');
    try {
      const res = await fetch('/api/trial/start', { method: 'POST' });
      const json = await res.json() as { error?: string; code?: string };
      if (!res.ok) {
        if (json.code === 'EMAIL_UNVERIFIED') await update();
        setError(json.error ?? 'Could not start your free access');
        setPhase('idle');
        return;
      }
      await update(); // so the new plan applies immediately
      setPhase('started');
    } catch {
      setError('Could not start your free access. Try again.');
      setPhase('idle');
    }
  };

  let content: React.ReactNode;

  if (status === 'loading') {
    content = <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-purple-400 animate-spin" /></div>;
  } else if (phase === 'started') {
    content = (
      <div className="text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-green-500/15 border border-green-500/25 flex items-center justify-center"><PartyPopper className="w-7 h-7 text-green-400" /></div>
        <h1 className="text-2xl font-black text-white">You&apos;re on Pro for {TRIAL_DAYS} days</h1>
        <p className="text-gray-400 text-sm mt-2">No card, nothing to pay. Find businesses, see who to contact and start conversations.</p>
        <a href="/" className={`${primary} mt-6`}>Start finding clients</a>
      </div>
    );
  } else if (!verified) {
    content = (
      <>
        <div className="w-14 h-14 mb-4 rounded-2xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center"><MailWarning className="w-7 h-7 text-orange-400" /></div>
        <h1 className="text-2xl font-black text-white">Your email isn&apos;t verified yet</h1>
        <p className="text-gray-400 text-sm mt-2 leading-relaxed">
          Verify <strong className="text-gray-200">{user?.email}</strong> to claim your {TRIAL_DAYS} free days of Pro. It takes a few seconds.
        </p>

        {resend === 'sent' ? (
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-green-500/25 bg-green-500/10 p-4">
            <MailCheck className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-300 leading-relaxed">Verification link sent. Open it from your inbox (check spam or junk too), then come back here and tap the button below.</p>
          </div>
        ) : (
          <button onClick={() => void sendLink()} disabled={resend === 'sending'} className={`${primary} mt-5`}>
            {resend === 'sending' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MailCheck className="w-4 h-4" />}
            {resend === 'sending' ? 'Sending…' : 'Send me a verification link'}
          </button>
        )}
        {resend === 'error' && <p role="alert" className="text-xs text-red-400 mt-2">We couldn&apos;t send it. Try again in a minute.</p>}

        <button onClick={() => void recheck()} disabled={checking} className={`${secondary} mt-3`}>
          {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          I&apos;ve verified. Continue
        </button>
        {stillUnverified && <p role="status" className="text-xs text-orange-400 mt-2">We can&apos;t see your verification yet. Open the link in the email first, then try again.</p>}
      </>
    );
  } else if (plan !== 'free') {
    content = (
      <>
        <div className="w-14 h-14 mb-4 rounded-2xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center"><Zap className="w-7 h-7 text-purple-400" /></div>
        <h1 className="text-2xl font-black text-white">You already have {plan.charAt(0).toUpperCase() + plan.slice(1)}</h1>
        <p className="text-gray-400 text-sm mt-2">Nothing to claim. Your account already has the full set of features.</p>
        <a href="/" className={`${primary} mt-6`}>Go to Runvax</a>
      </>
    );
  } else if (!trialOfferOpen()) {
    content = (
      <>
        <div className="w-14 h-14 mb-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center"><Info className="w-7 h-7 text-gray-400" /></div>
        <h1 className="text-2xl font-black text-white">This offer has ended</h1>
        <p className="text-gray-400 text-sm mt-2">The launch offer closed on {trialOfferLastDayLabel()}. Your free account is still yours to use every day.</p>
        <a href="/" className={`${primary} mt-6`}>Go to Runvax</a>
      </>
    );
  } else {
    content = (
      <>
        <div className="w-14 h-14 mb-4 rounded-2xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center"><Zap className="w-7 h-7 text-purple-400" /></div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-purple-400">Launch offer</p>
        <h1 className="text-2xl font-black text-white mt-1">{first ? `${first}, claim` : 'Claim'} your {TRIAL_DAYS} days of Pro</h1>
        <p className="text-gray-400 text-sm mt-2 leading-relaxed">Your email is verified, so you&apos;re ready. Full Pro access for {TRIAL_DAYS} days.</p>
        <div className="mt-5 rounded-xl border border-purple-500/25 bg-purple-600/10 p-4 text-center">
          <p className="text-lg font-black text-white">{TRIAL_DAYS} days of RUNVAX Pro</p>
          <p className="text-sm font-semibold text-purple-300 mt-0.5">$0 · No credit card required</p>
        </div>
        <button onClick={() => void start()} disabled={phase === 'starting'} className={`${primary} mt-5`}>
          {phase === 'starting' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {phase === 'starting' ? 'Activating…' : `Activate my ${TRIAL_DAYS} free days`}
        </button>
        {error && <p role="alert" className="text-xs text-red-400 mt-2">{error}</p>}
        <p className="text-[11px] text-gray-600 mt-3 text-center">One free trial per account. Claim by {trialOfferLastDayLabel()}.</p>
      </>
    );
  }

  return (
    <div className="min-h-dvh bg-gray-950 px-4 py-10 sm:py-16">
      <div className="max-w-md mx-auto">
        <div className={card}>{content}</div>
        <p className="text-center text-xs text-gray-600 mt-5"><Link href="/" className="hover:text-gray-400">Back to Runvax</Link></p>
      </div>
    </div>
  );
}
