'use client';

import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Running as installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    // Previously installed (caught via appinstalled event)
    if (localStorage.getItem('pwa_installed')) return;
    // User dismissed — don't show again for 30 days
    const dismissedAt = localStorage.getItem('pwa_dismissed_at');
    if (dismissedAt && Date.now() - Number(dismissedAt) < 30 * 24 * 60 * 60 * 1000) return;

    // Listen for successful install — permanently suppress banner
    const onInstalled = () => {
      localStorage.setItem('pwa_installed', '1');
      setShow(false);
    };
    window.addEventListener('appinstalled', onInstalled);

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(navigator as { standalone?: boolean }).standalone;
    if (ios) {
      setIsIOS(true);
      setShow(true);
      return () => window.removeEventListener('appinstalled', onInstalled);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem('pwa_installed', '1');
      setShow(false);
    }
    setPrompt(null);
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('pwa_dismissed_at', String(Date.now()));
  };

  if (!show) return null;

  return (
    <div className="fixed z-[60] left-3 right-3 sm:left-auto sm:right-4 sm:max-w-sm"
      style={{ bottom: `calc(env(safe-area-inset-bottom) + ${typeof window !== 'undefined' && window.innerWidth < 640 ? '4rem' : '1rem'})` }}>
      <div className="bg-gray-900 border border-purple-500/40 rounded-2xl p-4 shadow-2xl shadow-black/60 flex items-start gap-3">
        <img src="/logo.svg" alt="" className="w-10 h-10 rounded-xl flex-shrink-0 bg-gray-800" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm leading-tight">Add to Home Screen</p>
          {isIOS ? (
            <p className="text-gray-400 text-xs mt-1 leading-snug">
              Tap <Share className="inline w-3 h-3 mx-0.5 -mt-0.5" /> then <strong className="text-gray-300">&ldquo;Add to Home Screen&rdquo;</strong>
            </p>
          ) : (
            <>
              <p className="text-gray-400 text-xs mt-0.5">Install for a native app experience</p>
              <button
                onClick={handleInstall}
                className="mt-2.5 flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Install App
              </button>
            </>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-white flex-shrink-0 -mt-0.5 -mr-0.5"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
