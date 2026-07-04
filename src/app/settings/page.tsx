'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Save, Loader2, CheckCircle, AlertCircle, Send, User, Mail, Target, Eye, EyeOff, Landmark, RotateCcw, Receipt, Globe, Plus, Trash2, MessageCircle, Wifi, Bot, Play, ToggleLeft, ToggleRight, RefreshCw, Fingerprint, ChevronRight, ChevronLeft, Shield, LogOut, Smartphone } from 'lucide-react';
import RateCardTab from '@/components/RateCardTab';
import { DEFAULT_RATE_CARD } from '@/lib/rateCard';
import type { RateCard } from '@/lib/rateCard';

// ── Auto-Prospecting Settings ─────────────────────────────────────────────────

interface AutoProspectConfig {
  enabled: boolean;
  industry: string;
  location: string;
  minRating: number;
  noWebsiteOnly: boolean;
}

const AP_KEY = 'aip_auto_prospect_config';

function AutoProspectingSettings() {
  const [cfg, setCfg] = useState<AutoProspectConfig>({
    enabled: false, industry: '', location: 'Lagos, Nigeria', minRating: 0, noWebsiteOnly: true,
  });
  const [running, setRunning]     = useState(false);
  const [queueCount, setQueueCount] = useState<number | null>(null);
  const [runMsg, setRunMsg]       = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(AP_KEY);
      if (saved) setCfg(JSON.parse(saved) as AutoProspectConfig);
    } catch { /* */ }
    // Check how many prospects are queued for review
    fetch('/api/prospects/queue-count').then(r => r.json()).then(d => {
      if (typeof d.count === 'number') setQueueCount(d.count);
    }).catch(() => { /* */ });
  }, []);

  const update = useCallback((patch: Partial<AutoProspectConfig>) => {
    setCfg(prev => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(AP_KEY, JSON.stringify(next)); } catch { /* */ }
      return next;
    });
  }, []);

  const runNow = async () => {
    if (!cfg.industry || !cfg.location) {
      setRunMsg('Set an industry and location first.'); return;
    }
    setRunning(true); setRunMsg('');
    try {
      const res = await fetch('/api/prospects/auto-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industry: cfg.industry,
          location: cfg.location,
          noWebsiteOnly: cfg.noWebsiteOnly,
          minRating: cfg.minRating,
        }),
      });
      const json = await res.json() as { found?: number; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed');
      const n = json.found ?? 0;
      setQueueCount(prev => (prev ?? 0) + n);
      setRunMsg(`Found ${n} new prospect${n !== 1 ? 's' : ''} — review them in the Find Prospects page.`);
    } catch (e: unknown) {
      setRunMsg(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setRunning(false);
    }
  };

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500/50 transition-colors';
  const labelCls = 'block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5';

  return (
    <div className="space-y-4">
      {/* Enable toggle */}
      <button
        onClick={() => update({ enabled: !cfg.enabled })}
        className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all ${
          cfg.enabled
            ? 'bg-purple-600/20 border-purple-500/40 text-white'
            : 'bg-white/5 border-white/10 text-gray-400'
        }`}
      >
        <div className="flex items-center gap-3">
          <Bot className={`w-5 h-5 ${cfg.enabled ? 'text-purple-400' : 'text-gray-600'}`} />
          <div className="text-left">
            <p className="text-sm font-bold">{cfg.enabled ? 'Auto Prospecting ON' : 'Auto Prospecting OFF'}</p>
            <p className="text-xs text-gray-500 mt-0.5">{cfg.enabled ? 'Agent is ready — click Run Now to find prospects' : 'Toggle on to enable'}</p>
          </div>
        </div>
        {cfg.enabled
          ? <ToggleRight className="w-6 h-6 text-purple-400 flex-shrink-0" />
          : <ToggleLeft className="w-6 h-6 text-gray-600 flex-shrink-0" />}
      </button>

      {cfg.enabled && (
        <div className="space-y-3 pl-1">
          {/* Preferences */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Industry</label>
              <input
                className={inputCls}
                value={cfg.industry}
                onChange={(e) => update({ industry: e.target.value })}
                placeholder="e.g. Restaurant, Hotel, Salon"
              />
            </div>
            <div>
              <label className={labelCls}>Location</label>
              <input
                className={inputCls}
                value={cfg.location}
                onChange={(e) => update({ location: e.target.value })}
                placeholder="e.g. Lagos, Nigeria"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={cfg.noWebsiteOnly}
                onChange={(e) => update({ noWebsiteOnly: e.target.checked })}
                className="w-4 h-4 rounded accent-purple-500"
              />
              <span className="text-sm text-gray-400">No-website businesses only</span>
            </label>
          </div>

          {/* Queue status */}
          {queueCount !== null && queueCount > 0 && (
            <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
              <RefreshCw className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              <p className="text-sm text-yellow-300">
                <span className="font-bold">{queueCount}</span> prospect{queueCount !== 1 ? 's' : ''} waiting for your review in Find Prospects
              </p>
            </div>
          )}

          {/* Run Now button */}
          <button
            onClick={runNow}
            disabled={running}
            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? 'Searching…' : 'Run Now'}
          </button>

          {runMsg && (
            <p className={`text-xs ${runMsg.includes('Found') ? 'text-green-400' : 'text-red-400'}`}>{runMsg}</p>
          )}

          <p className="text-[11px] text-gray-600 leading-relaxed">
            Results are queued for your review — nothing is sent automatically. You approve each prospect before any outreach happens.
          </p>
        </div>
      )}
    </div>
  );
}

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
  // WhatsApp Business API
  waPhoneNumberId: string;
  waAccessToken: string;
  waTemplateName: string;
  wabaId: string;
  waDisplayPhone: string;
  waTemplateStatus: string;
}

const RECOMMENDED_TEMPLATE = `Hi {{1}},

I noticed {{2}} doesn't have a website yet. Customers searching online may not be finding you.

I help local businesses get a professional website. Is this something you're considering?`;


const DEFAULTS: Settings = {
  dailyGoal: 10, avgDealValue: 300000, closeRatePct: 10,
  senderName: '', businessName: '', whatsapp: '', replyEmail: '', city: '', tagline: '', jobTitle: '', website: '',
  smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '', smtpFrom: '',
  bankName: '', bankAccount: '', bankAcctName: '', paymentLink: '',
  waPhoneNumberId: '', waAccessToken: '', waTemplateName: '', wabaId: '', waDisplayPhone: '', waTemplateStatus: '',
};

interface PortfolioItem {
  url: string;
  description: string;
  title?: string;
  favicon?: string;
  category?: string;
}

type Tab = 'profile' | 'email' | 'payment' | 'goals' | 'ratecard' | 'portfolio' | 'whatsapp-api' | 'security';

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
  const [showWaToken, setShowWaToken] = useState(false);
  const [hasExistingWaToken, setHasExistingWaToken] = useState(false);
  const [waTestMsg, setWaTestMsg] = useState('');
  const [templateCopied, setTemplateCopied] = useState(false);

  // New simplified WA wizard state
  interface WaPhone { id: string; number: string; name: string; quality: string; status: string; wabaId: string; }
  const [waPhones, setWaPhones] = useState<WaPhone[]>([]);
  const [waConnecting, setWaConnecting] = useState(false);
  const [waConnectError, setWaConnectError] = useState('');
  const [waCreatingTemplate, setWaCreatingTemplate] = useState(false);
  const [waTemplateError, setWaTemplateError] = useState('');
  const [waCheckingStatus, setWaCheckingStatus] = useState(false);
  const [rateCard, setRateCard] = useState<RateCard>(DEFAULT_RATE_CARD);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [fetchingSet, setFetchingSet] = useState<Set<number>>(new Set());
  // Mobile navigation: null = home screen, string = detail view
  const [mobileSection, setMobileSection] = useState<Tab | null>(null);
  // Biometric
  interface BioCred { id: string; deviceName: string | null; createdAt: string }
  const [bioCreds, setBioCreds] = useState<BioCred[]>([]);
  const [bioRegistering, setBioRegistering] = useState(false);
  const [bioMsg, setBioMsg] = useState('');
  const [bioSupported, setBioSupported] = useState(false);

  useEffect(() => {
    setBioSupported(
      typeof window !== 'undefined' &&
      !!window.PublicKeyCredential &&
      !!navigator.credentials
    );
  }, []);

  const loadBioCreds = useCallback(async () => {
    const res = await fetch('/api/auth/webauthn/credentials');
    if (res.ok) setBioCreds(await res.json() as BioCred[]);
  }, []);

  useEffect(() => { void loadBioCreds(); }, [loadBioCreds]);

  const registerBiometric = async () => {
    setBioRegistering(true);
    setBioMsg('');
    try {
      const { startRegistration } = await import('@simplewebauthn/browser');
      const optRes = await fetch('/api/auth/webauthn/register');
      if (!optRes.ok) throw new Error('Could not start registration');
      const options = await optRes.json();
      const deviceName = /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone'
        : /Android/.test(navigator.userAgent) ? 'Android'
        : 'This device';
      const response = await startRegistration({ optionsJSON: options });
      const verRes = await fetch('/api/auth/webauthn/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response, deviceName }),
      });
      const data = await verRes.json() as { ok?: boolean; error?: string };
      if (!verRes.ok) throw new Error(data.error ?? 'Registration failed');
      setBioMsg('Biometric login enabled for this device.');
      await loadBioCreds();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed';
      setBioMsg(msg.includes('cancel') ? 'Cancelled.' : msg);
    } finally {
      setBioRegistering(false);
    }
  };

  const removeBioCred = async (id: string) => {
    await fetch('/api/auth/webauthn/credentials', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await loadBioCreds();
  };

  useEffect(() => {
    fetch('/api/user/settings')
      .then((r) => r.json())
      .then((d) => {
        if (d.smtpPass === '••••••••') setHasExistingPass(true);
        if (d.waAccessToken === '••••••••') setHasExistingWaToken(true);
        setSettings((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(d).filter(([, v]) => v != null && v !== '')
          ),
          smtpPass: '',     // never pre-fill password field
          waAccessToken: '', // never pre-fill token field
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

  const testWaConnection = async () => {
    setTesting(true);
    setWaTestMsg('');
    try {
      // Save credentials first so the test route can read them server-side
      await fetch('/api/user/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (settings.waAccessToken) setHasExistingWaToken(true);

      const res = await fetch('/api/whatsapp/test', { method: 'POST' });
      const data = await res.json() as { ok?: boolean; phone?: string; name?: string; quality?: string; error?: string };
      if (res.ok && data.ok) {
        const label = [data.phone, data.name].filter(Boolean).join(' · ');
        setWaTestMsg(`✅ Connected: ${label}`);
      } else {
        setWaTestMsg(`❌ ${data.error ?? 'Connection failed'}`);
      }
    } catch {
      setWaTestMsg('❌ Failed to reach Meta API');
    } finally {
      setTesting(false);
    }
  };

  // ── New simplified WA wizard handlers ──
  const waDetectNumbers = async () => {
    if (!settings.waAccessToken) return;
    setWaConnecting(true);
    setWaConnectError('');
    setWaPhones([]);
    try {
      const res = await fetch('/api/whatsapp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: settings.waAccessToken }),
      });
      const data = await res.json() as { ok?: boolean; phones?: WaPhone[]; userName?: string; error?: string };
      if (!res.ok || data.error) { setWaConnectError(data.error ?? 'Connection failed'); return; }
      setWaPhones(data.phones ?? []);
      if (settings.waAccessToken) setHasExistingWaToken(true);
    } catch {
      setWaConnectError('Could not reach Meta API. Check your internet connection.');
    } finally {
      setWaConnecting(false);
    }
  };

  const waSelectPhone = async (phone: WaPhone) => {
    const updated = { ...settings, waPhoneNumberId: phone.id, wabaId: phone.wabaId, waDisplayPhone: phone.number, waTemplateStatus: '' };
    setSettings(updated);
    setWaPhones([]);
    await fetch('/api/user/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  };

  const waCreateTemplate = async () => {
    setWaCreatingTemplate(true);
    setWaTemplateError('');
    try {
      const res = await fetch('/api/whatsapp/create-template', { method: 'POST' });
      const data = await res.json() as { ok?: boolean; status?: string; existed?: boolean; error?: string };
      if (!res.ok || data.error) { setWaTemplateError(data.error ?? 'Failed to create template'); return; }
      setSettings((prev) => ({ ...prev, waTemplateName: 'beamai_outreach_v1', waTemplateStatus: data.status ?? 'PENDING' }));
    } catch {
      setWaTemplateError('Could not reach Meta API.');
    } finally {
      setWaCreatingTemplate(false);
    }
  };

  const waRefreshStatus = async () => {
    setWaCheckingStatus(true);
    try {
      const res = await fetch('/api/whatsapp/template-status');
      const data = await res.json() as { status?: string | null; rejectedReason?: string };
      if (data.status) setSettings((prev) => ({ ...prev, waTemplateStatus: data.status! }));
    } catch { /* silent */ } finally {
      setWaCheckingStatus(false);
    }
  };

  // Auto-poll template status every 2 min while PENDING and WA tab is open
  useEffect(() => {
    if (tab !== 'whatsapp-api' || settings.waTemplateStatus !== 'PENDING') return;
    const id = setInterval(waRefreshStatus, 2 * 60 * 1000);
    return () => clearInterval(id);
  }, [tab, settings.waTemplateStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMeta = async (i: number, url: string) => {
    if (!url.trim()) return;
    setFetchingSet((prev) => new Set(Array.from(prev).concat(i)));
    try {
      const res = await fetch('/api/scrape-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json() as { title?: string; metaDesc?: string; favicon?: string; category?: string; error?: string };
      if (res.ok) {
        setPortfolioItems((prev) => prev.map((p, idx) =>
          idx === i ? {
            ...p,
            title: data.title || p.title,
            favicon: data.favicon,
            category: data.category,
            description: p.description || data.metaDesc || '',
          } : p
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
      .filter(({ p }) => p.url && (!p.title || !p.description));
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

  const tabs: { id: Tab; label: string; icon: typeof User; subtitle?: string }[] = [
    { id: 'profile',       label: 'Profile',          icon: User,          subtitle: settings.senderName || 'Your name & agency' },
    { id: 'email',         label: 'Email & SMTP',      icon: Mail,          subtitle: settings.smtpHost || 'Connect your email' },
    { id: 'payment',       label: 'Bank & Payment',    icon: Landmark,      subtitle: settings.bankName || 'Bank account & links' },
    { id: 'goals',         label: 'Goals & Analytics', icon: Target,        subtitle: `${settings.dailyGoal} outreaches/day` },
    { id: 'ratecard',      label: 'Rate Card',         icon: Receipt,       subtitle: 'Your pricing packages' },
    { id: 'portfolio',     label: 'Portfolio',         icon: Globe,         subtitle: `${portfolioItems.length} project${portfolioItems.length !== 1 ? 's' : ''}` },
    { id: 'whatsapp-api',  label: 'WhatsApp Business', icon: MessageCircle, subtitle: settings.waDisplayPhone || 'Connect WA API' },
    { id: 'security',      label: 'Security',          icon: Shield,        subtitle: bioCreds.length > 0 ? `${bioCreds.length} biometric device${bioCreds.length !== 1 ? 's' : ''}` : 'Face ID · Fingerprint · PIN' },
  ];

  const MOBILE_GROUPS = [
    { label: 'Agency Profile', tabs: ['profile', 'ratecard', 'portfolio'] as Tab[] },
    { label: 'Outreach',       tabs: ['email', 'whatsapp-api', 'payment'] as Tab[] },
    { label: 'Performance',    tabs: ['goals'] as Tab[] },
    { label: 'Security',       tabs: ['security'] as Tab[] },
  ];

  const activeTab = mobileSection ?? tab;

  // Security tab content
  const securityContent = (
    <div className="space-y-6">
      <div className="pb-4 border-b border-white/8">
        <p className="text-white font-semibold text-sm">Biometric Login</p>
        <p className="text-gray-500 text-xs mt-1">
          Use Face ID, fingerprint, or device PIN to sign in without a password.
        </p>
      </div>

      {!bioSupported && (
        <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
          <p className="text-sm text-yellow-300">Your browser doesn&apos;t support biometric login. Try Chrome or Safari on a modern device.</p>
        </div>
      )}

      {bioSupported && (
        <>
          <button
            onClick={registerBiometric}
            disabled={bioRegistering}
            className="w-full flex items-center gap-4 px-5 py-4 bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/30 rounded-2xl transition-colors disabled:opacity-60"
          >
            {bioRegistering
              ? <Loader2 className="w-6 h-6 text-purple-400 animate-spin flex-shrink-0" />
              : <Fingerprint className="w-6 h-6 text-purple-400 flex-shrink-0" />}
            <div className="text-left">
              <p className="text-sm font-bold text-white">
                {bioRegistering ? 'Follow your device prompt…' : 'Enable on this device'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Face ID · Touch ID · Fingerprint · Device PIN</p>
            </div>
          </button>

          {bioMsg && (
            <p className={`text-xs px-1 ${bioMsg.includes('enabled') ? 'text-green-400' : 'text-red-400'}`}>{bioMsg}</p>
          )}
        </>
      )}

      {bioCreds.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Registered Devices</p>
          <div className="space-y-2">
            {bioCreds.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 bg-gray-800/60 border border-white/8 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Smartphone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{c.deviceName ?? 'Device'}</p>
                    <p className="text-[11px] text-gray-600">{new Date(c.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <button
                  onClick={() => void removeBioCred(c.id)}
                  className="text-red-500 hover:text-red-400 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors flex-shrink-0"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pt-2 border-t border-white/8 space-y-2">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Account</p>
        <button
          onClick={replayOnboarding}
          className="w-full flex items-center gap-3 px-4 py-3.5 bg-white/[0.03] border border-white/8 rounded-xl text-sm text-gray-300 hover:bg-white/[0.06] transition-colors"
        >
          <RotateCcw className="w-4 h-4 text-gray-500" />
          Replay setup wizard
        </button>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="w-full flex items-center gap-3 px-4 py-3.5 bg-red-500/5 border border-red-500/20 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Log out
        </button>
      </div>
    </div>
  );

  // ── Mobile home screen (list view) ────────────────────────────────────────────
  const mobileHome = (
    <div className="space-y-1 pb-24">
      {/* Profile card */}
      <div className="bg-gray-900/80 rounded-2xl border border-white/8 px-5 py-4 mb-4 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-purple-600 flex items-center justify-center text-white text-xl font-black flex-shrink-0">
          {(session?.user?.name?.[0] ?? session?.user?.email?.[0] ?? '?').toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-white font-bold truncate">{session?.user?.name ?? 'Your Account'}</p>
          <p className="text-gray-500 text-xs truncate">{session?.user?.email}</p>
          <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-600/20 text-purple-400 border border-purple-500/30 uppercase tracking-wider">
            {((session?.user as { plan?: string })?.plan ?? 'Free')} Plan
          </span>
        </div>
      </div>

      {MOBILE_GROUPS.map(({ label, tabs: groupTabs }) => (
        <div key={label} className="mb-2">
          <p className="text-[11px] font-bold text-gray-600 uppercase tracking-widest px-1 pb-1.5">{label}</p>
          <div className="bg-gray-900 border border-white/8 rounded-2xl overflow-hidden divide-y divide-white/[0.05]">
            {groupTabs.map((tid) => {
              const t = tabs.find((x) => x.id === tid)!;
              return (
                <button
                  key={tid}
                  onClick={() => { setMobileSection(tid); setTab(tid); }}
                  className="w-full flex items-center gap-4 px-4 py-4 hover:bg-white/[0.03] active:bg-white/[0.06] transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-gray-800 border border-white/8 flex items-center justify-center flex-shrink-0">
                    <t.icon className="w-4 h-4 text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{t.label}</p>
                    {t.subtitle && <p className="text-xs text-gray-500 truncate mt-0.5">{t.subtitle}</p>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-dvh bg-gray-950">

      {/* ── MOBILE HOME (hidden when a section is selected) ──────────────── */}
      <div className={`sm:hidden ${mobileSection ? 'hidden' : ''}`}>
        <div className="px-4 pt-6 pb-32">
          <h1 className="text-2xl font-black text-white mb-5">Settings</h1>
          {mobileHome}
        </div>
      </div>

      {/* ── MOBILE DETAIL SUBHEADER ─────────────────────────────────────── */}
      {mobileSection && (
        <div className="sm:hidden sticky top-0 z-10 bg-gray-950/95 backdrop-blur-md border-b border-white/[0.06] flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => setMobileSection(null)}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-400 hover:text-white"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <p className="font-bold text-white text-sm">{tabs.find((t) => t.id === tab)?.label}</p>
        </div>
      )}

      {/* ── SHARED CONTENT (mobile detail + always on desktop) ──────────── */}
      <div className={`${mobileSection ? 'block' : 'hidden'} sm:block py-4 sm:py-10 px-4`}>
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-black text-white">Settings</h1>
          <p className="text-gray-500 text-sm mt-1">
            Personalize your identity and email settings — used in all outreach, proposals, and emails.
          </p>
        </div>

        {/* Tabs */}
        <div className="hidden sm:flex gap-1 bg-gray-900 border border-white/10 rounded-xl p-1 mb-6 overflow-x-auto scrollbar-none">
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

        <div className="bg-gray-900 border border-white/10 rounded-2xl p-5 sm:p-6 space-y-5">

          {/* ── SECURITY TAB ── */}
          {tab === 'security' && securityContent}

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

              {/* Auto Prospecting */}
              <div className="pt-4 border-t border-white/8">
                <p className="text-white font-semibold text-sm mb-1">Auto Prospecting Agent</p>
                <p className="text-gray-500 text-xs mb-4">When enabled, a background agent will find new prospects using your saved search preferences. You review and approve before anything is sent — no API calls are wasted automatically.</p>

                <AutoProspectingSettings />
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
            const needsScan = portfolioItems.some((p) => p.url && (!p.title || !p.description));
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
                      const cur = portfolioItems[item.idx];
                      if (url && (!cur?.title || !cur?.description)) fetchMeta(item.idx, url);
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


          {/* ── WHATSAPP BUSINESS API TAB ── */}
          {tab === 'whatsapp-api' && (() => {
            const waStep = !settings.waPhoneNumberId ? 1 : settings.waTemplateStatus !== 'APPROVED' ? 2 : 3;
            const TEMPLATE_PREVIEW = "Hi! I noticed *[Business Name]* on Google Maps has no website yet. Customers searching online for your services can't find you easily. I help local businesses get professional websites quickly and affordably. Would you like to see what yours could look like?";

            return (
              <div className="space-y-5">

                {/* Progress pills */}
                <div className="flex items-center gap-2">
                  {[
                    { n: 1, label: 'Connect' },
                    { n: 2, label: 'Template' },
                    { n: 3, label: 'Ready' },
                  ].map(({ n, label }, i, arr) => (
                    <div key={n} className="flex items-center gap-2 flex-1">
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold flex-shrink-0 ${
                        n < waStep  ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                        n === waStep ? 'bg-purple-600 text-white' :
                        'bg-white/5 text-gray-600 border border-white/8'
                      }`}>
                        {n < waStep ? <CheckCircle className="w-3 h-3" /> : <span>{n}</span>}
                        {label}
                      </div>
                      {i < arr.length - 1 && <div className={`flex-1 h-px ${n < waStep ? 'bg-green-500/30' : 'bg-white/8'}`} />}
                    </div>
                  ))}
                </div>

                {/* ── STEP 1: Paste token + pick number ── */}
                {waStep === 1 && (
                  <div className="space-y-5 pt-2">
                    <div className="text-center py-3">
                      <div className="w-14 h-14 bg-green-500/15 border border-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <MessageCircle className="w-7 h-7 text-green-400" />
                      </div>
                      <p className="text-white font-bold text-base">Connect your WhatsApp Business number</p>
                      <p className="text-gray-500 text-sm mt-1">Paste your access token — we&apos;ll find your numbers automatically.</p>
                    </div>

                    {/* Token field */}
                    <div>
                      <label className={labelCls}>Access Token <span className="text-gray-500 font-normal">(from Meta Developer App)</span></label>
                      <div className="relative">
                        <input
                          type={showWaToken ? 'text' : 'password'}
                          className={`${inputCls} pr-10`}
                          value={settings.waAccessToken}
                          onChange={(e) => { set('waAccessToken', e.target.value); setHasExistingWaToken(false); setWaPhones([]); setWaConnectError(''); }}
                          placeholder={hasExistingWaToken ? '••••••••' : 'EAABsB…'}
                        />
                        <button type="button" onClick={() => setShowWaToken((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                          {showWaToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Where to get token */}
                    <details className="group">
                      <summary className="text-xs text-purple-400 hover:text-purple-300 cursor-pointer list-none flex items-center gap-1.5 w-fit select-none">
                        <span className="text-[10px] group-open:rotate-90 inline-block transition-transform">▶</span>
                        Where do I get my Access Token?
                      </summary>
                      <div className="mt-3 pl-4 border-l-2 border-purple-500/30 space-y-2 text-xs text-gray-400">
                        <p><span className="text-purple-400 font-bold">1.</span> Go to <strong className="text-white">developers.facebook.com/apps</strong> → open your WhatsApp app</p>
                        <p><span className="text-purple-400 font-bold">2.</span> WhatsApp → Getting Started → copy the <strong className="text-white">Temporary access token</strong></p>
                        <p className="text-orange-400/80"><strong>⚠ Temporary tokens expire in 24 hours.</strong> For a permanent token: Business Settings → System Users → Generate Token → select your app + whatsapp_business_messaging + whatsapp_business_management.</p>
                      </div>
                    </details>

                    <button
                      onClick={waDetectNumbers}
                      disabled={waConnecting || (!settings.waAccessToken && !hasExistingWaToken)}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
                    >
                      {waConnecting
                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Detecting your numbers…</>
                        : <><Wifi className="w-4 h-4" /> Detect my WhatsApp numbers</>}
                    </button>

                    {waConnectError && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{waConnectError}</div>
                    )}

                    {/* Phone picker */}
                    {waPhones.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Pick your number</p>
                        {waPhones.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => waSelectPhone(p)}
                            className="w-full text-left flex items-center gap-3 px-4 py-3 bg-gray-800/60 hover:bg-green-600/15 border border-white/8 hover:border-green-500/30 rounded-xl transition-all"
                          >
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.status === 'CONNECTED' ? 'bg-green-400' : 'bg-yellow-400'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="text-white font-bold text-sm">{p.number}</div>
                              <div className="text-gray-500 text-xs">{p.name} · {p.status}</div>
                            </div>
                            <span className="text-xs text-green-400 font-bold">Select →</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── STEP 2: Auto-create template ── */}
                {waStep === 2 && (
                  <div className="space-y-5 pt-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                      <p className="text-green-400 font-bold text-sm">Connected</p>
                      <span className="text-gray-500 text-xs">{settings.waDisplayPhone || settings.waPhoneNumberId}</span>
                    </div>

                    <div>
                      <p className="text-white font-bold text-sm">Set up your outreach template</p>
                      <p className="text-gray-500 text-xs mt-1">
                        WhatsApp requires a pre-approved template for cold messages. We&apos;ll create and submit it to Meta on your behalf — no copy-pasting needed.
                      </p>
                    </div>

                    {/* Template preview (read-only) */}
                    <div className="bg-gray-800/50 border border-white/8 rounded-xl p-4">
                      <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-2">Message that will be sent</p>
                      <p className="text-sm text-gray-200 leading-relaxed">{TEMPLATE_PREVIEW}</p>
                    </div>

                    {/* Status display */}
                    {settings.waTemplateStatus === 'PENDING' && (
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 space-y-2">
                        <p className="text-yellow-400 font-bold text-sm">⏳ Awaiting Meta review</p>
                        <p className="text-yellow-400/70 text-xs">Template submitted. Meta usually approves within 1–24 hours. Come back to check.</p>
                        <button
                          onClick={waRefreshStatus}
                          disabled={waCheckingStatus}
                          className="text-xs text-yellow-400 hover:text-yellow-300 font-bold flex items-center gap-1.5 transition-colors"
                        >
                          {waCheckingStatus ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                          Check status now
                        </button>
                      </div>
                    )}

                    {settings.waTemplateStatus === 'REJECTED' && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                        <p className="text-red-400 font-bold text-sm">❌ Template rejected by Meta</p>
                        <p className="text-red-400/70 text-xs mt-1">This sometimes happens with cold outreach templates. Contact support and we&apos;ll help resubmit with a revised message.</p>
                      </div>
                    )}

                    {waTemplateError && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">{waTemplateError}</div>
                    )}

                    {!settings.waTemplateStatus && (
                      <button
                        onClick={waCreateTemplate}
                        disabled={waCreatingTemplate}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
                      >
                        {waCreatingTemplate
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting to Meta…</>
                          : <><Send className="w-4 h-4" /> Create & Submit Template</>}
                      </button>
                    )}

                    <button
                      onClick={() => { set('waPhoneNumberId', ''); set('wabaId', ''); set('waDisplayPhone', ''); set('waTemplateStatus', ''); }}
                      className="text-xs text-gray-600 hover:text-gray-400 transition-colors w-full text-center"
                    >
                      ← Change number
                    </button>
                  </div>
                )}

                {/* ── STEP 3: Ready ── */}
                {waStep === 3 && (
                  <div className="space-y-5 pt-2 text-center">
                    <div className="py-5">
                      <div className="w-16 h-16 bg-green-500/15 border border-green-500/25 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-green-400" />
                      </div>
                      <p className="text-white font-bold text-lg">WhatsApp Business API is active</p>
                      <p className="text-gray-500 text-sm mt-1">
                        The <strong className="text-white">API Send</strong> button now appears on every prospect card with a phone number.
                      </p>
                    </div>

                    <div className="text-left space-y-3 bg-gray-800/40 border border-white/8 rounded-xl px-4 py-4">
                      <div className="flex items-center gap-2.5 text-sm">
                        <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                        <span className="text-gray-500">Phone</span>
                        <span className="text-white font-semibold text-sm ml-auto">{settings.waDisplayPhone || settings.waPhoneNumberId}</span>
                      </div>
                      <div className="flex items-center gap-2.5 text-sm">
                        <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
                        <span className="text-gray-500">Template</span>
                        <span className="text-green-400 font-semibold text-sm ml-auto">✅ Approved</span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        set('waPhoneNumberId', ''); set('waAccessToken', ''); set('waTemplateName', '');
                        set('wabaId', ''); set('waDisplayPhone', ''); set('waTemplateStatus', '');
                        setHasExistingWaToken(false);
                      }}
                      className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                    >
                      Disconnect / change number
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Save button */}
          {tab !== 'security' && (
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
          )}
        </div>

        {session?.user && (
          <p className="text-center text-gray-600 text-xs mt-6">
            Logged in as <span className="text-gray-400">{session.user.email}</span>
          </p>
        )}
      </div>
      </div>
    </div>
  );
}
