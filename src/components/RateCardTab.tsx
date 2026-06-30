'use client';

import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Package, Wrench, Puzzle, CreditCard } from 'lucide-react';
import type { RateCard, WebsitePackage, MaintenancePlan, AddOn } from '@/lib/rateCard';
import { formatPrice } from '@/lib/rateCard';

const inputCls = 'w-full bg-gray-800/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/60 transition-colors';
const labelCls = 'block text-xs font-semibold text-gray-400 mb-1.5';

const CURRENCIES = ['NGN', 'GHS', 'KES', 'USD', 'GBP', 'ZAR', 'CAD'];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Package editor ────────────────────────────────────────────────────────────

function PackageCard({
  pkg,
  currency,
  onChange,
  onDelete,
}: {
  pkg: WebsitePackage;
  currency: string;
  onChange: (p: WebsitePackage) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const set = (k: keyof WebsitePackage, v: unknown) => onChange({ ...pkg, [k]: v });

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-left"
      >
        <div className="min-w-0">
          <p className="text-sm font-bold text-white truncate">{pkg.name || 'Untitled package'}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {pkg.priceMin || pkg.priceMax
              ? `${formatPrice(pkg.priceMin, currency)} – ${formatPrice(pkg.priceMax, currency)}`
              : 'No price set'}{pkg.timeline ? ` · ${pkg.timeline}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-3 space-y-3 border-t border-white/8">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Package name</label>
              <input className={inputCls} value={pkg.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Starter Site" />
            </div>
            <div>
              <label className={labelCls}>Timeline</label>
              <input className={inputCls} value={pkg.timeline} onChange={(e) => set('timeline', e.target.value)} placeholder="e.g. 2–3 weeks" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Short description</label>
            <input className={inputCls} value={pkg.description} onChange={(e) => set('description', e.target.value)} placeholder="e.g. Clean, mobile-friendly site for small businesses" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Min price</label>
              <input type="number" className={inputCls} value={pkg.priceMin} onChange={(e) => set('priceMin', Number(e.target.value))} placeholder="150000" />
            </div>
            <div>
              <label className={labelCls}>Max price</label>
              <input type="number" className={inputCls} value={pkg.priceMax} onChange={(e) => set('priceMax', Number(e.target.value))} placeholder="250000" />
            </div>
            <div>
              <label className={labelCls}>Pages</label>
              <input className={inputCls} value={pkg.pages} onChange={(e) => set('pages', e.target.value)} placeholder="e.g. 5–7 pages" />
            </div>
          </div>

          <div>
            <label className={labelCls}>Features included <span className="text-gray-600 font-normal">(one per line)</span></label>
            <textarea
              className={inputCls + ' resize-none'}
              rows={4}
              value={pkg.features.join('\n')}
              onChange={(e) => set('features', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
              placeholder={'Responsive design\nContact form\nGoogle Maps embed\nSocial media links'}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Maintenance plan editor ───────────────────────────────────────────────────

function MaintenanceCard({
  plan,
  currency,
  onChange,
  onDelete,
}: {
  plan: MaintenancePlan;
  currency: string;
  onChange: (p: MaintenancePlan) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const set = (k: keyof MaintenancePlan, v: unknown) => onChange({ ...plan, [k]: v });

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-left"
      >
        <div className="min-w-0">
          <p className="text-sm font-bold text-white truncate">{plan.name || 'Untitled plan'}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {plan.pricePerMonth ? `${formatPrice(plan.pricePerMonth, currency)}/month` : 'No price set'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-3 space-y-3 border-t border-white/8">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Plan name</label>
              <input className={inputCls} value={plan.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Basic Maintenance" />
            </div>
            <div>
              <label className={labelCls}>Monthly price</label>
              <input type="number" className={inputCls} value={plan.pricePerMonth} onChange={(e) => set('pricePerMonth', Number(e.target.value))} placeholder="15000" />
            </div>
          </div>
          <div>
            <label className={labelCls}>What&apos;s included <span className="text-gray-600 font-normal">(one per line)</span></label>
            <textarea
              className={inputCls + ' resize-none'}
              rows={4}
              value={plan.includes.join('\n')}
              onChange={(e) => set('includes', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
              placeholder={'Monthly content updates\nHosting management\nSecurity monitoring'}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add-on editor ────────────────────────────────────────────────────────────

function AddOnCard({
  addon,
  currency,
  onChange,
  onDelete,
}: {
  addon: AddOn;
  currency: string;
  onChange: (a: AddOn) => void;
  onDelete: () => void;
}) {
  const set = (k: keyof AddOn, v: unknown) => onChange({ ...addon, [k]: v });

  return (
    <div className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/10 rounded-xl">
      <div className="flex-1 grid grid-cols-3 gap-2 min-w-0">
        <input
          className={inputCls + ' col-span-1'}
          value={addon.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Add-on name"
        />
        <input
          className={inputCls + ' col-span-1'}
          value={addon.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Short description"
        />
        <div className="flex items-center gap-1">
          <span className="text-gray-500 text-xs flex-shrink-0">{currency}</span>
          <input
            type="number"
            className={inputCls}
            value={addon.price}
            onChange={(e) => set('price', Number(e.target.value))}
            placeholder="50000"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function RateCardTab({
  rateCard,
  onChange,
}: {
  rateCard: RateCard;
  onChange: (rc: RateCard) => void;
}) {
  const set = <K extends keyof RateCard>(k: K, v: RateCard[K]) => onChange({ ...rateCard, [k]: v });

  const setTerms = <K extends keyof RateCard['paymentTerms']>(k: K, v: number) =>
    onChange({ ...rateCard, paymentTerms: { ...rateCard.paymentTerms, [k]: v } });

  const addPackage = () =>
    set('packages', [...rateCard.packages, {
      id: uid(), name: '', description: '', priceMin: 0, priceMax: 0,
      currency: rateCard.currency, timeline: '', pages: '', features: [],
    }]);

  const addMaintenance = () =>
    set('maintenancePlans', [...rateCard.maintenancePlans, {
      id: uid(), name: '', pricePerMonth: 0, currency: rateCard.currency, includes: [],
    }]);

  const addAddOn = () =>
    set('addOns', [...rateCard.addOns, {
      id: uid(), name: '', price: 0, currency: rateCard.currency, description: '',
    }]);

  const t = rateCard.paymentTerms;

  return (
    <div className="space-y-8">

      {/* Currency */}
      <div className="flex items-center gap-4 pb-4 border-b border-white/8">
        <div>
          <p className="text-white font-semibold text-sm">Default Currency</p>
          <p className="text-gray-500 text-xs mt-0.5">Applied to all packages and plans</p>
        </div>
        <select
          className="ml-auto bg-gray-800/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500/60"
          value={rateCard.currency}
          onChange={(e) => set('currency', e.target.value)}
        >
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Website packages */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-purple-400" />
            <p className="text-white font-semibold text-sm">Website Packages</p>
          </div>
          <button
            type="button"
            onClick={addPackage}
            className="flex items-center gap-1.5 text-xs font-bold text-purple-400 hover:text-purple-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add package
          </button>
        </div>
        {rateCard.packages.length === 0 && (
          <p className="text-xs text-gray-600 text-center py-6 border border-dashed border-white/10 rounded-xl">
            No packages yet — click &quot;Add package&quot; to create your first.
          </p>
        )}
        <div className="space-y-2">
          {rateCard.packages.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              currency={rateCard.currency}
              onChange={(updated) =>
                set('packages', rateCard.packages.map((p) => p.id === pkg.id ? updated : p))
              }
              onDelete={() =>
                set('packages', rateCard.packages.filter((p) => p.id !== pkg.id))
              }
            />
          ))}
        </div>
      </div>

      {/* Maintenance plans */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-blue-400" />
            <p className="text-white font-semibold text-sm">Maintenance Plans</p>
          </div>
          <button
            type="button"
            onClick={addMaintenance}
            className="flex items-center gap-1.5 text-xs font-bold text-blue-400 hover:text-blue-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add plan
          </button>
        </div>
        {rateCard.maintenancePlans.length === 0 && (
          <p className="text-xs text-gray-600 text-center py-6 border border-dashed border-white/10 rounded-xl">
            No maintenance plans yet.
          </p>
        )}
        <div className="space-y-2">
          {rateCard.maintenancePlans.map((plan) => (
            <MaintenanceCard
              key={plan.id}
              plan={plan}
              currency={rateCard.currency}
              onChange={(updated) =>
                set('maintenancePlans', rateCard.maintenancePlans.map((p) => p.id === plan.id ? updated : p))
              }
              onDelete={() =>
                set('maintenancePlans', rateCard.maintenancePlans.filter((p) => p.id !== plan.id))
              }
            />
          ))}
        </div>
      </div>

      {/* Add-ons */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Puzzle className="w-4 h-4 text-green-400" />
            <p className="text-white font-semibold text-sm">Add-ons</p>
          </div>
          <button
            type="button"
            onClick={addAddOn}
            className="flex items-center gap-1.5 text-xs font-bold text-green-400 hover:text-green-300 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add service
          </button>
        </div>
        {rateCard.addOns.length === 0 && (
          <p className="text-xs text-gray-600 text-center py-6 border border-dashed border-white/10 rounded-xl">
            No add-ons yet.
          </p>
        )}
        <div className="space-y-2">
          {rateCard.addOns.map((ao) => (
            <AddOnCard
              key={ao.id}
              addon={ao}
              currency={rateCard.currency}
              onChange={(updated) =>
                set('addOns', rateCard.addOns.map((a) => a.id === ao.id ? updated : a))
              }
              onDelete={() =>
                set('addOns', rateCard.addOns.filter((a) => a.id !== ao.id))
              }
            />
          ))}
        </div>
      </div>

      {/* Payment terms */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="w-4 h-4 text-orange-400" />
          <p className="text-white font-semibold text-sm">Payment Terms</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Deposit %</label>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={100} className={inputCls} value={t.depositPct} onChange={(e) => setTerms('depositPct', Number(e.target.value))} />
              <span className="text-gray-500 text-sm flex-shrink-0">%</span>
            </div>
          </div>
          <div>
            <label className={labelCls}>Mid-project milestone %</label>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={100} className={inputCls} value={t.milestonePct} onChange={(e) => setTerms('milestonePct', Number(e.target.value))} />
              <span className="text-gray-500 text-sm flex-shrink-0">%</span>
            </div>
          </div>
          <div>
            <label className={labelCls}>On delivery %</label>
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={100} className={inputCls} value={t.completionPct} onChange={(e) => setTerms('completionPct', Number(e.target.value))} />
              <span className="text-gray-500 text-sm flex-shrink-0">%</span>
            </div>
          </div>
          <div>
            <label className={labelCls}>Revision rounds included</label>
            <input type="number" min={0} className={inputCls} value={t.revisionRounds} onChange={(e) => setTerms('revisionRounds', Number(e.target.value))} />
          </div>
          <div>
            <label className={labelCls}>Extra revision cost ({rateCard.currency})</label>
            <input type="number" min={0} className={inputCls} value={t.extraRevisionCost} onChange={(e) => setTerms('extraRevisionCost', Number(e.target.value))} />
          </div>
          <div>
            <label className={labelCls}>Quote valid for (days)</label>
            <input type="number" min={1} className={inputCls} value={t.validityDays} onChange={(e) => setTerms('validityDays', Number(e.target.value))} />
          </div>
        </div>
        {t.depositPct + t.milestonePct + t.completionPct !== 100 && (
          <p className="mt-2 text-xs text-orange-400">
            Payment splits add up to {t.depositPct + t.milestonePct + t.completionPct}% — should total 100%.
          </p>
        )}
      </div>

      {/* Custom notes */}
      <div>
        <label className={labelCls}>Custom terms / notes <span className="text-gray-600 font-normal">(printed at the bottom of proposals)</span></label>
        <textarea
          className={inputCls + ' resize-none'}
          rows={3}
          value={rateCard.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="e.g. All prices are exclusive of VAT. Domain and hosting fees are billed separately."
        />
      </div>

    </div>
  );
}
