import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Find Web Design Clients in Accra — ProspectAI',
  description:
    'Find businesses in Accra, Ghana that need a website. Search East Legon, Osu, Tema, Kumasi, and more. AI cold outreach included. Free plan available.',
  alternates: { canonical: `${SITE_URL}/web-design-clients-accra` },
  openGraph: {
    title: 'Find Web Design Clients in Accra — ProspectAI',
    description:
      'ProspectAI finds Accra businesses with no website. Search East Legon, Osu, Tema and pitch with AI cold outreach. Free plan.',
    url: `${SITE_URL}/web-design-clients-accra`,
  },
};

const areas = [
  'East Legon', 'Osu', 'Labone', 'Adabraka', 'Tema', 'Airport Residential',
  'Spintex', 'Madina', 'Achimota', 'Dansoman', 'Nungua', 'Kasoa', 'Accra CBD',
  'Kaneshie', 'Kumasi', 'Takoradi', 'Cape Coast',
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Find Web Design Clients in Accra',
  url: `${SITE_URL}/web-design-clients-accra`,
  about: { '@type': 'City', name: 'Accra', addressCountry: 'GH' },
};

export default function AccraPage() {
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
              Accra, Ghana
            </span>
            <h1 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
              Find Web Design Clients<br />
              <span className="text-indigo-400">in Accra, Ghana</span>
            </h1>
            <p className="text-gray-400 text-lg mb-8 max-w-2xl">
              Accra is West Africa&apos;s tech hub — and thousands of local businesses still have no
              website. East Legon restaurants, Osu boutiques, Tema logistics companies. ProspectAI
              finds them all in real time.
            </p>
            <a
              href="/?city=Accra&country=GH"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-semibold px-8 py-4 rounded-xl text-lg"
            >
              Search Accra businesses →
            </a>
          </div>

          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Areas to search in Greater Accra</h2>
            <div className="flex flex-wrap gap-2">
              {areas.map((n) => (
                <span key={n} className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-400">
                  {n}
                </span>
              ))}
            </div>
          </div>

          <div className="mb-16 grid md:grid-cols-2 gap-6">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="font-bold text-lg mb-3">Why Ghana for web design clients?</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>• Ghana has one of Africa&apos;s highest mobile internet penetration rates</li>
                <li>• Rapidly growing SMB economy post-AfCFTA trade zone</li>
                <li>• Tourism sector (hotels, restaurants) booming since 2019 &ldquo;Year of Return&rdquo;</li>
                <li>• English-speaking — easier outreach without translation</li>
                <li>• GHS pricing (no FX volatility on local client deals)</li>
              </ul>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="font-bold text-lg mb-3">Best industries to target in Accra</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>• Restaurants and chop bars in East Legon &amp; Osu</li>
                <li>• Hair salons and beauty studios</li>
                <li>• Logistics and freight companies in Tema</li>
                <li>• Real estate agencies and estate developers</li>
                <li>• Schools and private coaching centres</li>
              </ul>
            </div>
          </div>

          <div className="rounded-2xl bg-indigo-900/30 border border-indigo-800/50 p-10 text-center">
            <h2 className="text-3xl font-bold mb-3">Start finding Accra clients today</h2>
            <p className="text-gray-400 mb-8">Free plan — no credit card. Search any Accra neighbourhood now.</p>
            <a
              href="/?city=Accra&country=GH"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-semibold px-10 py-4 rounded-xl text-lg"
            >
              Search Accra now →
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
