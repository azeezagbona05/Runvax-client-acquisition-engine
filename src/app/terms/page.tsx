import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8">
        <Link href="/" className="text-purple-400 text-sm hover:underline">← Back to app</Link>
        <h1 className="text-3xl font-black text-white mt-4 mb-1">Terms of Service</h1>
        <p className="text-gray-500 text-sm">Last updated: June 2025</p>
      </div>

      <div className="prose prose-invert max-w-none space-y-8 text-gray-300 text-sm leading-relaxed">

        <section>
          <h2 className="text-white font-bold text-lg mb-3">1. Acceptance of Terms</h2>
          <p>By accessing or using ProspectAI ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">2. Description of Service</h2>
          <p>ProspectAI is a SaaS platform that helps web developers and digital agencies in Nigeria discover local businesses without websites, generate AI-powered outreach, proposals, and website prompts, and manage their sales pipeline.</p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">3. User Accounts</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>You must provide accurate information when creating an account.</li>
            <li>You are responsible for maintaining the confidentiality of your password.</li>
            <li>You must verify your email address to access full platform features.</li>
            <li>Accounts may not be shared or transferred to another person.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">4. Subscription Plans & Payments</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Free accounts have limited daily AI usage. Pro and Agency plans unlock higher limits.</li>
            <li>Payments are processed by Paystack. By subscribing, you agree to Paystack&apos;s terms.</li>
            <li>Subscriptions renew monthly unless cancelled before the renewal date.</li>
            <li>Refunds are not provided for partial billing periods.</li>
            <li>We reserve the right to change pricing with 14 days&apos; notice to subscribers.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">5. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 space-y-1.5 mt-2">
            <li>Use the Service to send unsolicited bulk messages or spam.</li>
            <li>Scrape or harvest data beyond your permitted plan limits.</li>
            <li>Reverse-engineer, copy, or resell the Service or its AI outputs.</li>
            <li>Use the Service for any unlawful purpose under Nigerian or applicable law.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">6. AI-Generated Content</h2>
          <p>AI outputs (outreach emails, proposals, prompts) are generated automatically and may not always be accurate, appropriate, or legally sufficient. You are solely responsible for reviewing and using AI-generated content before sending it to third parties.</p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">7. Data & Privacy</h2>
          <p>Your use of the Service is also governed by our <Link href="/privacy" className="text-purple-400 hover:underline">Privacy Policy</Link>. We store your account data, prospect data, and AI usage records to provide the Service. We do not sell your personal data.</p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">8. Termination</h2>
          <p>We may suspend or terminate your account at any time for violations of these Terms. You may cancel your account at any time from your settings page. Upon termination, your data will be deleted within 30 days.</p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">9. Limitation of Liability</h2>
          <p>The Service is provided &quot;as is&quot; without warranty. We are not liable for any indirect, incidental, or consequential damages arising from your use of the Service, including loss of business or revenue.</p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">10. Governing Law</h2>
          <p>These Terms are governed by the laws of the Federal Republic of Nigeria. Any disputes shall be resolved in Nigerian courts.</p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">11. Contact</h2>
          <p>For questions about these Terms, contact us at <a href="mailto:info@beamai.net" className="text-purple-400 hover:underline">info@beamai.net</a>.</p>
        </section>
      </div>
    </div>
  );
}
