'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import AuthBackground from '@/components/AuthBackground';

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [company, setCompany] = useState(''); // honeypot — real users never fill this
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!acceptedTerms) {
      setError('Please accept the Terms and Privacy Policy to continue');
      return;
    }

    setLoading(true);

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, acceptedTerms, company }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? 'Registration failed');
      setLoading(false);
      return;
    }

    const signInRes = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (signInRes?.error) {
      // Account was created but auto-login failed — send them to sign in manually.
      router.push('/auth/signin?registered=1');
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <div
      className="min-h-dvh bg-gray-950 flex flex-col sm:items-center sm:justify-center relative overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <AuthBackground />

      {/* ── Logo / branding section ── */}
      <div className="flex-1 sm:flex-none flex flex-col items-center justify-center px-6 pt-8 pb-4 sm:pb-8 relative z-10">
        <div className={`transition-opacity duration-100 ${mounted ? 'animate-logo-pop' : 'opacity-0'}`}>
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-600 to-orange-500 flex items-center justify-center shadow-2xl shadow-purple-900/50 mb-6">
            <img src="/logo.svg" alt="Runvax" className="w-12 h-12" />
          </div>
        </div>

        <h1
          className={`text-3xl font-black text-white text-center leading-tight mb-2 ${mounted ? 'animate-fade-up' : 'opacity-0'}`}
          style={{ animationDelay: '150ms' }}
        >
          Runvax
        </h1>
        <p
          className={`text-gray-400 text-sm text-center ${mounted ? 'animate-fade-up' : 'opacity-0'}`}
          style={{ animationDelay: '220ms' }}
        >
          Find your next paying client in seconds
        </p>
      </div>

      {/* ── Signup card — bottom sheet on mobile, centred card on desktop ── */}
      <div
        className={`relative z-10 w-full sm:max-w-sm sm:mx-auto bg-gray-900/95 backdrop-blur-xl border-t border-white/10 sm:border sm:rounded-2xl rounded-t-3xl px-6 pt-6 pb-2 ${mounted ? 'animate-slide-in-up' : 'opacity-0'}`}
        style={{ animationDelay: '300ms' }}
      >
        <div className="sm:hidden w-10 h-1 bg-white/15 rounded-full mx-auto mb-6" />

        <h2 className="text-xl font-black text-white mb-5">Create your free account</h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Honeypot — hidden from real users, only bots fill it */}
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            className="absolute -left-[9999px] w-px h-px opacity-0"
            aria-hidden="true"
          />

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Full name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
              className="w-full bg-gray-800/80 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/60 focus:bg-gray-800 text-[16px]"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-gray-800/80 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/60 focus:bg-gray-800 text-[16px]"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full bg-gray-800/80 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/60 focus:bg-gray-800 text-[16px]"
              placeholder="Min. 8 characters"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Confirm password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full bg-gray-800/80 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/60 focus:bg-gray-800 text-[16px]"
              placeholder="Re-enter your password"
            />
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-purple-600 flex-shrink-0"
            />
            <span className="text-xs text-gray-400 leading-relaxed">
              I agree to the{' '}
              <Link href="/terms" target="_blank" className="text-purple-400 hover:underline">Terms of Service</Link>{' '}
              and{' '}
              <Link href="/privacy" target="_blank" className="text-purple-400 hover:underline">Privacy Policy</Link>
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-orange-500 hover:from-purple-500 hover:to-orange-400 active:from-purple-700 active:to-orange-600 disabled:opacity-50 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-purple-900/30 text-base"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Creating account…
              </span>
            ) : 'Create free account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-5 mb-2">
          Already have an account?{' '}
          <Link href="/auth/signin" className="text-purple-400 font-bold hover:text-purple-300">Sign in</Link>
        </p>

        <div style={{ height: 'max(1rem, env(safe-area-inset-bottom))' }} />
      </div>
    </div>
  );
}
