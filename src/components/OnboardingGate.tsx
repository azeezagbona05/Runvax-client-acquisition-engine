'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import VerifyEmailModal from './VerifyEmailModal';

const SEEN_KEY = 'aip_verify_prompt_seen';

/**
 * What a new account sees after sign-up. The step-by-step onboarding wizard is switched off:
 * the one thing that matters first is verifying the email, because prospects stay locked until
 * then. So an unverified account gets a single "verify your email" prompt, once per browser
 * session (closable; the banner in the nav and the prospect-card gate keep reminding them).
 */
export default function OnboardingGate() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  const verified = !!(session?.user as { emailVerified?: unknown } | undefined)?.emailVerified;

  useEffect(() => {
    if (status !== 'authenticated' || verified) { setShow(false); return; }
    // Pages that handle verification themselves, or where a popup would get in the way.
    if (pathname.startsWith('/auth') || pathname.startsWith('/claim-pro') || pathname.startsWith('/settings')) return;
    try {
      if (sessionStorage.getItem(SEEN_KEY)) return;
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch { /* private mode: show it anyway */ }
    setShow(true);
  }, [status, verified, pathname]);

  if (!show) return null;
  return <VerifyEmailModal mode="verify" headline="Verify your email to get started" onClose={() => setShow(false)} />;
}
