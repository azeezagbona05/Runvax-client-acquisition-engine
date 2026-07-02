'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Users, CreditCard, TrendingUp, ShieldCheck,
  LogOut, RefreshCw, Search, ChevronDown, SlidersHorizontal, Check,
  Infinity as InfinityIcon, Plus, Trash2, X, AlertTriangle,
  MapPin, Activity, Ban, Save, ShieldOff,
} from 'lucide-react';
import { formatPrice } from '@/lib/scoring';
import BehaviorPanel from './BehaviorPanel';
import { ALL_FEATURES, FEATURE_LABELS, FeatureId } from '@/lib/features';
import { AREAS, TIER_CONFIG } from '@/lib/areas';

interface SearchActivity {
  industry: string; location: string; totalCount: number;
  noWebsiteCount: number; searchedAt: string;
}

interface AdminUser {
  id: string; name: string | null; email: string | null; plan: string;
  createdAt: string; emailVerified: string | null; planExpiresAt: string | null;
  searchLimitOverride: number | null;
  blockedLocations: string | null;
  blockedCountries: string | null;
  registrationIp: string | null;
  lastSeenIp: string | null;
  isSuspended: boolean;
  searchHistory: SearchActivity[];
  _count: { prospects: number };
}

interface AdminPayment {
  id: string; reference: string; plan: string; amount: number;
  status: string; paidAt: string;
  user: { name: string | null; email: string | null };
}

interface UserCost {
  aiCalls: number;
  searchCount: number;
  openaiInputTokens: number;
  openaiOutputTokens: number;
  geminiInputTokens: number;
  geminiOutputTokens: number;
  googlePlacesReqs: number;
  openaiCostUsd: number;
  geminiCostUsd: number;
  googleCostUsd: number;
  totalCostUsd: number;
}

interface Stats {
  users: AdminUser[];
  payments: AdminPayment[];
  totalRevenue: number;
  byPlan: Record<string, number>;
  costByUser: Record<string, UserCost>;
  costSince: string;
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
  allowedLocations?: string[] | null;
  allowedCountries?: string[] | null;
}

