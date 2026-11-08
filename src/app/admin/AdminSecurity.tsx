'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Fingerprint, Check, Loader2, X } from 'lucide-react';

const KEY = 'rv_admin';
const read = (): { email?: string; bio?: boolean } => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; } };

/** After an email-code sign-in: offer to set up biometric on this device, so the next admin sign-in here opens on biometric. */
export default function AdminSecurity() {
  const { data: session } = useSession();
  const email = session?.user?.email?.toLowerCase() ?? '';
  const [state, setState] = useState<'hidden' | 'offer' | 'working' | 'done'>('hidden');
  const [error, setError] = useState('');

  useEffect(() => { if (!email) return; const s = read(); setState(s.bio && s.email === email ? 'hidden' : 'offer'); }, [email]);

  async function setup() {
    setState('working'); setError('');
    try {
      const { startRegistration } = await import('@simplewebauthn/browser');
      const o = await fetch('/api/auth/webauthn/register'); const options = await o.json();
      if (!o.ok) throw new Error(options.error || 'Could not start the setup.');
      let response;
      try { response = await startRegistration({ optionsJSON: options }); }
      catch (e) {
        // This device already has a RUNVAX passkey for this account: that is as good as set up.
        if ((e as { name?: string })?.name === 'InvalidStateError') { try { localStorage.setItem(KEY, JSON.stringify({ email, bio: true })); } catch { /* ignore */ } setState('done'); return; }
        throw e;
      }
      const v = await fetch('/api/auth/webauthn/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response, deviceName: `Admin: ${navigator.platform || 'this device'}`.slice(0, 60) }) });
      const j = await v.json().catch(() => ({}));
      if (!v.ok) throw new Error(j.error || 'The setup did not finish.');
      try { localStorage.setItem(KEY, JSON.stringify({ email, bio: true })); } catch { /* ignore */ }
      setState('done');
    } catch (e) {
      const n = (e as { name?: string })?.name;
      setError(n === 'NotAllowedError' ? 'The biometric prompt was cancelled. You can try again.' : (e as Error)?.message || 'Biometric could not be set up on this device.');
      setState('offer');
    }
  }

  if (state === 'hidden') return null;
  return (
    <div className="bg-purple-500/10 border border-purple-500/25 rounded-2xl px-5 py-4 flex items-start gap-4" role="region" aria-label="Biometric sign-in">
      <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">{state === 'done' ? <Check className="w-5 h-5 text-green-400" /> : <Fingerprint className="w-5 h-5 text-purple-300" />}</div>
      <div className="flex-1 min-w-0">
        {state === 'done' ? (<>
          <p className="text-white font-bold text-sm">Biometric is set up on this device</p>
          <p className="text-gray-400 text-sm mt-0.5">Next time you open the admin area here, it asks for your fingerprint, face or device PIN. On a new device, use an email code.</p>
        </>) : (<>
          <p className="text-white font-bold text-sm">Sign in faster next time</p>
          <p className="text-gray-400 text-sm mt-0.5">Set up biometric on this device. Your fingerprint or face never leaves it. You can always use an email code instead, for example on a new device.</p>
          {error && <p role="alert" className="text-red-400 text-sm mt-2">{error}</p>}
          <button type="button" onClick={() => void setup()} disabled={state === 'working'} className="mt-3 inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors">
            {state === 'working' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Fingerprint className="w-4 h-4" />} Set up biometric
          </button>
        </>)}
      </div>
      <button type="button" onClick={() => setState('hidden')} aria-label="Dismiss" className="text-gray-500 hover:text-white"><X className="w-4 h-4" /></button>
    </div>
  );
}
