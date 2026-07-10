import type { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SITE_URL, SITE_NAME } from '@/lib/seo';

const TITLE = 'AI Market Brief — Find Web Design Opportunities in Any City';
const DESC = 'Get an AI-generated market intelligence brief for any city and industry. Understand local business demand, web design opportunities, and lead volume before you prospect.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESC,
  alternates: { canonical: `${SITE_URL}/market-brief` },
  keywords: [
    'AI market brief', 'local market analysis tool', 'web design opportunity finder',
    'AI business insights by city', 'web design market research',
    'local business landscape analysis', 'lead market data by city',
  ],
  openGraph: {
    title: TITLE, description: DESC,
    url: `${SITE_URL}/market-brief`, siteName: SITE_NAME,
    images: [{ url: `${SITE_URL}/og-image.png`, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC, images: [`${SITE_URL}/og-image.png`] },
};

export default async function MarketBriefLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/auth/signin');
  return <>{children}</>;
}
