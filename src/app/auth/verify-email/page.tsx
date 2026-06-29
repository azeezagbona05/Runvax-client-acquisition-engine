'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MailCheck, AlertCircle, Clock, Loader2, CheckCircle } from 'lucide-react';

const ERRORS: Record<string, { icon: typeof AlertCircle; color: string; title: string; body: string }> = {
  missing: { icon: AlertCircle, color: 'text-red-400',    title: 'Invalid link',   body: 'This verification link is missing a token. Please use the link from your email.' },
  invalid: { icon: AlertCircle, color: 'text-red-400',    title: 'Link not found', body: "This verification link doesn't exist. It may have already been used." },
  expired: { icon: Clock,       color: 'text-orange-400', title: 'Link expired',   body: 'This link has expired (24 hours). Enter your email below to get a new one.' },
};

function ResendForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrMsg('');
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed');
      setStatus('sent');
    } catch (err: unknown) {
      setErrMsg(err instanceof Error ? err.message : 'Something went wrong');
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-sm rounded-xl px-4 py-3 mt-4">
        <CheckCircle className="w-4 h-4 flex-shrink-0" /> New verification email sent — check your inbox.
      </div>
    );
  }

  return (
    <form onSubmit={handleResend} className="mt-5 space-y-3">
      <p className="text-gray-500 text-xs text-center">Enter your email to receive a new link</p>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
      />
      {status === 'error' && (
        <p className="text-red-400 text-xs">{errMsg}</p>
      )}
      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
      >
        {status === 'loading' ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : 'Resend verification email'}
      </button>
    </form>
  );
}

function VerifyContent() {
  const params = useSearchParams();
  const error = params.get('error');

  if (error && ERRORS[error]) {
    const { icon: Icon, color, title, body } = ERRORS[error];
    return (
      <div className="text-center space-y-4">
        <Icon className={`w-14 h-14 mx-auto ${color}`} />
        <h1 className="text-xl font-black text-white">{title}</h1>
        <p className="text-gray-400 text-sm max-w-xs mx-auto">{body}</p>
        <ResendForm />
        <Link href="/auth/signin" className="inline-block mt-2 text-purple-400 hover:text-purple-300 text-sm font-semibold">
          Back to sign in →
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center space-y-4">
      <MailCheck className="w-14 h-14 mx-auto text-green-400" />
      <h1 className="text-xl font-black text-white">Check your inbox</h1>
      <p className="text-gray-400 text-sm max-w-xs mx-auto">
        We sent a verification link to your email. Click it to activate your account.
        The link expires in 24 hours.
      </p>
      <p className="text-gray-600 text-xs">Didn&apos;t get it? Check spam, or resend below.</p>
      <ResendForm />
      <Link href="/auth/signin" className="inline-block text-purple-400 hover:text-purple-300 text-sm font-semibold">
        Back to sign in →
      </Link>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl p-10 shadow-2xl">
        <Suspense fallback={<div className="text-gray-400 text-center text-sm">Loading…</div>}>
          <VerifyContent />
        </Suspense>
      </div>
    </div>
  );
}
