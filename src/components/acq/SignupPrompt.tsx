'use client';

import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { X } from 'lucide-react';
import { DEFAULT_HOME } from '@/lib/home';

/** The moment a signed-out visitor reaches for something that needs an account. Says exactly what they get and keeps the way back to their search. */
export default function SignupPrompt({ reason, onClose }: { reason: string; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="Create a free account" style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,.55)' }} />
      <div className="acq-card" style={{ position: 'relative', width: '100%', maxWidth: 400, padding: 28, textAlign: 'center' }}>
        <button onClick={onClose} aria-label="Close" className="acq-icon-btn" style={{ position: 'absolute', top: 10, right: 10 }}><X size={18} /></button>
        <h2 className="acq-title" style={{ fontSize: 20, marginBottom: 8 }}>Create a free account to continue</h2>
        <p className="acq-sub" style={{ marginBottom: 20 }}>{reason} Your search will be waiting for you.</p>
        <button className="acq-btn acq-btn-primary" style={{ width: '100%', marginBottom: 10 }} onClick={() => void signIn('google', { callbackUrl: DEFAULT_HOME })}>Continue with Google</button>
        <Link href="/auth/signup" className="acq-btn" style={{ width: '100%', marginBottom: 14 }}>Sign up with email</Link>
        <p className="acq-faint" style={{ fontSize: 13 }}>Already have an account? <Link href="/auth/signin" style={{ textDecoration: 'underline' }}>Sign in</Link></p>
      </div>
    </div>
  );
}
