'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle, XCircle, Info } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  exiting?: boolean;
}

interface ToastCtx {
  toast: (message: string, type?: ToastType) => void;
}

const Ctx = createContext<ToastCtx>({ toast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++counter.current;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => {
      setToasts((t) => t.map((x) => x.id === id ? { ...x, exiting: true } : x));
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 300);
    }, 2400);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      {/* Bottom snackbar stack — sits above mobile bottom nav (h-14 + safe area) */}
      <div
        className="fixed inset-x-0 z-[200] flex flex-col items-center gap-2 pointer-events-none px-4"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 4rem)' }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto w-full max-w-sm flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border text-sm font-semibold transition-all duration-300 ${
              t.exiting ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
            } ${
              t.type === 'error'
                ? 'bg-red-950 border-red-500/40 text-red-200'
                : t.type === 'info'
                ? 'bg-gray-800 border-white/12 text-gray-200'
                : 'bg-gray-800 border-white/12 text-white'
            }`}
          >
            {t.type === 'error' ? (
              <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            ) : t.type === 'info' ? (
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
            ) : (
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
            )}
            <span className="flex-1 leading-snug">{t.message}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
