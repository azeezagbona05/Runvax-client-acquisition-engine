import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Find Web Design Clients in Abuja — Runvax',
  description:
    'Find businesses in Abuja that need a website. Search Wuse, Garki, Maitama, Gwarinpa, and every Abuja area for SMBs with no web presence. Free plan available.',
  alternates: { canonical: `${SITE_URL}/web-design-clients-abuja` },
  openGraph: {
    title: 'Find Web Design Clients in Abuja — Runvax',
    description:
      'Runvax finds Abuja businesses with no website. AI cold outreach in 60 seconds. Free plan.',
    url: `${SITE_URL}/web-design-clients-abuja`,
  },
};

const neighbourhoods = [
  'Wuse', 'Garki', 'Maitama', 'Asokoro', 'Gwarinpa', 'Jabi', 'Utako',
  'Kubwa', 'Lugbe', 'Karu', 'Nyanya', 'Gwagwalada', 'Abaji', 'Bwari',
  'Central Business District', 'Area 1', 'Area 2', 'Area 3',
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Find Web Design Clients in Abuja',
  url: `${SITE_URL}/web-design-clients-abuja`,
  about: { '@type': 'City', name: 'Abuja', addressCountry: 'NG' },
};

export default function AbujaPage() {
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
              Abuja, Nigeria
            </span>
            <h1 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
              Find Web Design Clients<br />
              <span className="text-indigo-400">in Abuja, Nigeria</span>
            </h1>
            <p className="text-gray-400 text-lg mb-8 max-w-2xl">
              Abuja is Nigeria&apos;s capital and fastest-growing city. Government contractors, hotels,
              restaurants, and professional services firms fill every district — and most still have
              no website. Runvax finds them for you.
            </p>
            <a
              href="/?city=Abuja&country=NG"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-semibold px-8 py-4 rounded-xl text-lg"
            >
              Search Abuja businesses →
            </a>
          </div>

          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">Areas to search in Abuja</h2>
            <div className="flex flex-wrap gap-2">
              {neighbourhoods.map((n) => (
                <span key={n} className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-400">
                  {n}
                </span>
              ))}
            </div>
          </div>

          <div className="mb-16 bg-green-950/30 border border-green-900/40 rounded-2xl p-8">
            <h2 className="text-xl font-bold mb-4 text-green-400">
              Why Abuja is a great market for web designers
            </h2>
            <ul className="space-y-3 text-gray-300 text-sm">
              <li>• Higher average income than most Nigerian cities — clients can pay more</li>
              <li>• Large government and NGO sector where professional websites are mandatory</li>
              <li>• Rapidly growing hospitality and real estate sectors</li>
              <li>• Less saturated than Lagos — fewer freelancers competing for the same clients</li>
              <li>• Many embassies and international organizations that need bilingual websites</li>
            </ul>
          </div>

          <div className="rounded-2xl bg-indigo-900/30 border border-indigo-800/50 p-10 text-center">
            <h2 className="text-3xl font-bold mb-3">Start finding Abuja clients today</h2>
            <p className="text-gray-400 mb-8">Free plan — no credit card. Search any Abuja area now.</p>
            <a
              href="/?city=Abuja&country=NG"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-semibold px-10 py-4 rounded-xl text-lg"
            >
              Search Abuja now →
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
