import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Find Web Design Clients in Lagos — Runvax',
  description:
    'Find local businesses in Lagos that need a website. Search Ikeja, Lekki, Victoria Island, Surulere, and every Lagos neighbourhood for businesses with no web presence.',
  alternates: { canonical: `${SITE_URL}/web-design-clients-lagos` },
  openGraph: {
    title: 'Find Web Design Clients in Lagos — Runvax',
    description:
      'Runvax finds Lagos businesses with no website. Get phone numbers, addresses, and AI cold outreach in 60 seconds. Free plan available.',
    url: `${SITE_URL}/web-design-clients-lagos`,
  },
};

const industries = [
  'Restaurants & Eateries', 'Beauty Salons & Spas', 'Barbers & Hair Salons',
  'Clinics & Hospitals', 'Pharmacies', 'Law Firms', 'Real Estate Agencies',
  'Hotels & Guesthouses', 'Schools & Private Tutors', 'Churches',
  'Event Centers', 'Auto Workshops', 'Fashion & Boutiques', 'Gyms',
  'Photography Studios', 'Supermarkets', 'Catering Services',
];

const neighbourhoods = [
  'Ikeja', 'Lekki', 'Victoria Island', 'Surulere', 'Yaba', 'Ajah',
  'Ikorodu', 'Alimosho', 'Agege', 'Festac Town', 'Apapa', 'Mushin',
  'Oshodi', 'Maryland', 'Gbagada', 'Ojota', 'Lagos Island', 'Badagry',
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Find Web Design Clients in Lagos',
  description: 'How to find local businesses in Lagos that need a website using Runvax.',
  url: `${SITE_URL}/web-design-clients-lagos`,
  about: {
    '@type': 'City',
    name: 'Lagos',
    addressCountry: 'NG',
  },
};

export default function LagosPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-gray-950 text-white">
        <div className="max-w-4xl mx-auto px-4 py-16">
          {/* Hero */}
          <div className="mb-14">
            <span className="inline-block text-xs font-semibold tracking-widest uppercase text-indigo-400 mb-3">
              Lagos, Nigeria
            </span>
            <h1 className="text-4xl md:text-5xl font-bold mb-5 leading-tight">
              Find Web Design Clients<br />
              <span className="text-indigo-400">in Lagos, Nigeria</span>
            </h1>
            <p className="text-gray-400 text-lg mb-8 max-w-2xl">
              Lagos has over 300,000 registered SMBs — and the vast majority have no website. Every
              restaurant in Ikeja, salon in Lekki, and clinic in Surulere is a potential client.
              Runvax finds them for you in seconds.
            </p>
            <a
              href="/?city=Lagos&country=NG"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-semibold px-8 py-4 rounded-xl text-lg"
            >
              Search Lagos businesses →
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
            {[
              { label: 'Lagos businesses indexed', value: '300,000+' },
              { label: 'Est. without a website', value: '~70%' },
              { label: 'Industries covered', value: '22+' },
              { label: 'Time to first lead', value: '<60s' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
                <p className="text-2xl font-bold text-indigo-400">{value}</p>
                <p className="text-gray-500 text-xs mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Industries */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">
              Industries to target in Lagos
            </h2>
            <div className="flex flex-wrap gap-2">
              {industries.map((ind) => (
                <span
                  key={ind}
                  className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300"
                >
                  {ind}
                </span>
              ))}
            </div>
          </div>

          {/* Neighbourhoods */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">
              Neighbourhoods to search in Lagos
            </h2>
            <div className="flex flex-wrap gap-2">
              {neighbourhoods.map((n) => (
                <span
                  key={n}
                  className="px-3 py-1.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-400"
                >
                  {n}
                </span>
              ))}
            </div>
            <p className="text-gray-500 text-sm mt-3">
              Runvax searches any Lagos neighbourhood or local government area — type any location name.
            </p>
          </div>

          {/* How to */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-8">
              How to find web design clients in Lagos
            </h2>
            <div className="space-y-4">
              {[
                {
                  step: '1',
                  title: 'Search a Lagos neighbourhood',
                  body: 'Type "Ikeja", "Lekki", "Surulere", or any Lagos location. Runvax queries Google\'s real-time business data for that area.',
                },
                {
                  step: '2',
                  title: 'Filter "No Website" businesses',
                  body: 'Toggle the no-website filter and instantly see businesses with no web presence. Every result shows phone number, address, and Google rating.',
                },
                {
                  step: '3',
                  title: 'Generate a personalized pitch',
                  body: 'Click Generate to create a personalized cold email or WhatsApp message for that specific business — in Yoruba-friendly tone if needed.',
                },
                {
                  step: '4',
                  title: 'Track and follow up',
                  body: 'Save the prospect to your pipeline, set a reminder, and track conversations until you close the deal.',
                },
              ].map(({ step, title, body }) => (
                <div key={step} className="flex gap-5 bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <div className="w-9 h-9 rounded-full bg-indigo-900/50 border border-indigo-700 flex items-center justify-center text-indigo-400 font-bold shrink-0">
                    {step}
                  </div>
                  <div>
                    <p className="font-semibold mb-1">{title}</p>
                    <p className="text-gray-400 text-sm">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing context */}
          <div className="mb-16 bg-green-950/30 border border-green-900/40 rounded-2xl p-8">
            <h2 className="text-xl font-bold mb-3 text-green-400">
              How much can you charge for web design in Lagos?
            </h2>
            <div className="grid md:grid-cols-3 gap-4 mt-4">
              {[
                { type: 'Basic / Landing Page', range: '₦50,000 – ₦150,000' },
                { type: 'Business Website (5–10 pages)', range: '₦150,000 – ₦400,000' },
                { type: 'E-commerce / Custom', range: '₦400,000 – ₦1,500,000+' },
              ].map(({ type, range }) => (
                <div key={type} className="bg-green-900/20 border border-green-800/30 rounded-xl p-4">
                  <p className="text-sm text-green-400 font-semibold mb-1">{type}</p>
                  <p className="text-gray-200 font-bold">{range}</p>
                </div>
              ))}
            </div>
            <p className="text-gray-400 text-sm mt-4">
              One Lagos client paying ₦150,000 covers 15 months of Runvax Pro (₦9,999/month).
            </p>
          </div>

          {/* CTA */}
          <div className="rounded-2xl bg-indigo-900/30 border border-indigo-800/50 p-10 text-center">
            <h2 className="text-3xl font-bold mb-3">Start finding Lagos clients today</h2>
            <p className="text-gray-400 mb-8">
              Free plan — no credit card. Search any Lagos neighbourhood in under 60 seconds.
            </p>
            <a
              href="/?city=Lagos&country=NG"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-semibold px-10 py-4 rounded-xl text-lg"
            >
              Search Lagos now →
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
