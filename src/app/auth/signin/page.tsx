'use client';

import { Suspense, useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, MailCheck, Fingerprint, Loader2, Eye, EyeOff } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/types';
import GoogleButton from '@/components/GoogleButton';
import { DEFAULT_HOME } from '@/lib/home';
import AuthShell, { Notice, authInput, authLabel, authPrimary, authSecondary } from '@/components/auth/AuthShell';

/** Only same-site paths: '/claim-pro' is fine, 'https://evil.com' and '//evil.com' are not. Without one, signing in lands on Find Prospects. */
function safeNext(raw: string | null): string {
  return raw && /^\/[A-Za-z0-9_\-/]*(\?[A-Za-z0-9_\-=&%.]*)?$/.test(raw) && !raw.startsWith('//') ? raw : DEFAULT_HOME;
}

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
  const [showPw, setShowPw] = useState(false);

  const justReset      = params.get('reset') === '1';
  const justVerified   = params.get('verified') === '1';
  const justRegistered = params.get('registered') === '1';
  const next           = safeNext(params.get('next'));
  const authError      = params.get('error');

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
      // Full reload (not router.push) — the session cookie was set via raw fetch,
      // so next-auth/react's SessionProvider cache needs a fresh mount to see it.
      window.location.href = next;
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
      router.push(next);
      router.refresh();
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to your Runvax account."
      footer={<>No account? <Link href="/auth/signup" className="font-semibold text-purple-700 hover:text-purple-800 hover:underline">Create one free</Link></>}
    >
      {justVerified && <Notice tone="success"><MailCheck className="mt-0.5 h-4 w-4 flex-shrink-0" /> Email verified! You can now log in.</Notice>}
      {justReset && <Notice tone="success"><CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" /> Password reset. Log in with your new password.</Notice>}
      {justRegistered && <Notice tone="success"><CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" /> Account created! Log in below to get started.</Notice>}
      {(error || authError) && (
        <Notice tone="error">{error || 'Google sign-in did not complete. Try again, or log in with your email and password.'}</Notice>
      )}

      <GoogleButton callbackUrl={next} dividerLabel="or continue with email" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="signin-email" className={authLabel}>Email address</label>
          <input
            id="signin-email"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setBiometricAvailable(false); }}
            onBlur={(e) => checkBiometric(e.target.value)}
            required
            autoComplete="email"
            className={authInput}
            placeholder="you@company.com"
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="signin-password" className="block text-[13px] font-semibold text-slate-700">Password</label>
            <Link href="/auth/forgot-password" className="text-[13px] font-medium text-purple-700 hover:text-purple-800 hover:underline">Forgot password?</Link>
          </div>
          <div className="relative">
            <input
              id="signin-password"
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className={`${authInput} pr-11`}
              placeholder="Your password"
            />
            <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide password' : 'Show password'} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-600">
              {showPw ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </div>

        <button type="submit" disabled={loading} className={authPrimary}>
          {loading ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Logging in…</span> : 'Log in'}
        </button>

        {biometricAvailable && (
          <button type="button" onClick={handleBiometricLogin} disabled={biometricLoading} className={`${authSecondary} flex items-center justify-center gap-2.5`}>
            {biometricLoading
              ? <><Loader2 className="h-5 w-5 animate-spin" /> Authenticating…</>
              : <><Fingerprint className="h-5 w-5" /> Log in with Face ID / Touch ID</>}
          </button>
        )}
        {checkingBiometric && (
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400"><Loader2 className="h-3 w-3 animate-spin" /> Checking biometric…</div>
        )}
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-slate-50" />}>
      <LoginForm />
    </Suspense>
  );
}
