'use client';

import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Nav from './Nav';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import OnboardingGate from './OnboardingGate';
import QuestTracker from './QuestTracker';
import CoachHint from './CoachHint';
import AssistantWidget from './AssistantWidget';
import V2SwitchBanner from './V2SwitchBanner';
import { SiteBanner } from './SiteNotice';
import { SidebarProvider, useSidebar } from '@/context/SidebarContext';

function AppShell({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  const pathname = usePathname();
  const isAuth = pathname.startsWith('/auth');
  // Signed-out visitors get no sidebar (nothing to navigate yet); it appears once they sign in.
  const { status } = useSession();
  const showSidebar = !isAuth && status !== 'unauthenticated';

  return (
    <>
      {/* Sidebar — desktop only (rendered inside provider so it can read collapsed state) */}
      {showSidebar && <Sidebar />}

      {/* Main content — shifts right on desktop to clear the sidebar */}
      <div
        className={[
          !isAuth ? 'app-content' : '',
          showSidebar ? (collapsed ? 'lg:pl-16' : 'lg:pl-60') : '',
          'transition-[padding-left] duration-300 ease-in-out',
        ].join(' ')}
      >
        {!isAuth && <TopBar />}
        {!isAuth && <SiteBanner />}
        {!isAuth && <V2SwitchBanner />}
        {!isAuth && <CoachHint />}
        {children}
      </div>
      {!isAuth && <QuestTracker />}
      {!isAuth && <AssistantWidget />}
    </>
  );
}

export default function ConditionalNav({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Admin routes, public demo sites and Client Acquisition have their own standalone layout
  if (pathname.startsWith('/admin') || pathname.startsWith('/demo') || pathname.startsWith('/client-acquisition')) return <>{children}</>;

  return (
    <SidebarProvider>
      <Nav />
      <OnboardingGate />
      <AppShell>{children}</AppShell>
    </SidebarProvider>
  );
}
