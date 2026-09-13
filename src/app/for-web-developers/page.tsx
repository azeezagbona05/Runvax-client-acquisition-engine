import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'How Web Developers Find Clients — Runvax',
  description:
    'You can build anything. The pipeline is the bottleneck. Runvax finds local businesses with no site, a broken site, or no booking flow, and drafts the first message. Free plan.',
  alternates: { canonical: `${SITE_URL}/for-web-developers` },
  openGraph: {
    title: 'Client Acquisition for Web Developers',
    description:
      'Turn a build-anything skill set into a full client pipeline. Runvax finds local businesses with a visible web gap and writes the outreach. Free plan available.',
    url: `${SITE_URL}/for-web-developers`,
  },
};

const gaps = [
  { label: 'No website at all', pitch: 'The cleanest pitch there is — a business with reviews and revenue and nowhere to send people.' },
  { label: 'A slow or broken site', pitch: '53% of mobile visitors leave a site that takes over 3 seconds. A rebuild pays for itself.' },
  { label: 'No booking or enquiry flow', pitch: 'A contact form into a shared inbox is a lost lead. Booking, chat, and capture are billable.' },
  { label: 'A DIY builder site hitting its limits', pitch: 'Wix and Linktree work until they do not. Migration and a real stack is a developer job.' },
  { label: 'No way to answer enquiries after hours', pitch: 'The upsell path from a website into an AI enquiry and booking system.' },
];

const steps = [
  'Pick a city and an industry you want to work in.',
  'Runvax returns real local businesses with website status, ratings, and contact details.',
  'It flags the ones with a gap and scores how strong the opportunity is.',
  'It drafts a cold email, a WhatsApp message, and a proposal for each — in your voice.',
  'You review, send, and track replies through the built-in pipeline.',
];

const faqs = [
  {
    q: 'How do web developers find clients in 2026?',
    a: 'The reliable path is proactive outbound to businesses with a visible technical gap — no site, a slow site, a broken booking flow — combined with a tracked follow-up sequence. Multi-channel outreach (email plus WhatsApp plus a call) generates far more replies than any single channel, and most replies come from the second to fifth touch, not the first.',
  },
  {
    q: 'Is this different from finding web design clients?',
    a: 'The prospecting is the same; the pitch is broader. A developer can sell the rebuild, the booking system, the integrations, the migration off a page builder, and the AI enquiry layer on top. Runvax detects which of those gaps a business has so you pitch the one that is real.',
  },
  {
    q: 'Do I need a portfolio first?',
    a: 'A small, focused portfolio helps, but it is not a blocker for outbound. A message that names a specific, real problem on the prospect’s current site outperforms a link to your best work for a cold first touch.',
  },
  {
    q: 'What does Runvax cost?',
    a: 'There is a free plan with no card — 5 searches a day, 15 AI drafts a day. Paid plans start at roughly $6/month for higher limits.',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      name: 'Client Acquisition for Web Developers',
      description: 'How web developers find and reach local business clients with Runvax.',
      url: `${SITE_URL}/for-web-developers`,
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'For Web Developers', item: `${SITE_URL}/for-web-developers` },
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

export default function ForWebDevelopersPage() {
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
              For Web Developers
            </span>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              You Can Build Anything.<br />
              <span className="text-indigo-400">The Pipeline Is the Bottleneck.</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-8">
              Runvax finds local businesses with a real technical gap — no site, a slow site,
              a dead booking flow, a page builder hitting its limits — scores the opportunity,
              and drafts the first message so you spend your time building, not prospecting.
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-semibold px-8 py-4 rounded-xl text-lg"
            >
              Try Runvax free &rarr;
            </a>
          </div>

          {/* Gaps you can sell against */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-8 text-center">Five gaps a developer can sell against</h2>
            <div className="space-y-3">
              {gaps.map((g, i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 md:flex md:gap-6">
                  <div className="font-semibold text-indigo-400 md:w-1/3 mb-1 md:mb-0">{g.label}</div>
                  <div className="text-gray-400 text-sm md:w-2/3">{g.pitch}</div>
                </div>
              ))}
            </div>
          </div>

          {/* How it works */}
          <div className="mb-16 bg-gray-900 border border-gray-800 rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-4">How it works</h2>
            <ol className="space-y-3 text-gray-300 text-sm">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-6 h-6 rounded-md bg-indigo-600/20 text-indigo-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Developer vs designer */}
          <div className="mb-16 bg-gray-900 border border-gray-800 rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-4">Developer, not just designer</h2>
            <p className="text-gray-300 mb-4">
              Most &quot;find web design clients&quot; advice assumes the deliverable is a
              brochure site. A developer&apos;s deliverables are wider — integrations, a
              booking system, a migration, an enquiry agent — and the cold message should say
              so. Runvax picks the offer that matches the gap it detected.
            </p>
            <p className="text-gray-300">
              See{' '}
              <Link href="/blog/web-developer-vs-web-designer-finding-clients" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
                web developer vs web designer: finding clients is a different game
              </Link>{' '}
              and{' '}
              <Link href="/blog/how-web-developers-find-clients-2026" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
                how web developers find clients in 2026
              </Link>
              .
            </p>
          </div>

          {/* Related */}
          <div className="mb-16 text-sm text-gray-400 leading-relaxed">
            <span className="font-semibold text-gray-300">Related:</span>{' '}
            <Link href="/ai-for-client-acquisition" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">AI for client acquisition</Link>
            {' · '}
            <Link href="/for-ai-agent-builders" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">For AI agent builders</Link>
            {' · '}
            <Link href="/web-design-clients-lagos" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">Web design clients in Lagos</Link>
            {' · '}
            <Link href="/vs-clay" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">Runvax vs Clay</Link>
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
            <h2 className="text-3xl font-bold mb-3">Fill your pipeline this week</h2>
            <p className="text-gray-400 mb-8 max-w-xl mx-auto">
              Free plan. No credit card. Search any city worldwide and see the businesses with
              a web gap you can close.
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
