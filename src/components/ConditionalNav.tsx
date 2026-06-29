'use client';

import { usePathname } from 'next/navigation';
import Nav from './Nav';
import OnboardingGate from './OnboardingGate';

// Suppress main Nav and Onboarding on admin routes — they have their own layout
export default function ConditionalNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith('/admin')) return <>{children}</>;

  const isAuth = pathname.startsWith('/auth');
  return (
    <>
      <Nav />
      <OnboardingGate />
      <div className={isAuth ? undefined : 'app-content'}>
        {children}
      </div>
    </>
  );
}
