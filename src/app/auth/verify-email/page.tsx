'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { MailCheck, AlertCircle, Clock } from 'lucide-react';

const ERRORS: Record<string, { icon: typeof AlertCircle; color: string; title: string; body: string }> = {
  missing:  { icon: AlertCircle, color: 'text-red-400',    title: 'Invalid link',      body: 'This verification link is missing a token. Please use the link from your email.' },
  invalid:  { icon: AlertCircle, color: 'text-red-400',    title: 'Link not found',    body: 'This verification link doesn\'t exist. It may have already been used.' },
  expired:  { icon: Clock,       color: 'text-orange-400', title: 'Link expired',      body: 'This link has expired (24 hours). Sign in and we\'ll prompt you to resend a new one.' },
};

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
      <p className="text-gray-600 text-xs">Didn&apos;t get it? Check your spam folder.</p>
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
