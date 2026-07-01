import type { Metadata } from 'next';
import { SITE_URL, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for ProspectAI — AI-powered lead generation for web designers and digital agencies. Read our usage terms, plan conditions, and acceptable use policy.',
  alternates: { canonical: `${SITE_URL}/terms` },
  openGraph: { title: 'Terms of Service', siteName: SITE_NAME, url: `${SITE_URL}/terms` },
  robots: { index: true, follow: true },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
