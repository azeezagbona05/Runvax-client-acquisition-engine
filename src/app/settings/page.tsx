'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Save, Loader2, CheckCircle, AlertCircle, Send, User, Mail, Target, Eye, EyeOff, Landmark, RotateCcw, Receipt, Globe, Plus, Trash2 } from 'lucide-react';
import RateCardTab from '@/components/RateCardTab';
import { DEFAULT_RATE_CARD } from '@/lib/rateCard';
import type { RateCard } from '@/lib/rateCard';

interface Settings {
  // Goals
  dailyGoal: number;
  avgDealValue: number;
  closeRatePct: number;
  // Profile
  senderName: string;
  businessName: string;
  whatsapp: string;
  replyEmail: string;
  city: string;
  tagline: string;
  jobTitle: string;
  website: string;
  // SMTP
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  // Bank / payment
  bankName: string;
  bankAccount: string;
  bankAcctName: string;
  paymentLink: string;
}

const DEFAULTS: Settings = {
  dailyGoal: 10, avgDealValue: 300000, closeRatePct: 10,
  senderName: '', businessName: '', whatsapp: '', replyEmail: '', city: '', tagline: '', jobTitle: '', website: '',
  smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '', smtpFrom: '',
  bankName: '', bankAccount: '', bankAcctName: '', paymentLink: '',
};

interface PortfolioItem {
  url: string;
  description: string;
  title?: string;
  favicon?: string;
  category?: string;
}

type Tab = 'profile' | 'email' | 'payment' | 'goals' | 'ratecard' | 'portfolio';

