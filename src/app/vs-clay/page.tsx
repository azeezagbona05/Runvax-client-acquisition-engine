import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Runvax vs Clay — The Clay Alternative That Builds the List for You',
  description:
    'Clay enriches a list and an ICP you already have. Runvax builds the list — real-time local businesses filtered by the gap you can sell against — and writes the first message. Free plan.',
  alternates: { canonical: `${SITE_URL}/vs-clay` },
  openGraph: {
    title: 'Runvax vs Clay — Build the List, Don’t Just Enrich It',
    description:
      'Clay is enrichment for B2B sales teams who already know their ICP. Runvax finds local businesses with a visible unmet need and drafts the outreach. Free plan available.',
    url: `${SITE_URL}/vs-clay`,
  },
};

const comparisons = [
  {
    feature: 'Core job',
    clay: 'Enrich a list you import — fill in emails, firmographics, signals',
    runvax: 'Build the list — surface local businesses that match a sellable gap',
  },
  {
    feature: 'You bring',
    clay: 'A target account list and a defined ICP',
    runvax: 'A city and an industry. Runvax finds the rest',
  },
  {
    feature: 'Data source',
    clay: '100+ enrichment providers stitched via waterfall (B2B databases)',
    runvax: 'Real-time Google business data — every city worldwide, always current',
  },
  {
    feature: 'Best-fit buyer',
    clay: 'B2B SaaS and mid-market sales teams with a RevOps function',
    runvax: 'Freelancers and small agencies selling websites and AI systems to local SMBs',
  },
  {
    feature: 'Gap detection',
    clay: 'Not built in — you define the signals and scoring yourself',
    runvax: 'Built in — flags no website, weak site, no booking, no after-hours cover, and scores the opportunity',
  },
  {
    feature: 'Outreach',
    clay: 'Generates copy from your prompts and templates; sends via integrations',
    runvax: 'Writes a unique cold email, WhatsApp message, and proposal per business and per offer',
  },
  {
    feature: 'WhatsApp',
    clay: 'Not supported',
    runvax: 'Built-in AI WhatsApp message generator — the primary channel in many local markets',
  },
  {
    feature: 'Local / Africa coverage',
    clay: 'Thin — most local SMBs are not in B2B databases or on LinkedIn',
    runvax: 'Full real-time coverage: Nigeria, Ghana, Kenya, South Africa, UK, USA, Canada, and more',
  },
  {
    feature: 'Learning curve',
    clay: 'Steep — tables, formulas, waterfall config, credit management',
    runvax: 'Search, review, send — first list in under two minutes',
  },
  {
    feature: 'Pricing',
    clay: 'Free tier is limited; paid plans from ~$167–$185/month, metered in credits',
    runvax: '₦9,999/month (~$6 USD). Free plan, no card',
  },
];

