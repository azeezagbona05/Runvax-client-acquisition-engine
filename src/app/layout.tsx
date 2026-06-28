import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ProspectsProvider } from '@/context/ProspectsContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { UpgradeProvider } from '@/context/UpgradeContext';
import ConditionalNav from '@/components/ConditionalNav';
import AuthProvider from '@/components/AuthProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AI Prospect Finder — Find Businesses That Need a Website',
  description: 'Discover local businesses with no website. Generate AI-powered Lovable prompts instantly.',
};

// Inline script runs before React hydration — prevents theme flash
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${inter.className} bg-gray-950 text-white antialiased`}>
        <AuthProvider>
          <ThemeProvider>
            <ProspectsProvider>
              <UpgradeProvider>
                <ConditionalNav />
                {children}
              </UpgradeProvider>
            </ProspectsProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
