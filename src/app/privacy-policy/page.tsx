import Link from 'next/link'

export const metadata = { title: 'Privacy Policy – Marvyn' }

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Nav */}
      <nav className="px-6 py-4 border-b border-white/5 flex items-center justify-between max-w-4xl mx-auto">
        <span className="font-bold text-lg tracking-tight">Marvyn</span>
        <Link href="/" className="text-sm text-[#555] hover:text-white transition-colors">← Back to home</Link>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-[#555] text-sm mb-10">Effective date: March 23, 2026</p>

        <div className="prose prose-invert max-w-none space-y-8 text-[#A0A0A0] leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. About Us</h2>
            <p>
              Marvyn is an AI Marketing OS SaaS product developed and operated by <strong className="text-white">Eleven Square Labs</strong>,
              a company registered in India with its office at 648/A OM Chambers, 4th Floor, Binnamangala 1st Stage,
              Indiranagar, Bangalore – 560038, India. You can reach us at{' '}
              <a href="mailto:support@elevensquarelabs.com" className="text-[#DA7756] hover:underline">support@elevensquarelabs.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Information We Collect</h2>
            <p>We collect the following categories of information:</p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li><strong className="text-white">Account information:</strong> Name, email address, and password when you register.</li>
              <li><strong className="text-white">Billing information:</strong> Payment details processed securely via Razorpay. We do not store card numbers.</li>
              <li><strong className="text-white">Connected platform data:</strong> When you connect Meta Ads, Google Ads, Google Search Console, or LinkedIn, we store OAuth tokens and fetch campaign/analytics data on your behalf.</li>
              <li><strong className="text-white">Brand profile data:</strong> Business name, product descriptions, competitors, and preferences you enter in the app.</li>
              <li><strong className="text-white">Usage data:</strong> Pages visited, features used, and interactions within the platform.</li>
              <li><strong className="text-white">Log data:</strong> IP address, browser type, device information, and timestamps.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>To provide and operate the Marvyn platform and its features.</li>
              <li>To generate AI-powered marketing insights, content, and recommendations.</li>
              <li>To process payments and manage your subscription.</li>
              <li>To send transactional emails (receipts, alerts, account notifications).</li>
              <li>To improve our product through aggregated, anonymised analytics.</li>
              <li>To respond to support requests and communicate with you.</li>
              <li>To comply with applicable legal obligations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Third-Party Services</h2>
            <p>We integrate with and share limited data with the following third-party services to deliver our product:</p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li><strong className="text-white">Anthropic (Claude AI):</strong> Used to generate marketing content and insights. Prompts may include your brand data.</li>
              <li><strong className="text-white">Google APIs:</strong> Google Ads and Google Search Console data is fetched using your authorised OAuth tokens.</li>
              <li><strong className="text-white">Meta APIs:</strong> Facebook and Instagram Ads data is fetched using your authorised access tokens.</li>
              <li><strong className="text-white">Razorpay:</strong> Payment processing for subscriptions.</li>
              <li><strong className="text-white">MongoDB Atlas:</strong> Database hosting for your account and platform data.</li>
              <li><strong className="text-white">DataForSEO:</strong> SEO data and crawling services.</li>
              <li><strong className="text-white">Microsoft Clarity:</strong> Session recordings and heatmaps for product improvement (if connected).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active or as needed to provide the service.
              If you cancel your subscription or delete your account, your personal data is deleted within 30 days,
              except where retention is required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Data Security</h2>
            <p>
              We use industry-standard security measures including encrypted connections (HTTPS), hashed passwords,
              and access controls to protect your data. OAuth tokens are stored encrypted and never shared with
              third parties beyond what is necessary to provide the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc list-inside space-y-2 mt-3">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request deletion of your data (&quot;right to be forgotten&quot;).</li>
              <li>Withdraw consent for data processing at any time.</li>
              <li>Export your data in a portable format.</li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, email us at{' '}
              <a href="mailto:support@elevensquarelabs.com" className="text-[#DA7756] hover:underline">support@elevensquarelabs.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Cookies</h2>
            <p>
              We use cookies and similar technologies for authentication, preferences, and analytics.
              See our <Link href="/cookie-policy" className="text-[#DA7756] hover:underline">Cookie Policy</Link> for full details.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Children&apos;s Privacy</h2>
            <p>
              Marvyn is not intended for use by individuals under the age of 18. We do not knowingly collect
              personal data from children.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this policy from time to time. We will notify you of significant changes by email
              or via an in-app notice. Continued use of the platform after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Contact</h2>
            <p>
              Eleven Square Labs<br />
              648/A OM Chambers, 4th Floor, Binnamangala 1st Stage,<br />
              Indiranagar, Bangalore – 560038, India<br />
              <a href="mailto:support@elevensquarelabs.com" className="text-[#DA7756] hover:underline">support@elevensquarelabs.com</a>
            </p>
          </section>

        </div>
      </main>

      <footer className="border-t border-white/5 py-8 text-center text-xs text-[#333] mt-12">
        <p>© 2026 Eleven Square Labs. All rights reserved.</p>
        <div className="flex items-center justify-center gap-4 mt-3">
          <Link href="/privacy-policy" className="hover:text-[#555] transition-colors">Privacy Policy</Link>
          <Link href="/terms-of-service" className="hover:text-[#555] transition-colors">Terms of Service</Link>
          <Link href="/cookie-policy" className="hover:text-[#555] transition-colors">Cookie Policy</Link>
          <Link href="/refund-policy" className="hover:text-[#555] transition-colors">Refund Policy</Link>
        </div>
      </footer>
    </div>
  )
}
