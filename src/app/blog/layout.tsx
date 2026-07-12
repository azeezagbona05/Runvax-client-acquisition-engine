import type { Metadata } from 'next';
import { SITE_URL, SITE_NAME } from '@/lib/seo';

const TITLE = 'Blog — Web Design Client Tips, Lead Gen Guides | Runvax';
const DESC = 'Practical guides for freelance web designers and agencies: how to find clients, write cold emails, and grow your web design business in Nigeria, Ghana, Kenya, UK, and beyond.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESC,
  alternates: { canonical: `${SITE_URL}/blog` },
  keywords: [
    'web design client tips', 'freelance web designer blog',
    'how to find web design clients', 'cold email templates web designers',
    'web design business Nigeria', 'lead generation guide freelancers',
    'web design agency growth', 'prospect outreach tips',
  ],
  openGraph: {
    title: TITLE, description: DESC,
    url: `${SITE_URL}/blog`, siteName: SITE_NAME,
    images: [{ url: `${SITE_URL}/og`, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC, images: [`${SITE_URL}/og`] },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
