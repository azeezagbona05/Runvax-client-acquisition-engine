'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Users, CreditCard, TrendingUp, ShieldAlert } from 'lucide-react';
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
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'users' | 'payments'>('users');

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/admin/login'); return; }
    if (status !== 'authenticated') return;

    const isAdmin = (session?.user as { isAdmin?: boolean })?.isAdmin;
    if (!isAdmin) { router.replace('/admin/login'); return; }

    fetch('/api/admin/stats')
      .then((r) => {
        if (r.status === 403) { router.replace('/admin/login'); return null; }
        return r.json() as Promise<Stats>;
      })
      .then((data) => { if (data) setStats(data); })
      .catch(() => setError('Failed to load admin data'));
  }, [status, session, router]);

  if (error) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h1 className="text-xl font-black text-white mb-2">Access Denied</h1>
        <p className="text-gray-400 text-sm">{error}</p>
      </div>
    );
  }

  if (!stats) {
    return <div className="max-w-7xl mx-auto px-4 py-12 text-gray-500 text-sm">Loading admin data…</div>;
  }

  const { users, payments, totalRevenue, byPlan } = stats;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-black text-white mb-1">Admin Panel</h1>
        <p className="text-gray-500 text-sm">Logged in as {session?.user?.email}</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-gray-500 mb-2"><Users className="w-4 h-4" /><span className="text-xs font-semibold uppercase tracking-widest">Total Users</span></div>
          <div className="text-3xl font-black text-white">{users.length}</div>
        </div>
        <div className="bg-gray-900 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-gray-500 mb-2"><TrendingUp className="w-4 h-4 text-purple-400" /><span className="text-xs font-semibold uppercase tracking-widest">Paid Users</span></div>
          <div className="text-3xl font-black text-purple-400">{(byPlan.pro ?? 0) + (byPlan.agency ?? 0)}</div>
          <div className="text-xs text-gray-600 mt-1">{byPlan.pro ?? 0} Pro · {byPlan.agency ?? 0} Agency</div>
        </div>
        <div className="bg-gray-900 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-gray-500 mb-2"><CreditCard className="w-4 h-4 text-green-400" /><span className="text-xs font-semibold uppercase tracking-widest">Total Revenue</span></div>
          <div className="text-3xl font-black text-green-400">{formatPrice(Math.round(totalRevenue / 100))}</div>
          <div className="text-xs text-gray-600 mt-1">{payments.length} payments</div>
        </div>
        <div className="bg-gray-900 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-gray-500 mb-2"><Users className="w-4 h-4 text-gray-500" /><span className="text-xs font-semibold uppercase tracking-widest">Free Users</span></div>
          <div className="text-3xl font-black text-gray-400">{byPlan.free ?? 0}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/8 pb-0">
        {(['users', 'payments'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold capitalize border-b-2 transition-colors -mb-px ${
              tab === t ? 'border-purple-500 text-purple-400' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t}
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
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Verified</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Joined</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Expires</th>
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
                    <td className="px-4 py-3 text-gray-400">{u._count.prospects}</td>
                    <td className="px-4 py-3">
                      {u.emailVerified
                        ? <span className="text-green-400 text-xs font-semibold">✓ Yes</span>
                        : <span className="text-red-400 text-xs font-semibold">✗ No</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(u.createdAt).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {u.planExpiresAt ? new Date(u.planExpiresAt).toLocaleDateString('en-GB') : '—'}
                    </td>
                  </tr>
                ))}
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
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Ref</th>
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
                    <td className="px-4 py-3 font-bold text-green-400">{formatPrice(Math.round(p.amount / 100))}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold ${p.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{new Date(p.paidAt).toLocaleDateString('en-GB')}</td>
                    <td className="px-4 py-3 text-gray-700 text-xs font-mono truncate max-w-[120px]">{p.reference}</td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-600 text-sm">No payments yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
