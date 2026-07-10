'use client';

import { useState, useEffect } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Loader2, Eye, EyeOff } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  // Already logged in as admin → go straight to panel
  useEffect(() => {
    if (status !== 'authenticated') return;
    const isAdmin = (session?.user as { isAdmin?: boolean })?.isAdmin;
    if (isAdmin) router.replace('/admin');
  }, [status, session, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await signIn('credentials', { email, password, redirect: false });

    if (res?.error) {
      setError('Invalid credentials');
      setLoading(false);
      return;
    }

    // Fetch fresh session to read isAdmin from JWT
    const sessionRes = await fetch('/api/auth/session');
    const freshSession = await sessionRes.json() as { user?: { isAdmin?: boolean } };

    if (!freshSession?.user?.isAdmin) {
      setError('This account does not have admin access');
      await signOut({ redirect: false }); // properly clears the session
      setLoading(false);
      return;
    }

    router.replace('/admin');
    // keep loading=true — the redirect will unmount the page
  }

  if (status === 'loading') {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
    </div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-purple-600 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-purple-900/30">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-black text-white">Admin Access</h1>
          <p className="text-gray-500 text-sm mt-1">AI Prospect Finder — restricted area</p>
        </div>

        {/* Form */}
        <div className="bg-gray-900 border border-white/10 rounded-2xl p-8 shadow-2xl">
          {error && (
            <div className="bg-red-500/10 border border-red-500/25 text-red-400 text-sm rounded-xl px-4 py-3 mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Admin Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500/60 transition-colors"
                placeholder="admin@runvax.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500/60 transition-colors"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white font-bold py-3 rounded-xl text-sm transition-colors shadow-lg shadow-purple-900/30 mt-2"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
                : <><ShieldCheck className="w-4 h-4" /> Sign in to Admin</>}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-700 mt-6">
          Not an admin?{' '}
          <a href="/" className="text-gray-600 hover:text-gray-400 transition-colors">Back to app</a>
        </p>
      </div>
    </div>
  );
}
