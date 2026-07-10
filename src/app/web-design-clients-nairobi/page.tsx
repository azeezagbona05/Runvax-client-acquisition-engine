import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Find Web Design Clients in Nairobi — Runvax',
  description:
    'Find businesses in Nairobi, Kenya that need a website. Search Westlands, Karen, CBD, Mombasa Road, and everywhere. AI cold outreach included. Free plan.',
  alternates: { canonical: `${SITE_URL}/web-design-clients-nairobi` },
  openGraph: {
    title: 'Find Web Design Clients in Nairobi — Runvax',
    description:
      'Runvax finds Nairobi businesses with no website. Real-time search. AI cold outreach. Free plan available.',
    url: `${SITE_URL}/web-design-clients-nairobi`,
  },
};

const areas = [
  'Westlands', 'Karen', 'CBD', 'Kilimani', 'Lavington', 'Hurlingham',
  'Upperhill', 'Parklands', 'South B', 'South C', 'Embakasi', 'Kasarani',
  'Mombasa Road', 'Thika Road', 'Kiambu', 'Mombasa', 'Nakuru', 'Kisumu',
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Find Web Design Clients in Nairobi',
  url: `${SITE_URL}/web-design-clients-nairobi`,
  about: { '@type': 'City', name: 'Nairobi', addressCountry: 'KE' },
};

export default function NairobiPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-gray-950 text-white">
        <div className="max-w-4xl mx-auto px-4 py-16">
          <div className="mb-14">
            <span className="inline-block text-xs font-semibold tracking-widest uppercase text-indigo-400 mb-3">
              Nairobi, Kenya
            </span>
            <h1 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
              Find Web Design Clients<br />
              <span className="text-indigo-400">in Nairobi, Kenya</span>
            </h1>
            <p className="text-gray-400 text-lg mb-8 max-w-2xl">
              Nairobi is &ldquo;Silicon Savannah&rdquo; — East Africa&apos;s tech capital. Yet thousands of
              Westlands restaurants, Karen clinics, and CBD law firms still have no website. That is
              your opportunity. Runvax finds them in seconds.
            </p>
            <a
              href="/?city=Nairobi&country=KE"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-semibold px-8 py-4 rounded-xl text-lg"
            >
              Search Nairobi businesses →
            </a>
          </div>

          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Areas and cities to search in Kenya</h2>
            <div className="flex flex-wrap gap-2">
              {areas.map((n) => (
                <span key={n} className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-400">
                  {n}
                </span>
              ))}
            </div>
          </div>

          <div className="mb-16 bg-green-950/30 border border-green-900/40 rounded-2xl p-8">
            <h2 className="text-xl font-bold mb-4 text-green-400">
              Why Nairobi is a premium market for web designers
            </h2>
            <ul className="space-y-3 text-gray-300 text-sm">
              <li>• Kenya has Africa&apos;s best mobile payment infrastructure (M-Pesa) — e-commerce demand is high</li>
              <li>• Rapidly growing startup and SMB ecosystem in Westlands and Karen</li>
              <li>• Tourism sector recovering strongly — hotels and lodges need modern websites</li>
              <li>• NGO and donor-funded organizations require professional online presence</li>
              <li>• USD-denominated clients possible — many international businesses operate from Nairobi</li>
            </ul>
          </div>

          <div className="rounded-2xl bg-indigo-900/30 border border-indigo-800/50 p-10 text-center">
            <h2 className="text-3xl font-bold mb-3">Start finding Nairobi clients today</h2>
            <p className="text-gray-400 mb-8">Free plan — no credit card. Search any Nairobi area now.</p>
            <a
              href="/?city=Nairobi&country=KE"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-semibold px-10 py-4 rounded-xl text-lg"
            >
              Search Nairobi now →
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
