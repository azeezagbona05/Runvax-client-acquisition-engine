import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE_URL } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'AI for Client Acquisition — Find and Reach Clients on Autopilot',
  description:
    'AI for client acquisition means using AI to find businesses with a real unmet need, qualify them, and write the first outreach. Runvax does all three for people selling to local businesses. Free plan.',
  alternates: { canonical: `${SITE_URL}/ai-for-client-acquisition` },
  openGraph: {
    title: 'AI for Client Acquisition — The 2026 Playbook',
    description:
      'What AI client acquisition actually is, the tool categories, and how Runvax finds local businesses with a sellable gap and drafts the outreach. Free plan available.',
    url: `${SITE_URL}/ai-for-client-acquisition`,
  },
};

const stages = [
  {
    n: '1',
    title: 'Find',
    body: 'AI surfaces businesses that match a real, visible need — no website, a slow or broken site, no online booking, no way to answer enquiries after hours.',
  },
  {
    n: '2',
    title: 'Qualify',
    body: 'It scores each prospect on how badly they need what you sell and how likely they are to pay, so you work the top of the list first instead of guessing.',
  },
  {
    n: '3',
    title: 'Reach',
    body: 'It drafts a personalised first message — email, WhatsApp, or a full proposal — built from that specific business and the specific offer you are pitching.',
  },
];

const categories = [
  {
    type: 'Enterprise AI SDR / enrichment',
    examples: 'Clay, Apollo, SyncGTM, ZoomInfo',
    fit: 'B2B SaaS and mid-market sales teams',
    gap: 'You bring the account list and the ICP. No local SMB coverage, no "which businesses have no website" filter, $49–349/month.',
  },
  {
    type: 'General AI writers',
    examples: 'ChatGPT, Claude, Jasper',
    fit: 'Drafting copy once you know who to write to',
    gap: 'They do not find or qualify anyone. You still do the prospecting by hand.',
  },
  {
    type: 'Local client acquisition',
    examples: 'Runvax',
    fit: 'Freelancers and agencies selling websites and AI systems to local businesses',
    gap: 'Builds the list from real-time local data, detects the sellable gap, scores it, and writes the outreach — in one flow.',
  },
];