function FeatureToggles({ value, onChange }: { value: FeatureId[]; onChange: (v: FeatureId[]) => void }) {
  const toggle = (f: FeatureId) =>
    onChange(value.includes(f) ? value.filter((x) => x !== f) : [...value, f]);
  return (
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Features unlocked</p>
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
                  : 'bg-white/[0.03] border-white/8 text-gray-300 hover:border-white/20 hover:bg-white/[0.06]'
              }`}
            >
              <span className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${on ? 'bg-purple-600' : 'bg-white/10 border border-white/20'}`}>
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
            isUnlimited ? 'bg-purple-600/15 text-purple-300 border-purple-500/30' : 'text-gray-400 border-white/15 hover:border-white/30'
          }`}
        >
          <InfinityIcon className="w-3 h-3" /> {isUnlimited ? 'Unlimited' : 'Set unlimited'}
        </button>
      </div>
      {isUnlimited ? (
        <div className="w-full bg-purple-600/10 border border-purple-500/25 rounded-xl px-4 py-2.5 text-sm text-purple-300 font-bold flex items-center gap-2">
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

function LocationTagInput({
  label, values, onChange, placeholder, variant = 'block',
}: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string; variant?: 'block' | 'allow' }) {
  const [input, setInput] = useState('');
  const [showSug, setShowSug] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const matched = input.trim()
    ? AREAS.filter(
        (a) =>
          (a.name.toLowerCase().includes(input.toLowerCase()) ||
           a.city.toLowerCase().includes(input.toLowerCase())) &&
          !values.includes(a.name)
      )
    : [];

  const grouped = (['high', 'mid', 'budget'] as const)
    .map((tier) => ({ tier, areas: matched.filter((a) => a.tier === tier).slice(0, 5) }))
    .filter((g) => g.areas.length > 0);

  const addValue = (v: string) => {
    const trimmed = v.trim();
    if (trimmed && !values.includes(trimmed)) onChange([...values, trimmed]);
    setInput('');
    setShowSug(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); addValue(input); }
    if (e.key === 'Escape') setShowSug(false);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShowSug(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const tagCls = variant === 'allow'
    ? 'bg-green-500/15 text-green-300 border-green-500/20'
    : 'bg-red-500/15 text-red-300 border-red-500/20';
  const icon = variant === 'allow'
    ? <MapPin className="w-3 h-3" />
    : <Ban className="w-3 h-3" />;

  return (
    <div ref={wrapRef}>
      <p className="text-xs font-bold text-gray-400 mb-1.5">{label}</p>
      <div className="relative flex gap-2 mb-2">
        <div className="relative flex-1">
          <input
            value={input}
            onChange={(e) => { setInput(e.target.value); setShowSug(true); }}
            onFocus={() => { if (input.trim()) setShowSug(true); }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
          />
          {showSug && grouped.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-gray-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
              {grouped.map(({ tier, areas }) => (
                <div key={tier}>
                  <div className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border-b border-white/5 ${TIER_CONFIG[tier].color} bg-white/[0.02]`}>
                    {TIER_CONFIG[tier].label}
                  </div>
                  {areas.map((area) => (
                    <button
                      key={area.name}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); addValue(area.name); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-purple-600/20 transition-colors border-b border-white/5 last:border-0 flex items-start justify-between gap-3"
                    >
                      <div>
                        <div className="text-sm text-gray-200 font-medium">{area.name}</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{area.note}</div>
                      </div>
                      <span className={`flex-shrink-0 w-2 h-2 rounded-full mt-1.5 ${TIER_CONFIG[tier].dot}`} />
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
        <button type="button" onClick={() => addValue(input)}
          className="px-3 py-2 bg-purple-600/20 border border-purple-500/30 text-purple-300 text-xs font-bold rounded-xl hover:bg-purple-600/30 transition-colors">
          Add
        </button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span key={v} className={`flex items-center gap-1 text-xs border px-2.5 py-1 rounded-full font-semibold ${tagCls}`}>
              {icon} {v}
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))}
                className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function UserRestrictionsPanel({ user, onUpdated, duplicateIp }: {
  user: AdminUser;
  onUpdated: (u: Partial<AdminUser>) => void;
  duplicateIp: boolean;
}) {
  const parse = (raw: string | null) => { try { return raw ? JSON.parse(raw) as string[] : []; } catch { return []; } };

  const [searchLimit, setSearchLimit] = useState<string>(
    user.searchLimitOverride != null ? String(user.searchLimitOverride) : ''
  );
  const [blockedLocs, setBlockedLocs] = useState<string[]>(parse(user.blockedLocations));
  const [blockedCountries, setBlockedCountries] = useState<string[]>(parse(user.blockedCountries));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [suspending, setSuspending] = useState(false);

  const toggleSuspend = async () => {
    setSuspending(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSuspended: !user.isSuspended }),
      });
      if (res.ok) onUpdated({ isSuspended: !user.isSuspended });
    } finally { setSuspending(false); }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchLimitOverride: searchLimit === '' ? null : Number(searchLimit),
          blockedLocations: blockedLocs,
          blockedCountries,
        }),
      });
      if (res.ok) {
        onUpdated({
          searchLimitOverride: searchLimit === '' ? null : Number(searchLimit),
          blockedLocations: blockedLocs.length ? JSON.stringify(blockedLocs) : null,
          blockedCountries: blockedCountries.length ? JSON.stringify(blockedCountries) : null,
        });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-gray-950 border-t border-white/8 px-4 py-4 space-y-4">

      {/* IP addresses + suspend toggle */}
      <div className="flex flex-wrap gap-3 items-start justify-between">
        <div className="flex flex-wrap gap-3 items-start">
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Registration IP</p>
            <span className={`text-xs font-mono px-2.5 py-1 rounded-lg border ${duplicateIp ? 'bg-red-500/15 text-red-300 border-red-500/25' : 'bg-white/[0.04] text-gray-300 border-white/8'}`}>
              {user.registrationIp ?? '—'}
              {duplicateIp && <span className="ml-1.5 text-red-400 font-bold">⚠ duplicate</span>}
            </span>
          </div>
          {user.lastSeenIp && user.lastSeenIp !== user.registrationIp && (
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Last Seen IP</p>
              <span className="text-xs font-mono px-2.5 py-1 rounded-lg border bg-white/[0.04] text-gray-300 border-white/8">
                {user.lastSeenIp}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={toggleSuspend}
          disabled={suspending}
          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition-colors disabled:opacity-60 ${
            user.isSuspended
              ? 'bg-green-500/15 text-green-300 border-green-500/25 hover:bg-green-500/25'
              : 'bg-red-500/15 text-red-300 border-red-500/25 hover:bg-red-500/25'
          }`}
        >
          {suspending
            ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            : user.isSuspended ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
          {user.isSuspended ? 'Unsuspend Account' : 'Suspend Account'}
        </button>
      </div>

      {/* Search activity */}
      {user.searchHistory.length > 0 ? (
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Activity className="w-3 h-3" /> Search Activity
          </p>
          <div className="flex flex-wrap gap-1.5">
            {user.searchHistory.map((h, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/[0.04] border border-white/8 rounded-xl text-xs">
                <span className="text-white font-semibold">{h.industry}</span>
                <span className="text-gray-500">·</span>
                <span className="text-gray-400">{h.location.split(',')[0]}</span>
                <span className="text-gray-500 text-[10px]">×{h.totalCount}</span>
                {h.noWebsiteCount > 0 && (
                  <span className="text-orange-400 text-[10px] font-bold">{h.noWebsiteCount}🎯</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-400 flex items-center gap-1.5">
          <Activity className="w-3 h-3" /> No searches yet
        </p>
      )}

      {/* Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-white/5">
        <div>
          <label className="text-xs font-bold text-gray-400 block mb-1.5">
            Daily Limit Override
            <span className="text-gray-600 font-normal ml-1">(blank = plan default)</span>
          </label>
          <input
            type="number" min={0} value={searchLimit}
            onChange={(e) => setSearchLimit(e.target.value)}
            placeholder="e.g. 3"
            className="w-full bg-gray-800 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
          />
        </div>

        <LocationTagInput
          label="Blocked Locations"
          values={blockedLocs}
          onChange={setBlockedLocs}
          placeholder="e.g. Lagos, Lekki…"
        />

        <LocationTagInput
          label="Blocked Countries"
          values={blockedCountries}
          onChange={setBlockedCountries}
          placeholder="e.g. NG, GH, KE…"
        />
      </div>

      <div className="flex justify-end">
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors">
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
          {saved ? 'Saved' : 'Save Restrictions'}
        </button>
      </div>
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
  const [allowedLocations, setAllowedLocations] = useState<string[]>(row.allowedLocations ?? []);
  const [allowedCountries, setAllowedCountries] = useState<string[]>(row.allowedCountries ?? []);
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
          allowedLocations,
          allowedCountries,
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

      <div className="border-t border-white/8 pt-4">
        <LocationTagInput
          label="Allowed Locations (whitelist — blank = all allowed)"
          values={allowedLocations}
          onChange={setAllowedLocations}
          placeholder="e.g. Lagos, Accra, London…"
          variant="allow"
        />
        <LocationTagInput
          label="Allowed Countries (whitelist — blank = all allowed)"
          values={allowedCountries}
          onChange={setAllowedCountries}
          placeholder="e.g. NG, GH, KE, ZA…"
          variant="allow"
        />
      </div>

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

// ── Bot-risk scoring (client-side heuristics) ────────────────────────────────
function botScore(u: AdminUser): number {
  let score = 0;
  const name = u.name ?? '';
  // Garbled name: no spaces, long, very low vowel ratio (random chars)
  if (name.length > 10 && !name.includes(' ')) {
    const vowels = (name.match(/[aeiouAEIOU]/g) ?? []).length;
    if (vowels / name.length < 0.25) score += 3;
    else score += 1;
  }
  // Email local part looks generated: many dots or long digit runs
  const local = (u.email ?? '').split('@')[0];
  if ((local.match(/\./g) ?? []).length >= 3) score += 2;
  if (/\d{4,}/.test(local)) score += 1;
  // Unverified email
  if (!u.emailVerified) score += 1;
  // Zero activity
  if (u._count.prospects === 0 && u.searchHistory.length === 0) score += 1;
  // Duplicate IP
  return score;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats]       = useState<Stats | null>(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<'users' | 'behaviour' | 'payments' | 'revenue' | 'plans' | 'costs'>('users');
  const [costSince, setCostSince] = useState(() => new Date().toISOString().split('T')[0]);

  // Users filter state
  const [search, setSearch]         = useState('');
  const [planFilter, setPlanFilter] = useState<Plan | 'all' | 'suspicious'>('all');

  // API Costs filter state
  const [costsSearch, setCostsSearch]     = useState('');
  const [costsPlan, setCostsPlan]         = useState<Plan | 'all'>('all');
  const [costsSort, setCostsSort]         = useState<'cost' | 'searches' | 'ai'>('cost');

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
  // Expanded user rows for restrictions panel
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const isAdmin = (session?.user as { isAdmin?: boolean })?.isAdmin;

  const loadStats = (since?: string) => {
    setLoading(true);
    const date = since ?? costSince;
    fetch(`/api/admin/stats?costSince=${date}`)
      .then((r) => {
        if (r.status === 403) { router.replace('/admin/login'); return null; }
        return r.json() as Promise<Stats>;
      })
      .then((data) => { if (data) setStats(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  // Admin panel must always render in dark mode regardless of user theme preference
  useEffect(() => {
    const html = document.documentElement;
    const wasLight = html.classList.contains('light');
    html.classList.remove('light');
    html.classList.add('dark');
    return () => {
      html.classList.remove('dark');
      if (wasLight) html.classList.add('light');
    };
  }, []);

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
      if (planFilter === 'suspicious') return botScore(u) >= 4;
      const matchesPlan = planFilter === 'all' || u.plan === planFilter;
      const q = search.toLowerCase();
      const matchesSearch = !q
        || (u.name ?? '').toLowerCase().includes(q)
        || (u.email ?? '').toLowerCase().includes(q);
      return matchesPlan && matchesSearch;
    });
  }, [stats, search, planFilter]);

  const suspiciousCount = useMemo(
    () => (stats?.users ?? []).filter((u) => botScore(u) >= 4).length,
    [stats]
  );

  // IPs that appear on more than one account — flags potential multi-registration
  const duplicateIpSet = useMemo(() => {
    if (!stats) return new Set<string>();
    const ipCount: Record<string, number> = {};
    for (const u of stats.users) {
      if (u.registrationIp) ipCount[u.registrationIp] = (ipCount[u.registrationIp] ?? 0) + 1;
    }
    return new Set(Object.entries(ipCount).filter(([, n]) => n > 1).map(([ip]) => ip));
  }, [stats]);

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
            onClick={() => loadStats()}
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
            ['behaviour', 'Behaviour'],
            ['payments', `Payments (${payments.length})`],
            ['revenue',  'Revenue by Month'],
            ['plans',    'Plan Limits'],
            ['costs',    'API Costs'],
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

        {/* ── BEHAVIOUR TAB ── */}
        {tab === 'behaviour' && <BehaviorPanel />}

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
                {suspiciousCount > 0 && (
                  <button
                    onClick={() => setPlanFilter('suspicious')}
                    className={`text-xs font-bold px-3 py-2 rounded-xl border transition-colors ${
                      planFilter === 'suspicious'
                        ? 'bg-red-500/20 text-red-300 border-red-500/30'
                        : 'text-red-400 border-red-500/20 hover:bg-red-500/10'
                    }`}
                  >
                    🤖 Suspicious ({suspiciousCount})
                  </button>
                )}
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
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-widest">Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => {
                      const isExpanded = expandedUser === u.id;
                      const hasRestrictions = u.searchLimitOverride != null || !!u.blockedLocations || u.isSuspended;
                      const risk = botScore(u);
                      const isDupIp = !!(u.registrationIp && duplicateIpSet.has(u.registrationIp));
                      return (
                        <>
                          <tr key={u.id} className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${isExpanded ? 'bg-white/[0.03]' : ''} ${u.isSuspended ? 'bg-red-500/[0.04]' : risk >= 4 ? 'bg-orange-500/[0.03]' : ''}`}>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-white flex items-center gap-1.5 flex-wrap">
                                {u.name ?? '—'}
                                {u.isSuspended && (
                                  <span className="flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                                    <ShieldOff className="w-2.5 h-2.5" /> SUSPENDED
                                  </span>
                                )}
                                {risk >= 6 && !u.isSuspended && (
                                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">🤖 HIGH RISK</span>
                                )}
                                {risk >= 4 && risk < 6 && !u.isSuspended && (
                                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/20">⚠ SUSPICIOUS</span>
                                )}
                                {isDupIp && !u.isSuspended && (
                                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">⚡ DUP IP</span>
                                )}
                              </div>
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
                            <td className="px-4 py-3">
                              <button
                                onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                                className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-xl border transition-colors ${
                                  isExpanded
                                    ? 'bg-purple-600/20 text-purple-300 border-purple-500/30'
                                    : hasRestrictions
                                    ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                                    : 'bg-white/5 text-gray-500 border-white/10 hover:text-white hover:bg-white/10'
                                }`}
                              >
                                {hasRestrictions ? <Ban className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
                                {u.searchHistory.length > 0 ? u.searchHistory.length : '—'}
                                <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </button>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${u.id}-expand`} className="border-b border-white/5">
                              <td colSpan={8} className="p-0">
                                <UserRestrictionsPanel
                                  user={u}
                                  duplicateIp={isDupIp}
                                  onUpdated={(updates) => {
                                    setStats((prev) => {
                                      if (!prev) return prev;
                                      return {
                                        ...prev,
                                        users: prev.users.map((x) =>
                                          x.id === u.id ? { ...x, ...updates } : x
                                        ),
                                      };
                                    });
                                  }}
                                />
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-gray-600 text-sm">
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

        {/* ── API COSTS TAB ── */}
        {tab === 'costs' && (() => {
          const costByUser = stats.costByUser ?? {};
          const allRows = users.map((u) => ({
            user: u,
            cost: costByUser[u.id] ?? {
              aiCalls: 0, searchCount: 0,
              openaiInputTokens: 0, openaiOutputTokens: 0,
              geminiInputTokens: 0, geminiOutputTokens: 0,
              googlePlacesReqs: 0,
              openaiCostUsd: 0, geminiCostUsd: 0, googleCostUsd: 0, totalCostUsd: 0,
            },
          }));

          const rows = allRows
            .filter((r) => {
              const q = costsSearch.toLowerCase();
              const matchSearch = !q
                || (r.user.name ?? '').toLowerCase().includes(q)
                || (r.user.email ?? '').toLowerCase().includes(q);
              const matchPlan = costsPlan === 'all' || r.user.plan === costsPlan;
              return matchSearch && matchPlan;
            })
            .sort((a, b) => {
              if (costsSort === 'searches') return b.cost.searchCount - a.cost.searchCount;
              if (costsSort === 'ai') return b.cost.aiCalls - a.cost.aiCalls;
              return b.cost.totalCostUsd - a.cost.totalCostUsd;
            });

          const grandTotal = allRows.reduce((s, r) => s + r.cost.totalCostUsd, 0);
          const totalOpenai = allRows.reduce((s, r) => s + r.cost.openaiCostUsd, 0);
          const totalGemini = allRows.reduce((s, r) => s + r.cost.geminiCostUsd, 0);
          const totalGoogle = allRows.reduce((s, r) => s + r.cost.googleCostUsd, 0);

          const fmt = (n: number) => `$${n.toFixed(4)}`;
          const fmtBig = (n: number) => `$${n.toFixed(2)}`;

          return (
            <div className="space-y-4">
              {/* Filters row */}
              <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
                {/* Date */}
                <div className="flex items-center gap-2 bg-gray-900 border border-white/10 rounded-xl px-3 py-2">
                  <span className="text-xs text-gray-500 whitespace-nowrap">From</span>
                  <input
                    type="date"
                    value={costSince}
                    onChange={(e) => { setCostSince(e.target.value); loadStats(e.target.value); }}
                    className="bg-transparent text-sm text-white focus:outline-none"
                  />
                </div>
                {/* Search */}
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                  <input
                    type="text"
                    value={costsSearch}
                    onChange={(e) => setCostsSearch(e.target.value)}
                    placeholder="Search user…"
                    className="w-full bg-gray-900 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
                  />
                </div>
                {/* Plan filter */}
                <div className="flex gap-1.5 flex-wrap items-center">
                  {(['all', 'free', 'pro', 'agency'] as const).map((p) => (
                    <button key={p} onClick={() => setCostsPlan(p)}
                      className={`text-xs font-bold px-3 py-2 rounded-xl border capitalize transition-colors ${
                        costsPlan === p ? 'bg-purple-600/20 text-purple-300 border-purple-500/30' : 'text-gray-500 border-white/8 hover:text-gray-300 hover:border-white/20'
                      }`}>
                      {p}
                    </button>
                  ))}
                </div>
                {/* Sort */}
                <div className="flex gap-1.5 items-center">
                  <span className="text-xs text-gray-600">Sort:</span>
                  {([['cost', 'Total $'], ['searches', 'Searches'], ['ai', 'AI calls']] as const).map(([val, label]) => (
                    <button key={val} onClick={() => setCostsSort(val)}
                      className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-colors ${
                        costsSort === val ? 'bg-purple-600/20 text-purple-300 border-purple-500/30' : 'text-gray-500 border-white/8 hover:text-gray-300'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cost summary cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Total API Cost', value: fmtBig(grandTotal), color: 'text-red-400' },
                  { label: 'OpenAI (GPT-4o)', value: fmtBig(totalOpenai), color: 'text-blue-400' },
                  { label: 'Gemini Flash', value: fmtBig(totalGemini), color: 'text-green-400' },
                  { label: 'Google Places', value: fmtBig(totalGoogle), color: 'text-yellow-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-gray-900 border border-white/8 rounded-xl p-4">
                    <p className="text-xs text-gray-500 mb-1">{label}</p>
                    <p className={`text-2xl font-black ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Pricing reference */}
              <div className="bg-gray-900/50 border border-white/8 rounded-xl p-3 text-xs text-gray-500 flex flex-wrap gap-4">
                <span>GPT-4o: <strong className="text-gray-400">$2.50/1M input · $10.00/1M output</strong></span>
                <span>Gemini Flash: <strong className="text-gray-400">$0.10/1M input · $0.40/1M output</strong></span>
                <span>Google Places: <strong className="text-gray-400">$0.032/request</strong></span>
                <span className="text-gray-600">Token tracking starts from now — historical calls show $0.00</span>
              </div>

              {/* Per-user cost table */}
              <div className="bg-gray-900 border border-white/8 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/8 text-left">
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500">User</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500">Plan</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right">AI Calls</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right">Searches</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right">OpenAI tokens</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right">OpenAI cost</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right">Gemini tokens</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right">Gemini cost</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right">Places reqs</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right">Places cost</th>
                        <th className="px-4 py-3 text-xs font-semibold text-gray-500 text-right">Total cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(({ user: u, cost: c }) => {
                        const openaiTokens = c.openaiInputTokens + c.openaiOutputTokens;
                        const geminiTokens = c.geminiInputTokens + c.geminiOutputTokens;
                        return (
                          <tr key={u.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                            <td className="px-4 py-3">
                              <p className="text-white font-medium truncate max-w-[180px]">{u.name || u.email}</p>
                              {u.name && <p className="text-xs text-gray-600 truncate max-w-[180px]">{u.email}</p>}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${PLAN_BADGE[u.plan] ?? 'bg-gray-700 text-gray-300'}`}>
                                {u.plan}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-gray-400">{c.aiCalls.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-gray-400">{c.searchCount.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right text-gray-400">{openaiTokens.toLocaleString()}</td>
                            <td className={`px-4 py-3 text-right font-mono text-xs ${c.openaiCostUsd > 0.01 ? 'text-orange-400' : 'text-gray-500'}`}>
                              {fmt(c.openaiCostUsd)}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-400">{geminiTokens.toLocaleString()}</td>
                            <td className={`px-4 py-3 text-right font-mono text-xs ${c.geminiCostUsd > 0.001 ? 'text-yellow-400' : 'text-gray-500'}`}>
                              {fmt(c.geminiCostUsd)}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-400">{c.googlePlacesReqs.toLocaleString()}</td>
                            <td className={`px-4 py-3 text-right font-mono text-xs ${c.googleCostUsd > 0.05 ? 'text-yellow-400' : 'text-gray-500'}`}>
                              {fmt(c.googleCostUsd)}
                            </td>
                            <td className={`px-4 py-3 text-right font-mono text-sm font-bold ${c.totalCostUsd > 0.5 ? 'text-red-400' : c.totalCostUsd > 0.1 ? 'text-orange-400' : 'text-gray-400'}`}>
                              {fmtBig(c.totalCostUsd)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-white/10 bg-white/[0.02]">
                        <td className="px-4 py-3 text-xs font-bold text-gray-400" colSpan={5}>TOTAL</td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-bold text-blue-400">{fmtBig(totalOpenai)}</td>
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3 text-right font-mono text-xs font-bold text-green-400">{fmtBig(totalGemini)}</td>
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3 text-right font-mono text-xs font-bold text-yellow-400">{fmtBig(totalGoogle)}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm font-bold text-red-400">{fmtBig(grandTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
