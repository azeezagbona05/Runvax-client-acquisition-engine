import type { Metadata } from 'next';
import { SITE_URL, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Runvax vs Upwork — Find Web Design Clients Without Bidding Wars',
  description:
    'Stop spending hours writing Upwork proposals that never get accepted. Runvax lets you find local businesses that need a website and reach them directly with AI-generated outreach.',
  alternates: { canonical: `${SITE_URL}/vs-upwork` },
  openGraph: {
    title: `Runvax vs Upwork — No Bids, No Connects, No Waiting`,
    description:
      'Find unlimited web design clients without wasting Connects on Upwork. Search any city and pitch businesses directly with AI cold outreach.',
    url: `${SITE_URL}/vs-upwork`,
  },
};

const comparisons = [
  {
    feature: 'Client acquisition',
    upwork: 'Submit proposals and compete with 10–50 freelancers per job',
    runvax: 'You reach businesses directly — you are the only person pitching',
  },
  {
    feature: 'Cost to apply',
    upwork: 'Spend Connects (paid tokens) for every proposal — win or lose',
    runvax: 'No tokens, no bids — unlimited outreach on paid plans',
  },
  {
    feature: 'Commission',
    upwork: '10% service fee on all earnings (plus contract fee)',
    runvax: 'Zero platform commission — you keep every naira',
  },
  {
    feature: 'Client type',
    upwork: 'Global clients who may demand complex portfolios',
    runvax: 'Local businesses in your city who need a basic website — easier close',
  },
  {
    feature: 'Pricing control',
    upwork: 'Race to the bottom in a saturated global market',
    runvax: 'You quote local market rates directly — no global price pressure',
  },
  {
    feature: 'Proposal success rate',
    upwork: '1–5% win rate on most proposals due to saturation',
    runvax: 'Direct outreach to warm leads (no website = confirmed need)',
  },
  {
    feature: 'Speed to first client',
    upwork: 'Weeks or months building profile, reviews, and JSS score',
    runvax: 'First outreach in under 5 minutes — free plan, no card',
  },
  {
    feature: 'Account risk',
    upwork: 'Account can be suspended; you lose all earnings history',
    runvax: 'You own every client relationship — nothing to lose',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Runvax vs Upwork',
  description:
    'Comparison of Runvax and Upwork for web designers looking to find clients without bidding.',
  url: `${SITE_URL}/vs-upwork`,
  mainEntity: {
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Is Runvax better than Upwork for web design freelancers?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'For local client acquisition — especially in Nigeria, Ghana, Kenya, and other African markets — Runvax is more effective than Upwork. You find businesses that need a website, contact them directly, and keep 100% of your revenue. Upwork requires Connects, takes a 10% fee, and forces you to compete in a saturated global marketplace.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do I get web design clients without Upwork?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Use Runvax to search for local businesses in your city that have no website. Filter by industry, get real contact details, and send personalized AI cold emails or WhatsApp messages in one click. No bids, no Connects, no waiting.',
        },
      },
    ],
  },
};

export default function VsUpworkPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-gray-950 text-white">
        <div className="max-w-4xl mx-auto px-4 py-16">
          {/* Hero */}
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-semibold tracking-widest uppercase text-indigo-400 mb-3">
              Runvax vs Upwork
            </span>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Stop Burning Connects on Proposals<br />
              <span className="text-indigo-400">That Never Win.</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-8">
              Upwork has thousands of proposals for every job. Runvax lets you find businesses
              that <em>already need</em> a website and pitch them before any competitor even knows
              they exist.
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-semibold px-8 py-4 rounded-xl text-lg"
            >
              Find local clients now — it&apos;s free →
            </a>
          </div>

          {/* Pain section */}
          <div className="mb-16 bg-orange-950/30 border border-orange-900/40 rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-6 text-orange-400">The Upwork Reality</h2>
            <ul className="space-y-4 text-gray-300">
              {[
                '95%+ of proposals go unanswered. You spend Connects and time — for nothing.',
                'Top-Rated badge takes months of low-paid work just to earn the badge.',
                'Contract fees, service fees, and withdrawal fees eat 15–20% of every dollar.',
                'Clients from expensive countries expect global-quality portfolios at low rates.',
                'One bad client review can tank your entire JSS score and kill your visibility.',
              ].map((point, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-orange-500 mt-0.5 shrink-0">✕</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Table */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-8 text-center">Side-by-Side Comparison</h2>
            <div className="overflow-x-auto rounded-2xl border border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900 border-b border-gray-800">
                    <th className="text-left px-6 py-4 text-gray-400 font-semibold w-1/4">Feature</th>
                    <th className="text-left px-6 py-4 text-orange-400 font-semibold">
                      🔴 Upwork
                    </th>
                    <th className="text-left px-6 py-4 text-indigo-400 font-semibold">
                      🟢 Runvax
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map((row, i) => (
                    <tr
                      key={i}
                      className={`border-b border-gray-800 ${i % 2 === 0 ? 'bg-gray-900/30' : 'bg-gray-900/60'}`}
                    >
                      <td className="px-6 py-4 font-medium text-gray-300">{row.feature}</td>
                      <td className="px-6 py-4 text-gray-400">{row.upwork}</td>
                      <td className="px-6 py-4 text-gray-200">{row.runvax}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Why local is better */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6">
              Why Local Outreach Beats Global Platforms for Nigerian & African Freelancers
            </h2>
            <div className="space-y-4 text-gray-300 leading-relaxed">
              <p>
                Upwork was built for global remote work. But most web designers in Lagos, Accra, or
                Nairobi don&apos;t need global clients — they need the thousands of local businesses in
                their own city that still have no website.
              </p>
              <p>
                A restaurant in Ikeja with no website is a warm lead. They know they need one. They
                just haven&apos;t been approached yet. With Runvax, you find that restaurant, get
                their phone number, and send a personalized WhatsApp message in under 3 minutes.
              </p>
              <p>
                That restaurant will pay ₦150,000–₦300,000 for a basic website. You keep every kobo.
                No Upwork, no Fiverr, no platform fee.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="rounded-2xl bg-indigo-900/30 border border-indigo-800/50 p-10 text-center">
            <h2 className="text-3xl font-bold mb-3">Find clients the smart way</h2>
            <p className="text-gray-400 mb-8 max-w-xl mx-auto">
              Free plan. No credit card. Search any city in Nigeria, Ghana, Kenya, or the UK and
              find businesses with no website in seconds.
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-semibold px-10 py-4 rounded-xl text-lg"
            >
              Start finding clients →
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
