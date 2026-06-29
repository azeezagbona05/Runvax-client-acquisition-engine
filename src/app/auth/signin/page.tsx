'use client';

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, MailCheck } from 'lucide-react';

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const justReset    = params.get('reset') === '1';
  const justVerified = params.get('verified') === '1';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);

    if (res?.error) {
      setError('Invalid email or password');
    } else {
      router.push('/');
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Subtle animated background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="auth-blob absolute -top-32 -left-24 w-[30rem] h-[30rem] rounded-full blur-3xl opacity-60"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.30), transparent 70%)' }} />
        <div className="auth-blob-slow absolute -bottom-32 -right-24 w-[32rem] h-[32rem] rounded-full blur-3xl opacity-50"
          style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.22), transparent 70%)' }} />
      </div>

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-orange-500 rounded-xl flex items-center justify-center text-xl font-black mx-auto mb-4">A</div>
          <h1 className="text-2xl font-black text-white">AI Prospect Finder</h1>
          <p className="text-gray-400 mt-1 text-sm">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 border border-white/10 rounded-2xl p-8 space-y-5">
          {justVerified && (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/25 text-green-400 text-sm rounded-xl px-4 py-3">
              <MailCheck className="w-4 h-4 flex-shrink-0" /> Email verified! You can now sign in.
            </div>
          )}
          {justReset && (
            <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/25 text-green-400 text-sm rounded-xl px-4 py-3">
              <CheckCircle className="w-4 h-4 flex-shrink-0" /> Password reset. Sign in with your new password.
            </div>
          )}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Email</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/60"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm text-gray-400">Password</label>
              <Link href="/auth/forgot-password" className="text-xs text-purple-400 hover:underline">Forgot password?</Link>
            </div>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/60"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="text-center text-sm text-gray-500">
            No account?{' '}
            <Link href="/auth/signup" className="text-purple-400 hover:text-purple-300">Create one free</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950" />}>
      <SignInForm />
    </Suspense>
  );
}
