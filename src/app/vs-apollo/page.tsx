import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'ProspectAI vs Apollo.io — Local Business Leads Without Enterprise Pricing',
  description:
    'Apollo.io is built for enterprise B2B sales. ProspectAI is built for web designers who want to find local SMBs with no website in Lagos, Accra, Nairobi, or anywhere worldwide.',
  alternates: { canonical: `${SITE_URL}/vs-apollo` },
  openGraph: {
    title: `ProspectAI vs Apollo.io — Right Tool for Web Designers`,
    description:
      'Apollo.io is enterprise B2B. ProspectAI finds local SMBs with no website and writes personalized outreach automatically. Free plan available.',
    url: `${SITE_URL}/vs-apollo`,
  },
};

const comparisons = [
  {
    feature: 'Target market',
    apollo: 'Enterprise and mid-market B2B companies globally',
    prospectai: 'Local SMBs in any city — restaurants, salons, clinics, law firms',
  },
  {
    feature: 'Data source',
    apollo: 'Static database (may be outdated, limited Africa coverage)',
    prospectai: 'Real-time Google business data — always current, every city worldwide',
  },
  {
    feature: 'No-website filter',
    apollo: 'Not available — built for companies that already have a web presence',
    prospectai: 'Core feature — instantly shows which businesses have no website',
  },
  {
    feature: 'WhatsApp outreach',
    apollo: 'Not supported — email and phone call sequences only',
    prospectai: 'Built-in AI WhatsApp message generator for African markets',
  },
  {
    feature: 'Nigeria / Africa data',
    apollo: 'Limited coverage, inaccurate for Nigerian SMBs',
    prospectai: 'Full real-time coverage: Nigeria, Ghana, Kenya, South Africa, Uganda, and more',
  },
  {
    feature: 'AI outreach',
    apollo: 'Email sequences (template-based)',
    prospectai: 'AI writes unique cold email, WhatsApp message, and proposal per prospect',
  },
  {
    feature: 'Pricing',
    apollo: '$49–$119/month USD minimum for useful features',
    prospectai: '₦9,999/month (~$6 USD). Free plan available.',
  },
  {
    feature: 'Pipeline management',
    apollo: 'CRM integrations required (Salesforce, HubSpot)',
    prospectai: 'Built-in Kanban pipeline — no integrations needed',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'ProspectAI vs Apollo.io',
  description: 'Why web designers should use ProspectAI instead of Apollo.io for local SMB leads.',
  url: `${SITE_URL}/vs-apollo`,
};

export default function VsApolloPage() {
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
              ProspectAI vs Apollo.io
            </span>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Apollo is Built for Enterprise.<br />
              <span className="text-indigo-400">You Need Local SMB Leads.</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-8">
              Apollo.io is a powerful tool for enterprise SaaS sales teams targeting Fortune 500
              companies. If you&apos;re a web designer in Lagos trying to find restaurants with no
              website, you need ProspectAI.
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-semibold px-8 py-4 rounded-xl text-lg"
            >
              Try ProspectAI free →
            </a>
          </div>

          {/* Key difference callout */}
          <div className="mb-16 grid md:grid-cols-2 gap-6">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h3 className="font-bold text-lg mb-3 text-orange-400">🏢 Apollo.io is for:</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>• Enterprise SaaS sales reps targeting VP-level buyers</li>
                <li>• Finding email addresses of C-suite at mid-market companies</li>
                <li>• Running automated email sequences at scale</li>
                <li>• Teams with $50–$200/month budgets per seat</li>
                <li>• Markets where companies already have websites and LinkedIn profiles</li>
              </ul>
            </div>
            <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-2xl p-6">
              <h3 className="font-bold text-lg mb-3 text-indigo-400">🏪 ProspectAI is for:</h3>
              <ul className="space-y-2 text-gray-200 text-sm">
                <li>• Web designers finding local businesses that need a website</li>
                <li>• Reaching small businesses via cold email or WhatsApp</li>
                <li>• Real-time search for any city — including cities across Africa</li>
                <li>• Freelancers and small agencies with ₦9,999/month budget</li>
                <li>• Finding the businesses that DON&apos;T have a web presence yet</li>
              </ul>
            </div>
          </div>

          {/* Table */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-8 text-center">Feature Comparison</h2>
            <div className="overflow-x-auto rounded-2xl border border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900 border-b border-gray-800">
                    <th className="text-left px-6 py-4 text-gray-400 font-semibold w-1/4">Feature</th>
                    <th className="text-left px-6 py-4 text-orange-400 font-semibold">
                      🔴 Apollo.io
                    </th>
                    <th className="text-left px-6 py-4 text-indigo-400 font-semibold">
                      🟢 ProspectAI
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
                      <td className="px-6 py-4 text-gray-400">{row.apollo}</td>
                      <td className="px-6 py-4 text-gray-200">{row.prospectai}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* The Africa gap */}
          <div className="mb-16 bg-gray-900 border border-gray-800 rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-4">
              Apollo Has No Real Africa Coverage
            </h2>
            <p className="text-gray-300 mb-4">
              Apollo.io&apos;s database is built from LinkedIn profiles, company websites, and B2B
              directories — which means it has good coverage of companies in the US, UK, and Europe.
            </p>
            <p className="text-gray-300 mb-4">
              But in Lagos, Accra, Nairobi, or Kampala, most small and medium businesses are not on
              LinkedIn. They are registered on Google Maps. That is where ProspectAI searches.
            </p>
            <p className="text-gray-300">
              ProspectAI gives you real-time access to every restaurant, salon, clinic, law firm, and
              hotel in any Nigerian or African city — with phone numbers, addresses, ratings, and
              website status — data that simply does not exist in Apollo&apos;s database.
            </p>
          </div>

          {/* CTA */}
          <div className="rounded-2xl bg-indigo-900/30 border border-indigo-800/50 p-10 text-center">
            <h2 className="text-3xl font-bold mb-3">
              The right tool for local client acquisition
            </h2>
            <p className="text-gray-400 mb-8 max-w-xl mx-auto">
              Free plan. No credit card. Search any city in Nigeria, Ghana, Kenya, or worldwide.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/"
                className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-semibold px-10 py-4 rounded-xl text-lg"
              >
                Start free →
              </a>
              <a
                href="/pricing"
                className="inline-flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 transition-colors text-white font-semibold px-10 py-4 rounded-xl text-lg"
              >
                See pricing
              </a>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
