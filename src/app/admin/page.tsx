'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Users, CreditCard, TrendingUp, ShieldCheck, LogOut, RefreshCw } from 'lucide-react';
import { formatPrice } from '@/lib/scoring';

interface AdminUser {
  id: string; name: string | null; email: string | null; plan: string;
  createdAt: string; emailVerified: string | null; planExpiresAt: string | null;
  _count: { prospects: number };
}

interface AdminPayment {
  id: string; reference: string; plan: string; amount: number;
  status: string; paidAt: string;
  user: { name: string | null; email: string | null };
}

interface Stats {
  users: AdminUser[];
  payments: AdminPayment[];
  totalRevenue: number;
  byPlan: Record<string, number>;
}

const PLAN_BADGE: Record<string, string> = {
  free:   'bg-gray-700 text-gray-300',
  pro:    'bg-purple-600 text-white',
  agency: 'bg-orange-500 text-white',
};

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]       = useState<'users' | 'payments'>('users');

  const isAdmin = (session?.user as { isAdmin?: boolean })?.isAdmin;

  const loadStats = () => {
    setLoading(true);
    fetch('/api/admin/stats')
      .then((r) => {
        if (r.status === 403) { router.replace('/admin/login'); return null; }
        return r.json() as Promise<Stats>;
      })
      .then((data) => { if (data) setStats(data); })
      .catch(() => {/* silent — handled by null stats */})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/admin/login'); return; }
    if (status !== 'authenticated') return;
    if (!isAdmin) { router.replace('/admin/login'); return; }
    loadStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isAdmin]);

  // Show loading spinner while session or data is loading
  if (status === 'loading' || (status === 'authenticated' && isAdmin && loading && !stats)) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <RefreshCw className="w-6 h-6 text-purple-400 animate-spin mx-auto" />
          <p className="text-gray-500 text-sm">Loading admin panel…</p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const { users, payments, totalRevenue, byPlan } = stats;

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Admin-specific header — replaces main Nav on this page */}
      <header className="sticky top-0 z-40 bg-gray-900/90 backdrop-blur border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-black text-white text-sm leading-none">Admin Panel</div>
            <div className="text-[11px] text-gray-500 mt-0.5 hidden sm:block">
              {session?.user?.email}
            </div>
          </div>
          <a href="/" className="text-xs text-gray-500 hover:text-gray-300 transition-colors hidden sm:block">
            ← Back to app
          </a>
          <button
            onClick={() => signOut({ callbackUrl: '/admin/login' })}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-400 bg-white/5 hover:bg-red-500/10 border border-white/10 px-3 py-2 rounded-xl transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">

        {/* Page title + refresh */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white mb-1">Overview</h1>
            <p className="text-gray-500 text-sm">All users, plans, and revenue</p>
          </div>
          <button
            onClick={loadStats}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <Users className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-widest">Total Users</span>
            </div>
            <div className="text-3xl font-black text-white">{users.length}</div>
          </div>
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-semibold uppercase tracking-widest">Paid</span>
            </div>
            <div className="text-3xl font-black text-purple-400">
              {(byPlan.pro ?? 0) + (byPlan.agency ?? 0)}
            </div>
            <div className="text-xs text-gray-600 mt-1">{byPlan.pro ?? 0} Pro · {byPlan.agency ?? 0} Agency</div>
          </div>
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <CreditCard className="w-4 h-4 text-green-400" />
              <span className="text-xs font-semibold uppercase tracking-widest">Revenue</span>
            </div>
            <div className="text-3xl font-black text-green-400">
              {formatPrice(Math.round(totalRevenue / 100))}
            </div>
            <div className="text-xs text-gray-600 mt-1">{payments.length} payments</div>
          </div>
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-gray-500 mb-2">
              <Users className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-widest">Free</span>
            </div>
            <div className="text-3xl font-black text-gray-400">{byPlan.free ?? 0}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-white/8">
          {(['users', 'payments'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold capitalize border-b-2 transition-colors -mb-px ${
                tab === t
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {t === 'users' ? `Users (${users.length})` : `Payments (${payments.length})`}
            </button>
          ))}
        </div>

        {/* Users table */}
        {tab === 'users' && (
          <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">User</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Plan</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Prospects</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Email Verified</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Joined</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Plan Expires</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{u.name ?? '—'}</div>
                        <div className="text-xs text-gray-500">{u.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded ${PLAN_BADGE[u.plan] ?? PLAN_BADGE.free}`}>
                          {u.plan.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 font-semibold">{u._count.prospects}</td>
                      <td className="px-4 py-3">
                        {u.emailVerified
                          ? <span className="text-green-400 text-xs font-semibold">✓ Verified</span>
                          : <span className="text-red-400 text-xs font-semibold">✗ Unverified</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(u.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {u.planExpiresAt
                          ? new Date(u.planExpiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-600 text-sm">No users yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Payments table */}
        {tab === 'payments' && (
          <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8 text-left">
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">User</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Plan</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Amount</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Date</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {payments.map((p) => (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{p.user.name ?? '—'}</div>
                        <div className="text-xs text-gray-500">{p.user.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded ${PLAN_BADGE[p.plan] ?? PLAN_BADGE.free}`}>
                          {p.plan.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-green-400">
                        {formatPrice(Math.round(p.amount / 100))}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${p.status === 'success' ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(p.paidAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-xs font-mono truncate max-w-[140px]">
                        {p.reference}
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-600 text-sm">No payments yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
