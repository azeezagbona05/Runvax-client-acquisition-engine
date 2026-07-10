import type { Metadata } from 'next';
import { SITE_URL, SITE_NAME } from '@/lib/seo';

const TITLE = 'Runvax Pricing — Free Lead Gen Tool for Web Designers';
const DESC = 'Start free — no credit card. Find businesses without a website in any city. Pro from ₦9,999/month (~$6 USD). Agency unlimited. AI cold email included on all plans.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESC,
  alternates: { canonical: `${SITE_URL}/pricing` },
  keywords: [
    'Runvax pricing', 'lead gen tool for agencies pricing',
    'AI prospect finder plans', 'free lead generation tool for web designers',
    'affordable lead generation software', 'web design client finder cost',
    'agency prospecting tool pricing', 'cold outreach tool plans',
  ],
  openGraph: {
    title: TITLE, description: DESC,
    url: `${SITE_URL}/pricing`, siteName: SITE_NAME,
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC, images: [`${SITE_URL}/og-image.png`] },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
