'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Users, CreditCard, TrendingUp, ShieldCheck,
  LogOut, RefreshCw, Search, ChevronDown,
} from 'lucide-react';
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

const PLAN_OPTIONS = ['free', 'pro', 'agency'] as const;
type Plan = typeof PLAN_OPTIONS[number];

function monthLabel(iso: string) {
  return new Date(iso + '-01').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats]       = useState<Stats | null>(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<'users' | 'payments' | 'revenue'>('users');

  // Users filter state
  const [search, setSearch]         = useState('');
  const [planFilter, setPlanFilter] = useState<Plan | 'all'>('all');

  // Inline plan-change state: userId → loading
  const [planChanging, setPlanChanging] = useState<Record<string, boolean>>({});

  const isAdmin = (session?.user as { isAdmin?: boolean })?.isAdmin;

  const loadStats = () => {
    setLoading(true);
    fetch('/api/admin/stats')
      .then((r) => {
        if (r.status === 403) { router.replace('/admin/login'); return null; }
        return r.json() as Promise<Stats>;
      })
      .then((data) => { if (data) setStats(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (status === 'unauthenticated') { router.replace('/admin/login'); return; }
    if (status !== 'authenticated') return;
    if (!isAdmin) { router.replace('/admin/login'); return; }
    loadStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isAdmin]);

  // ── Manual plan change ───────────────────────────────────────────────────
  const handlePlanChange = async (userId: string, newPlan: Plan) => {
    setPlanChanging((p) => ({ ...p, [userId]: true }));
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: newPlan }),
      });
      if (res.ok) {
        setStats((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            users: prev.users.map((u) =>
              u.id === userId ? { ...u, plan: newPlan } : u
            ),
            byPlan: prev.users.reduce((acc, u) => {
              const p = u.id === userId ? newPlan : u.plan;
              acc[p] = (acc[p] ?? 0) + 1;
              return acc;
            }, {} as Record<string, number>),
          };
        });
      }
    } finally {
      setPlanChanging((p) => ({ ...p, [userId]: false }));
    }
  };

  // ── Filtered users ───────────────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    if (!stats) return [];
    return stats.users.filter((u) => {
      const matchesPlan = planFilter === 'all' || u.plan === planFilter;
      const q = search.toLowerCase();
      const matchesSearch = !q
        || (u.name ?? '').toLowerCase().includes(q)
        || (u.email ?? '').toLowerCase().includes(q);
      return matchesPlan && matchesSearch;
    });
  }, [stats, search, planFilter]);

  // ── Monthly revenue ──────────────────────────────────────────────────────
  const monthlyRevenue = useMemo(() => {
    if (!stats) return [];
    const byMonth: Record<string, { revenue: number; count: number; plans: Record<string, number> }> = {};
    for (const p of stats.payments) {
      const month = p.paidAt.slice(0, 7);
      if (!byMonth[month]) byMonth[month] = { revenue: 0, count: 0, plans: {} };
      byMonth[month].revenue += p.amount;
      byMonth[month].count  += 1;
      byMonth[month].plans[p.plan] = (byMonth[month].plans[p.plan] ?? 0) + 1;
    }
    return Object.entries(byMonth)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([month, data]) => ({ month, ...data }));
  }, [stats]);

  const maxMonthRevenue = useMemo(
    () => Math.max(...monthlyRevenue.map((m) => m.revenue), 1),
    [monthlyRevenue]
  );

  // Loading screen
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
      {/* Admin header */}
      <header className="sticky top-0 z-40 bg-gray-900/90 backdrop-blur border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-black text-white text-sm leading-none">Admin Panel</div>
            <div className="text-[11px] text-gray-500 mt-0.5 hidden sm:block">{session?.user?.email}</div>
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

        {/* Page title */}
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
          {([
            ['users',    `Users (${users.length})`],
            ['payments', `Payments (${payments.length})`],
            ['revenue',  'Revenue by Month'],
          ] as const).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px whitespace-nowrap ${
                tab === t
                  ? 'border-purple-500 text-purple-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── USERS TAB ── */}
        {tab === 'users' && (
          <div className="space-y-4">
            {/* Search + plan filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  className="w-full bg-gray-900 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50 transition-colors"
                />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {(['all', 'free', 'pro', 'agency'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlanFilter(p)}
                    className={`text-xs font-bold px-3 py-2 rounded-xl border transition-colors capitalize ${
                      planFilter === p
                        ? 'bg-purple-600/20 text-purple-300 border-purple-500/30'
                        : 'text-gray-500 border-white/8 hover:text-gray-300 hover:border-white/20'
                    }`}
                  >
                    {p === 'all' ? `All (${users.length})` : `${p} (${byPlan[p] ?? 0})`}
                  </button>
                ))}
              </div>
            </div>

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
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Change Plan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredUsers.map((u) => (
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
                            ? <span className="text-green-400 text-xs font-semibold">✓ Yes</span>
                            : <span className="text-red-400 text-xs font-semibold">✗ No</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {new Date(u.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {u.planExpiresAt
                            ? new Date(u.planExpiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="relative">
                            <select
                              value={u.plan}
                              disabled={planChanging[u.id]}
                              onChange={(e) => handlePlanChange(u.id, e.target.value as Plan)}
                              className="appearance-none text-xs font-bold bg-gray-800 border border-white/10 text-white rounded-lg pl-3 pr-7 py-1.5 focus:outline-none focus:border-purple-500/50 disabled:opacity-50 cursor-pointer hover:border-white/25 transition-colors"
                            >
                              {PLAN_OPTIONS.map((p) => (
                                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
                            {planChanging[u.id] && (
                              <RefreshCw className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-purple-400 animate-spin" />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-gray-600 text-sm">
                          {search || planFilter !== 'all' ? 'No users match your filters' : 'No users yet'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── PAYMENTS TAB ── */}
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
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          p.status === 'success'
                            ? 'text-green-400 bg-green-500/10'
                            : 'text-red-400 bg-red-500/10'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(p.paidAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-xs font-mono truncate max-w-[140px]">
                        {p.reference}
                      </td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-gray-600 text-sm">No payments yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── REVENUE TAB ── */}
        {tab === 'revenue' && (
          <div className="space-y-4">
            {monthlyRevenue.length === 0 ? (
              <div className="bg-gray-900 border border-white/10 rounded-2xl p-10 text-center text-gray-600 text-sm">
                No payments yet — revenue data will appear here once payments come in
              </div>
            ) : (
              <>
                {/* Bar chart */}
                <div className="bg-gray-900 border border-white/10 rounded-2xl p-6">
                  <h2 className="font-black text-white mb-6 text-sm">Monthly Revenue (₦)</h2>
                  <div className="space-y-3">
                    {monthlyRevenue.map((m) => {
                      const pct = Math.round((m.revenue / maxMonthRevenue) * 100);
                      return (
                        <div key={m.month}>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="text-gray-300 font-semibold w-20 flex-shrink-0">{monthLabel(m.month)}</span>
                            <div className="flex items-center gap-3 text-gray-500">
                              <span>{m.count} payment{m.count !== 1 ? 's' : ''}</span>
                              {Object.entries(m.plans).map(([plan, count]) => (
                                <span key={plan} className={`text-[10px] font-black px-1.5 py-0.5 rounded ${PLAN_BADGE[plan] ?? PLAN_BADGE.free}`}>
                                  {count}× {plan}
                                </span>
                              ))}
                              <span className="font-black text-green-400 w-24 text-right">
                                {formatPrice(Math.round(m.revenue / 100))}
                              </span>
                            </div>
                          </div>
                          <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-purple-500 to-green-500 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Monthly summary table */}
                <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/8 text-left">
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Month</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Payments</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Plans</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {monthlyRevenue.map((m) => (
                        <tr key={m.month} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 font-semibold text-white">{monthLabel(m.month)}</td>
                          <td className="px-4 py-3 text-gray-400">{m.count}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1 flex-wrap">
                              {Object.entries(m.plans).map(([plan, count]) => (
                                <span key={plan} className={`text-[10px] font-black px-2 py-0.5 rounded ${PLAN_BADGE[plan] ?? PLAN_BADGE.free}`}>
                                  {count}× {plan}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-black text-green-400">
                            {formatPrice(Math.round(m.revenue / 100))}
                          </td>
                        </tr>
                      ))}
                      {/* Total row */}
                      <tr className="bg-white/[0.02] border-t border-white/10">
                        <td className="px-4 py-3 font-black text-white">Total</td>
                        <td className="px-4 py-3 font-black text-white">{payments.length}</td>
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3 font-black text-green-400 text-base">
                          {formatPrice(Math.round(totalRevenue / 100))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
