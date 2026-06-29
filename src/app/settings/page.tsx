'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Save, Loader2, CheckCircle, AlertCircle, Send, User, Mail, Target, Eye, EyeOff, Landmark } from 'lucide-react';

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
  senderName: '', businessName: '', whatsapp: '', replyEmail: '', city: '', tagline: '',
  smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '', smtpFrom: '',
  bankName: '', bankAccount: '', bankAcctName: '', paymentLink: '',
};

type Tab = 'profile' | 'email' | 'payment' | 'goals';

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
        body: JSON.stringify(settings),
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
  ];

  return (
    <div className="min-h-dvh bg-gray-950 py-4 sm:py-10 px-4">
      <div className="max-w-2xl mx-auto">

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
