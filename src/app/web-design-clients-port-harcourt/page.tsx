import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Find Web Design Clients in Port Harcourt — Runvax',
  description:
    'Find businesses in Port Harcourt that need a website. Search GRA, Trans Amadi, Rumuola, Eleme, and every PH area. AI cold outreach included. Free plan.',
  alternates: { canonical: `${SITE_URL}/web-design-clients-port-harcourt` },
  openGraph: {
    title: 'Find Web Design Clients in Port Harcourt — Runvax',
    description:
      'Runvax finds Port Harcourt businesses with no website. Search oil servicing firms, hotels, restaurants in GRA, Trans Amadi and more.',
    url: `${SITE_URL}/web-design-clients-port-harcourt`,
  },
};

const areas = [
  'GRA Phase 1', 'GRA Phase 2', 'GRA Phase 3', 'Trans Amadi', 'Rumuola',
  'Rumuigbo', 'Eleme', 'Diobu', 'Borikiri', 'Mile 1', 'Mile 3', 'Mile 4',
  'Woji', 'Rumola', 'Elechi', 'Aggrey Road', 'Ada George', 'Obio/Akpor',
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Find Web Design Clients in Port Harcourt',
  url: `${SITE_URL}/web-design-clients-port-harcourt`,
  about: { '@type': 'City', name: 'Port Harcourt', addressCountry: 'NG' },
};

export default function PortHarcourtPage() {
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
              Port Harcourt, Nigeria
            </span>
            <h1 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
              Find Web Design Clients<br />
              <span className="text-indigo-400">in Port Harcourt</span>
            </h1>
            <p className="text-gray-400 text-lg mb-8 max-w-2xl">
              Port Harcourt is Nigeria&apos;s oil capital — and it is full of oil servicing companies,
              engineering firms, hotels, and restaurants that need professional websites. Runvax
              finds them for you, with contact details and AI outreach ready.
            </p>
            <a
              href="/?city=Port+Harcourt&country=NG"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-semibold px-8 py-4 rounded-xl text-lg"
            >
              Search Port Harcourt businesses →
            </a>
          </div>

          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Areas to search in Port Harcourt</h2>
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
              Why Port Harcourt is great for web designers
            </h2>
            <ul className="space-y-3 text-gray-300 text-sm">
              <li>• Oil and gas industry clients pay premium rates — budgets are higher than most Nigerian cities</li>
              <li>• Many small oil servicing companies need urgent professional web presence for tenders</li>
              <li>• GRA area restaurants, hotels, and event centres are underserved online</li>
              <li>• Expat community creates demand for bilingual English-focused websites</li>
              <li>• Less freelance competition than Lagos — easier to stand out</li>
            </ul>
          </div>

          <div className="rounded-2xl bg-indigo-900/30 border border-indigo-800/50 p-10 text-center">
            <h2 className="text-3xl font-bold mb-3">Start finding Port Harcourt clients today</h2>
            <p className="text-gray-400 mb-8">Free plan — no credit card.</p>
            <a
              href="/?city=Port+Harcourt&country=NG"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-semibold px-10 py-4 rounded-xl text-lg"
            >
              Search Port Harcourt now →
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
