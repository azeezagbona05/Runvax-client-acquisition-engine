'use client';

import { Suspense, useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, MailCheck, Fingerprint, Loader2 } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/types';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [checkingBiometric, setCheckingBiometric] = useState(false);
  const [mounted, setMounted] = useState(false);

  const justReset    = params.get('reset') === '1';
  const justVerified = params.get('verified') === '1';

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((available) => { if (!available) setBiometricAvailable(false); })
        .catch(() => {});
    }
  }, []);

  const checkBiometric = async (emailVal: string) => {
    if (!emailVal.includes('@')) { setBiometricAvailable(false); return; }
    setCheckingBiometric(true);
    try {
      const res = await fetch(`/api/auth/webauthn/authenticate?email=${encodeURIComponent(emailVal)}`);
      setBiometricAvailable(res.ok);
    } catch {
      setBiometricAvailable(false);
    } finally {
      setCheckingBiometric(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (!email) { setError('Enter your email first'); return; }
    setBiometricLoading(true);
    setError('');
    try {
      const optRes = await fetch(`/api/auth/webauthn/authenticate?email=${encodeURIComponent(email)}`);
      if (!optRes.ok) {
        const j = await optRes.json() as { error?: string };
        throw new Error(j.error ?? 'No biometric found for this account');
      }
      const options = await optRes.json() as PublicKeyCredentialRequestOptionsJSON;
      const assertion = await startAuthentication({ optionsJSON: options });
      const verifyRes = await fetch('/api/auth/webauthn/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: assertion }),
      });
      const verifyJson = await verifyRes.json() as { ok?: boolean; error?: string };
      if (!verifyRes.ok || !verifyJson.ok) throw new Error(verifyJson.error ?? 'Verification failed');
      router.push('/');
      router.refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Biometric login failed';
      if (msg.includes('cancelled') || msg.includes('abort') || msg.toLowerCase().includes('not allowed')) {
        setError('Biometric cancelled — use your password instead.');
      } else {
        setError(msg);
      }
    } finally {
      setBiometricLoading(false);
    }
  };

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
    <div
      className="min-h-dvh bg-gray-950 flex flex-col sm:items-center sm:justify-center relative overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Animated background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="animate-blob-drift absolute -top-40 -left-20 w-[28rem] h-[28rem] rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.35), transparent 65%)' }}
        />
        <div
          className="animate-blob-drift absolute -bottom-40 -right-20 w-[30rem] h-[30rem] rounded-full blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(249,115,22,0.25), transparent 65%)',
            animationDelay: '-4s',
            animationDirection: 'alternate-reverse',
          }}
        />
        <div
          className="animate-blob-drift absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[20rem] h-[20rem] rounded-full blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(124,58,237,0.12), transparent 65%)',
            animationDelay: '-2s',
          }}
        />
      </div>

      {/* ── Logo / branding section ── */}
      <div className="flex-1 sm:flex-none flex flex-col items-center justify-center px-6 pt-8 pb-4 sm:pb-8 relative z-10">
        {/* Logo — spring pop animation */}
        <div
          className={`transition-opacity duration-100 ${mounted ? 'animate-logo-pop' : 'opacity-0'}`}
        >
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-600 to-orange-500 flex items-center justify-center shadow-2xl shadow-purple-900/50 mb-6">
            <img src="/logo.svg" alt="AI Prospect Finder" className="w-12 h-12" />
          </div>
        </div>

        <h1
          className={`text-3xl font-black text-white text-center leading-tight mb-2 ${mounted ? 'animate-fade-up' : 'opacity-0'}`}
          style={{ animationDelay: '150ms' }}
        >
          AI Prospect Finder
        </h1>
        <p
          className={`text-gray-400 text-sm text-center ${mounted ? 'animate-fade-up' : 'opacity-0'}`}
          style={{ animationDelay: '220ms' }}
        >
          Find your next paying client in seconds
        </p>
      </div>

      {/* ── Login card — bottom sheet on mobile, centred card on desktop ── */}
      <div
        className={`relative z-10 w-full sm:max-w-sm sm:mx-auto bg-gray-900/95 backdrop-blur-xl border-t border-white/10 sm:border sm:rounded-2xl rounded-t-3xl px-6 pt-6 pb-2 ${mounted ? 'animate-slide-in-up' : 'opacity-0'}`}
        style={{ animationDelay: '300ms' }}
      >
        {/* Drag pill — mobile only */}
        <div className="sm:hidden w-10 h-1 bg-white/15 rounded-full mx-auto mb-6" />

        <h2 className="text-xl font-black text-white mb-5">Login</h2>

        {/* Alert banners */}
        {justVerified && (
          <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/25 text-green-400 text-sm rounded-xl px-4 py-3 mb-4">
            <MailCheck className="w-4 h-4 flex-shrink-0" /> Email verified! You can now log in.
          </div>
        )}
        {justReset && (
          <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/25 text-green-400 text-sm rounded-xl px-4 py-3 mb-4">
            <CheckCircle className="w-4 h-4 flex-shrink-0" /> Password reset. Login with your new password.
          </div>
        )}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {/* Email */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-300 mb-2">Email address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setBiometricAvailable(false); }}
            onBlur={(e) => checkBiometric(e.target.value)}
            required
            autoComplete="email"
            className="w-full bg-gray-800/80 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/60 focus:bg-gray-800 text-[16px]"
            placeholder="you@example.com"
          />
        </div>

        {/* Biometric login */}
        {biometricAvailable && (
          <button
            type="button"
            onClick={handleBiometricLogin}
            disabled={biometricLoading}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 active:from-purple-700 active:to-purple-800 text-white font-bold text-sm transition-all disabled:opacity-60 shadow-xl shadow-purple-900/40 mb-4"
          >
            {biometricLoading
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Authenticating…</>
              : <><Fingerprint className="w-5 h-5" /> Login with Face ID / Touch ID</>
            }
          </button>
        )}

        {checkingBiometric && (
          <div className="flex items-center justify-center gap-2 text-xs text-gray-600 mb-3">
            <Loader2 className="w-3 h-3 animate-spin" /> Checking biometric…
          </div>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-white/8" />
          <span className="text-xs text-gray-600 font-medium">
            {biometricAvailable ? 'or login with password' : 'login with password'}
          </span>
          <div className="flex-1 h-px bg-white/8" />
        </div>

        {/* Password form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-300">Password</label>
              <Link href="/auth/forgot-password" className="text-xs text-purple-400 hover:underline">Forgot password?</Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-gray-800/80 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/60 focus:bg-gray-800 text-[16px]"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-orange-500 hover:from-purple-500 hover:to-orange-400 active:from-purple-700 active:to-orange-600 disabled:opacity-50 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-purple-900/30 text-base"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Logging in…
              </span>
            ) : 'Login'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-5 mb-2">
          No account?{' '}
          <Link href="/auth/signup" className="text-purple-400 font-bold hover:text-purple-300">Create one free</Link>
        </p>

        {/* Bottom safe area spacer */}
        <div style={{ height: 'max(1rem, env(safe-area-inset-bottom))' }} />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-gray-950" />}>
      <LoginForm />
    </Suspense>
  );
}
