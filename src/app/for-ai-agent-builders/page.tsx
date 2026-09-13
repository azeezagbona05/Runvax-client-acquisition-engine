import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Find Clients for Your AI Agent or Automation Business — Runvax',
  description:
    'You can build the agent. Finding the business that needs one is the hard part. Runvax surfaces local businesses whose enquiries go unanswered and drafts the first message. Free plan.',
  alternates: { canonical: `${SITE_URL}/for-ai-agent-builders` },
  openGraph: {
    title: 'Client Acquisition for AI Agent & Automation Builders',
    description:
      'Stop pitching "we do AI automation" into the void. Runvax finds local businesses with a named operational gap and writes the outreach. Free plan available.',
    url: `${SITE_URL}/for-ai-agent-builders`,
  },
};

const comparisons = [
  {
    feature: 'Targeting',
    generic: 'Spray "we build AI agents" on LinkedIn and hope a decision-maker scrolls past',
    runvax: 'Filter to businesses whose trade and reviews show enquiries slipping through',
  },
  {
    feature: 'The hook',
    generic: 'Lead with the technology — which triggers "we’re not ready for AI"',
    runvax: 'Lead with a moment from their week: an after-hours enquiry no one answered',
  },
  {
    feature: 'Volume',
    generic: '15–25 manual messages a day to build one meeting in 1–2 weeks',
    runvax: 'A qualified list of local businesses in minutes, outreach drafted per business',
  },
  {
    feature: 'Qualification',
    generic: 'You find out if they need it on the call',
    runvax: 'Opportunity scored up front from the business record and its trade',
  },
  {
    feature: 'First message',
    generic: 'Reused template, feature list, calendar link',
    runvax: 'A short message that earns a reply, never names the tech, and sets up the demo',
  },
];

const signals = [
  'A trade that runs on enquiries and bookings — clinics, salons, law firms, real estate, trades, hospitality',
  'Reviews that mention slow replies, missed calls, or "I couldn’t get through"',
  'A website with no live chat, no booking, and a contact form that goes to a shared inbox',
  'Small team, owner-operated — no one covering the phone evenings or weekends',
  'High-value bookings where one missed enquiry is a real amount of money',
];

const faqs = [
  {
    q: 'How do AI automation agencies find clients?',
    a: 'The channels that work in 2026 are targeted outbound (email and WhatsApp) against businesses with a named operational pain, partnerships with web and marketing agencies that already serve those businesses, and demo-first pitches that show a working agent before asking for the sale. Generic "we do AI automation" marketing does not work because buyers are not searching for an agency with those words in the tagline.',
  },
  {
    q: 'How does Runvax help AI agent builders specifically?',
    a: 'It finds local businesses whose enquiries are likely going cold — using the trade’s workflow plus any review evidence — scores the opportunity, and drafts a first message that puts the owner inside a real moment from their week and asks if they want to see a fix. The pitch and the reply ladder are built so the first message never has to explain the technology.',
  },
  {
    q: 'What kind of businesses should I target?',
    a: 'Local, service-based, enquiry-driven, and owner-operated: dental and medical clinics, law firms, real estate agencies, salons and spas, home-service trades, hotels and event venues. These are the businesses where a missed enquiry has an obvious cost and where there is no night shift to answer it.',
  },
  {
    q: 'Do I need to say "AI" in the first message?',
    a: 'No, and it usually hurts. The stronger opener describes the outcome — enquiries answered, details captured, the booking saved — in the owner’s own language. You can introduce the word once they have engaged.',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      name: 'Client Acquisition for AI Agent & Automation Builders',
      description:
        'How AI agent and automation builders find local business clients with Runvax.',
      url: `${SITE_URL}/for-ai-agent-builders`,
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'For AI Agent Builders', item: `${SITE_URL}/for-ai-agent-builders` },
      ],
    },
    {
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ],
};

