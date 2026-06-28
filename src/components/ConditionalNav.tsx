'use client';

import { usePathname } from 'next/navigation';
import Nav from './Nav';
import OnboardingGate from './OnboardingGate';

// Suppress main Nav and Onboarding on admin routes — they have their own layout
export default function ConditionalNav() {
  const pathname = usePathname();
  if (pathname.startsWith('/admin')) return null;
  return (
    <>
      <Nav />
      <OnboardingGate />
    </>
  );
}
