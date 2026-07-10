import type { Metadata } from 'next';
import { SITE_URL, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Runvax (operated by Runvax, Lagos) collects, uses, and protects your data. GDPR-aligned privacy policy for our AI lead generation platform.',
  alternates: { canonical: `${SITE_URL}/privacy` },
  openGraph: { title: 'Privacy Policy', siteName: SITE_NAME, url: `${SITE_URL}/privacy` },
  robots: { index: true, follow: true },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
