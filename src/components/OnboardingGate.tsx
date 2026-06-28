'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import OnboardingWizard from './OnboardingWizard';

export default function OnboardingGate() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return;
    // Don't show on auth or settings pages
    if (pathname.startsWith('/auth') || pathname.startsWith('/settings')) return;

    fetch('/api/user/settings')
      .then((r) => r.json())
      .then((s: { onboardingDone?: boolean }) => {
        if (!s.onboardingDone) setShow(true);
      })
      .catch(() => {});
  }, [status, session, pathname]);

  if (!show) return null;
  return <OnboardingWizard onComplete={() => setShow(false)} />;
}
