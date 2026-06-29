import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ProspectsProvider } from '@/context/ProspectsContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { UpgradeProvider } from '@/context/UpgradeContext';
import ConditionalNav from '@/components/ConditionalNav';
import AuthProvider from '@/components/AuthProvider';
import InstallBanner from '@/components/InstallBanner';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#030712',
};

export const metadata: Metadata = {
  title: 'AI Prospect Finder — Find Businesses That Need a Website',
  description: 'Discover local businesses with no website. Generate AI-powered outreach instantly.',
  manifest: '/manifest.json',
  icons: {
    apple: '/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ProspectAI',
  },
};

// Inline scripts run before React hydration
const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('aip_theme') || 'dark';
    document.documentElement.classList.add(t);
  } catch(e) {
    document.documentElement.classList.add('dark');
  }
})();
`;

const swScript = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js');
  });
}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: swScript }} />
      </head>
      <body className={`${inter.className} bg-gray-950 text-white antialiased`}>
        <AuthProvider>
          <ThemeProvider>
            <ProspectsProvider>
              <UpgradeProvider>
                <ConditionalNav>
                  {children}
                </ConditionalNav>
                <InstallBanner />
              </UpgradeProvider>
            </ProspectsProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