const faqs = [
  {
    q: 'Is Runvax a Clay alternative?',
    a: 'For one specific job, yes. If you sell websites, AI automation, or other digital services to local businesses and you want a tool that finds the prospects and drafts the outreach, Runvax replaces the Clay workflow entirely. If you run B2B SaaS sales against a named account list and need deep firmographic enrichment, Clay is the better fit.',
  },
  {
    q: 'What can Clay do that Runvax cannot?',
    a: 'Clay enriches arbitrary company lists from 100+ data providers, runs custom scoring formulas, and integrates with a wide set of CRMs and sequencers. It is a power tool for RevOps teams. Runvax does not import external lists or do waterfall enrichment.',
  },
  {
    q: 'What can Runvax do that Clay cannot?',
    a: 'Runvax builds the prospect list from real-time local business data, flags which businesses have no website or no booking flow, scores the opportunity, and writes a per-business cold email, WhatsApp message, and proposal. Clay assumes you already have the list and the ICP.',
  },
  {
    q: 'Which is cheaper?',
    a: 'Runvax. It has a free plan with no card, and its paid plan is roughly $6/month. Clay also has a free tier, and its paid plans start around $167–$185/month depending on billing term (checked September 2026).',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      name: 'Runvax vs Clay',
      description:
        'How Runvax compares to Clay for finding and reaching local business clients.',
      url: `${SITE_URL}/vs-clay`,
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Runvax vs Clay', item: `${SITE_URL}/vs-clay` },
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

export default function VsClayPage() {
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
              Runvax vs Clay
            </span>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Clay Enriches Your List.<br />
              <span className="text-indigo-400">Runvax Builds It.</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-8">
              Clay is a brilliant enrichment engine for B2B sales teams that already know
              their ICP and have a list of target accounts. If you sell websites or AI
              systems to local businesses and the hard part is finding who to pitch,
              Runvax is built for you.
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-semibold px-8 py-4 rounded-xl text-lg"
            >
              Try Runvax free &rarr;
            </a>
          </div>

          {/* Who each is for */}
          <div className="mb-16 grid md:grid-cols-2 gap-6">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h2 className="font-bold text-lg mb-3 text-orange-400">Clay is for:</h2>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li>&bull; B2B SaaS and mid-market sales teams</li>
                <li>&bull; Operators with a defined ICP and an account list to work</li>
                <li>&bull; RevOps functions that want custom enrichment and scoring</li>
                <li>&bull; Teams comfortable with tables, formulas, and credit budgets</li>
                <li>&bull; Workflows that end in a CRM or a sequencer</li>
              </ul>
            </div>
            <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-2xl p-6">
              <h2 className="font-bold text-lg mb-3 text-indigo-400">Runvax is for:</h2>
              <ul className="space-y-2 text-gray-200 text-sm">
                <li>&bull; Web designers and developers finding local clients</li>
                <li>&bull; AI agent and automation builders who need businesses to sell to</li>
                <li>&bull; Anyone whose bottleneck is <em>finding</em> prospects, not enriching them</li>
                <li>&bull; Solo operators and small agencies on a small budget</li>
                <li>&bull; Local markets where buyers are on Google Maps, not LinkedIn</li>
              </ul>
            </div>
          </div>

          {/* Table */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-8 text-center">Feature comparison</h2>
            <div className="overflow-x-auto rounded-2xl border border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900 border-b border-gray-800">
                    <th className="text-left px-6 py-4 text-gray-400 font-semibold w-1/5">Feature</th>
                    <th className="text-left px-6 py-4 text-orange-400 font-semibold">Clay</th>
                    <th className="text-left px-6 py-4 text-indigo-400 font-semibold">Runvax</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map((row, i) => (
                    <tr
                      key={i}
                      className={`border-b border-gray-800 ${i % 2 === 0 ? 'bg-gray-900/30' : 'bg-gray-900/60'}`}
                    >
                      <td className="px-6 py-4 font-medium text-gray-300">{row.feature}</td>
                      <td className="px-6 py-4 text-gray-400">{row.clay}</td>
                      <td className="px-6 py-4 text-gray-200">{row.runvax}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Narrative */}
          <div className="mb-16 bg-gray-900 border border-gray-800 rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-4">The real difference: who builds the list</h2>
            <p className="text-gray-300 mb-4">
              Clay&apos;s whole model starts with a list you already have. You import target
              companies, and Clay fills in the missing emails, headcounts, tech stack, and
              buying signals from more than a hundred data providers. It is the best tool in
              the category for that job.
            </p>
            <p className="text-gray-300 mb-4">
              But if you are a freelancer or a small agency selling to restaurants, clinics,
              law firms, and salons in your city, you do not have a list. Those businesses are
              not in B2B databases and most are not on LinkedIn. They are on Google Maps, with
              a phone number, a rating, and — often — no website.
            </p>
            <p className="text-gray-300">
              Runvax searches that data in real time, flags the businesses with a gap you can
              sell against, scores each opportunity, and drafts the first message. It is the
              step that has to happen <em>before</em> enrichment is even a question.
            </p>
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

          {/* Related */}
          <div className="mb-16 text-sm text-gray-400">
            <span className="font-semibold text-gray-300">Related:</span>{' '}
            <Link href="/ai-for-client-acquisition" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">AI for client acquisition</Link>
            {' · '}
            <Link href="/for-ai-agent-builders" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">For AI agent builders</Link>
            {' · '}
            <Link href="/for-web-developers" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">For web developers</Link>
            {' · '}
            <Link href="/vs-apollo" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">Runvax vs Apollo.io</Link>
          </div>

          {/* CTA */}
          <div className="rounded-2xl bg-indigo-900/30 border border-indigo-800/50 p-10 text-center">
            <h2 className="text-3xl font-bold mb-3">Skip the list-building grind</h2>
            <p className="text-gray-400 mb-8 max-w-xl mx-auto">
              Free plan. No credit card. Search any city in Nigeria, Ghana, Kenya, the UK, USA,
              or worldwide and see your first list of businesses with a visible gap.
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
