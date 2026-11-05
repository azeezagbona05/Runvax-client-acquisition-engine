'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import GoogleButton from '@/components/GoogleButton';
import AuthShell, { Notice, authInput, authLabel, authPrimary } from '@/components/auth/AuthShell';

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
  const [showPw, setShowPw] = useState(false);

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
    <AuthShell
      title="Create your free account"
      subtitle="Find your next customers in minutes. No card needed."
      footer={<>Already have an account? <Link href="/auth/signin" className="font-semibold text-purple-700 hover:text-purple-800 hover:underline">Log in</Link></>}
    >
      {error && <Notice tone="error">{error}</Notice>}

      <GoogleButton callbackUrl="/" dividerLabel="or sign up with email" showTerms />

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Honeypot — hidden from real users, only bots fill it */}
        <input
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          className="absolute -left-[9999px] h-px w-px opacity-0"
          aria-hidden="true"
        />

        <div>
          <label htmlFor="signup-name" className={authLabel}>Full name</label>
          <input id="signup-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" className={authInput} placeholder="Your full name" />
        </div>

        <div>
          <label htmlFor="signup-email" className={authLabel}>Work email</label>
          <input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className={authInput} placeholder="you@company.com" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="signup-password" className={authLabel}>Password</label>
            <div className="relative">
              <input id="signup-password" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" className={`${authInput} pr-11`} placeholder="8+ characters" />
              <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? 'Hide passwords' : 'Show passwords'} className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-600">
                {showPw ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="signup-confirm" className={authLabel}>Confirm password</label>
            <input id="signup-confirm" type={showPw ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} autoComplete="new-password" className={authInput} placeholder="Repeat password" />
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5">
          <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-slate-300 accent-purple-600" />
          <span className="text-[13px] leading-relaxed text-slate-600">
            I agree to the{' '}
            <Link href="/terms" target="_blank" className="font-medium text-purple-700 hover:underline">Terms of Service</Link>{' '}and{' '}
            <Link href="/privacy" target="_blank" className="font-medium text-purple-700 hover:underline">Privacy Policy</Link>
          </span>
        </label>

        <button type="submit" disabled={loading} className={authPrimary}>
          {loading ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Creating account…</span> : 'Create free account'}
        </button>
      </form>
    </AuthShell>
  );
}