const faqs = [
  {
    q: 'What is AI for client acquisition?',
    a: 'It is the use of AI to run the top of your sales funnel: finding businesses that have a genuine unmet need, qualifying them by how likely they are to buy, and drafting the first outreach message for each one. Done well, it turns hours of manual directory searching and copywriting into minutes.',
  },
  {
    q: 'Does AI client acquisition actually work for small businesses and freelancers?',
    a: 'Yes, and arguably better than for enterprise teams. A freelancer selling websites or AI automation to local businesses has a clear, verifiable buying signal to target — a missing website, a dead booking page — and AI is very good at finding and ranking those signals at scale.',
  },
  {
    q: 'What is the best AI tool for client acquisition?',
    a: 'It depends on who you sell to. B2B SaaS teams with a known ICP use Clay or Apollo for enrichment. People selling websites, chatbots, or automation to local businesses use Runvax, because it builds the prospect list and detects the gap rather than assuming you already have both.',
  },
  {
    q: 'Can AI write cold outreach that does not sound like AI?',
    a: 'It can when the message is built from real facts about the business rather than a generic template. Runvax passes each draft through a house-style and anti-"AI tell" check, and never opens an AI-automation pitch by naming the technology.',
  },
  {
    q: 'How much does AI client acquisition cost?',
    a: 'Enterprise enrichment tools run $49–349/month. Runvax has a free plan with no card and a paid plan at roughly $6/month.',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebPage',
      name: 'AI for Client Acquisition',
      description:
        'What AI for client acquisition means, the tool categories, and how Runvax does it for people selling to local businesses.',
      url: `${SITE_URL}/ai-for-client-acquisition`,
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'AI for Client Acquisition', item: `${SITE_URL}/ai-for-client-acquisition` },
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

export default function AiForClientAcquisitionPage() {
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
              AI for Client Acquisition
            </span>
            <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
              Let AI Find the Clients.<br />
              <span className="text-indigo-400">You Close Them.</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-8">
              AI for client acquisition means using AI to find businesses with a real unmet
              need, qualify them, and write the first outreach. Runvax does all three — for
              anyone selling websites, AI systems, or digital services to local businesses.
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-semibold px-8 py-4 rounded-xl text-lg"
            >
              Try Runvax free &rarr;
            </a>
          </div>

          {/* The three stages */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-8 text-center">The three stages AI can run for you</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {stages.map((s) => (
                <div key={s.n} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                  <div className="w-9 h-9 rounded-lg bg-indigo-600/20 text-indigo-400 font-bold flex items-center justify-center mb-4">
                    {s.n}
                  </div>
                  <h3 className="font-bold text-lg mb-2">{s.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{s.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Tool categories */}
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-4 text-center">The AI client acquisition tool landscape</h2>
            <p className="text-gray-400 text-sm text-center max-w-2xl mx-auto mb-8">
              &quot;AI client acquisition&quot; covers three very different kinds of tool. Buying the
              wrong one for your actual bottleneck is the most common mistake.
            </p>
            <div className="overflow-x-auto rounded-2xl border border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900 border-b border-gray-800">
                    <th className="text-left px-6 py-4 text-gray-400 font-semibold">Category</th>
                    <th className="text-left px-6 py-4 text-gray-400 font-semibold">Examples</th>
                    <th className="text-left px-6 py-4 text-gray-400 font-semibold">Best fit</th>
                    <th className="text-left px-6 py-4 text-gray-400 font-semibold">The catch</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c, i) => (
                    <tr
                      key={i}
                      className={`border-b border-gray-800 ${c.type === 'Local client acquisition' ? 'bg-indigo-950/30' : i % 2 === 0 ? 'bg-gray-900/30' : 'bg-gray-900/60'}`}
                    >
                      <td className="px-6 py-4 font-medium text-gray-200">{c.type}</td>
                      <td className="px-6 py-4 text-gray-400">{c.examples}</td>
                      <td className="px-6 py-4 text-gray-400">{c.fit}</td>
                      <td className="px-6 py-4 text-gray-300">{c.gap}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* How Runvax does it */}
          <div className="mb-16 bg-gray-900 border border-gray-800 rounded-2xl p-8">
            <h2 className="text-2xl font-bold mb-4">How Runvax does AI client acquisition</h2>
            <p className="text-gray-300 mb-4">
              You pick a city and an industry. Runvax searches Google&apos;s live business
              index and returns real businesses with phone numbers, ratings, and website
              status. It flags the ones with a gap you can sell against — no website, a weak
              site, no booking, no after-hours cover for enquiries.
            </p>
            <p className="text-gray-300 mb-4">
              Each prospect gets an opportunity score built from deterministic signals in the
              business record and its trade — not a black-box guess — so &quot;why is this a
              lead&quot; is always a concrete answer. Then Runvax drafts the first message:
              a cold email, a WhatsApp message, and a proposal, written for that business and
              the specific offer, whether that is a website or an AI enquiry-and-booking
              system.
            </p>
            <p className="text-gray-300">
              For the deeper strategy, start with{' '}
              <Link href="/blog/ai-for-client-acquisition-guide" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
                the complete 2026 guide to AI for client acquisition
              </Link>
              .
            </p>
          </div>

          {/* Audience links */}
          <div className="mb-16 grid md:grid-cols-2 gap-6">
            <Link href="/for-ai-agent-builders" className="block bg-gray-900 border border-gray-800 hover:border-indigo-700 rounded-2xl p-6 transition-colors">
              <h3 className="font-bold text-lg mb-2 text-indigo-400">For AI agent &amp; automation builders &rarr;</h3>
              <p className="text-gray-400 text-sm">Find local businesses that need an AI enquiry, booking, or follow-up system.</p>
            </Link>
            <Link href="/for-web-developers" className="block bg-gray-900 border border-gray-800 hover:border-indigo-700 rounded-2xl p-6 transition-colors">
              <h3 className="font-bold text-lg mb-2 text-indigo-400">For web developers &rarr;</h3>
              <p className="text-gray-400 text-sm">Turn a build-anything skill set into a full client pipeline.</p>
            </Link>
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
            <h2 className="text-3xl font-bold mb-3">Put client acquisition on autopilot</h2>
            <p className="text-gray-400 mb-8 max-w-xl mx-auto">
              Free plan. No credit card. Search any city worldwide and see your first list of
              businesses with a sellable gap in under two minutes.
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
