import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ProspectsProvider } from '@/context/ProspectsContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { UpgradeProvider } from '@/context/UpgradeContext';
import { PlanFeaturesProvider } from '@/context/PlanFeaturesContext';
import ConditionalNav from '@/components/ConditionalNav';
import AuthProvider from '@/components/AuthProvider';
import InstallBanner from '@/components/InstallBanner';
import WaDailyCounter from '@/components/WaDailyCounter';
import { ToastProvider } from '@/components/Toast';
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '@/lib/seo';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)',  color: '#030712' },
  ],
};

const TITLE = 'Runvax — Find Businesses That Need a Website';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: `%s — ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  keywords: [
    // Core product
    'Runvax', 'AI prospect finder', 'AI lead generation tool', 'business lead finder',
    // Primary intent — finding clients
    'find web design clients', 'how to find web design clients', 'get web design leads',
    'find freelance web design clients', 'web design lead generation', 'web design client finder',
    'web design client acquisition', 'find clients as a web designer',
    // Businesses without websites
    'find businesses without a website', 'businesses that need a website',
    'local businesses no website', 'businesses without online presence',
    'small businesses without websites', 'identify businesses lacking online presence',
    // Lead generation
    'lead generation for web designers', 'lead generation for digital agencies',
    'agency lead generation tool', 'local business lead generation',
    'b2b lead generation platform', 'freelancer client finder',
    'sales prospecting tool', 'prospect finder app', 'business prospecting software',
    // Cold outreach & AI
    'AI cold email generator', 'AI outreach message generator', 'cold email tool for agencies',
    'AI WhatsApp message generator', 'AI proposal generator', 'cold outreach small businesses',
    'personalized cold email web design', 'automated cold outreach',
    // Industries
    'restaurant leads', 'salon leads', 'law firm leads', 'clinic leads',
    'real estate leads', 'gym leads', 'hotel leads', 'school leads',
    // Locations — Africa
    'business leads Nigeria', 'web design leads Lagos', 'business leads Ghana',
    'business leads Accra', 'business leads Kenya', 'business leads Nairobi',
    'business leads South Africa', 'business leads Johannesburg',
    // Locations — International
    'business leads UK', 'business leads USA', 'business leads Canada',
    // Long-tail & questions
    'how to find local businesses without a website', 'best lead generation tool for web designers',
    'how to get web design clients fast', 'find clients for web development agency',
    'tools for finding web design prospects', 'where to find small business leads',
  ],
  alternates: { canonical: SITE_URL },
  manifest: '/manifest.json',
  icons: { apple: '/icon-192.png' },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: SITE_NAME,
  },
  authors:   [{ name: 'Runvax', url: SITE_URL }],
  creator:   'Runvax',
  publisher: 'Runvax',
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: TITLE,
    description: SITE_DESCRIPTION,
    locale: 'en_US',
    // Replace /og-image.png with a 1200×630 branded banner once designed
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Runvax — Find Businesses That Need a Website' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: SITE_DESCRIPTION,
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'Runvax',
      legalName: 'Runvax',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png`, width: 512, height: 512 },
      contactPoint: { '@type': 'ContactPoint', email: 'info@runvax.com', contactType: 'customer support' },
      address: { '@type': 'PostalAddress', addressLocality: 'Lagos', addressCountry: 'NG' },
      foundingDate: '2024',
      sameAs: [],
    },
    {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/?industry={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'HowTo',
      name: 'How to Find Local Businesses That Need a Website',
      description: 'Use Runvax to find businesses with no website in any city and generate AI cold outreach in seconds.',
      totalTime: 'PT2M',
      step: [
        {
          '@type': 'HowToStep',
          position: 1,
          name: 'Search any industry in any city',
          text: 'Select your target industry (restaurant, salon, law firm, clinic, gym, etc.) and type any city in Nigeria, Ghana, Kenya, South Africa, UK, USA, or Canada.',
          url: `${SITE_URL}/`,
        },
        {
          '@type': 'HowToStep',
          position: 2,
          name: 'Identify businesses with no website',
          text: 'Runvax flags every business that has no website. These are your highest-priority leads — businesses missing online presence most likely to need your services.',
          url: `${SITE_URL}/`,
        },
        {
          '@type': 'HowToStep',
          position: 3,
          name: 'Send AI-generated cold outreach',
          text: 'Click Generate to create a personalized cold email, WhatsApp message, or business proposal tailored to the specific business name, industry, and location.',
          url: `${SITE_URL}/`,
        },
      ],
    },
    {
      '@type': 'SoftwareApplication',
      name: SITE_NAME,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: SITE_DESCRIPTION,
      url: SITE_URL,
      featureList: [
        'Search any business type in any city worldwide',
        'Find local businesses with no website',
        'AI-generated cold emails personalized to each prospect',
        'AI-generated WhatsApp outreach messages',
        'AI-generated business proposals',
        'Lead pipeline and prospect management',
        'Supported in Nigeria, Ghana, Kenya, South Africa, UK, USA, Canada',
      ],
      offers: [
        { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'NGN', description: '5 searches per day, 20 results, 15 AI calls' },
        { '@type': 'Offer', name: 'Pro', price: '9999', priceCurrency: 'NGN', description: '20 searches per day, 60 results, 200 AI calls' },
        { '@type': 'Offer', name: 'Agency', price: '24999', priceCurrency: 'NGN', description: 'Unlimited searches, results, and AI calls' },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is Runvax?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Runvax is an AI-powered lead generation tool for web designers, freelancers, and digital agencies. It searches any business type in any city worldwide and surfaces businesses with no website, so you can find your next paying client in seconds.',
          },
        },
        {
          '@type': 'Question',
          name: 'How do I find businesses that need a website?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Runvax searches Google\'s real-time global business index for any industry and location, then automatically flags every listing that has no website. You can filter by industry — restaurants, salons, law firms, clinics, gyms, hotels, and 16 more categories — and by city or country.',
          },
        },
        {
          '@type': 'Question',
          name: 'How do freelancers and agencies find web design clients?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'The fastest way is to search for local businesses in your target industry that have no website. Runvax does this automatically — search any city, select an industry, and get a list of businesses with phone numbers, addresses, ratings, and a no-website flag so you know exactly who to pitch.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can Runvax generate cold outreach emails and WhatsApp messages?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. For every prospect found, Runvax generates a personalized cold email, WhatsApp message, and formal proposal using AI. The messages are written in a natural tone, tailored to the specific business, and avoid generic AI-sounding language.',
          },
        },
        {
          '@type': 'Question',
          name: 'What industries can I search for leads?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Runvax covers 22+ industries including Restaurants & Eateries, Beauty Salons & Spas, Barbers & Hair Salons, Schools & Private Tutors, Clinics & Hospitals, Pharmacies, Real Estate Agencies, Hotels & Guesthouses, Event Centers, Law Firms, Auto Workshops, Fashion & Boutiques, Photography Studios, Gyms, Construction, Catering Services, Churches, Travel Agencies, Supermarkets, Laundry Services, Printing & Design Shops, and Accounting Firms. You can also type any custom industry.',
          },
        },
        {
          '@type': 'Question',
          name: 'Which countries does Runvax support?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Runvax supports Nigeria, Ghana, Kenya, South Africa, Uganda, Tanzania, Rwanda, Senegal, Cameroon, United States, United Kingdom, and Canada. Any city within these countries can be searched for business leads.',
          },
        },
        {
          '@type': 'Question',
          name: 'How do I find web design clients in Nigeria or Ghana?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Select Nigeria or Ghana from the country selector, enter any city (Lagos, Abuja, Port Harcourt, Accra, Kumasi, etc.), choose an industry, and Runvax returns local businesses in that city with their contact details and website status. Businesses with no website are your highest-priority leads.',
          },
        },
        {
          '@type': 'Question',
          name: 'What is the best lead generation tool for web designers?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Runvax is purpose-built for web designers, freelancers, and agencies who want to find local businesses without a website. Unlike generic B2B databases, it searches in real time for any city worldwide, flags no-website businesses automatically, and generates personalized cold outreach in one click.',
          },
        },
        {
          '@type': 'Question',
          name: 'How do I generate leads for a digital marketing agency?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Use Runvax to search any industry and city for businesses with low or no online presence. You can search multiple industries (restaurants, salons, law firms, etc.) across multiple cities, save prospects to a pipeline, and send AI-generated cold emails or WhatsApp messages directly from the platform.',
          },
        },
        {
          '@type': 'Question',
          name: 'Is Runvax free?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Runvax has a free plan with 5 searches per day and 20 results per search. Paid plans start at ₦9,999 per month (Pro) for 20 searches and 60 results, and ₦24,999 per month (Agency) for unlimited searches and results.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can I find restaurant, salon, or law firm leads with Runvax?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Runvax includes dedicated categories for restaurants, beauty salons, barbers, law firms, clinics, gyms, real estate agencies, hotels, and 14+ more industries. Search any of these in any city to get a targeted list of leads with contact info and website status.',
          },
        },
        {
          '@type': 'Question',
          name: 'How does AI cold email generation work in Runvax?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'After finding a business, click Generate and Runvax\'s AI writes a personalized cold email using the business name, industry, location, and your agency details from your profile. The email is natural, conversational, avoids spam triggers, and ends with your full professional signature.',
          },
        },
        {
          '@type': 'Question',
          name: 'What is the best way to find local businesses without a website?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'The most efficient method is to use a tool like Runvax that queries Google\'s business index and automatically filters for listings with no website URL. This surfaces hundreds of potential clients per search that you can contact directly with a personalized pitch.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can I manage prospects and track outreach in Runvax?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Runvax includes a built-in pipeline where you can save businesses, move them through stages (Found, Contacted, Interested, Proposal Sent, Won, Lost), add notes, set reminders, and track all outreach conversations in one place.',
          },
        },
        {
          '@type': 'Question',
          name: 'How much does Runvax cost?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Runvax has a free plan with no credit card required (5 searches/day). Pro is ₦9,999/month (~$6 USD / £5 GBP) with 20 searches/day and 60 results. Agency is ₦24,999/month (~$15 USD / £12 GBP) with unlimited searches, results, and AI calls.',
          },
        },
        {
          '@type': 'Question',
          name: 'Is Runvax available in the UK and USA?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Runvax supports cities in the United Kingdom (London, Manchester, Birmingham) and the United States (New York, Houston, Chicago, Los Angeles) in addition to Nigeria, Ghana, Kenya, South Africa, Uganda, Tanzania, Rwanda, Senegal, and Cameroon.',
          },
        },
        {
          '@type': 'Question',
          name: 'What is the difference between Runvax Free and Pro?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Free plan: 5 searches/day, 20 results/search, 15 AI messages/day — no credit card. Pro plan (₦9,999/month): 20 searches/day, 60 results/search, 200 AI calls/day. Agency plan (₦24,999/month): unlimited everything plus bulk email blast.',
          },
        },
      ],
    },
  ],
};

// Inline scripts run before React hydration
const themeScript = `
(function(){
  try {
    var t = localStorage.getItem('aip_theme') || 'light';
    document.documentElement.classList.add(t);
  } catch(e) {
    document.documentElement.classList.add('light');
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body className={`${inter.className} bg-gray-950 text-white antialiased`}>
        <AuthProvider>
          <ThemeProvider>
            <ProspectsProvider>
              <PlanFeaturesProvider>
                <UpgradeProvider>
                  <ToastProvider>
                  <ConditionalNav>
                    {children}
                  </ConditionalNav>
                  <InstallBanner />
                  <WaDailyCounter />
                  </ToastProvider>
                </UpgradeProvider>
              </PlanFeaturesProvider>
            </ProspectsProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