export default function SettingsPage() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<Tab>('profile');
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [testMsg, setTestMsg] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [hasExistingPass, setHasExistingPass] = useState(false);
  const [rateCard, setRateCard] = useState<RateCard>(DEFAULT_RATE_CARD);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [fetchingSet, setFetchingSet] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch('/api/user/settings')
      .then((r) => r.json())
      .then((d) => {
        if (d.smtpPass === '••••••••') setHasExistingPass(true);
        setSettings((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(d).filter(([, v]) => v != null && v !== '')
          ),
          smtpPass: '', // never pre-fill password field
        }));
        if (d.rateCard) setRateCard(d.rateCard as RateCard);
        if (Array.isArray(d.portfolio)) setPortfolioItems(d.portfolio as PortfolioItem[]);
      })
      .finally(() => setLoading(false));
  }, []);

  const set = (key: keyof Settings, value: string | number) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, rateCard, portfolio: portfolioItems }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to save');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const replayOnboarding = async () => {
    try {
      await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onboardingDone: false }),
      });
      localStorage.removeItem('aip_quests_hidden');
      localStorage.removeItem('aip_quests_done');
    } catch { /* */ }
    window.location.assign('/'); // home triggers the onboarding wizard
  };

  const testSmtp = async () => {
    setTesting(true);
    setTestMsg('');
    try {
      // Save first so the route reads the latest values
      await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const res = await fetch('/api/user/smtp-test', { method: 'POST' });
      const data = await res.json() as { ok?: boolean; sentTo?: string; error?: string };
      setTestMsg(res.ok
        ? `Test email sent to ${data.sentTo}`
        : `Failed: ${data.error}`
      );
    } catch {
      setTestMsg('Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const fetchMeta = async (i: number, url: string) => {
    if (!url.trim()) return;
    setFetchingSet((prev) => new Set(Array.from(prev).concat(i)));
    try {
      const res = await fetch('/api/scrape-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json() as { title?: string; favicon?: string; category?: string; error?: string };
      if (res.ok) {
        setPortfolioItems((prev) => prev.map((p, idx) =>
          idx === i ? { ...p, title: data.title || p.title, favicon: data.favicon, category: data.category } : p
        ));
      }
    } catch { /* silent */ }
    finally {
      setFetchingSet((prev) => { const s = new Set(prev); s.delete(i); return s; });
    }
  };

  const fetchAllMeta = async () => {
    const toFetch = portfolioItems
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => p.url && !p.title);
    await Promise.all(toFetch.map(({ i, p }) => fetchMeta(i, p.url)));
  };

  const inputCls = 'w-full bg-gray-800/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/60 transition-colors';
  const labelCls = 'block text-xs font-semibold text-gray-400 mb-1.5';

  if (loading) {
    return (
      <div className="min-h-dvh bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof User }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'email', label: 'Email & SMTP', icon: Mail },
    { id: 'payment', label: 'Bank & Payment', icon: Landmark },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'ratecard', label: 'Rate Card', icon: Receipt },
    { id: 'portfolio', label: 'Portfolio', icon: Globe },
  ];

  return (
    <div className="min-h-dvh bg-gray-950 py-4 sm:py-10 px-4">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-black text-white">Settings</h1>
          <p className="text-gray-500 text-sm mt-1">
            Personalize your identity and email settings — used in all outreach, proposals, and emails.
          </p>
        </div>

        {/* Tabs — scrollable on mobile */}
        <div className="flex gap-1 bg-gray-900 border border-white/10 rounded-xl p-1 mb-6 overflow-x-auto scrollbar-none">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-shrink-0 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                tab === id
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="whitespace-nowrap">{label}</span>
            </button>
          ))}
        </div>

        <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 space-y-5">

          {/* ── PROFILE TAB ── */}
          {tab === 'profile' && (
            <>
              <div className="pb-4 border-b border-white/8">
                <p className="text-white font-semibold text-sm">Your Identity</p>
                <p className="text-gray-500 text-xs mt-1">Used in proposals, email signatures, and AI-generated outreach.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Your Name</label>
                  <input className={inputCls} value={settings.senderName} onChange={(e) => set('senderName', e.target.value)} placeholder="e.g. Azeez Oladipo" />
                </div>
                <div>
                  <label className={labelCls}>Business / Agency Name</label>
                  <input className={inputCls} value={settings.businessName} onChange={(e) => set('businessName', e.target.value)} placeholder="e.g. WebCraft Studios" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>WhatsApp Number</label>
                  <input className={inputCls} value={settings.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="e.g. +234 803 123 4567" />
                </div>
                <div>
                  <label className={labelCls}>Reply Email</label>
                  <input type="email" className={inputCls} value={settings.replyEmail} onChange={(e) => set('replyEmail', e.target.value)} placeholder="e.g. contact@myagency.ng" />
                </div>
              </div>

              <div>
                <label className={labelCls}>Your City / Location</label>
                <input className={inputCls} value={settings.city} onChange={(e) => set('city', e.target.value)} placeholder="e.g. Lagos, Nigeria" />
              </div>

              <div>
                <label className={labelCls}>Tagline <span className="text-gray-600 font-normal">(shown in email signature)</span></label>
                <input className={inputCls} value={settings.tagline} onChange={(e) => set('tagline', e.target.value)} placeholder="e.g. Building digital front doors for Nigerian businesses" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Job Title <span className="text-gray-600 font-normal">(email signature)</span></label>
                  <input className={inputCls} value={settings.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} placeholder="e.g. Team Lead - Website Development" />
                </div>
                <div>
                  <label className={labelCls}>Website <span className="text-gray-600 font-normal">(email signature)</span></label>
                  <input className={inputCls} value={settings.website} onChange={(e) => set('website', e.target.value)} placeholder="e.g. www.harzotech.com" />
                </div>
              </div>

              {/* Replay onboarding */}
              <div className="border-t border-white/8 pt-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-semibold text-white">Onboarding tour</div>
                  <div className="text-xs text-gray-500">Restart the &ldquo;Find your first client&rdquo; walkthrough.</div>
                </div>
                <button
                  type="button"
                  onClick={replayOnboarding}
                  className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 rounded-xl text-sm font-bold transition-colors flex-shrink-0"
                >
                  <RotateCcw className="w-4 h-4" /> Replay onboarding
                </button>
              </div>
            </>
          )}

          {/* ── EMAIL & SMTP TAB ── */}
          {tab === 'email' && (
            <>
              <div className="pb-4 border-b border-white/8">
                <p className="text-white font-semibold text-sm">Custom Email Server</p>
                <p className="text-gray-500 text-xs mt-1">
                  Emails are sent from your own account. Leave blank to use the platform's shared server.
                  <br />For Gmail: use <span className="text-purple-300">smtp.gmail.com</span>, port <span className="text-purple-300">587</span>, and a <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener" className="text-purple-400 underline">Gmail App Password</a>.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>SMTP Host</label>
                  <input className={inputCls} value={settings.smtpHost} onChange={(e) => set('smtpHost', e.target.value)} placeholder="smtp.gmail.com" />
                </div>
                <div>
                  <label className={labelCls}>Port</label>
                  <input type="number" className={inputCls} value={settings.smtpPort} onChange={(e) => set('smtpPort', Number(e.target.value))} placeholder="587" />
                </div>
              </div>

              <div>
                <label className={labelCls}>SMTP Email / Username</label>
                <input type="email" className={inputCls} value={settings.smtpUser} onChange={(e) => set('smtpUser', e.target.value)} placeholder="you@gmail.com" />
              </div>

              <div>
                <label className={labelCls}>
                  SMTP Password / App Password
                  {hasExistingPass && !settings.smtpPass && (
                    <span className="ml-2 text-green-400 font-normal text-[11px]">✓ Saved — leave blank to keep existing</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    className={inputCls + ' pr-10'}
                    value={settings.smtpPass}
                    onChange={(e) => {
                      set('smtpPass', e.target.value);
                      if (e.target.value) setHasExistingPass(false);
                    }}
                    placeholder={hasExistingPass ? '••••••••  (saved)' : 'Your Gmail App Password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className={labelCls}>From Name <span className="text-gray-600 font-normal">(shown to email recipients)</span></label>
                <input className={inputCls} value={settings.smtpFrom} onChange={(e) => set('smtpFrom', e.target.value)} placeholder="e.g. WebCraft Studios" />
              </div>

              {testMsg && (
                <div className={`flex items-center gap-2 text-sm p-3 rounded-xl ${testMsg.startsWith('Test email') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                  {testMsg.startsWith('Test email') ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                  {testMsg}
                </div>
              )}

              <button
                onClick={testSmtp}
                disabled={testing || !settings.smtpHost || !settings.smtpUser || (!settings.smtpPass && !hasExistingPass)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white/8 hover:bg-white/15 text-gray-300 disabled:opacity-40 transition-colors border border-white/10"
              >
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {testing ? 'Sending test…' : 'Send test email to myself'}
              </button>
            </>
          )}

          {/* ── BANK & PAYMENT TAB ── */}
          {tab === 'payment' && (
            <>
              <div className="pb-4 border-b border-white/8">
                <p className="text-white font-semibold text-sm">Bank & Payment Details</p>
                <p className="text-gray-500 text-xs mt-1">
                  Printed automatically in AI-generated proposals so clients know how to pay you.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Bank Name</label>
                  <input className={inputCls} value={settings.bankName} onChange={(e) => set('bankName', e.target.value)} placeholder="e.g. GTBank" />
                </div>
                <div>
                  <label className={labelCls}>Account Number</label>
                  <input className={inputCls} value={settings.bankAccount} onChange={(e) => set('bankAccount', e.target.value)} placeholder="e.g. 0123456789" />
                </div>
              </div>

              <div>
                <label className={labelCls}>Account Name</label>
                <input className={inputCls} value={settings.bankAcctName} onChange={(e) => set('bankAcctName', e.target.value)} placeholder="e.g. AZEEZ OLADIPO" />
              </div>

              <div>
                <label className={labelCls}>Payment Link <span className="text-gray-600 font-normal">(optional — Paystack/Flutterwave)</span></label>
                <input type="url" className={inputCls} value={settings.paymentLink} onChange={(e) => set('paymentLink', e.target.value)} placeholder="https://paystack.com/pay/your-link" />
              </div>

              {(settings.bankName || settings.bankAccount) && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-xs text-green-400">
                  <p className="font-semibold mb-1">Preview in proposals:</p>
                  <p>Bank: {settings.bankName || '—'}</p>
                  <p>Account: {settings.bankAccount || '—'}</p>
                  <p>Name: {settings.bankAcctName || '—'}</p>
                  {settings.paymentLink && <p>Pay online: {settings.paymentLink}</p>}
                </div>
              )}
            </>
          )}

          {/* ── GOALS TAB ── */}
          {tab === 'goals' && (
            <>
              <div className="pb-4 border-b border-white/8">
                <p className="text-white font-semibold text-sm">Prospecting Goals</p>
                <p className="text-gray-500 text-xs mt-1">Used to calculate your revenue targets and streak on the dashboard.</p>
              </div>

              <div>
                <label className={labelCls}>Daily outreach goal</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1} max={200}
                    className={inputCls + ' max-w-[120px]'}
                    value={settings.dailyGoal}
                    onChange={(e) => set('dailyGoal', Number(e.target.value))}
                  />
                  <span className="text-gray-500 text-sm">businesses contacted per day</span>
                </div>
              </div>

              <div>
                <label className={labelCls}>Average deal value</label>
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 text-sm">₦</span>
                  <input
                    type="number"
                    min={10000}
                    className={inputCls + ' max-w-[180px]'}
                    value={settings.avgDealValue}
                    onChange={(e) => set('avgDealValue', Number(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Estimated close rate</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1} max={100}
                    className={inputCls + ' max-w-[120px]'}
                    value={settings.closeRatePct}
                    onChange={(e) => set('closeRatePct', Number(e.target.value))}
                  />
                  <span className="text-gray-500 text-sm">% of outreach converts to a client</span>
                </div>
                {settings.dailyGoal > 0 && settings.avgDealValue > 0 && settings.closeRatePct > 0 && (
                  <p className="text-xs text-purple-400 mt-2">
                    At {settings.dailyGoal} contacts/day × {settings.closeRatePct}% close rate × ₦{settings.avgDealValue.toLocaleString()} = <strong className="text-purple-300">₦{Math.round(settings.dailyGoal * (settings.closeRatePct / 100) * settings.avgDealValue).toLocaleString()}/month</strong> potential
                  </p>
                )}
              </div>
            </>
          )}

          {/* ── RATE CARD TAB ── */}
          {tab === 'ratecard' && (
            <>
              <div className="pb-4 border-b border-white/8">
                <p className="text-white font-semibold text-sm">Rate Card</p>
                <p className="text-gray-500 text-xs mt-1">
                  Your pricing, packages, and terms — used in AI-generated proposals and outreach.
                </p>
              </div>
              <RateCardTab rateCard={rateCard} onChange={setRateCard} />
            </>
          )}

          {/* ── PORTFOLIO TAB ── */}
          {tab === 'portfolio' && (() => {
            const withIdx = portfolioItems.map((item, i) => ({ ...item, idx: i }));
            const grouped = withIdx.reduce((acc, item) => {
              const cat = item.category || '';
              if (!acc[cat]) acc[cat] = [];
              acc[cat].push(item);
              return acc;
            }, {} as Record<string, typeof withIdx>);
            const sortedCats = Object.keys(grouped).filter(Boolean).sort();
            const uncategorised = grouped[''] ?? [];
            const needsScan = portfolioItems.some((p) => p.url && !p.title);
            const isAnyFetching = fetchingSet.size > 0;

            const renderCard = (item: typeof withIdx[number]) => (
              <div key={item.idx} className="bg-white/[0.03] border border-white/8 rounded-xl p-4 space-y-3">
                {/* Header row: favicon + title + category badge + delete */}
                <div className="flex items-center gap-2.5">
                  {item.favicon && (
                    <img
                      src={item.favicon}
                      alt=""
                      className="w-5 h-5 rounded-sm flex-shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  {fetchingSet.has(item.idx) ? (
                    <Loader2 className="w-4 h-4 text-purple-400 animate-spin flex-shrink-0" />
                  ) : null}
                  <span className="text-xs font-semibold text-white truncate flex-1">
                    {item.title || `Website ${item.idx + 1}`}
                  </span>
                  {item.category && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 flex-shrink-0">
                      {item.category}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setPortfolioItems((prev) => prev.filter((_, idx) => idx !== item.idx))}
                    className="text-gray-600 hover:text-red-400 transition-colors p-1 flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* URL */}
                <div>
                  <label className={labelCls}>Website URL</label>
                  <input
                    className={inputCls}
                    value={item.url}
                    onChange={(e) => setPortfolioItems((prev) => prev.map((p, idx) => idx === item.idx ? { ...p, url: e.target.value } : p))}
                    onBlur={(e) => {
                      const url = e.target.value.trim();
                      if (url && !portfolioItems[item.idx]?.title) fetchMeta(item.idx, url);
                    }}
                    placeholder="e.g. www.clientwebsite.com"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className={labelCls}>Brief description <span className="text-gray-600 font-normal">(optional)</span></label>
                  <input
                    className={inputCls}
                    value={item.description}
                    onChange={(e) => setPortfolioItems((prev) => prev.map((p, idx) => idx === item.idx ? { ...p, description: e.target.value } : p))}
                    placeholder="e.g. Restaurant website with online menu and reservations"
                  />
                </div>
              </div>
            );

            return (
              <>
                <div className="pb-4 border-b border-white/8 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-white font-semibold text-sm">Your Portfolio</p>
                    <p className="text-gray-500 text-xs mt-1">
                      Websites you&apos;ve built — auto-detected by category from each site&apos;s metadata.
                    </p>
                  </div>
                  {needsScan && !isAnyFetching && (
                    <button
                      type="button"
                      onClick={fetchAllMeta}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold transition-colors flex-shrink-0"
                    >
                      <Globe className="w-3.5 h-3.5" /> Scan all
                    </button>
                  )}
                  {isAnyFetching && (
                    <span className="flex items-center gap-1.5 text-purple-400 text-xs flex-shrink-0">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning…
                    </span>
                  )}
                </div>

                {portfolioItems.length === 0 && (
                  <div className="text-center py-8 text-gray-600 text-sm">No portfolio websites yet. Add one below.</div>
                )}

                {/* Grouped by category */}
                <div className="space-y-5">
                  {sortedCats.map((cat) => (
                    <div key={cat}>
                      <p className="text-[11px] font-bold text-purple-400 uppercase tracking-widest mb-2">{cat}</p>
                      <div className="space-y-2">{grouped[cat].map(renderCard)}</div>
                    </div>
                  ))}

                  {/* Items not yet scanned */}
                  {uncategorised.length > 0 && (
                    <div>
                      {sortedCats.length > 0 && (
                        <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest mb-2">Not scanned yet</p>
                      )}
                      <div className="space-y-2">{uncategorised.map(renderCard)}</div>
                    </div>
                  )}
                </div>

                {/* Add / Bulk buttons */}
                {bulkMode ? (
                  <div className="space-y-2">
                    <label className={labelCls}>Paste URLs — one per line</label>
                    <textarea
                      rows={6}
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      placeholder={`www.client1.com\nwww.client2.com\nwww.client3.com`}
                      className={inputCls + ' resize-none'}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const newItems = bulkText
                            .split('\n')
                            .map((line) => line.trim())
                            .filter((line) => line.length > 0)
                            .map((url) => ({ url, description: '' }));
                          if (newItems.length > 0) {
                            setPortfolioItems((prev) => {
                              const updated = [...prev, ...newItems];
                              // kick off meta fetch for the newly added items
                              const startIdx = prev.length;
                              newItems.forEach((item, offset) => fetchMeta(startIdx + offset, item.url));
                              return updated;
                            });
                          }
                          setBulkText('');
                          setBulkMode(false);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-bold transition-colors"
                      >
                        <Plus className="w-4 h-4" /> Add all
                      </button>
                      <button
                        type="button"
                        onClick={() => { setBulkMode(false); setBulkText(''); }}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-400 rounded-xl text-sm font-semibold transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPortfolioItems((prev) => [...prev, { url: '', description: '' }])}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 border-dashed rounded-xl text-sm font-semibold transition-colors flex-1 justify-center"
                    >
                      <Plus className="w-4 h-4" /> Add website
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkMode(true)}
                      className="flex items-center gap-2 px-4 py-2.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 hover:text-purple-300 border border-purple-500/30 rounded-xl text-sm font-semibold transition-colors"
                    >
                      Bulk add
                    </button>
                  </div>
                )}
              </>
            );
          })()}


          {/* Save button */}
          <div className="pt-4 border-t border-white/8 flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving…' : 'Save settings'}
            </button>

            {saved && (
              <span className="flex items-center gap-1.5 text-green-400 text-sm font-medium">
                <CheckCircle className="w-4 h-4" /> Saved
              </span>
            )}
            {error && (
              <span className="flex items-center gap-1.5 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" /> {error}
              </span>
            )}
          </div>
        </div>

        {session?.user && (
          <p className="text-center text-gray-600 text-xs mt-6">
            Logged in as <span className="text-gray-400">{session.user.email}</span>
          </p>
        )}
      </div>
    </div>
  );
}
