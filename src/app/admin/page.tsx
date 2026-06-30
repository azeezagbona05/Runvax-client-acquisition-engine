'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Users, CreditCard, TrendingUp, ShieldCheck,
  LogOut, RefreshCw, Search, ChevronDown, SlidersHorizontal, Check,
  Infinity as InfinityIcon, Plus, Trash2, X, AlertTriangle,
} from 'lucide-react';
import { formatPrice } from '@/lib/scoring';
import { ALL_FEATURES, FEATURE_LABELS, FeatureId } from '@/lib/features';

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

interface PlanRow {
  planId: string;
  name: string;
  price: string | null;
  priceNote: string;
  searchesPerDay: number;
  resultsPerSearch: number;
  aiCallsPerDay: number;
  maxProspects: number;
  features: FeatureId[];
}

function FeatureToggles({ value, onChange }: { value: FeatureId[]; onChange: (v: FeatureId[]) => void }) {
  const toggle = (f: FeatureId) =>
    onChange(value.includes(f) ? value.filter((x) => x !== f) : [...value, f]);
  return (
    <div>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Features unlocked</p>
      <div className="space-y-1.5">
        {ALL_FEATURES.map((f) => {
          const on = value.includes(f);
          return (
            <button
              key={f}
              type="button"
              onClick={() => toggle(f)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-sm font-semibold text-left transition-colors ${
                on
                  ? 'bg-purple-600/15 border-purple-500/30 text-purple-200'
                  : 'bg-gray-800/50 border-white/8 text-gray-500 hover:border-white/20'
              }`}
            >
              <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${on ? 'bg-purple-600' : 'border border-white/20'}`}>
                {on && <Check className="w-3 h-3 text-white" />}
              </span>
              {FEATURE_LABELS[f]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const PLAN_META: Record<string, { color: string; border: string }> = {
  free:   { color: 'text-gray-300',   border: 'border-white/10' },
  pro:    { color: 'text-purple-300',  border: 'border-purple-500/30' },
  agency: { color: 'text-orange-300',  border: 'border-orange-500/30' },
};

function LimitField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const isUnlimited = value === -1;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-gray-400">{label}</label>
        <button
          type="button"
          onClick={() => onChange(isUnlimited ? 10 : -1)}
          className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
            isUnlimited ? 'bg-purple-600/20 text-purple-300 border-purple-500/30' : 'text-gray-600 border-white/10 hover:border-white/25'
          }`}
        >
          <InfinityIcon className="w-3 h-3" /> {isUnlimited ? 'Unlimited' : 'Set unlimited'}
        </button>
      </div>
      {isUnlimited ? (
        <div className="w-full bg-gray-800/50 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-purple-400 font-bold flex items-center gap-2">
          <InfinityIcon className="w-4 h-4" /> Unlimited
        </div>
      ) : (
        <input
          type="number" min={0} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-colors"
        />
      )}
    </div>
  );
}

function PlanCard({ row, onSaved, onDeleted }: { row: PlanRow; onSaved: (r: PlanRow) => void; onDeleted: () => void }) {
  const meta = PLAN_META[row.planId] ?? { color: 'text-gray-300', border: 'border-white/10' };
  const isFree = row.planId === 'free';

  const [fields, setFields] = useState({
    name:             row.name,
    price:            row.price ?? '',
    priceNote:        row.priceNote,
    searchesPerDay:   row.searchesPerDay,
    resultsPerSearch: row.resultsPerSearch,
    aiCallsPerDay:    row.aiCallsPerDay,
    maxProspects:     row.maxProspects,
    features:         row.features ?? [],
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState('');

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/plans/${row.planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...fields,
          price: fields.price.trim() || null,
        }),
      });
      if (res.ok) {
        onSaved({ ...row, ...fields, price: fields.price.trim() || null });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteErr('');
    try {
      const res = await fetch(`/api/admin/plans/${row.planId}`, { method: 'DELETE' });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setDeleteErr(data.error ?? 'Failed to delete'); return; }
      onDeleted();
    } finally { setDeleting(false); }
  };

  const setF = (k: keyof typeof fields) => (v: string | number) =>
    setFields((f) => ({ ...f, [k]: v }));

  return (
    <div className={`bg-gray-900 border rounded-2xl p-5 space-y-4 ${meta.border}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className={`text-[10px] font-black px-2 py-0.5 rounded ${PLAN_BADGE[row.planId] ?? 'bg-gray-700 text-gray-300'}`}>
            {row.planId.toUpperCase()}
          </span>
          <h3 className={`font-black text-base mt-1 ${meta.color}`}>{row.name || row.planId}</h3>
        </div>
        {!isFree && (
          <button
            onClick={() => { setConfirmDelete(true); setDeleteErr(''); }}
            title="Delete plan"
            className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2 text-red-400 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Users on this plan will be downgraded to Free.
          </div>
          {deleteErr && <p className="text-red-400 text-xs">{deleteErr}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-xs font-bold py-2 rounded-lg transition-colors"
            >
              {deleting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              {deleting ? 'Deleting…' : 'Confirm Delete'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-2 text-xs font-semibold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Name & price */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-400 block mb-1.5">Plan Name</label>
          <input
            value={fields.name}
            onChange={(e) => setF('name')(e.target.value)}
            className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
            placeholder="e.g. Starter"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-400 block mb-1.5">Price display</label>
          <input
            value={fields.price}
            onChange={(e) => setF('price')(e.target.value)}
            className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
            placeholder="₦9,999 or blank"
          />
        </div>
      </div>

      {/* Limits */}
      <LimitField label="Searches per day"   value={fields.searchesPerDay}   onChange={(v) => setF('searchesPerDay')(v)} />
      <LimitField label="Results per search"  value={fields.resultsPerSearch}  onChange={(v) => setF('resultsPerSearch')(v)} />
      <LimitField label="AI calls per day"    value={fields.aiCallsPerDay}    onChange={(v) => setF('aiCallsPerDay')(v)} />
      <LimitField label="Max saved prospects" value={fields.maxProspects}     onChange={(v) => setF('maxProspects')(v)} />

      <FeatureToggles value={fields.features} onChange={(v) => setFields((f) => ({ ...f, features: v }))} />

      <button
        onClick={handleSave}
        disabled={saving}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-colors ${
          saved
            ? 'bg-green-600/20 text-green-400 border border-green-500/30'
            : 'bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-60'
        }`}
      >
        {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</> : saved ? <><Check className="w-4 h-4" /> Saved!</> : 'Save Changes'}
      </button>
    </div>
  );
}

const EMPTY_PLAN = {
  planId: '', name: '', price: '', priceNote: 'per month',
  searchesPerDay: 5, resultsPerSearch: 20, aiCallsPerDay: 15, maxProspects: 30,
};

function CreatePlanModal({ onCreated, onClose }: { onCreated: (r: PlanRow) => void; onClose: () => void }) {
  const [fields, setFields] = useState(EMPTY_PLAN);
  const [features, setFeatures] = useState<FeatureId[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const setF = (k: keyof typeof EMPTY_PLAN) => (v: string | number) =>
    setFields((f) => ({ ...f, [k]: v }));

  // Auto-generate planId slug from name
  const handleNameChange = (v: string) => {
    setF('name')(v);
    setF('planId')(v.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!fields.planId) { setErr('Plan ID is required'); return; }
    if (!fields.name)   { setErr('Name is required'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...fields, price: fields.price.trim() || null, features }),
      });
      const data = await res.json() as PlanRow & { error?: string };
      if (!res.ok) { setErr(data.error ?? 'Failed to create plan'); return; }
      onCreated(data);
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 sticky top-0 bg-gray-900">
          <h2 className="font-black text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-purple-400" /> Create New Plan
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-500 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {err && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
              {err}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-400 block mb-1.5">Plan Name *</label>
              <input
                required value={fields.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Starter"
                className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 block mb-1.5">Plan ID (slug) *</label>
              <input
                required value={fields.planId}
                onChange={(e) => setF('planId')(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                placeholder="e.g. starter"
                className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-purple-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-400 block mb-1.5">Price (display)</label>
              <input
                value={fields.price}
                onChange={(e) => setF('price')(e.target.value)}
                placeholder="₦4,999 or blank"
                className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 block mb-1.5">Price note</label>
              <input
                value={fields.priceNote}
                onChange={(e) => setF('priceNote')(e.target.value)}
                placeholder="per month"
                className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/50"
              />
            </div>
          </div>

          <div className="border-t border-white/8 pt-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Limits</p>
            <LimitField label="Searches per day"   value={fields.searchesPerDay}   onChange={(v) => setF('searchesPerDay')(v)} />
            <LimitField label="Results per search"  value={fields.resultsPerSearch}  onChange={(v) => setF('resultsPerSearch')(v)} />
            <LimitField label="AI calls per day"    value={fields.aiCallsPerDay}    onChange={(v) => setF('aiCallsPerDay')(v)} />
            <LimitField label="Max saved prospects" value={fields.maxProspects}     onChange={(v) => setF('maxProspects')(v)} />
          </div>

          <div className="border-t border-white/8 pt-4">
            <FeatureToggles value={features} onChange={setFeatures} />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
            >
              {saving ? <><RefreshCw className="w-4 h-4 animate-spin" /> Creating…</> : <><Plus className="w-4 h-4" /> Create Plan</>}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function monthLabel(iso: string) {
  return new Date(iso + '-01').toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats]       = useState<Stats | null>(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<'users' | 'payments' | 'revenue' | 'plans'>('users');

  // Users filter state
  const [search, setSearch]         = useState('');
  const [planFilter, setPlanFilter] = useState<Plan | 'all'>('all');

  // Plan config state
  const [planRows, setPlanRows] = useState<PlanRow[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    setPlansError('');
    try {
      const res = await fetch('/api/admin/plans');
      const data = await res.json() as PlanRow[] | { error: string };
      if (!res.ok || !Array.isArray(data)) {
        setPlansError((data as { error?: string }).error ?? `HTTP ${res.status}`);
        return;
      }
      setPlanRows(data);
    } catch (e) {
      setPlansError(String(e));
    } finally {
      setPlansLoading(false);
    }
  }, []);

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
    loadPlans();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isAdmin, loadPlans]);

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
        <div className="flex gap-1 border-b border-white/8 overflow-x-auto">
          {([
            ['users',    `Users (${users.length})`],
            ['payments', `Payments (${payments.length})`],
            ['revenue',  'Revenue by Month'],
            ['plans',    'Plan Limits'],
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

        {/* ── PLANS TAB ── */}
        {tab === 'plans' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-black text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-purple-400" /> Plan Management
                </h2>
                <p className="text-gray-500 text-sm mt-0.5">
                  Changes take effect within 60 seconds (server cache TTL).
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-1.5 text-xs text-white bg-purple-600 hover:bg-purple-500 px-3 py-2 rounded-xl transition-colors font-bold"
                >
                  <Plus className="w-3.5 h-3.5" /> New Plan
                </button>
                <button
                  onClick={loadPlans}
                  disabled={plansLoading}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${plansLoading ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>
            </div>

            {showCreateModal && (
              <CreatePlanModal
                onCreated={(row) => {
                  setPlanRows((prev) => [...prev, row]);
                  setShowCreateModal(false);
                }}
                onClose={() => setShowCreateModal(false)}
              />
            )}

            {plansError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Failed to load plans: {plansError}
              </div>
            )}

            {plansLoading && planRows.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw className="w-5 h-5 text-purple-400 animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {planRows.map((row) => (
                  <PlanCard
                    key={row.planId}
                    row={row}
                    onSaved={(updated) =>
                      setPlanRows((prev) => prev.map((r) => (r.planId === row.planId ? updated : r)))
                    }
                    onDeleted={() =>
                      setPlanRows((prev) => prev.filter((r) => r.planId !== row.planId))
                    }
                  />
                ))}
              </div>
            )}

            <div className="bg-gray-900/50 border border-white/8 rounded-xl p-4 text-xs text-gray-500 space-y-1">
              <p><strong className="text-gray-400">-1</strong> = unlimited in DB. Use the ∞ toggle to set a field as unlimited.</p>
              <p>The <strong className="text-gray-400">Free</strong> plan cannot be deleted — it is the system default.</p>
              <p>Deleting a plan will downgrade all users on it to Free.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