export default function ForAiAgentBuildersPage() {
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
              For AI Agent &amp; Automation Builders
            </span>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              You Can Build the Agent.<br />
              <span className="text-indigo-400">Finding Who Needs One Is the Hard Part.</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-8">
              Runvax finds local businesses whose enquiries are slipping through the cracks —
              missed calls, unanswered messages, no cover after hours — scores each one, and
              writes a first message that earns a reply without ever leading with &quot;AI&quot;.
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-semibold px-8 py-4 rounded-xl text-lg"
            >
              Try Runvax free &rarr;
            </a>
          </div>

          {/* Problem framing */}
          <div className="mb-16 grid md:grid-cols-2 gap-6">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h2 className="font-bold text-lg mb-3 text-orange-400">Why the usual outbound stalls</h2>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>&bull; &quot;We do AI automation&quot; is invisible — nobody is searching for that</li>
                <li>&bull; Leading with the tech triggers &quot;we&apos;re not ready for AI&quot;</li>
                <li>&bull; Manual LinkedIn outreach caps at 15&ndash;25 messages a day</li>
                <li>&bull; You only learn if they need it once you are on the call</li>
              </ul>
            </div>
            <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-2xl p-6">
              <h2 className="font-bold text-lg mb-3 text-indigo-400">What Runvax changes</h2>
              <ul className="space-y-2 text-gray-200 text-sm">
                <li>&bull; Targets businesses by a real operational gap, not a job title</li>
                <li>&bull; Opens on a moment from their week, not a feature list</li>
                <li>&bull; A qualified local list in minutes, outreach drafted per business</li>
                <li>&bull; Opportunity scored before you spend a minute on the pitch</li>
              </ul>
            </div>
          </div>

          {/* Table */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-8 text-center">Generic outbound vs Runvax</h2>
            <div className="overflow-x-auto rounded-2xl border border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900 border-b border-gray-800">
                    <th className="text-left px-6 py-4 text-gray-400 font-semibold w-1/6">Step</th>
                    <th className="text-left px-6 py-4 text-orange-400 font-semibold">Generic AI-agency outbound</th>
                    <th className="text-left px-6 py-4 text-indigo-400 font-semibold">With Runvax</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map((row, i) => (
                    <tr
                      key={i}
                      className={`border-b border-gray-800 ${i % 2 === 0 ? 'bg-gray-900/30' : 'bg-gray-900/60'}`}
                    >
                      <td className="px-6 py-4 font-medium text-gray-300">{row.feature}</td>
                      <td className="px-6 py-4 text-gray-400">{row.generic}</td>
                      <td className="px-6 py-4 text-gray-200">{row.runvax}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Signals */}
          <div className="mb-16 bg-gray-900 border border-gray-800 rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-4">The signals that a business needs an AI agent</h2>
            <p className="text-gray-300 mb-4">
              Runvax scores opportunities on signals like these — deterministic, traceable to
              the business record and its trade, so you always know why a lead is a lead:
            </p>
            <ul className="space-y-2 text-gray-300 text-sm">
              {signals.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-indigo-400">&bull;</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
            <p className="text-gray-400 text-sm mt-4">
              More on this in{' '}
              <Link href="/blog/signals-a-local-business-needs-an-ai-agent" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
                7 signals a local business needs an AI agent
              </Link>
              .
            </p>
          </div>

          {/* Related reading */}
          <div className="mb-16 text-sm text-gray-400 leading-relaxed">
            <span className="font-semibold text-gray-300">Keep reading:</span>{' '}
            <Link href="/blog/how-ai-automation-agencies-find-clients" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">How AI automation agencies find clients</Link>
            {' · '}
            <Link href="/blog/lead-generation-for-ai-agencies" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">Lead generation for AI agencies</Link>
            {' · '}
            <Link href="/blog/cold-outreach-for-ai-automation-agencies" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">Cold outreach for AI automation agencies</Link>
            {' · '}
            <Link href="/ai-for-client-acquisition" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">AI for client acquisition</Link>
          </div>

          {/* FAQ */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-8 text-center">Questions</h2>
            <div className="space-y-4">
              {faqs.map((f, i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                  <h3 className="font-semibold text-white mb-2">{f.q}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="rounded-2xl bg-indigo-900/30 border border-indigo-800/50 p-10 text-center">
            <h2 className="text-3xl font-bold mb-3">Find your first 10 AI automation clients</h2>
            <p className="text-gray-400 mb-8 max-w-xl mx-auto">
              Free plan. No credit card. Search any city and see which local businesses are
              losing enquiries right now.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/"
                className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-semibold px-10 py-4 rounded-xl text-lg"
              >
                Start free &rarr;
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
