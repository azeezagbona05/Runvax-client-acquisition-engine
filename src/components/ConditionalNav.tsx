'use client';

import { usePathname } from 'next/navigation';
import Nav from './Nav';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import OnboardingGate from './OnboardingGate';
import QuestTracker from './QuestTracker';
import CoachHint from './CoachHint';
import AssistantWidget from './AssistantWidget';
import { SidebarProvider, useSidebar } from '@/context/SidebarContext';

function AppShell({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  const pathname = usePathname();
  const isAuth = pathname.startsWith('/auth');

  return (
    <>
      {/* Sidebar — desktop only (rendered inside provider so it can read collapsed state) */}
      {!isAuth && <Sidebar />}

      {/* Main content — shifts right on desktop to clear the sidebar */}
      <div
        className={[
          !isAuth ? 'app-content' : '',
          !isAuth ? (collapsed ? 'lg:pl-16' : 'lg:pl-60') : '',
          'transition-[padding-left] duration-300 ease-in-out',
        ].join(' ')}
      >
        {!isAuth && <TopBar />}
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
