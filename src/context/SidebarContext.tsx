'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface SidebarCtx {
  collapsed: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarCtx>({ collapsed: false, toggle: () => {} });

export function SidebarProvider({ children }: { children: ReactNode }) {
  // Collapsed by default — opens via the top toggle (no auto-collapse)
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('aip_sidebar_collapsed');
      if (saved !== null) setCollapsed(saved === '1');
    } catch { /* */ }
  }, []);

  const toggle = () => {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem('aip_sidebar_collapsed', next ? '1' : '0'); } catch { /* */ }
      return next;
    });
  };

  return (
    <SidebarContext.Provider value={{ collapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

export const useSidebar = () => useContext(SidebarContext);
