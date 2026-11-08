'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { ShieldCheck, Loader2, Fingerprint, Mail, ArrowLeft } from 'lucide-react';

/** What this browser remembers about admin sign-in: which address, and whether biometric was set up here. Never a password or a token. */
const KEY = 'rv_admin';
const read = (): { email?: string; bio?: boolean } => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; } };
const write = (v: { email?: string; bio?: boolean }) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ } };

type View = 'bio' | 'email' | 'code';
const card = 'bg-gray-900 border border-white/10 rounded-2xl p-8 shadow-2xl';
const field = 'w-full bg-gray-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-colors';
const primary = 'w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2';
const link = 'text-sm text-gray-400 hover:text-white underline-offset-4 hover:underline';

export default function AdminLoginPage() {
  const { data: session, status } = useSession();
  const [view, setView] = useState<View>('email');
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [bioHere, setBioHere] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const tried = useRef(false);

  // Already signed in as admin: straight to the panel.
  useEffect(() => { if (status === 'authenticated' && (session?.user as { isAdmin?: boolean })?.isAdmin) window.location.assign('/admin'); }, [status, session]);

  // A device that has biometric set up opens on biometric; anything else opens on the email box.
  useEffect(() => {
    const s = read(); setEmail(s.email ?? '');
    if (s.bio && s.email) { setBioHere(true); setView('bio'); }
    setReady(true);
  }, []);

  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(t); }, [wait]);

  const done = useCallback((addr: string, bio: boolean) => { write({ email: addr, bio }); window.location.assign('/admin'); }, []);

  const biometric = useCallback(async (addr: string) => {
    setBusy(true); setError(''); setNote('');
    try {
      const o = await fetch(`/api/admin-auth/biometric?email=${encodeURIComponent(addr)}`);
      const opts = await o.json();
      if (!o.ok) { setError(opts.error || 'Biometric is not available here.'); setBusy(false); return; }
      const { startAuthentication } = await import('@simplewebauthn/browser');
      const response = await startAuthentication({ optionsJSON: opts });
      const v = await fetch('/api/admin-auth/biometric', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response }) });
      const j = await v.json().catch(() => ({}));
      if (!v.ok) { setError(j.error || 'Biometric check failed.'); setBusy(false); return; }
      done(addr, true);
    } catch (e) {
      const name = (e as { name?: string })?.name;
      setError(name === 'NotAllowedError' ? 'Biometric was cancelled. Tap the button to try again, or use an email code.' : 'Biometric did not work on this device. Use an email code instead.');
      setBusy(false);
    }
  }, [done]);

  // Offer the biometric prompt straight away on a device that has it.
  useEffect(() => { if (ready && view === 'bio' && email && !tried.current) { tried.current = true; void biometric(email); } }, [ready, view, email, biometric]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault(); if (!email.trim()) return;
    setBusy(true); setError(''); setNote('');
    const r = await fetch('/api/admin-auth/code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    const j = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok) { setError(j.error || 'Could not send a code.'); return; }
    setView('code'); setCode(''); setWait(60); setNote(`If ${email.trim()} can sign in here, a 6-digit code is on its way. It lasts 10 minutes.`);
  }

  async function verify(value = code) {
    if (!/^\d{6}$/.test(value)) { setError('Enter the 6-digit code from your email.'); return; }
    setBusy(true); setError('');
    const r = await fetch('/api/admin-auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code: value }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error || 'That code did not work.'); setBusy(false); setCode(''); return; }
    done(email.trim().toLowerCase(), bioHere);
  }

  if (status === 'loading' || !ready) {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><Loader2 className="w-6 h-6 text-purple-400 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-purple-900/30"><ShieldCheck className="w-7 h-7 text-white" /></div>
          <h1 className="text-xl font-black text-white">Admin Access</h1>
          <p className="text-gray-500 text-sm mt-1">Restricted area</p>
        </div>

        <div className={card}>
          {error && <div role="alert" className="bg-red-500/10 border border-red-500/25 text-red-400 text-sm rounded-xl px-4 py-3 mb-5">{error}</div>}
          {note && !error && <div role="status" className="bg-purple-500/10 border border-purple-500/25 text-purple-200 text-sm rounded-xl px-4 py-3 mb-5">{note}</div>}

          {view === 'bio' && (
            <div className="space-y-5 text-center">
              <p className="text-gray-400 text-sm">Welcome back<br /><b className="text-white break-all">{email}</b></p>
              <button type="button" onClick={() => void biometric(email)} disabled={busy} className={primary}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-5 h-5" />} Use biometric
              </button>
              <div className="space-y-2 pt-1">
                <button type="button" className={link} onClick={() => { setView('email'); setError(''); setNote(''); }}>Use an email code instead (new device)</button><br />
                <button type="button" className={link} onClick={() => { setEmail(''); setBioHere(false); write({}); setView('email'); setError(''); }}>Not you?</button>
              </div>
            </div>
          )}

          {view === 'email' && (
            <form onSubmit={sendCode} className="space-y-4">
              <div>
                <label htmlFor="admin-email" className="block text-xs font-bold text-gray-400 mb-1.5">Admin email</label>
                <input id="admin-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={field} />
              </div>
              <button type="submit" disabled={busy || !email.trim()} className={primary}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Email me a code</button>
              {bioHere && <div className="text-center"><button type="button" className={link} onClick={() => { setView('bio'); tried.current = false; setError(''); }}>Use biometric instead</button></div>}
              <p className="text-gray-600 text-xs text-center">No password. After you sign in you can set up biometric on this device.</p>
            </form>
          )}

          {view === 'code' && (
            <form onSubmit={(e) => { e.preventDefault(); void verify(); }} className="space-y-4">
              <div>
                <label htmlFor="admin-code" className="block text-xs font-bold text-gray-400 mb-1.5">6-digit code</label>
                <input id="admin-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} autoFocus value={code}
                  onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setCode(v); if (v.length === 6) void verify(v); }}
                  placeholder="000000" className={`${field} text-center text-2xl tracking-[0.5em] font-mono`} />
              </div>
              <button type="submit" disabled={busy || code.length !== 6} className={primary}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Sign in</button>
              <div className="flex items-center justify-between">
                <button type="button" className={`${link} inline-flex items-center gap-1`} onClick={() => { setView(bioHere ? 'bio' : 'email'); tried.current = true; setError(''); setNote(''); }}><ArrowLeft className="w-3.5 h-3.5" /> Back</button>
                <button type="button" className={link} disabled={wait > 0 || busy} onClick={() => void sendCode()} style={{ opacity: wait > 0 ? 0.5 : 1 }}>{wait > 0 ? `Send again in ${wait}s` : 'Send a new code'}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
