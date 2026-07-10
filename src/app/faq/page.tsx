import type { Metadata } from 'next';
import { SITE_URL, SITE_NAME } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions',
  description:
    'Everything you need to know about Runvax — how to find web design clients, generate cold outreach, manage a prospect pipeline, and grow your agency in Nigeria, Ghana, Kenya, and beyond.',
  alternates: { canonical: `${SITE_URL}/faq` },
  openGraph: {
    title: `FAQ — ${SITE_NAME}`,
    description:
      'Answers to every common question about Runvax: pricing, features, countries supported, cold email generation, pipeline management, and more.',
    url: `${SITE_URL}/faq`,
  },
};

const faqs: { q: string; a: string }[] = [
  {
    q: 'What is Runvax?',
    a: 'Runvax is an AI-powered lead generation tool for web designers, freelancers, and digital agencies. It searches any business type in any city worldwide and surfaces businesses with no website, so you can find your next paying client in seconds.',
  },
  {
    q: 'How do I find businesses that need a website?',
    a: "Runvax searches Google's real-time global business index for any industry and location, then automatically flags every listing that has no website. You can filter by industry — restaurants, salons, law firms, clinics, gyms, hotels, and 16 more categories — and by city or country.",
  },
  {
    q: 'How do freelancers and agencies find web design clients?',
    a: 'The fastest way is to search for local businesses in your target industry that have no website. Runvax does this automatically — search any city, select an industry, and get a list of businesses with phone numbers, addresses, ratings, and a no-website flag so you know exactly who to pitch.',
  },
  {
    q: 'Can Runvax generate cold outreach emails and WhatsApp messages?',
    a: 'Yes. For every prospect found, Runvax generates a personalized cold email, WhatsApp message, and formal proposal using AI. The messages are written in a natural tone, tailored to the specific business, and avoid generic AI-sounding language.',
  },
  {
    q: 'What industries can I search for leads?',
    a: 'Runvax covers 22+ industries including Restaurants & Eateries, Beauty Salons & Spas, Barbers & Hair Salons, Schools & Private Tutors, Clinics & Hospitals, Pharmacies, Real Estate Agencies, Hotels & Guesthouses, Event Centers, Law Firms, Auto Workshops, Fashion & Boutiques, Photography Studios, Gyms, Construction, Catering Services, Churches, Travel Agencies, Supermarkets, Laundry Services, Printing & Design Shops, and Accounting Firms. You can also type any custom industry.',
  },
  {
    q: 'Which countries does Runvax support?',
    a: 'Runvax supports Nigeria, Ghana, Kenya, South Africa, Uganda, Tanzania, Rwanda, Senegal, Cameroon, United States, United Kingdom, and Canada. Any city within these countries can be searched for business leads.',
  },
  {
    q: 'How do I find web design clients in Nigeria or Ghana?',
    a: 'Select Nigeria or Ghana from the country selector, enter any city (Lagos, Abuja, Port Harcourt, Accra, Kumasi, etc.), choose an industry, and Runvax returns local businesses in that city with their contact details and website status. Businesses with no website are your highest-priority leads.',
  },
  {
    q: 'What is the best lead generation tool for web designers?',
    a: 'Runvax is purpose-built for web designers, freelancers, and agencies who want to find local businesses without a website. Unlike generic B2B databases, it searches in real time for any city worldwide, flags no-website businesses automatically, and generates personalized cold outreach in one click.',
  },
  {
    q: 'How do I generate leads for a digital marketing agency?',
    a: 'Use Runvax to search any industry and city for businesses with low or no online presence. You can search multiple industries (restaurants, salons, law firms, etc.) across multiple cities, save prospects to a pipeline, and send AI-generated cold emails or WhatsApp messages directly from the platform.',
  },
  {
    q: 'Is Runvax free?',
    a: 'Yes. Runvax has a free plan with 5 searches per day and 20 results per search. Paid plans start at ₦9,999 per month (Pro) for 20 searches and 60 results, and ₦24,999 per month (Agency) for unlimited searches and results.',
  },
  {
    q: 'Can I find restaurant, salon, or law firm leads with Runvax?',
    a: 'Yes. Runvax includes dedicated categories for restaurants, beauty salons, barbers, law firms, clinics, gyms, real estate agencies, hotels, and 14+ more industries. Search any of these in any city to get a targeted list of leads with contact info and website status.',
  },
  {
    q: 'How does AI cold email generation work in Runvax?',
    a: "After finding a business, click Generate and Runvax's AI writes a personalized cold email using the business name, industry, location, and your agency details from your profile. The email is natural, conversational, avoids spam triggers, and ends with your full professional signature.",
  },
  {
    q: 'What is the best way to find local businesses without a website?',
    a: "The most efficient method is to use a tool like Runvax that queries Google's business index and automatically filters for listings with no website URL. This surfaces hundreds of potential clients per search that you can contact directly with a personalized pitch.",
  },
  {
    q: 'Can I manage prospects and track outreach in Runvax?',
    a: 'Yes. Runvax includes a built-in pipeline where you can save businesses, move them through stages (Found, Contacted, Interested, Proposal Sent, Won, Lost), add notes, set reminders, and track all outreach conversations in one place.',
  },
  {
    q: 'How much does Runvax cost?',
    a: 'Runvax has a free plan with no credit card required (5 searches/day). Pro is ₦9,999/month (~$6 USD / £5 GBP) with 20 searches/day and 60 results. Agency is ₦24,999/month (~$15 USD / £12 GBP) with unlimited searches, results, and AI calls.',
  },
  {
    q: 'Is Runvax available in the UK and USA?',
    a: 'Yes. Runvax supports cities in the United Kingdom (London, Manchester, Birmingham) and the United States (New York, Houston, Chicago, Los Angeles) in addition to Nigeria, Ghana, Kenya, South Africa, Uganda, Tanzania, Rwanda, Senegal, and Cameroon.',
  },
  {
    q: 'What is the difference between Runvax Free and Pro?',
    a: 'Free plan: 5 searches/day, 20 results/search, 15 AI messages/day — no credit card. Pro plan (₦9,999/month): 20 searches/day, 60 results/search, 200 AI calls/day. Agency plan (₦24,999/month): unlimited everything plus bulk email blast.',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
};

export default function FAQPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-gray-950 text-white">
        <div className="max-w-3xl mx-auto px-4 py-16">
          {/* Header */}
          <div className="mb-12 text-center">
            <span className="inline-block text-xs font-semibold tracking-widest uppercase text-indigo-400 mb-3">
              FAQ
            </span>
            <h1 className="text-4xl font-bold mb-4">Frequently Asked Questions</h1>
            <p className="text-gray-400 text-lg max-w-xl mx-auto">
              Everything you need to know about finding web design clients and growing your agency
              with Runvax.
            </p>
          </div>

          {/* FAQ list */}
          <div className="space-y-1">
            {faqs.map(({ q, a }, i) => (
              <details
                key={i}
                className="group border border-gray-800 rounded-xl overflow-hidden bg-gray-900/50 open:bg-gray-900"
              >
                <summary className="flex items-center justify-between gap-4 px-6 py-5 cursor-pointer list-none select-none hover:bg-gray-800/50 transition-colors">
                  <span className="font-semibold text-gray-100 text-base">{q}</span>
                  <span className="shrink-0 w-5 h-5 rounded-full border border-gray-700 flex items-center justify-center text-gray-400 group-open:rotate-45 transition-transform text-lg leading-none">
                    +
                  </span>
                </summary>
                <div className="px-6 pb-6 pt-1 text-gray-400 leading-relaxed text-sm">{a}</div>
              </details>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-16 rounded-2xl bg-indigo-900/30 border border-indigo-800/50 p-8 text-center">
            <h2 className="text-2xl font-bold mb-2">Ready to find your next client?</h2>
            <p className="text-gray-400 mb-6">
              Search any city, any industry. Free plan — no credit card needed.
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 transition-colors text-white font-semibold px-8 py-3 rounded-xl"
            >
              Start finding clients →
            </a>
          </div>

          {/* More links */}
          <div className="mt-10 flex flex-wrap gap-4 justify-center text-sm text-gray-500">
            <a href="/pricing" className="hover:text-indigo-400 transition-colors">
              Pricing
            </a>
            <a href="/blog" className="hover:text-indigo-400 transition-colors">
              Blog &amp; Guides
            </a>
            <a href="/privacy" className="hover:text-indigo-400 transition-colors">
              Privacy Policy
            </a>
            <a href="/terms" className="hover:text-indigo-400 transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
