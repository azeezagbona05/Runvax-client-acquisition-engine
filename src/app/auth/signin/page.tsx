'use client';

import { Suspense, useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, MailCheck, Fingerprint, Loader2 } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/types';

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [checkingBiometric, setCheckingBiometric] = useState(false);

  const justReset    = params.get('reset') === '1';
  const justVerified = params.get('verified') === '1';

  // Check if this device supports platform biometrics
  useEffect(() => {
    if (typeof window !== 'undefined' && window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((available) => { if (!available) setBiometricAvailable(false); })
        .catch(() => {});
    }
  }, []);

  // When email changes, check if the account has a registered biometric credential
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
      // Step 1: get challenge from server
      const optRes = await fetch(`/api/auth/webauthn/authenticate?email=${encodeURIComponent(email)}`);
      if (!optRes.ok) {
        const j = await optRes.json() as { error?: string };
        throw new Error(j.error ?? 'No biometric found for this account');
      }
      const options = await optRes.json() as PublicKeyCredentialRequestOptionsJSON;

      // Step 2: prompt device biometric (Face ID / Touch ID / fingerprint)
      const assertion = await startAuthentication({ optionsJSON: options });

      // Step 3: verify on server → sets session cookie
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

        <div className="bg-gray-900 border border-white/10 rounded-2xl p-8 space-y-5">
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

          {/* Email */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setBiometricAvailable(false); }}
              onBlur={(e) => checkBiometric(e.target.value)}
              required
              className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/60"
              placeholder="you@example.com"
            />
          </div>

          {/* Biometric button — shown when account has a registered credential */}
          {biometricAvailable && (
            <button
              type="button"
              onClick={handleBiometricLogin}
              disabled={biometricLoading}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white font-bold text-sm transition-all disabled:opacity-60 shadow-lg shadow-purple-900/30"
            >
              {biometricLoading
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Authenticating…</>
                : <><Fingerprint className="w-5 h-5" /> Sign in with Face ID / Touch ID</>
              }
            </button>
          )}

          {/* Checking indicator */}
          {checkingBiometric && (
            <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
              <Loader2 className="w-3 h-3 animate-spin" /> Checking biometric…
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/8" />
            <span className="text-xs text-gray-600 font-medium">
              {biometricAvailable ? 'or use password' : 'sign in with password'}
            </span>
            <div className="flex-1 h-px bg-white/8" />
          </div>

          {/* Password form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm text-gray-400">Password</label>
                <Link href="/auth/forgot-password" className="text-xs text-purple-400 hover:underline">Forgot password?</Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/60"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gray-800 hover:bg-gray-700 border border-white/10 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors"
            >
              {loading ? 'Signing in…' : 'Sign in with Password'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500">
            No account?{' '}
            <Link href="/auth/signup" className="text-purple-400 hover:text-purple-300">Create one free</Link>
          </p>
        </div>
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
