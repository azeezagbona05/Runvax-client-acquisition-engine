import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8">
        <Link href="/" className="text-purple-400 text-sm hover:underline">← Back to app</Link>
        <h1 className="text-3xl font-black text-white mt-4 mb-1">Privacy Policy</h1>
        <p className="text-gray-500 text-sm">Last updated: August 2026</p>
      </div>

      <div className="space-y-8 text-gray-300 text-sm leading-relaxed">

        <section>
          <h2 className="text-white font-bold text-lg mb-3">1. Who We Are</h2>
          <p>Runvax is operated by Runvax. We are based in Lagos, Nigeria. Contact: <a href="mailto:info@runvax.com" className="text-purple-400 hover:underline">info@runvax.com</a>.</p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">2. What Data We Collect</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong className="text-white">Account data:</strong> name, email address, hashed password, subscription plan.</li>
            <li><strong className="text-white">Profile data:</strong> business name, WhatsApp number, city, SMTP credentials (encrypted at rest), bank details you choose to store.</li>
            <li><strong className="text-white">Prospect data:</strong> businesses you save, notes, reminders, outreach history, pipeline stage.</li>
            <li><strong className="text-white">Outreach signals:</strong> when you send a business a message through Runvax, we record which business was contacted and when, so we can show all users how heavily a lead has already been contacted. See section 5.</li>
            <li><strong className="text-white">Usage data:</strong> AI feature usage counts, daily outreach logs, search history (industry/location only — no personal data of prospects).</li>
            <li><strong className="text-white">Payment data:</strong> transaction references and plan status via Paystack. We do not store card numbers.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">3. How We Use Your Data</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>To provide and operate the Service.</li>
            <li>To personalise AI-generated content with your profile (name, business, city, etc.).</li>
            <li>To send transactional emails (verification, password reset, email outreach you trigger).</li>
            <li>To enforce plan limits and process subscription payments via Paystack.</li>
            <li>To improve the Service (aggregate, anonymised analytics only).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">4. Data Sharing</h2>
          <p>We do not sell your personal data. We share data only with:</p>
          <ul className="list-disc pl-5 space-y-1.5 mt-2">
            <li><strong className="text-white">Paystack</strong> — to process payments.</li>
            <li><strong className="text-white">OpenAI</strong> — your prompts are sent to OpenAI to generate AI content. OpenAI&apos;s API data policy applies.</li>
            <li><strong className="text-white">Google Maps API</strong> — search queries (industry + location) are sent to Google to fetch business listings.</li>
            <li><strong className="text-white">Your SMTP provider</strong> — when you send emails through the platform, they pass through the SMTP server you configure.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">5. Shared Outreach Data (Lead Saturation)</h2>
          <p>
            Runvax shows every user how many other Runvax users have already contacted a business, so you can
            judge whether a lead is worth pursuing. This works because all accounts contribute to it.
          </p>
          <p className="mt-2"><strong className="text-white">What is shared with other users:</strong></p>
          <ul className="list-disc pl-5 space-y-1.5 mt-2">
            <li>The public identifier of the business (its Google Places listing).</li>
            <li>A count of how many distinct users have messaged it.</li>
            <li>How recently the most recent message was sent.</li>
          </ul>
          <p className="mt-3"><strong className="text-white">What is never shared with other users:</strong></p>
          <ul className="list-disc pl-5 space-y-1.5 mt-2">
            <li>Your name, email address, business name or any other identifying detail.</li>
            <li>The content of your messages, your notes, or your pipeline.</li>
            <li>Which specific users make up a count. The figure is anonymous and cannot be traced back to individuals.</li>
          </ul>
          <p className="mt-3">
            Contacting the same business more than once still counts as one user, and counts are only ever
            displayed in aggregate. This applies to all accounts on all plans — every user both contributes to
            and benefits from the same data. If you delete your account, your contributions are removed from
            these counts.
          </p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">6. Data Retention</h2>
          <p>We retain your data for as long as your account is active. If you delete your account, your data is permanently deleted within 30 days. Payment records may be retained for 7 years for legal compliance.</p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">7. Security</h2>
          <p>Passwords are hashed with bcrypt. SMTP passwords are stored encrypted. All traffic is encrypted via HTTPS/TLS. We use Hepsia cloud hosting (UK) with daily backups.</p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">8. Your Rights</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong className="text-white">Access:</strong> Request a copy of your data.</li>
            <li><strong className="text-white">Correction:</strong> Update your profile at any time in Settings.</li>
            <li><strong className="text-white">Deletion:</strong> Request account deletion via email.</li>
            <li><strong className="text-white">Portability:</strong> Export your prospects as CSV from the Pipeline page.</li>
          </ul>
          <p className="mt-2">To exercise these rights, email <a href="mailto:info@runvax.com" className="text-purple-400 hover:underline">info@runvax.com</a>.</p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">9. Cookies</h2>
          <p>We use a single session cookie (NextAuth) to keep you signed in. We do not use tracking or advertising cookies.</p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">10. Changes to This Policy</h2>
          <p>We may update this policy. Significant changes will be notified via email. Continued use of the Service after changes constitutes acceptance.</p>
        </section>

        <section>
          <h2 className="text-white font-bold text-lg mb-3">11. Contact</h2>
          <p>Privacy questions: <a href="mailto:info@runvax.com" className="text-purple-400 hover:underline">info@runvax.com</a></p>
        </section>
      </div>

      <div className="mt-8 pt-6 border-t border-white/8 text-xs text-gray-600">
        Also read our <Link href="/terms" className="text-purple-400 hover:underline">Terms of Service</Link>.
      </div>
    </div>
  );
}
